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

