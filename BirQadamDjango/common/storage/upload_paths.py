"""
File upload path functions
Функции для определения путей загрузки файлов
"""
import os
from django.utils import timezone
from typing import Any


def photo_upload_path(instance: Any, filename: str) -> str:
    """Путь для загрузки фотоотчетов"""
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('photos', date, filename)


def task_image_upload_path(instance: Any, filename: str) -> str:
    """Путь для загрузки изображений задач"""
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('tasks', date, filename)


def project_cover_upload_path(instance: Any, filename: str) -> str:
    """Путь для загрузки обложек проектов"""
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('projects', date, filename)


def volunteer_document_upload_path(instance: Any, filename: str) -> str:
    """Путь для загрузки документов волонтёра."""
    import uuid
    ext = os.path.splitext(filename)[1].lower()
    volunteer_id = instance.volunteer_id
    if not volunteer_id and getattr(instance, 'volunteer', None):
        volunteer_id = instance.volunteer.pk
    doc_type = instance.doc_type or 'unknown'
    safe_name = f'{doc_type}_{uuid.uuid4().hex[:12]}{ext}'
    return os.path.join('volunteer_docs', str(volunteer_id), doc_type, safe_name)

