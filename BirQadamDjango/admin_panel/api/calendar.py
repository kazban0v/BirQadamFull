# admin_panel/calendar_api_views.py
"""
API для работы с календарем событий
Поддерживает CRUD операции для событий, фильтрацию, напоминания
"""

from typing import Any
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from datetime import datetime
from api.models import Event, Project, Task, User
import logging

logger = logging.getLogger(__name__)


class CalendarAPIView(APIView):
    """
    API для получения списка событий и создания новых событий
    
    GET /api/v1/calendar/events/
    - month: YYYY-MM (фильтр по месяцу)
    - type: event_type (project_start, meeting, custom и т.д.)
    - project_id: ID проекта
    - upcoming: true/false (только предстоящие)
    
    POST /api/v1/calendar/events/
    - Создание нового события
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:  # type: ignore[override]
        """Получить список событий"""
        try:
            user = request.user
            
            # Базовый queryset
            events = Event.objects.filter(is_deleted=False)
            
            # Фильтр по видимости
            from api.models import VolunteerProject  # type: ignore[attr-defined]
            volunteer_project_ids = []
            if hasattr(user, 'volunteer_projects'):
                volunteer_project_ids = list(VolunteerProject.objects.filter(volunteer=user).values_list('project', flat=True))  # type: ignore[attr-defined]
            
            events = events.filter(
                Q(visibility='public') |
                Q(creator=user) |
                Q(project__in=volunteer_project_ids) |
                Q(participants=user)
            ).distinct()
            
            # Фильтр по месяцу
            month_str = request.GET.get('month')
            if month_str:
                try:
                    year, month = map(int, month_str.split('-'))
                    events = events.filter(start_date__year=year, start_date__month=month)
                except (ValueError, AttributeError):
                    pass
            
            # Фильтр по типу события
            event_type = request.GET.get('type')
            if event_type:
                events = events.filter(event_type=event_type)
            
            # Фильтр по проекту
            project_id = request.GET.get('project_id')
            if project_id:
                events = events.filter(project_id=project_id)
            
            # Только предстоящие события
            if request.GET.get('upcoming') == 'true':
                today = timezone.now().date()
                events = events.filter(start_date__gte=today)
            
            # Сортировка
            events = events.order_by('start_date', 'start_time')
            
            # Сериализация
            events_data = []
            for event in events:
                participants_list = list(event.participants.all())
                events_data.append({
                    'id': event.id,  # type: ignore[attr-defined]
                    'title': event.title,
                    'description': event.description,
                    'event_type': event.event_type,
                    'event_type_display': event.get_event_type_display(),  # type: ignore[attr-defined]
                    'start_date': event.start_date.isoformat(),
                    'start_time': event.start_time.isoformat() if event.start_time else None,
                    'end_date': event.end_date.isoformat() if event.end_date else None,
                    'end_time': event.end_time.isoformat() if event.end_time else None,
                    'is_all_day': event.is_all_day,
                    'location': event.location,
                    'visibility': event.visibility,
                    'reminder_minutes': event.reminder_minutes,
                    'creator': {
                        'id': event.creator.id if hasattr(event.creator, 'id') else None,  # type: ignore[attr-defined]
                        'username': event.creator.username if hasattr(event.creator, 'username') else 'unknown',  # type: ignore[attr-defined]
                    },
                    'project': {
                        'id': event.project.id,  # type: ignore[attr-defined]
                        'title': event.project.title,
                    } if event.project else None,
                    'task': {
                        'id': event.task.id,  # type: ignore[attr-defined]
                        'text': event.task.text[:50],
                    } if event.task else None,
                    'participants': [
                        {
                            'id': p.id if hasattr(p, 'id') else None,  # type: ignore[attr-defined]
                            'username': p.username if hasattr(p, 'username') else 'unknown',  # type: ignore[attr-defined]
                        } for p in participants_list
                    ],
                    'participants_count': event.participants.count(),
                    'is_participant': user in participants_list,
                    'can_edit': event.creator == user,
                    'created_at': event.created_at.isoformat(),
                })
            
            return Response({
                'success': True,
                'events': events_data,
                'count': len(events_data),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching events: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при загрузке событий'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request: Request) -> Response:  # type: ignore[override]
        """Создать новое событие"""
        try:
            user = request.user
            data = request.data
            
            # Валидация обязательных полей
            title = data.get('title')
            start_date_str = data.get('start_date')
            
            if not title or not start_date_str:
                return Response({
                    'success': False,
                    'error': 'Название и дата начала обязательны'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Парсинг дат
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
            except (ValueError, AttributeError):
                return Response({
                    'success': False,
                    'error': 'Неверный формат даты начала'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Парсинг времени (опционально)
            start_time = None
            if data.get('start_time'):
                try:
                    start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00')).time()
                except (ValueError, AttributeError):
                    pass
            
            # Парсинг даты окончания (опционально)
            end_date = None
            if data.get('end_date'):
                try:
                    end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date()
                except (ValueError, AttributeError):
                    pass
            
            # Парсинг времени окончания (опционально)
            end_time = None
            if data.get('end_time'):
                try:
                    end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00')).time()
                except (ValueError, AttributeError):
                    pass
            
            # Создание события
            event = Event.objects.create(
                title=title,
                description=data.get('description', ''),
                event_type=data.get('event_type', 'custom'),
                start_date=start_date,
                start_time=start_time,
                end_date=end_date,
                end_time=end_time,
                is_all_day=data.get('is_all_day', False),
                location=data.get('location', ''),
                visibility=data.get('visibility', 'public'),
                reminder_minutes=data.get('reminder_minutes'),
                creator=user,
            )
            
            # Связать с проектом (если указан)
            project_id = data.get('project_id')
            if project_id:
                try:
                    project = Project.objects.get(id=project_id)
                    event.project = project
                    event.save()
                except Project.DoesNotExist:  # type: ignore[attr-defined]
                    pass
            
            # Связать с задачей (если указана)
            task_id = data.get('task_id')
            if task_id:
                try:
                    task = Task.objects.get(id=task_id)
                    event.task = task
                    event.save()
                except Task.DoesNotExist:  # type: ignore[attr-defined]
                    pass
            
            # Добавить участников
            participant_ids = data.get('participant_ids', [])
            if participant_ids:
                participants = User.objects.filter(id__in=participant_ids)
                event.participants.set(participants)
            
            logger.info(f"[OK] Event '{event.title}' created by {user.username if hasattr(user, 'username') else 'unknown'}")  # type: ignore[attr-defined]
            
            return Response({
                'success': True,
                'message': 'Событие создано',
                'event': {
                    'id': event.id,  # type: ignore[attr-defined]
                    'title': event.title,
                    'start_date': event.start_date.isoformat(),
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating event: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при создании события'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EventDetailAPIView(APIView):
    """
    API для работы с конкретным событием
    
    GET /api/v1/calendar/events/<id>/
    PUT /api/v1/calendar/events/<id>/
    DELETE /api/v1/calendar/events/<id>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, event_id: int) -> Response:  # type: ignore[override]
        """Получить детали события"""
        try:
            user = request.user
            
            event = Event.objects.filter(
                id=event_id, 
                is_deleted=False
            ).select_related('creator', 'project', 'task').prefetch_related('participants').first()
            
            if not event:
                return Response({
                    'success': False,
                    'error': 'Событие не найдено'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Проверка доступа
            participants_list = list(event.participants.all())
            has_access = (
                event.visibility == 'public' or
                event.creator == user or
                user in participants_list or
                (event.project and hasattr(user, 'volunteer_projects') and 
                 VolunteerProject.objects.filter(volunteer=user, project=event.project).exists())  # type: ignore[attr-defined]
            )
            
            if not has_access:
                return Response({
                    'success': False,
                    'error': 'Нет доступа к этому событию'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Детальная информация
            participants_list = list(event.participants.all())
            event_data = {
                'id': event.id,  # type: ignore[attr-defined]
                'title': event.title,
                'description': event.description,
                'event_type': event.event_type,
                'event_type_display': event.get_event_type_display(),  # type: ignore[attr-defined]
                'start_date': event.start_date.isoformat(),
                'start_time': event.start_time.isoformat() if event.start_time else None,
                'end_date': event.end_date.isoformat() if event.end_date else None,
                'end_time': event.end_time.isoformat() if event.end_time else None,
                'is_all_day': event.is_all_day,
                'location': event.location,
                'visibility': event.visibility,
                'visibility_display': event.get_visibility_display(),  # type: ignore[attr-defined]
                'reminder_minutes': event.reminder_minutes,
                'creator': {
                    'id': event.creator.id if hasattr(event.creator, 'id') else None,  # type: ignore[attr-defined]
                    'username': event.creator.username if hasattr(event.creator, 'username') else 'unknown',  # type: ignore[attr-defined]
                },
                'project': {
                    'id': event.project.id,  # type: ignore[attr-defined]
                    'title': event.project.title,
                    'city': event.project.city,
                } if event.project else None,
                'task': {
                    'id': event.task.id,  # type: ignore[attr-defined]
                    'text': event.task.text,
                    'status': event.task.status,
                } if event.task else None,
                'participants': [
                    {
                        'id': p.id if hasattr(p, 'id') else None,  # type: ignore[attr-defined]
                        'username': p.username if hasattr(p, 'username') else 'unknown',  # type: ignore[attr-defined]
                    } for p in participants_list
                ],
                'is_participant': user in participants_list,
                'can_edit': event.creator == user,
                'created_at': event.created_at.isoformat(),
                'updated_at': event.updated_at.isoformat(),
            }
            
            return Response({
                'success': True,
                'event': event_data,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching event {event_id}: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при загрузке события'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request: Request, event_id: int) -> Response:  # type: ignore[override]
        """Обновить событие"""
        try:
            user = request.user
            
            event = Event.objects.filter(id=event_id, is_deleted=False).first()
            
            if not event:
                return Response({
                    'success': False,
                    'error': 'Событие не найдено'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Только создатель может редактировать
            if event.creator != user:
                return Response({
                    'success': False,
                    'error': 'Только создатель может редактировать событие'
                }, status=status.HTTP_403_FORBIDDEN)
            
            data = request.data
            
            # Обновление полей
            if 'title' in data:
                event.title = data['title']
            if 'description' in data:
                event.description = data['description']
            if 'event_type' in data:
                event.event_type = data['event_type']
            if 'location' in data:
                event.location = data['location']
            if 'visibility' in data:
                event.visibility = data['visibility']
            if 'is_all_day' in data:
                event.is_all_day = data['is_all_day']
            if 'reminder_minutes' in data:
                event.reminder_minutes = data['reminder_minutes']
            
            # Обновление дат
            if 'start_date' in data:
                try:
                    event.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')).date()
                except (ValueError, AttributeError):
                    pass
            
            if 'start_time' in data:
                try:
                    event.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00')).time()
                except (ValueError, AttributeError):
                    event.start_time = None
            
            if 'end_date' in data:
                try:
                    event.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date()
                except (ValueError, AttributeError):
                    event.end_date = None
            
            if 'end_time' in data:
                try:
                    event.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00')).time()
                except (ValueError, AttributeError):
                    event.end_time = None
            
            # Обновление связей
            if 'project_id' in data:
                if data['project_id']:
                    try:
                        event.project = Project.objects.get(id=data['project_id'])  # type: ignore[attr-defined]
                    except Project.DoesNotExist:  # type: ignore[attr-defined]
                        pass
                else:
                    event.project = None
            
            if 'task_id' in data:
                if data['task_id']:
                    try:
                        event.task = Task.objects.get(id=data['task_id'])  # type: ignore[attr-defined]
                    except Task.DoesNotExist:  # type: ignore[attr-defined]
                        pass
                else:
                    event.task = None
            
            event.save()
            
            # Обновление участников
            if 'participant_ids' in data:
                participants = User.objects.filter(id__in=data['participant_ids'])
                event.participants.set(participants)
            
            logger.info(f"[OK] Event '{event.title}' updated by {user.username if hasattr(user, 'username') else 'unknown'}")  # type: ignore[attr-defined]
            
            return Response({
                'success': True,
                'message': 'Событие обновлено',
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error updating event {event_id}: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при обновлении события'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request: Request, event_id: int) -> Response:  # type: ignore[override]
        """Удалить событие (мягкое удаление)"""
        try:
            user = request.user
            
            event = Event.objects.filter(id=event_id, is_deleted=False).first()
            
            if not event:
                return Response({
                    'success': False,
                    'error': 'Событие не найдено'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Только создатель может удалять
            if event.creator != user:
                return Response({
                    'success': False,
                    'error': 'Только создатель может удалить событие'
                }, status=status.HTTP_403_FORBIDDEN)
            
            event.is_deleted = True
            event.save()
            
            logger.info(f"[DELETE] Event '{event.title}' deleted by {user.username if hasattr(user, 'username') else 'unknown'}")  # type: ignore[attr-defined]
            
            return Response({
                'success': True,
                'message': 'Событие удалено',
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error deleting event {event_id}: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при удалении события'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EventParticipantsAPIView(APIView):
    """
    API для управления участниками события
    
    POST /api/v1/calendar/events/<id>/join/ - Присоединиться
    POST /api/v1/calendar/events/<id>/leave/ - Покинуть
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, event_id: int) -> Response:  # type: ignore[override]
        """Присоединиться или покинуть событие"""
        try:
            user = request.user
            action = request.data.get('action')  # 'join' или 'leave'
            
            event = Event.objects.filter(id=event_id, is_deleted=False).first()
            
            if not event:
                return Response({
                    'success': False,
                    'error': 'Событие не найдено'
                }, status=status.HTTP_404_NOT_FOUND)
            
            participants_list = list(event.participants.all())
            if action == 'join':
                if user in participants_list:
                    return Response({
                        'success': False,
                        'error': 'Вы уже участник'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                event.participants.add(user)  # type: ignore[arg-type]
                logger.info(f"[OK] User {user.username if hasattr(user, 'username') else 'unknown'} joined event '{event.title}'")  # type: ignore[attr-defined]
                
                return Response({
                    'success': True,
                    'message': 'Вы присоединились к событию',
                }, status=status.HTTP_200_OK)
                
            elif action == 'leave':
                if user not in participants_list:
                    return Response({
                        'success': False,
                        'error': 'Вы не участник'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                event.participants.remove(user)  # type: ignore[arg-type]
                logger.info(f"🔸 User {user.username if hasattr(user, 'username') else 'unknown'} left event '{event.title}'")  # type: ignore[attr-defined]
                
                return Response({
                    'success': True,
                    'message': 'Вы покинули событие',
                }, status=status.HTTP_200_OK)
                
            else:
                return Response({
                    'success': False,
                    'error': 'Неизвестное действие'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error managing participants for event {event_id}: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при управлении участниками'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

