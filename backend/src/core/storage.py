"""
Document storage abstraction.

Defines a storage-agnostic interface (``StorageBackend``) plus a local-disk
implementation. Swapping to S3 later means adding an ``S3StorageBackend`` and
changing the binding in ``get_storage`` — nothing else in the app changes.
"""

import uuid
from pathlib import Path
from typing import AsyncIterator, Protocol, runtime_checkable

from fastapi import UploadFile

from src.core.config import UPLOAD_DIR

_CHUNK_SIZE = 1024 * 1024


@runtime_checkable
class StorageBackend(Protocol):
    """Contract every storage backend must satisfy."""

    async def save(self, file: UploadFile) -> str:
        """Persist ``file`` and return the stored path/key."""
        ...

    def get(self, path: str) -> AsyncIterator[bytes]:
        """Return an async byte stream for the stored object at ``path``."""
        ...

    def delete(self, path: str) -> None:
        """Remove the stored object at ``path``."""
        ...


class LocalStorageBackend:
    """Stores files on the local filesystem under a base directory."""

    def __init__(self, base_dir: str) -> None:
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile) -> str:
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

    def delete(self, path: str) -> None:
        self._resolve(path).unlink(missing_ok=True)

    def _resolve(self, path: str) -> Path:
        # Confine access to the base directory; reject path traversal.
        full = (self.base / path).resolve()
        if not full.is_relative_to(self.base.resolve()):
            raise ValueError("Invalid storage path")
        return full


def get_storage() -> StorageBackend:
    """FastAPI dependency that provides the active storage backend.

    Swap the returned implementation (e.g. ``S3StorageBackend``) to change
    where documents are stored.
    """
    return LocalStorageBackend(UPLOAD_DIR)
