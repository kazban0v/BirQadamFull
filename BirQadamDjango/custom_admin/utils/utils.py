"""
✅ ИСПРАВЛЕНИЕ СредП-5: Вспомогательные функции для избежания дублирования кода
"""
from typing import Any, Dict, Optional, Tuple, Type, TypeVar
from django.http import JsonResponse
from django.db import transaction, models
from core.models import User, Project, Task, Photo
from core.utils.audit_logger import log_audit_action, AuditActions
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=models.Model)

def get_object_or_404_json(model: Type[T], error_message: str = "Объект не найден", **kwargs: Any) -> Tuple[Optional[T], Optional[JsonResponse]]:
    """
    Получить объект или вернуть JSON 404 ошибку
    
    Args:
        model: Django модель
        error_message: Сообщение об ошибке
        **kwargs: Фильтры для поиска объекта
        
    Returns:
        tuple: (object, None) если найден, (None, JsonResponse) если не найден
    """
    try:
        obj = model.objects.get(**kwargs)
        return obj, None
    except model.DoesNotExist:  # type: ignore[attr-defined]
        logger.warning(f"{model.__name__} not found with filters: {kwargs}")
        return None, JsonResponse({
            'error': error_message
        }, status=404)
    except Exception as e:
        logger.error(f"Error getting {model.__name__}: {e}")
        return None, JsonResponse({
            'error': 'Ошибка сервера'
        }, status=500)


def check_user_permission(user: User, required_role: Optional[str] = None, must_be_approved: bool = False) -> Tuple[bool, Optional[JsonResponse]]:  # type: ignore[no-any-unimported]
    """
    Проверить права пользователя
    
    Args:
        user: Объект пользователя
        required_role: Требуемая роль ('volunteer' или 'organizer')
        must_be_approved: Требуется ли одобрение администратора
        
    Returns:
        tuple: (True, None) если проверка пройдена, (False, JsonResponse) если нет
    """
    if not user.is_authenticated:
        return False, JsonResponse({
            'error': 'Требуется авторизация'
        }, status=401)
    
    if required_role and user.role != required_role:
        return False, JsonResponse({
            'error': f'Доступ только для {required_role}'
        }, status=403)
    
    if must_be_approved and not user.is_approved:
        return False, JsonResponse({
            'error': 'Ваш аккаунт еще не одобрен администратором'
        }, status=403)
    
    return True, None


def serialize_user(user: User) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    """Сериализация пользователя"""
    return {
        'id': user.id,  # type: ignore[attr-defined]
        'name': user.name or user.username,
        'email': user.email,
        'role': user.role,
        'rating': float(user.rating) if user.rating else 0.0,
        'is_approved': user.is_approved,
        'avatar': user.avatar.url if user.avatar else None,
        'phone_number': user.phone_number,
        'telegram_id': user.telegram_id,
        'organization_name': user.organization_name if hasattr(user, 'organization_name') else None,
    }


def serialize_project(project: Project, include_creator: bool = True) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    """Сериализация проекта"""
    from core.models import VolunteerProject  # type: ignore[attr-defined]
    volunteers_count = VolunteerProject.objects.filter(project=project, is_active=True).count() if hasattr(project, 'volunteers') else 0  # type: ignore[attr-defined]
    
    data = {
        'id': project.id,  # type: ignore[attr-defined]
        'title': project.title,
        'description': project.description,
        'city': project.city,
        'volunteer_type': project.volunteer_type,
        'status': project.status,
        'created_at': project.created_at.isoformat() if project.created_at else None,
        'volunteers_count': volunteers_count,
        'image': project.image.url if hasattr(project, 'image') and project.image else None,  # type: ignore[attr-defined]
    }
    
    if include_creator:
        data['creator'] = serialize_user(project.creator)
    
    return data


def serialize_task(task: Task, include_project: bool = True) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    """Сериализация задачи"""
    data = {
        'id': task.id,  # type: ignore[attr-defined]
        'text': task.text,
        'status': task.status,
        'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
        'start_time': task.start_time.isoformat() if task.start_time else None,
        'end_time': task.end_time.isoformat() if task.end_time else None,
        'created_at': task.created_at.isoformat() if task.created_at else None,
        'task_image': task.task_image.url if task.task_image else None,
    }
    
    if include_project:
        data['project'] = serialize_project(task.project, include_creator=False)
    
    return data


def serialize_photo(photo: Photo, include_task: bool = True, include_volunteer: bool = True) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    """Сериализация фотоотчёта"""
    data = {
        'id': photo.id,  # type: ignore[attr-defined]
        'image': photo.image.url if photo.image else None,
        'status': photo.status,
        'volunteer_comment': photo.volunteer_comment,
        'organizer_feedback': photo.organizer_feedback if hasattr(photo, 'organizer_feedback') else None,  # type: ignore[attr-defined]
        'rating': photo.rating,
        'created_at': photo.created_at.isoformat() if hasattr(photo, 'created_at') and photo.created_at else None,  # type: ignore[attr-defined]
        'approved_at': photo.approved_at.isoformat() if hasattr(photo, 'approved_at') and photo.approved_at else None,  # type: ignore[attr-defined]
    }
    
    if include_volunteer and photo.volunteer:
        data['volunteer'] = serialize_user(photo.volunteer)
    
    if include_task and photo.task:
        data['task'] = serialize_task(photo.task, include_project=True)
    
    return data


