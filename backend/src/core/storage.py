"""
Document storage abstraction.

Defines a storage-agnostic interface (``StorageBackend``) plus a local-disk
implementation. Swapping to S3 later means adding an ``S3StorageBackend`` and
changing the binding in ``get_storage`` — nothing else in the app changes.
"""

import asyncio
import uuid
from pathlib import Path
from typing import AsyncIterator, Protocol, runtime_checkable

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile

from src.core.config import UPLOAD_DIR, S3_BUCKET_NAME

_CHUNK_SIZE = 1024 * 1024


@runtime_checkable
class StorageBackend(Protocol):
    """Contract every storage backend must satisfy."""

    async def save(self, file: UploadFile, project_id: str) -> str:
        """Persist ``file`` and return the stored path/key."""
        ...

    def get(self, path: str) -> AsyncIterator[bytes]:
        """Return an async byte stream for the stored object at ``path``."""
        ...

    def exists(self, path: str) -> bool:
        """Return whether a stored object exists at ``path``."""
        ...

    def delete(self, path: str) -> None:
        """Remove the stored object at ``path``."""
        ...


class LocalStorageBackend:
    """Stores files on the local filesystem under a base directory."""

    def __init__(self, base_dir: str) -> None:
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile, project_id: str) -> str:
        ext = Path(file.filename or "").suffix
        stored_name = f"{uuid.uuid4().hex}{ext}"
        dest = self.base / stored_name
        with dest.open("wb") as out:
            while chunk := await file.read(_CHUNK_SIZE):
                out.write(chunk)
        return stored_name

    async def get(self, path: str) -> AsyncIterator[bytes]:
        full = self._resolve(path)
        if not full.is_file():
            raise FileNotFoundError(path)
        with full.open("rb") as src:
            while chunk := src.read(_CHUNK_SIZE):
                yield chunk

    def exists(self, path: str) -> bool:
        try:
            return self._resolve(path).is_file()
        except ValueError:
            # An invalid/unresolvable key can't refer to a stored object.
            return False

    def delete(self, path: str) -> None:
        self._resolve(path).unlink(missing_ok=True)

    def _resolve(self, path: str) -> Path:
        # Confine access to the base directory; reject path traversal.
        full = (self.base / path).resolve()
        if not full.is_relative_to(self.base.resolve()):
            raise ValueError("Invalid storage path")
        return full


class S3StorageBackend:
    """Stores files in an AWS S3 bucket."""

    def __init__(self, bucket: str) -> None:
        self.bucket = bucket
        self._s3 = boto3.client("s3")

    async def save(self, file: UploadFile, project_id: str) -> str:
        ext = Path(file.filename or "").suffix
        key = f"original/{project_id}/{uuid.uuid4().hex}{ext}"
        body = await file.read()
        await asyncio.to_thread(
            self._s3.put_object, Bucket=self.bucket, Key=key, Body=body
        )
        return key

    async def get(self, path: str) -> AsyncIterator[bytes]:
        try:
            obj = await asyncio.to_thread(
                self._s3.get_object, Bucket=self.bucket, Key=path
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(path)
            raise
        stream = obj["Body"]
        try:
            while chunk := await asyncio.to_thread(stream.read, _CHUNK_SIZE):
                yield chunk
        finally:
            stream.close()

    def exists(self, path: str) -> bool:
        try:
            self._s3.head_object(Bucket=self.bucket, Key=path)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            raise

    def delete(self, path: str) -> None:
        self._s3.delete_object(Bucket=self.bucket, Key=path)


def get_storage() -> StorageBackend:
    """FastAPI dependency that provides the active storage backend.

    Uses ``S3StorageBackend`` when ``S3_BUCKET_NAME`` is set, otherwise falls
    back to ``LocalStorageBackend`` for local development.
    """
    if S3_BUCKET_NAME:
        return S3StorageBackend(S3_BUCKET_NAME)
    return LocalStorageBackend(UPLOAD_DIR)
