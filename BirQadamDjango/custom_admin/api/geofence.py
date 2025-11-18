# custom_admin/geofence_api_views.py
"""
API для управления геолокационными напоминаниями
"""

from typing import Any
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from core.models import GeofenceReminder, Project, Event
from decimal import Decimal
import math
import logging

logger = logging.getLogger(__name__)


class GeofenceReminderAPIView(APIView):
    """
    GET: Получить все напоминания пользователя
    POST: Создать новое напоминание
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        """Получить все напоминания пользователя"""
        try:
            user = request.user
            
            # Фильтры
            is_active = request.query_params.get('is_active', None)
            project_id = request.query_params.get('project_id', None)
            event_id = request.query_params.get('event_id', None)
            
            # Базовый queryset
            reminders = GeofenceReminder.objects.filter(user=user)
            
            # Применение фильтров
            if is_active is not None:
                reminders = reminders.filter(is_active=is_active.lower() == 'true')
            
            if project_id:
                reminders = reminders.filter(project_id=project_id)
            
            if event_id:
                reminders = reminders.filter(event_id=event_id)
            
            # Сортировка
            reminders = reminders.order_by('-created_at')
            
            # Формирование ответа
            reminders_data = []
            for reminder in reminders:
                reminders_data.append({
                    'id': reminder.id,  # type: ignore[attr-defined]
                    'title': reminder.title or reminder.get_location_name(),
                    'message': reminder.message,
                    'latitude': float(reminder.latitude),
                    'longitude': float(reminder.longitude),
                    'radius': reminder.radius,
                    'is_active': reminder.is_active,
                    'is_triggered': reminder.is_triggered,
                    'project': {
                        'id': reminder.project.id if reminder.project and hasattr(reminder.project, 'id') else None,  # type: ignore[attr-defined]
                        'title': reminder.project.title,
                    } if reminder.project else None,
                    'event': {
                        'id': reminder.event.id if reminder.event and hasattr(reminder.event, 'id') else None,  # type: ignore[attr-defined]
                        'title': reminder.event.title,
                    } if reminder.event else None,
                    'triggered_at': reminder.triggered_at.isoformat() if reminder.triggered_at else None,
                    'created_at': reminder.created_at.isoformat(),
                })
            
            return Response({
                'success': True,
                'reminders': reminders_data,
                'count': len(reminders_data),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching geofence reminders: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request: Request) -> Response:  # type: ignore[override]
        """Создать новое напоминание"""
        try:
            user = request.user
            data = request.data
            
            # Валидация обязательных полей
            if 'latitude' not in data or 'longitude' not in data:
                return Response({
                    'success': False,
                    'error': 'Latitude and longitude are required',
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Создание напоминания
            reminder = GeofenceReminder.objects.create(
                user=user,
                title=data.get('title', ''),
                message=data.get('message', ''),
                latitude=Decimal(str(data['latitude'])),
                longitude=Decimal(str(data['longitude'])),
                radius=data.get('radius', 500),
                project_id=data.get('project_id'),
                event_id=data.get('event_id'),
                is_active=data.get('is_active', True),
            )
            
            return Response({
                'success': True,
                'reminder': {
                    'id': reminder.id,  # type: ignore[attr-defined]
                    'title': reminder.title or reminder.get_location_name(),
                    'message': reminder.message,
                    'latitude': float(reminder.latitude),
                    'longitude': float(reminder.longitude),
                    'radius': reminder.radius,
                    'is_active': reminder.is_active,
                    'created_at': reminder.created_at.isoformat(),
                },
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating geofence reminder: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GeofenceReminderDetailAPIView(APIView):
    """
    GET: Получить детали напоминания
    PUT: Обновить напоминание
    DELETE: Удалить напоминание
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request, reminder_id: int) -> Response:  # type: ignore[override]
        """Получить детали напоминания"""
        try:
            user = request.user
            reminder = GeofenceReminder.objects.get(id=reminder_id, user=user)
            
            return Response({
                'success': True,
                'reminder': {
                    'id': reminder.id,  # type: ignore[attr-defined]
                    'title': reminder.title or reminder.get_location_name(),
                    'message': reminder.message,
                    'latitude': float(reminder.latitude),
                    'longitude': float(reminder.longitude),
                    'radius': reminder.radius,
                    'is_active': reminder.is_active,
                    'is_triggered': reminder.is_triggered,
                    'project': {
                        'id': reminder.project.id if reminder.project and hasattr(reminder.project, 'id') else None,  # type: ignore[attr-defined]
                        'title': reminder.project.title,
                        'latitude': float(reminder.project.latitude) if reminder.project.latitude else None,
                        'longitude': float(reminder.project.longitude) if reminder.project.longitude else None,
                    } if reminder.project else None,
                    'event': {
                        'id': reminder.event.id if reminder.event and hasattr(reminder.event, 'id') else None,  # type: ignore[attr-defined]
                        'title': reminder.event.title,
                        'location': reminder.event.location,
                    } if reminder.event else None,
                    'triggered_at': reminder.triggered_at.isoformat() if reminder.triggered_at else None,
                    'created_at': reminder.created_at.isoformat(),
                    'updated_at': reminder.updated_at.isoformat(),
                },
            }, status=status.HTTP_200_OK)
            
        except GeofenceReminder.DoesNotExist:  # type: ignore[attr-defined]
            return Response({
                'success': False,
                'error': 'Reminder not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error fetching geofence reminder detail: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request: Request, reminder_id: int) -> Response:  # type: ignore[override]
        """Обновить напоминание"""
        try:
            user = request.user
            reminder = GeofenceReminder.objects.get(id=reminder_id, user=user)
            data = request.data
            
            # Обновление полей
            if 'title' in data:
                reminder.title = data['title']
            if 'message' in data:
                reminder.message = data['message']
            if 'latitude' in data:
                reminder.latitude = Decimal(str(data['latitude']))
            if 'longitude' in data:
                reminder.longitude = Decimal(str(data['longitude']))
            if 'radius' in data:
                reminder.radius = data['radius']
            if 'is_active' in data:
                reminder.is_active = data['is_active']
            
            reminder.save()
            
            return Response({
                'success': True,
                'reminder': {
                    'id': reminder.id,  # type: ignore[attr-defined]
                    'title': reminder.title or reminder.get_location_name(),
                    'message': reminder.message,
                    'latitude': float(reminder.latitude),
                    'longitude': float(reminder.longitude),
                    'radius': reminder.radius,
                    'is_active': reminder.is_active,
                    'updated_at': reminder.updated_at.isoformat(),
                },
            }, status=status.HTTP_200_OK)
            
        except GeofenceReminder.DoesNotExist:  # type: ignore[attr-defined]
            return Response({
                'success': False,
                'error': 'Reminder not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating geofence reminder: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request: Request, reminder_id: int) -> Response:  # type: ignore[override]
        """Удалить напоминание"""
        try:
            user = request.user
            reminder = GeofenceReminder.objects.get(id=reminder_id, user=user)
            reminder.delete()
            
            return Response({
                'success': True,
                'message': 'Reminder deleted successfully',
            }, status=status.HTTP_200_OK)
            
        except GeofenceReminder.DoesNotExist:  # type: ignore[attr-defined]
            return Response({
                'success': False,
                'error': 'Reminder not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting geofence reminder: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GeofenceCheckAPIView(APIView):
    """
    POST: Проверить текущую позицию относительно всех активных напоминаний
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request: Request) -> Response:  # type: ignore[override]
        """Проверить текущую позицию"""
        try:
            user = request.user
            data = request.data
            
            # Валидация
            if 'latitude' not in data or 'longitude' not in data:
                return Response({
                    'success': False,
                    'error': 'Latitude and longitude are required',
                }, status=status.HTTP_400_BAD_REQUEST)
            
            current_lat = float(data['latitude'])
            current_lon = float(data['longitude'])
            
            # Получить все активные напоминания
            reminders = GeofenceReminder.objects.filter(
                user=user,
                is_active=True,
                is_triggered=False,
            )
            
            triggered_reminders = []
            
            for reminder in reminders:
                distance = self._calculate_distance(
                    current_lat, current_lon,
                    float(reminder.latitude), float(reminder.longitude)
                )
                
                # Если расстояние меньше радиуса - сработало
                if distance <= reminder.radius:
                    reminder.is_triggered = True
                    reminder.triggered_at = timezone.now()
                    reminder.save()
                    
                    triggered_reminders.append({
                        'id': reminder.id,  # type: ignore[attr-defined]
                        'title': reminder.title or reminder.get_location_name(),
                        'message': reminder.message,
                        'distance': round(distance, 2),
                        'latitude': float(reminder.latitude),
                        'longitude': float(reminder.longitude),
                        'radius': reminder.radius,
                        'is_active': reminder.is_active,
                        'is_triggered': reminder.is_triggered,
                        'project': {
                            'id': reminder.project.id if reminder.project and hasattr(reminder.project, 'id') else None,  # type: ignore[attr-defined]
                            'title': reminder.project.title,
                        } if reminder.project else None,
                        'event': {
                            'id': reminder.event.id if reminder.event and hasattr(reminder.event, 'id') else None,  # type: ignore[attr-defined]
                            'title': reminder.event.title,
                        } if reminder.event else None,
                        'triggered_at': reminder.triggered_at.isoformat() if reminder.triggered_at else None,
                        'created_at': reminder.created_at.isoformat(),
                    })
            
            return Response({
                'success': True,
                'triggered': len(triggered_reminders) > 0,
                'reminders': triggered_reminders,
                'count': len(triggered_reminders),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error checking geofence: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @staticmethod
    def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Вычислить расстояние между двумя точками (формула Haversine)
        Возвращает расстояние в метрах
        """
        R = 6371000  # Радиус Земли в метрах
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2)**2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda/2)**2
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c  # В метрах


class GeofenceProjectsAPIView(APIView):
    """
    GET: Получить все проекты с координатами (для создания напоминаний)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        """Получить проекты с координатами"""
        try:
            user = request.user
            
            # Получить проекты волонтера или организатора
            is_organizer = hasattr(user, 'is_organizer') and user.is_organizer  # type: ignore[attr-defined]
            if is_organizer:
                projects = Project.objects.filter(
                    creator=user,
                    is_deleted=False,
                    latitude__isnull=False,
                    longitude__isnull=False,
                ).order_by('-created_at')
            else:
                projects = Project.objects.filter(
                    volunteer_projects__volunteer=user,
                    volunteer_projects__is_active=True,
                    is_deleted=False,
                    latitude__isnull=False,
                    longitude__isnull=False,
                ).distinct().order_by('-created_at')
            
            projects_data = []
            for project in projects:
                projects_data.append({
                    'id': project.id,  # type: ignore[attr-defined]
                    'title': project.title,
                    'description': project.description[:100] + '...' if len(project.description) > 100 else project.description,
                    'city': project.city,
                    'latitude': float(project.latitude),
                    'longitude': float(project.longitude),
                    'status': project.status,
                    'start_date': project.start_date.isoformat() if project.start_date else None,
                })
            
            return Response({
                'success': True,
                'projects': projects_data,
                'count': len(projects_data),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching projects with coordinates: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GeofenceEventsAPIView(APIView):
    """
    GET: Получить все события с локацией (для создания напоминаний)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        """Получить события с локацией"""
        try:
            user = request.user
            
            # Получить события пользователя
            events = Event.objects.filter(
                Q(creator=user) | Q(participants=user),
                is_deleted=False,
                location__isnull=False,
            ).exclude(location='').distinct().order_by('start_date')
            
            events_data = []
            for event in events:
                events_data.append({
                    'id': event.id,  # type: ignore[attr-defined]
                    'title': event.title,
                    'description': event.description[:100] + '...' if len(event.description) > 100 else event.description,
                    'location': event.location,
                    'start_date': event.start_date.isoformat(),
                    'start_time': event.start_time.isoformat() if event.start_time else None,
                    'event_type': event.event_type,
                })
            
            return Response({
                'success': True,
                'events': events_data,
                'count': len(events_data),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching events with location: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

