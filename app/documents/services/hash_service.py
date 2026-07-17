"""
app/documents/services/hash_service.py
----------------------------------------
SHA-256 streaming computation — never loads full file into RAM.
"""

import hashlib


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of bytes. For large files, feed chunks."""
    return hashlib.sha256(data).hexdigest()


def compute_sha256_stream(chunks) -> str:
    """
    Compute SHA-256 from an iterable of byte chunks.
    Usage:
        hasher = hashlib.sha256()
        for chunk in chunks:
            hasher.update(chunk)
        return hasher.hexdigest()
    """
    h = hashlib.sha256()
    for chunk in chunks:
        h.update(chunk)
    return h.hexdigest()
