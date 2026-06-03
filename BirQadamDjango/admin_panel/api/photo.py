"""
API endpoints для работы с фотоотчетами
"""
from typing import Any
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import F, Q, Count
from django.utils import timezone
from api.models import Photo, Task, Project, Activity
from admin_panel.views.views import CsrfExemptSessionAuthentication
import logging

logger = logging.getLogger(__name__)


def build_https_absolute_uri(request: Request, path: str) -> str:
    """Строит абсолютный URL с принудительным использованием HTTPS (только для production)"""
    # photo.image.url уже возвращает путь вида /media/photos/..., так что просто используем его
    # Убеждаемся, что путь начинается с /
    if not path.startswith('/'):
        path = '/' + path
    
    url = request.build_absolute_uri(path)
    
    # Для localhost принудительно используем http (не https)
    if 'localhost' in url or '127.0.0.1' in url:
        if url.startswith('https://'):
            url = url.replace('https://', 'http://')
    else:
        # Для production заменяем http на https
        if url.startswith('http://'):
            url = url.replace('http://', 'https://')
    
    # Логирование для отладки
    logger.debug(f"[build_https_absolute_uri] path={path}, url={url}")
    
    return url


class SubmitPhotoReportAPIView(APIView):
    """Отправка фотоотчета волонтером"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Проверяем, что задача существует и назначена пользователю
            task = Task.objects.select_related('project').get(
                id=task_id,
                assignments__volunteer=request.user,
                is_deleted=False
            )

            # ВАЖНО: Проверяем, не отправлен ли уже активный фотоотчёт для этой задачи (не отклоненный)
            existing_active_photos = Photo.objects.filter(
                task=task,
                volunteer=request.user,
                is_deleted=False
            ).exclude(status='rejected').exists()

            if existing_active_photos and task.status != 'revision':
                return Response(
                    {'error': 'Вы уже отправили фотоотчёт для этой задачи. Повторная отправка невозможна.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Получаем фотографии (максимум 5)
            photos = request.FILES.getlist('photos')
            if not photos:
                return Response(
                    {'error': 'Необходимо выбрать хотя бы одно фото'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if len(photos) > 5:
                return Response(
                    {'error': 'Максимум 5 фотографий'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Получаем комментарий (опционально)
            comment = request.data.get('comment', '')

            # Создаем фотоотчеты
            created_photos = []
            for photo_file in photos:
                photo = Photo.objects.create(
                    volunteer=request.user,
                    project=task.project,
                    task=task,
                    image=photo_file,
                    status='pending',  # Ожидает проверки
                    volunteer_comment=comment  # Сохраняем комментарий волонтера
                )
                created_photos.append({
                    'id': photo.id,  # type: ignore[attr-defined]
                    'image_url': build_https_absolute_uri(request, photo.image.url) if photo.image else None,
                    'uploaded_at': photo.uploaded_at.isoformat()
                })

            # Создаём активность
            Activity.objects.create(
                user=request.user,
                type='photo_uploaded',
                title='Фотоотчет отправлен',
                description=f'Вы отправили {len(photos)} фото для задачи "{task.text}"',
                project=task.project
            )

            # Переводим задачу в статус "На проверке", если она была в работе или на доработке
            if task.status in ['in_progress', 'revision']:
                task.status = 'under_review'
                task.save(update_fields=['status'])

            # Отправляем уведомление организатору о новом фотоотчете
            from shared.notifications.utils import notify_organizer_new_photo
            from asgiref.sync import async_to_sync
            try:
                # Берем первое фото для уведомления (или можно использовать любое)
                first_photo = Photo.objects.get(id=created_photos[0]['id'])
                async_to_sync(notify_organizer_new_photo)(
                    organizer=task.project.creator,
                    photo_report=first_photo,
                    volunteer=request.user,
                    project=task.project,
                    task=task
                )
                logger.info(f"[PHOTO] Notified organizer {task.project.creator.username if hasattr(task.project.creator, 'username') else 'unknown'} about new photo from {request.user.username if hasattr(request.user, 'username') else 'unknown'}")  # type: ignore[attr-defined]
            except Exception as e:
                logger.error(f"[PHOTO] [ERROR] Error notifying organizer about photo: {e}")

            return Response({
                'message': f'Фотоотчет успешно отправлен ({len(photos)} фото)',
                'photos': created_photos
            }, status=status.HTTP_201_CREATED)

        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена или не назначена вам'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error submitting photo report: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrganizerPhotoReportsAPIView(APIView):
    """Список фотоотчетов для организатора"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            # Разрешаем доступ любому организатору (не только одобренным)
            is_organizer_flag = hasattr(request.user, 'is_organizer') and request.user.is_organizer  # type: ignore[attr-defined]
            role = getattr(request.user, 'role', None)  # type: ignore[attr-defined]
            is_organizer = is_organizer_flag or role == 'organizer'
            
            if not is_organizer:
                return Response(
                    {'error': 'Доступ запрещен. Только организаторы могут просматривать фотоотчеты.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Базовый запрос
            base_queryset = Photo.objects.filter(
                project__creator=request.user,
                project__is_deleted=False,
                is_deleted=False
            ).select_related(
                'volunteer',
                'project',
                'task'
            )

            # Счётчики по статусам для шапки
            counters = base_queryset.aggregate(
                pending=Count('id', filter=Q(status='pending')),
                approved=Count('id', filter=Q(status='approved')),
                rejected=Count('id', filter=Q(status='rejected')),
                total=Count('id')
            )
            counters = {
                'pending': counters.get('pending', 0) or 0,
                'approved': counters.get('approved', 0) or 0,
                'rejected': counters.get('rejected', 0) or 0,
                'total': counters.get('total', 0) or 0,
            }

            # Фильтры
            filter_type = request.GET.get('filter', 'all')
            status_param = request.GET.get('status')
            project_param = request.GET.get('project') or request.GET.get('project_id')

            # backward compatibility: filter=new -> pending
            if filter_type == 'new' and not status_param:
                status_param = 'pending'

            valid_statuses = {'pending', 'approved', 'rejected'}
            if status_param:
                if status_param not in valid_statuses:
                    return Response(
                        {'error': 'Недопустимый статус. Используйте pending, approved или rejected.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                base_queryset = base_queryset.filter(status=status_param)

            if project_param:
                try:
                    project_id = int(project_param)
                except (TypeError, ValueError):
                    return Response({'error': 'Параметр project должен быть числом.'}, status=status.HTTP_400_BAD_REQUEST)
                base_queryset = base_queryset.filter(project_id=project_id)
            else:
                project_id = None

            # Пагинация
            try:
                limit = int(request.GET.get('limit', 50))
            except (TypeError, ValueError):
                return Response({'error': 'Параметр limit должен быть числом.'}, status=status.HTTP_400_BAD_REQUEST)
            limit = max(1, min(limit, 100))

            try:
                offset = int(request.GET.get('offset', 0))
            except (TypeError, ValueError):
                return Response({'error': 'Параметр offset должен быть числом.'}, status=status.HTTP_400_BAD_REQUEST)
            offset = max(0, offset)

            filtered_count = base_queryset.count()

            photos_query = base_queryset.order_by(
                '-uploaded_at' if status_param in (None, 'pending') else '-moderated_at',
                '-id'
            )[offset:offset + limit]

            photos_data = []
            for photo in photos_query:
                task = photo.task
                project = photo.project
                volunteer = photo.volunteer

                # Формируем URL изображения
                image_url = None
                if photo.image:
                    image_path = photo.image.url
                    image_url = build_https_absolute_uri(request, image_path)
                    # Логирование для отладки
                    logger.info(f"Photo {photo.id}: image_path={image_path}, image_url={image_url}, image_name={photo.image.name}")
                    
                    # Проверяем существование файла (только для отладки)
                    import os
                    from django.conf import settings
                    if hasattr(photo.image, 'path'):
                        file_path = photo.image.path
                        exists = os.path.exists(file_path)
                        logger.info(f"Photo {photo.id}: file_path={file_path}, exists={exists}")
                    elif photo.image.name:
                        # Пытаемся построить путь
                        file_path = os.path.join(settings.MEDIA_ROOT, photo.image.name)
                        exists = os.path.exists(file_path)
                        logger.info(f"Photo {photo.id}: constructed file_path={file_path}, exists={exists}")

                photos_data.append({
                    'id': photo.id,  # type: ignore[attr-defined]
                    'volunteer': {
                        'id': volunteer.id,
                        'name': volunteer.name or volunteer.username,
                        'username': volunteer.username,
                        'rating': volunteer.rating,
                        'phone_number': volunteer.phone_number,
                    },
                    'task': {
                        'id': task.id if task else None,
                        'text': task.text if task else '',
                        'deadline_date': task.deadline_date.isoformat() if task and task.deadline_date else None,
                        'start_time': task.start_time.isoformat(timespec='minutes') if task and task.start_time else None,
                        'end_time': task.end_time.isoformat(timespec='minutes') if task and task.end_time else None,
                    },
                    'project': {
                        'id': project.id,
                        'title': project.title,
                        'city': project.city,
                    },
                    'image_url': image_url,
                    'volunteer_comment': photo.volunteer_comment or '',
                    'organizer_comment': photo.organizer_comment or '',
                    'rejection_reason': photo.rejection_reason or '',
                    'status': photo.status,
                    'rating': photo.rating,
                    'uploaded_at': photo.uploaded_at.isoformat(),
                    'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
                })

            return Response({
                'photos': photos_data,
                'counters': counters,
                'new_count': counters['pending'],
                'total_count': counters['total'],
                'filtered_count': filtered_count,
                'limit': limit,
                'offset': offset,
                'status': status_param or ('pending' if filter_type == 'new' else 'all'),
                'project_id': project_id,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error loading photo reports: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PhotoReportDetailAPIView(APIView):
    """Детали фотоотчета"""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, photo_id: int) -> Response:  # type: ignore[override]
        try:
            # Получаем фото с проверкой прав доступа
            photo = Photo.objects.select_related(
                'volunteer',
                'project',
                'task'
            ).get(
                id=photo_id,
                is_deleted=False
            )

            # Проверяем права доступа
            if hasattr(request.user, 'is_organizer') and request.user.is_organizer:  # type: ignore[attr-defined]
                # Организатор может смотреть только фото из своих проектов
                if photo.project.creator != request.user:
                    return Response(
                        {'error': 'Доступ запрещен'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                # Волонтер может смотреть только свои фото
                if photo.volunteer != request.user:
                    return Response(
                        {'error': 'Доступ запрещен'},
                        status=status.HTTP_403_FORBIDDEN
                    )

            # Получаем все фото из этой задачи для галереи
            related_photos = Photo.objects.filter(
                task=photo.task,
                volunteer=photo.volunteer,
                is_deleted=False
            ).order_by('uploaded_at')

            photos_list = []
            for p in related_photos:
                photos_list.append({
                    'id': p.id,  # type: ignore[attr-defined]
                    'image_url': build_https_absolute_uri(request, p.image.url) if p.image else None,
                    'uploaded_at': p.uploaded_at.isoformat()
                })

            return Response({
                'id': photo.id,  # type: ignore[attr-defined]
                'volunteer_name': photo.volunteer.name or photo.volunteer.username,
                'volunteer_id': photo.volunteer.id,
                'task_text': photo.task.text if photo.task else '',
                'task_id': photo.task.id if photo.task else None,
                'project_title': photo.project.title,
                'project_id': photo.project.id,
                'image_url': build_https_absolute_uri(request, photo.image.url) if photo.image else None,
                'volunteer_comment': photo.volunteer_comment if photo.volunteer_comment else '',
                'organizer_comment': photo.organizer_comment if photo.organizer_comment else '',
                'rejection_reason': photo.rejection_reason if photo.rejection_reason else '',
                'status': photo.status,
                'rating': photo.rating,
                'uploaded_at': photo.uploaded_at.isoformat(),
                'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
                'photos': photos_list  # Все фото из этой задачи
            }, status=status.HTTP_200_OK)

        except Photo.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Фотоотчет не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error loading photo detail: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RatePhotoReportAPIView(APIView):
    """Оценка фотоотчета организатором"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: Request, photo_id: int) -> Response:  # type: ignore[override]
        try:
            # Разрешаем доступ любому организатору (не только одобренным)
            is_organizer_flag = hasattr(request.user, 'is_organizer') and request.user.is_organizer  # type: ignore[attr-defined]
            role = getattr(request.user, 'role', None)  # type: ignore[attr-defined]
            is_organizer = is_organizer_flag or role == 'organizer'
            
            if not is_organizer:
                return Response(
                    {'error': 'Доступ запрещен. Только организаторы могут оценивать фотоотчеты.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Получаем фото
            photo = Photo.objects.select_related('volunteer', 'project', 'task').get(
                id=photo_id,
                project__creator=request.user,
                is_deleted=False
            )

            # Проверяем, что фото еще не оценено
            if photo.status != 'pending':
                return Response(
                    {'error': 'Фотоотчет уже оценен'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            skip_param = request.data.get('skip', False)
            feedback = request.data.get('feedback', '')

            skip = False
            if isinstance(skip_param, bool):
                skip = skip_param
            elif isinstance(skip_param, str):
                skip = skip_param.lower() in {'1', 'true', 'yes', 'on'}

            rating_value: int | None = None
            if not skip:
                rating_raw = request.data.get('rating')
                try:
                    rating_value = int(rating_raw)
                except (TypeError, ValueError):
                    return Response(
                        {'error': 'Рейтинг должен быть числом от 1 до 5 или включите параметр skip.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if rating_value < 1 or rating_value > 5:
                    return Response(
                        {'error': 'Рейтинг должен быть от 1 до 5'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if rating_value <= 3 and not feedback.strip():
                    return Response(
                        {'error': 'Комментарий обязателен для оценки 1-3 звезды'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                rating_value = None

            # Валидация статуса перед сохранением
            if photo.status and len(photo.status) > 20:
                logger.error(f"Photo status too long: {photo.status} (length: {len(photo.status)})")
                return Response(
                    {'error': 'Некорректный статус фотоотчета'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Проверяем текущий статус фото
            logger.info(f"Rating photo {photo_id}: current status='{photo.status}', rating={rating_value}, skip={skip}")
            
            # Инициализируем переменные для ответа
            updated_trust_factor = None
            updated_average_rating = None
            
            # Одобряем фото с рейтингом или без
            try:
                # Используем прямой update для избежания проблем с ограничениями БД
                from django.db import transaction
                with transaction.atomic():
                    # Проверяем, что статус действительно pending
                    photo_check = Photo.objects.select_for_update().get(pk=photo.pk)
                    if photo_check.status != 'pending':
                        return Response(
                            {'error': 'Фотоотчет уже обработан'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # Обновляем напрямую через update, чтобы избежать проблем с валидацией модели
                    updated = Photo.objects.filter(
                        pk=photo.pk,
                        status='pending'
                    ).update(
                        status='approved',  # 8 символов, должно поместиться даже в varchar(15)
                        rating=rating_value,
                        organizer_comment=feedback if feedback else None,
                        moderated_at=timezone.now()
                    )
                    
                    if updated == 0:
                        return Response(
                            {'error': 'Фотоотчет уже обработан'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # Обновляем объект из БД - ВАЖНО: делаем это ДО обновления рейтинга волонтера
                    photo.refresh_from_db()
                    
                    logger.info(f"[RATING] Photo {photo.id} saved with rating {rating_value}, now updating volunteer stats")
                    
                    # Обновляем рейтинг и TrustFactor волонтера, если есть
                    if rating_value and photo.volunteer:
                        from api.models import User
                        
                        # Получаем пользователя из БД с блокировкой
                        volunteer = User.objects.select_for_update().get(pk=photo.volunteer.pk)
                        
                        logger.info(f"[RATING] Applying consolidate reward for volunteer {volunteer.username} for rating {rating_value}")
                        
                        # Вызываем новый консолидированный метод начисления наград
                        reward_results = volunteer.apply_photo_rating_reward(rating_value, photo.id)
                        
                        # Сохраняем обновленные значения для ответа
                        updated_trust_factor = reward_results['new_tf']
                        updated_average_rating = reward_results['new_avg_rating']
                        
                        logger.info(f"[RATING] Photo {photo.id} rewarded successfully. New TF: {updated_trust_factor}, New Avg: {updated_average_rating}")
                    else:
                        updated_trust_factor = None
                        updated_average_rating = None
                    
                    # Обновляем статус задачи, если есть
                    if photo.task:
                        task = photo.task
                        task.status = 'completed'
                        task.save()
                        
            except Exception as approve_error:
                import traceback
                error_details = traceback.format_exc()
                logger.error(f"Error in photo approval: {approve_error}")
                logger.error(f"Error details: {error_details}")
                logger.error(f"Photo ID: {photo_id}, Photo status: {photo.status}, Rating: {rating_value}")
                return Response(
                    {'error': f'Ошибка при оценке фотоотчета: {str(approve_error)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            photo.refresh_from_db()

            publish_review = request.data.get('publish_as_review', False)
            if isinstance(publish_review, str):
                publish_review = publish_review.lower() in {'1', 'true', 'yes', 'on'}
            if (
                publish_review
                and feedback
                and feedback.strip()
                and rating_value
                and photo.volunteer
                and photo.project
            ):
                try:
                    from api.projects.services.reviews import create_or_update_volunteer_review
                    create_or_update_volunteer_review(
                        volunteer=photo.volunteer,
                        organizer=request.user,
                        project=photo.project,
                        rating=rating_value,
                        text=feedback.strip(),
                        task=photo.task,
                        photo=photo,
                    )
                except ValueError as review_error:
                    logger.warning('Could not publish volunteer review: %s', review_error)

            # Отправляем уведомление волонтеру (Telegram + Push)
            from admin_panel.services.notification_service import NotificationService
            from asgiref.sync import async_to_sync
            async_to_sync(NotificationService.notify_photo_approved)(
                photo.volunteer,
                photo,
                photo.project
            )
            
            # Отправляем email уведомление волонтеру
            if photo.volunteer and photo.project:
                from shared.notifications.email.service import notify_volunteer_photo_approved
                notify_volunteer_photo_approved(
                    photo.volunteer,
                    photo,
                    photo.project,
                    rating=rating_value,
                    feedback=feedback if feedback else None
                )
                logger.info(f"Sent email notification to volunteer {photo.volunteer.username} about approved photo {photo_id}")

            # Получаем обновленные значения TF и рейтинга для ответа
            # Если они не были установлены внутри транзакции, получаем их здесь
            if updated_trust_factor is None and photo.volunteer:
                photo.volunteer.refresh_from_db()
                updated_trust_factor = photo.volunteer.trust_factor  # type: ignore[attr-defined]
                updated_average_rating = photo.volunteer.average_rating  # type: ignore[attr-defined]
            
            return Response({
                'message': 'Фотоотчет оценен успешно',
                'photo': {
                    'id': photo.id,  # type: ignore[attr-defined]
                    'status': photo.status,
                    'rating': photo.rating,
                    'trust_factor': updated_trust_factor,
                    'average_rating': updated_average_rating,
                    'organizer_comment': photo.organizer_comment,
                    'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None
                }
            }, status=status.HTTP_200_OK)

        except Photo.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Фотоотчет не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"Error rating photo: {e}\n{error_details}")
            # Логируем детали запроса для отладки
            logger.error(f"Request data: {request.data}")
            logger.error(f"Photo ID: {photo_id}")
            return Response(
                {'error': str(e), 'details': error_details if logger.level <= logging.DEBUG else None},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RejectPhotoReportAPIView(APIView):
    """Отклонение фотоотчета организатором"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: Request, photo_id: int) -> Response:  # type: ignore[override]
        try:
            # Разрешаем доступ любому организатору (не только одобренным)
            is_organizer_flag = hasattr(request.user, 'is_organizer') and request.user.is_organizer  # type: ignore[attr-defined]
            role = getattr(request.user, 'role', None)  # type: ignore[attr-defined]
            is_organizer = is_organizer_flag or role == 'organizer'
            
            if not is_organizer:
                return Response(
                    {'error': 'Доступ запрещен. Только организаторы могут отклонять фотоотчеты.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Получаем фото
            photo = Photo.objects.select_related('volunteer', 'project', 'task').get(
                id=photo_id,
                project__creator=request.user,
                is_deleted=False
            )

            # Проверяем, что фото еще не оценено
            if photo.status != 'pending':
                return Response(
                    {'error': 'Фотоотчет уже обработан'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Получаем причину отклонения (обязательна)
            feedback = request.data.get('feedback', '')
            if not feedback.strip():
                return Response(
                    {'error': 'Причина отклонения обязательна'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Отклоняем фото
            photo.reject(feedback=feedback)
            photo.refresh_from_db()

            # Отправляем уведомление волонтеру (Telegram + Push)
            from admin_panel.services.notification_service import NotificationService
            from asgiref.sync import async_to_sync
            async_to_sync(NotificationService.notify_photo_rejected)(
                photo.volunteer,
                photo,
                photo.project
            )
            
            # Отправляем email уведомление волонтеру
            if photo.volunteer and photo.project:
                from shared.notifications.email.service import notify_volunteer_photo_rejected
                notify_volunteer_photo_rejected(
                    photo.volunteer,
                    photo,
                    photo.project,
                    reason=feedback
                )
                logger.info(f"Sent email notification to volunteer {photo.volunteer.username} about rejected photo {photo_id}")

            return Response({
                'message': 'Фотоотчет отклонен',
                'photo': {
                    'id': photo.id,  # type: ignore[attr-defined]
                    'status': photo.status,
                    'rejection_reason': photo.rejection_reason,
                    'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None
                }
            }, status=status.HTTP_200_OK)

        except Photo.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Фотоотчет не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error rejecting photo: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VolunteerPhotoReportsAPIView(APIView):
    """Список фотоотчетов волонтера"""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            # Получаем фотоотчеты текущего пользователя
            photos = Photo.objects.filter(
                volunteer=request.user,
                is_deleted=False
            ).select_related('project', 'task').order_by('-uploaded_at')

            photos_data = []
            for photo in photos:
                photos_data.append({
                    'id': photo.id,  # type: ignore[attr-defined]
                    'task_text': photo.task.text if photo.task else '',
                    'task_id': photo.task.id if photo.task else None,
                    'project_title': photo.project.title,
                    'project_id': photo.project.id,
                    'image_url': build_https_absolute_uri(request, photo.image.url) if photo.image else None,
                    'volunteer_comment': photo.volunteer_comment if photo.volunteer_comment else '',
                    'organizer_comment': photo.organizer_comment if photo.organizer_comment else '',
                    'rejection_reason': photo.rejection_reason if photo.rejection_reason else '',
                    'status': photo.status,
                    'rating': photo.rating,
                    'uploaded_at': photo.uploaded_at.isoformat(),
                    'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None
                })

            return Response({
                'photos': photos_data,
                'total_count': len(photos_data)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error loading volunteer photos: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskPhotosAPIView(APIView):
    """Получить фото для конкретной задачи"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Получаем фото для этой задачи от текущего пользователя
            photos = Photo.objects.filter(
                task_id=task_id,
                volunteer=request.user,
                is_deleted=False
            ).order_by('-uploaded_at')

            if not photos.exists():
                return Response({
                    'has_photos': False,
                    'photos': [],
                    'count': 0
                }, status=status.HTTP_200_OK)

            # Берем последнее фото для отображения статуса
            latest_photo = photos.first()

            photos_data = {
                'has_photos': True,
                'count': photos.count(),
                'photos': [{
                    'id': p.id,  # type: ignore[attr-defined]
                    'image_url': build_https_absolute_uri(request, p.image.url) if p.image else None,
                    'status': p.status,
                    'rating': p.rating,
                    'volunteer_comment': p.volunteer_comment if p.volunteer_comment else '',
                    'organizer_comment': p.organizer_comment if p.organizer_comment else '',
                    'rejection_reason': p.rejection_reason if p.rejection_reason else '',
                    'uploaded_at': p.uploaded_at.isoformat(),
                    'moderated_at': p.moderated_at.isoformat() if p.moderated_at else None
                } for p in photos],
                'latest_status': latest_photo.status if latest_photo else None,  # type: ignore[attr-defined]
                'latest_rating': latest_photo.rating if latest_photo else None,  # type: ignore[attr-defined]
                'latest_organizer_comment': latest_photo.organizer_comment if latest_photo and latest_photo.organizer_comment else '',  # type: ignore[attr-defined]
                'latest_rejection_reason': latest_photo.rejection_reason if latest_photo and latest_photo.rejection_reason else ''  # type: ignore[attr-defined]
            }

            return Response(photos_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error loading task photos: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )