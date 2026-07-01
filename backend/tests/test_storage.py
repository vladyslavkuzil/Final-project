"""Unit tests for the real LocalStorageBackend.

The document endpoint tests swap in an in-memory storage double, so the actual
disk implementation — saving bytes, reading them back, deleting, and the
path-traversal guard — is exercised only here.

The storage methods are "async" (they can pause for disk I/O), so they can't be
called like normal functions. The two helpers below run them and hand back a
plain result, which keeps each test a simple Arrange / Act / Assert.
"""

import asyncio
from io import BytesIO

import pytest
from fastapi import UploadFile

from src.core.storage import LocalStorageBackend


def save_file(backend: LocalStorageBackend, content: bytes, filename: str) -> str:
    """Save `content` through the backend and return the stored key.

    Wraps the file bytes in an UploadFile (what a real HTTP upload looks like)
    and runs the async save() to completion.
    """
    upload = UploadFile(filename=filename, file=BytesIO(content))
    return asyncio.run(backend.save(upload))


def read_file(backend: LocalStorageBackend, key: str) -> bytes:
    """Read a stored file back and return all of its bytes.

    get() streams the file in chunks, so we collect the chunks and join them.
    """

    async def _read() -> bytes:
        chunks = [chunk async for chunk in backend.get(key)]
        return b"".join(chunks)

    return asyncio.run(_read())


def test_save_then_get_round_trips_bytes(tmp_path):
    # Arrange — a storage backend that writes into a temporary folder
    backend = LocalStorageBackend(str(tmp_path))

    # Act — save some content, then read it back
    key = save_file(backend, b"hello bytes", "report.pdf")
    contents = read_file(backend, key)

    # Assert — same content comes back, under an opaque key that keeps the extension
    assert contents == b"hello bytes"
    assert key.endswith(".pdf")
    assert key != "report.pdf"


def test_exists_reflects_presence(tmp_path):
    # Arrange — a backend with one saved file
    backend = LocalStorageBackend(str(tmp_path))
    key = save_file(backend, b"data", "a.txt")

    # Act / Assert — exists() tracks the file through its lifecycle
    assert backend.exists(key) is True
    assert backend.exists("never-saved.pdf") is False
    backend.delete(key)
    assert backend.exists(key) is False


def test_delete_removes_file(tmp_path):
    # Arrange — a saved file
    backend = LocalStorageBackend(str(tmp_path))
    key = save_file(backend, b"data", "x.txt")

    # Act — delete it
    backend.delete(key)

    # Assert — reading it now fails because it's gone
    with pytest.raises(FileNotFoundError):
        read_file(backend, key)


def test_get_missing_path_raises(tmp_path):
    # Arrange
    backend = LocalStorageBackend(str(tmp_path))

    # Act / Assert — reading a key that was never saved fails
    with pytest.raises(FileNotFoundError):
        read_file(backend, "does-not-exist.pdf")


def test_delete_missing_path_is_noop(tmp_path):
    # Arrange
    backend = LocalStorageBackend(str(tmp_path))

    # Act / Assert — deleting something that isn't there must not raise
    backend.delete("does-not-exist.pdf")


def test_path_traversal_is_rejected(tmp_path):
    # Arrange
    backend = LocalStorageBackend(str(tmp_path))

    # Act / Assert — keys that try to escape the storage folder are refused
    with pytest.raises(ValueError):
        backend.delete("../escape.pdf")
    with pytest.raises(ValueError):
        read_file(backend, "../escape.pdf")
