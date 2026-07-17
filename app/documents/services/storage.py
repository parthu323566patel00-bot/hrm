"""
app/documents/services/storage.py
-----------------------------------
StorageProvider ABC + LocalStorageProvider implementation.

Switching to MinIO/S3/Azure only requires implementing StorageProvider.
"""

import aiofiles
import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator

STORAGE_ROOT = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "uploads", "documents"
)


class StorageProvider(ABC):
    @abstractmethod
    async def save(self, relative_path: str, data: bytes) -> str:
        """Persist data and return the stored path."""

    @abstractmethod
    async def read_bytes(self, relative_path: str) -> bytes:
        """Return full file bytes."""

    @abstractmethod
    async def delete(self, relative_path: str) -> None:
        """Remove stored file."""

    @abstractmethod
    async def exists(self, relative_path: str) -> bool:
        """Check if file exists."""


class LocalStorageProvider(StorageProvider):
    """Stores files on local disk under uploads/documents/."""

    def _abs(self, relative_path: str) -> str:
        # Prevent path traversal
        safe = os.path.normpath(relative_path).lstrip(os.sep)
        return os.path.join(STORAGE_ROOT, safe)

    async def save(self, relative_path: str, data: bytes) -> str:
        abs_path = self._abs(relative_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        async with aiofiles.open(abs_path, "wb") as f:
            await f.write(data)
        return relative_path

    async def read_bytes(self, relative_path: str) -> bytes:
        abs_path = self._abs(relative_path)
        async with aiofiles.open(abs_path, "rb") as f:
            return await f.read()

    async def delete(self, relative_path: str) -> None:
        abs_path = self._abs(relative_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)

    async def exists(self, relative_path: str) -> bool:
        return os.path.exists(self._abs(relative_path))


# Singleton — swap this for a different provider in production
storage_provider: StorageProvider = LocalStorageProvider()