@transaction.atomic
def approve_photo_transaction(photo_id: int, rating: int, feedback: str, organizer: User) -> Tuple[bool, Optional[Dict[str, Any]], Optional[JsonResponse]]:  # type: ignore[no-any-unimported]
    """
    Одобрить фотоотчёт в транзакции
    
    Args:
        photo_id: ID фотоотчёта
        rating: Оценка (1-5)
        feedback: Отзыв организатора
        organizer: Пользователь-организатор
        
    Returns:
        tuple: (success: bool, data: dict or None, error_response: JsonResponse or None)
    """
    try:
        # Получаем фото с блокировкой
        photo = Photo.objects.select_for_update().get(pk=photo_id)
        
        if photo.status == 'approved':
            return False, None, JsonResponse({
                'error': 'Фотоотчёт уже одобрен'
            }, status=400)
        
        # Одобряем фото
        photo.approve(rating=rating, feedback=feedback)
        
        # Аудит
        volunteer_id = None
        if photo.volunteer and hasattr(photo.volunteer, 'id'):
            volunteer_id = photo.volunteer.id  # type: ignore[attr-defined]
        log_audit_action(
            AuditActions.PHOTO_APPROVED,
            user=organizer,
            photo_id=photo_id,
            rating=rating,
            volunteer_id=volunteer_id
        )
        
        return True, serialize_photo(photo), None
        
    except Photo.DoesNotExist:
        return False, None, JsonResponse({'error': 'Фотоотчёт не найден'}, status=404)
    except Exception as e:
        logger.error(f"Error approving photo {photo_id}: {e}")
        return False, None, JsonResponse({'error': f'Ошибка одобрения: {str(e)}'}, status=500)


def reject_photo_transaction(photo_id: int, feedback: str, organizer: User) -> Tuple[bool, Optional[Dict[str, Any]], Optional[JsonResponse]]:  # type: ignore[no-any-unimported]
    """
    Отклонить фотоотчёт в транзакции
    
    Args:
        photo_id: ID фотоотчёта
        feedback: Причина отклонения
        organizer: Пользователь-организатор
        
    Returns:
        tuple: (success: bool, error_response: JsonResponse or None)
    """
    try:
        with transaction.atomic():
            photo = Photo.objects.select_for_update().get(pk=photo_id)
            
            if photo.status == 'rejected':
                return False, None, JsonResponse({
                    'error': 'Фотоотчёт уже отклонён'
                }, status=400)
            
            photo.reject(feedback=feedback)
            
            # Аудит
            volunteer_id = None
            if photo.volunteer and hasattr(photo.volunteer, 'id'):
                volunteer_id = photo.volunteer.id  # type: ignore[attr-defined]
            log_audit_action(
                AuditActions.PHOTO_REJECTED,
                user=organizer,
                photo_id=photo_id,
                feedback=feedback,
                volunteer_id=volunteer_id
            )
            
        return True, None, None
        
    except Photo.DoesNotExist:  # type: ignore[attr-defined]
        return False, None, JsonResponse({'error': 'Фотоотчёт не найден'}, status=404)
    except Exception as e:
        logger.error(f"Error rejecting photo {photo_id}: {e}")
        return False, None, JsonResponse({'error': f'Ошибка отклонения: {str(e)}'}, status=500)


def paginate_queryset(queryset: Any, page: int, page_size: int = 20) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    """
    Пагинация queryset
    
    Args:
        queryset: Django QuerySet
        page: Номер страницы (начиная с 1)
        page_size: Размер страницы
        
    Returns:
        dict: {'items': list, 'page': int, 'total_pages': int, 'total_count': int}
    """
    from django.core.paginator import Paginator, EmptyPage
    
    try:
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        return {
            'items': list(page_obj),
            'page': page_obj.number,
            'total_pages': paginator.num_pages,
            'total_count': paginator.count,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous(),
        }
    except EmptyPage:
        return {
            'items': [],
            'page': page,
            'total_pages': 0,
            'total_count': 0,
            'has_next': False,
            'has_previous': False,
        }


def handle_api_error(e: Exception, default_message: str = "Ошибка сервера", status_code: int = 500) -> JsonResponse:
    """
    Обработка ошибок API
    
    Args:
        e: Exception
        default_message: Сообщение по умолчанию
        status_code: HTTP статус код
        
    Returns:
        JsonResponse
    """
    logger.error(f"API Error: {e}", exc_info=True)
    return JsonResponse({
        'error': default_message,
        'details': str(e) if logger.level <= logging.DEBUG else None
    }, status=status_code)



