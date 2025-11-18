"""
📨 API Views для массовых рассылок (Email/Push)
"""
import logging
from typing import Any
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.request import Request

from core.models import BulkNotification, NotificationTemplate, NotificationRecipient, User
from core.utils.api_errors import APIError

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_bulk_notification(request: Request) -> Response:
    """
    Создание массовой рассылки
    
    POST /custom-admin/api/v1/bulk-notifications/create/
    {
        "notification_type": "push",  // "email", "push", "both"
        "template_id": 1,  // опционально
        "subject": "Тема сообщения",
        "message": "Текст сообщения с {{name}} {{city}} {{rating}}",
        "filter_role": "all",  // "all", "volunteer", "organizer"
        "filter_city": "Алматы",  // опционально
        "filter_rating_min": 0,
        "filter_rating_max": 100,
        "filter_active_days": 30,
        "scheduled_at": "2025-10-26T10:00:00Z"  // опционально
    }
    """
    try:
        # Проверка прав (DRF уже проверил авторизацию)
        is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
        is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
        if not is_staff and not is_admin:
            return APIError.forbidden("Только администраторы могут создавать рассылки")
        
        # Валидация
        notification_type = request.data.get('notification_type', 'push')
        subject = request.data.get('subject')
        message = request.data.get('message')
        
        if not subject:
            return APIError.missing_fields(['subject'])
        if not message:
            return APIError.missing_fields(['message'])
        
        # Безопасное преобразование числовых параметров
        try:
            filter_rating_min = int(request.data.get('filter_rating_min', 0))
        except (ValueError, TypeError):
            filter_rating_min = 0
        
        try:
            filter_rating_max = int(request.data.get('filter_rating_max', 100))
        except (ValueError, TypeError):
            filter_rating_max = 100
        
        try:
            filter_active_days = int(request.data.get('filter_active_days', 30))
        except (ValueError, TypeError):
            filter_active_days = 30
        
        # Создаем рассылку
        notification = BulkNotification.objects.create(
            created_by=request.user,
            notification_type=notification_type,
            subject=subject,
            message=message,
            filter_role=request.data.get('filter_role', 'all'),
            filter_city=request.data.get('filter_city'),
            filter_rating_min=filter_rating_min,
            filter_rating_max=filter_rating_max,
            filter_active_days=filter_active_days,
            scheduled_at=request.data.get('scheduled_at'),
            status='draft'
        )
        
        # Если указан шаблон
        template_id = request.data.get('template_id')
        if template_id:
            try:
                template = NotificationTemplate.objects.get(id=template_id)
                notification.template = template
                notification.save()
            except NotificationTemplate.DoesNotExist:  # type: ignore[attr-defined]
                pass
        
        # Подсчитываем получателей
        recipients_count = notification.get_filtered_recipients().count()
        notification.total_recipients = recipients_count
        notification.save()
        
        logger.info(f"[OK] Sozdana rassylka '{subject}' dlya {recipients_count} poluchateley")
        
        return Response({
            'id': notification.id,  # type: ignore[attr-defined]
            'subject': notification.subject,
            'notification_type': notification.notification_type,
            'status': notification.status,
            'total_recipients': notification.total_recipients,
            'created_at': notification.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka sozdaniya rassylki: {e}")
        return APIError.internal_error(e)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_notification(request: Request, notification_id: int) -> Response:
    """
    Отправка массовой рассылки
    
    POST /custom-admin/api/v1/bulk-notifications/{id}/send/
    """
    try:
        # Проверка прав (DRF уже проверил авторизацию)
        is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
        is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
        if not is_staff and not is_admin:
            return APIError.forbidden("Только администраторы могут отправлять рассылки")
        
        # Получаем рассылку
        try:
            notification = BulkNotification.objects.get(id=notification_id)  # type: ignore[attr-defined]
        except BulkNotification.DoesNotExist:  # type: ignore[attr-defined]
            return APIError.not_found("Рассылка не найдена")
        
        # Проверяем статус
        if notification.status not in ['draft', 'failed']:
            return Response({
                'error': 'Рассылка уже отправлена или отправляется'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # ✅ ИСПРАВЛЕНИЕ: Используем Celery вместо threading для асинхронной обработки
        from core.tasks.tasks import send_bulk_notification_task
        
        # Запускаем Celery задачу
        task = send_bulk_notification_task.delay(notification.id)  # type: ignore[attr-defined]
        
        logger.info(f"[BULK] Запущена отправка рассылки '{notification.subject}' (ID: {notification.id}, Celery Task: {task.id})")  # type: ignore[attr-defined]
        
        return Response({
            'message': 'Рассылка запущена',
            'notification_id': notification.id,  # type: ignore[attr-defined]
            'total_recipients': notification.total_recipients
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka otpravki rassylki: {e}")
        return APIError.internal_error(e)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_bulk_notifications(request: Request) -> Response:
    """
    Список массовых рассылок
    
    GET /custom-admin/api/v1/bulk-notifications/
    """
    try:
        # Проверка прав (DRF уже проверил авторизацию)
        is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
        is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
        if not is_staff and not is_admin:
            return APIError.forbidden("Только администраторы могут просматривать рассылки")
        
        # Фильтр по статусу
        status_filter = request.GET.get('status')
        notifications = BulkNotification.objects.all().order_by('-created_at')
        
        if status_filter:
            notifications = notifications.filter(status=status_filter)
        
        # Пагинация
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        offset = (page - 1) * page_size
        
        total_count = notifications.count()
        notifications_data = []
        
        for notif in notifications[offset:offset + page_size]:
            notifications_data.append({
                'id': notif.id,  # type: ignore[attr-defined]
                'subject': notif.subject,
                'notification_type': notif.notification_type,
                'status': notif.status,
                'total_recipients': notif.total_recipients,
                'sent_count': notif.sent_count,
                'delivered_count': notif.delivered_count,
                'failed_count': notif.failed_count,
                'created_by': notif.created_by.username if hasattr(notif.created_by, 'username') else 'unknown',  # type: ignore[attr-defined]
                'created_at': notif.created_at.isoformat(),
                'sent_at': notif.sent_at.isoformat() if notif.sent_at else None
            })
        
        return Response({
            'total': total_count,
            'page': page,
            'page_size': page_size,
            'results': notifications_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka polucheniya spiska rassylok: {e}")
        return APIError.internal_error(e)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bulk_notification(request: Request, notification_id: int) -> Response:
    """
    Получить детали рассылки
    
    GET /custom-admin/api/v1/bulk-notifications/{id}/
    """
    try:
        # Проверка прав (DRF уже проверил авторизацию)
        is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
        is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
        if not is_staff and not is_admin:
            return APIError.forbidden("Только администраторы могут просматривать рассылки")
        
        try:
            notification = BulkNotification.objects.get(id=notification_id)  # type: ignore[attr-defined]
        except BulkNotification.DoesNotExist:  # type: ignore[attr-defined]
            return APIError.not_found("Рассылка не найдена")
        
        # Получаем статистику по получателям
        recipients_stats = {
            'pending': NotificationRecipient.objects.filter(notification=notification, status='pending').count(),
            'sent': NotificationRecipient.objects.filter(notification=notification, status='sent').count(),
            'delivered': NotificationRecipient.objects.filter(notification=notification, status='delivered').count(),
            'opened': NotificationRecipient.objects.filter(notification=notification, status='opened').count(),
            'failed': NotificationRecipient.objects.filter(notification=notification, status='failed').count(),
        }
        
        return Response({
            'id': notification.id,  # type: ignore[attr-defined]
            'subject': notification.subject,
            'message': notification.message,
            'notification_type': notification.notification_type,
            'status': notification.status,
            'filters': {
                'role': notification.filter_role,
                'city': notification.filter_city,
                'rating_min': notification.filter_rating_min,
                'rating_max': notification.filter_rating_max,
                'active_days': notification.filter_active_days
            },
            'stats': {
                'total_recipients': notification.total_recipients,
                'sent_count': notification.sent_count,
                'delivered_count': notification.delivered_count,
                'opened_count': notification.opened_count,
                'clicked_count': notification.clicked_count,
                'failed_count': notification.failed_count
            },
            'recipients_stats': recipients_stats,
            'created_by': notification.created_by.username if hasattr(notification.created_by, 'username') else 'unknown',  # type: ignore[attr-defined]
            'created_at': notification.created_at.isoformat(),
            'sent_at': notification.sent_at.isoformat() if notification.sent_at else None,
            'scheduled_at': notification.scheduled_at.isoformat() if notification.scheduled_at else None
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka polucheniya detaley rassylki: {e}")
        return APIError.internal_error(e)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notification_templates(request: Request) -> Response:
    """
    Список шаблонов уведомлений
    
    GET /custom-admin/api/v1/notification-templates/
    """
    try:
        templates = NotificationTemplate.objects.all().order_by('-created_at')
        
        templates_data = []
        for template in templates:
            templates_data.append({
                'id': template.id,  # type: ignore[attr-defined]
                'name': template.name,
                'template_type': template.template_type,
                'subject': template.subject,
                'message': template.message,
                'created_at': template.created_at.isoformat()
            })
        
        return Response({
            'results': templates_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka polucheniya shablonov: {e}")
        return APIError.internal_error(e)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_recipients(request: Request) -> Response:
    """
    Предпросмотр получателей по фильтрам
    
    GET /custom-admin/api/v1/bulk-notifications/preview-recipients/
    ?role=volunteer&rating_min=0&rating_max=100&active_days=30
    """
    try:
        # Проверка прав (DRF уже проверил авторизацию)
        is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
        is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
        if not is_staff and not is_admin:
            return APIError.forbidden("Только администраторы")
        
        # Применяем фильтры
        queryset = User.objects.all()
        
        # Фильтр по роли
        filter_role = request.GET.get('role', 'all')
        if filter_role == 'volunteer':
            queryset = queryset.filter(role='volunteer')
        elif filter_role == 'organizer':
            queryset = queryset.filter(role='organizer')
        
        # Фильтр по городу
        filter_city = request.GET.get('city', '')
        if filter_city:
            # Note: User model doesn't have a city field, so we skip this filter
            logger.info(f"[BULKNOTIF] City filter '{filter_city}' requested but User model has no city field")
        
        # Фильтр по рейтингу (безопасное преобразование)
        try:
            filter_rating_min = int(request.GET.get('rating_min', 0))
        except (ValueError, TypeError):
            filter_rating_min = 0
        
        try:
            filter_rating_max = int(request.GET.get('rating_max', 100))
        except (ValueError, TypeError):
            filter_rating_max = 100
        
        queryset = queryset.filter(
            rating__gte=filter_rating_min,
            rating__lte=filter_rating_max
        )
        
        # Фильтр по активности (безопасное преобразование)
        filter_active_days = request.GET.get('active_days', '')
        if filter_active_days and filter_active_days.strip():  # Проверка на непустую строку
            try:
                days = int(filter_active_days)
                if days > 0:  # Только положительные числа
                    from datetime import timedelta
                    from django.utils import timezone
                    active_since = timezone.now() - timedelta(days=days)
                    queryset = queryset.filter(last_login__gte=active_since)
            except (ValueError, TypeError) as e:
                logger.warning(f"[BULKNOTIF] Invalid active_days value: {filter_active_days}, error: {e}")
        
        total_count = queryset.count()
        
        # Статистика по ролям
        volunteer_count = queryset.filter(role='volunteer').count()
        organizer_count = queryset.filter(role='organizer').count()
        
        return Response({
            'total_count': total_count,
            'volunteer_count': volunteer_count,
            'organizer_count': organizer_count,
            'filters_applied': {
                'role': filter_role,
                'city': filter_city,
                'rating_min': filter_rating_min,
                'rating_max': filter_rating_max,
                'active_days': filter_active_days
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка предпросмотра получателей: {e}")
        return APIError.internal_error(e)

