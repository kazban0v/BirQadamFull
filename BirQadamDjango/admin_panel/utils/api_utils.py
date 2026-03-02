"""
Утилиты для API views: валидация, обработка ошибок
"""
import logging
from typing import Any, Dict, List, Tuple, Optional
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> Tuple[bool, Optional[Response]]:
    """
    Проверяет наличие обязательных полей в данных

    Args:
        data: словарь с данными
        required_fields: список обязательных полей

    Returns:
        tuple: (is_valid, error_response or None)
    """
    missing_fields = []
    for field in required_fields:
        if field not in data or data.get(field) in [None, '', []]:
            missing_fields.append(field)

    if missing_fields:
        return False, Response({
            'error': f'Отсутствуют обязательные поля: {", ".join(missing_fields)}'
        }, status=status.HTTP_400_BAD_REQUEST)

    return True, None


def validate_project_data(data: Dict[str, Any]) -> Tuple[bool, Optional[Response]]:
    """Валидация данных для создания/обновления проекта"""
    required = ['title', 'description', 'city']
    is_valid, error_response = validate_required_fields(data, required)

    if not is_valid:
        return is_valid, error_response

    # Валидация длины полей
    if len(data.get('title', '')) > 255:
        return False, Response({
            'error': 'Название проекта не должно превышать 255 символов'
        }, status=status.HTTP_400_BAD_REQUEST)

    if len(data.get('description', '')) < 10:
        return False, Response({
            'error': 'Описание проекта должно содержать минимум 10 символов'
        }, status=status.HTTP_400_BAD_REQUEST)

    return True, None


def validate_task_data(data: Dict[str, Any]) -> Tuple[bool, Optional[Response]]:
    """Валидация данных для создания/обновления задачи"""
    required = ['text']
    is_valid, error_response = validate_required_fields(data, required)

    if not is_valid:
        return is_valid, error_response

    if len(data.get('text', '')) < 5:
        return False, Response({
            'error': 'Текст задания должен содержать минимум 5 символов'
        }, status=status.HTTP_400_BAD_REQUEST)

    return True, None


def handle_api_exception(e: Exception, action: str = "выполнения операции") -> Response:
    """
    Обработчик исключений для API

    Args:
        e: исключение
        action: описание действия для логирования

    Returns:
        Response: ответ с ошибкой
    """
    error_message = "Произошла ошибка при " + action

    if isinstance(e, (DjangoValidationError, ValidationError)):
        logger.warning(f"Validation error during {action}: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

    logger.error(f"Unexpected error during {action}: {e}", exc_info=True)
    return Response({
        'error': error_message
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
