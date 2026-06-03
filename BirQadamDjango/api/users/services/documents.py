"""Helpers for volunteer document upload/download."""
from __future__ import annotations

import mimetypes
import os
from typing import BinaryIO


def _read_head(file_obj: BinaryIO, size: int = 16) -> bytes:
    pos = file_obj.tell()
    try:
        file_obj.seek(0)
        return file_obj.read(size)
    finally:
        file_obj.seek(pos)


def validate_volunteer_document_upload(uploaded) -> str | None:
    """
    Validate uploaded volunteer document by magic bytes.
    Returns error message or None if valid.
    """
    ext = os.path.splitext(uploaded.name)[1].lower()
    head = _read_head(uploaded)

    if ext == '.pdf':
        if not head.startswith(b'%PDF-'):
            return 'Файл не является корректным PDF. Сохраните документ как PDF и загрузите снова.'
    elif ext in ('.jpg', '.jpeg'):
        if not head.startswith(b'\xff\xd8\xff'):
            return 'Файл не является корректным изображением JPEG.'
    elif ext == '.png':
        if not head.startswith(b'\x89PNG\r\n\x1a\n'):
            return 'Файл не является корректным изображением PNG.'
    else:
        return 'Допустимые форматы: PDF, JPG, PNG.'

    return None


def detect_volunteer_document_content_type(file_obj: BinaryIO, original_name: str) -> str:
    """Detect MIME type from file contents, not only the original filename."""
    head = _read_head(file_obj)

    if head.startswith(b'%PDF-'):
        return 'application/pdf'
    if head.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'

    # Text saved with .pdf extension — don't trust filename here.
    try:
        head.decode('utf-8')
        return 'text/plain; charset=utf-8'
    except UnicodeDecodeError:
        pass

    guessed = mimetypes.guess_type(original_name)[0]
    if guessed:
        return guessed

    return 'application/octet-stream'
