"""
API Views для карты проектов
"""
from typing import Any, List, Dict
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.permissions import IsAuthenticated
from core.models import Project
from django.db.models import Count, Q
import logging

logger = logging.getLogger(__name__)


class MapProjectsView(APIView):
    """
    API endpoint для получения проектов на карте
    
    GET /api/v1/map/projects/
    
    Query параметры:
    - type: фильтр по типу (social, environmental, cultural)
    - city: фильтр по городу
    - date_from: фильтр по дате начала
    - date_to: фильтр по дате окончания
    - status: фильтр по статусу (по умолчанию только approved)
    
    Возвращает список маркеров с координатами для отображения на карте
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            # Получаем параметры фильтров
            volunteer_type = request.query_params.get('type')
            city = request.query_params.get('city')
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            status = request.query_params.get('status', 'approved')  # По умолчанию только одобренные
            
            # Базовый запрос - только проекты с координатами
            projects = Project.objects.filter(
                is_deleted=False,
                latitude__isnull=False,
                longitude__isnull=False,
            )
            
            # Для обычных пользователей показываем только одобренные проекты
            # Для организаторов - их собственные проекты + одобренные других
            # Для админов - все проекты
            is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
            is_organizer = hasattr(request.user, 'is_organizer') and request.user.is_organizer  # type: ignore[attr-defined]
            
            if is_admin:
                # Админ видит все проекты
                if status and status != 'all':
                    projects = projects.filter(status=status)
            elif is_organizer:
                # Организатор видит свои проекты + одобренные других
                projects = projects.filter(
                    Q(creator=request.user) | Q(status='approved')
                )
            else:
                # Волонтер видит только одобренные
                projects = projects.filter(status='approved')
            
            # Применяем фильтры
            if volunteer_type:
                projects = projects.filter(volunteer_type=volunteer_type)
            
            if city:
                projects = projects.filter(city__icontains=city)
            
            if date_from:
                projects = projects.filter(start_date__gte=date_from)
            
            if date_to:
                projects = projects.filter(start_date__lte=date_to)
            
            # Оптимизация: выбираем связанные объекты
            projects = projects.select_related('creator').prefetch_related('volunteer_projects')
            
            # Формируем список маркеров
            from core.models import VolunteerProject  # type: ignore[attr-defined]
            markers = []
            for project in projects:
                # Подсчитываем активных участников
                volunteers_count = VolunteerProject.objects.filter(project=project, is_active=True).count()  # type: ignore[attr-defined]
                
                # Проверяем участие текущего пользователя
                is_joined = False
                if not is_organizer:
                    is_joined = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
                        project=project,
                        volunteer=request.user,
                        is_active=True
                    ).exists()
                
                # Формируем данные маркера
                marker_data = {
                    'id': project.id,  # type: ignore[attr-defined]
                    'title': project.title,
                    'description': project.description[:150] + '...' if len(project.description) > 150 else project.description,
                    'latitude': float(project.latitude),
                    'longitude': float(project.longitude),
                    'city': project.city,
                    'volunteer_type': project.volunteer_type,
                    'start_date': project.start_date.isoformat() if project.start_date else None,
                    'end_date': project.end_date.isoformat() if project.end_date else None,
                    'volunteers_count': volunteers_count,
                    'is_joined': is_joined,
                    'creator_name': project.creator.username if hasattr(project.creator, 'username') else 'unknown',  # type: ignore[attr-defined]
                    'status': project.status,
                }
                
                # Добавляем аватар создателя если есть
                if project.creator.avatar:
                    marker_data['creator_avatar'] = request.build_absolute_uri(project.creator.avatar.url)
                
                markers.append(marker_data)
            
            logger.info(f"Map API: User {request.user.username if hasattr(request.user, 'username') else 'unknown'} loaded {len(markers)} markers")  # type: ignore[attr-defined]
            
            return Response({
                'success': True,
                'markers': markers,
                'total_count': len(markers),
            })
            
        except Exception as e:
            logger.error(f"Error in MapProjectsView: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при загрузке карты проектов',
                'detail': str(e)
            }, status=500)


class MapStatsView(APIView):
    """
    API endpoint для статистики проектов на карте
    
    GET /api/v1/map/stats/
    
    Возвращает статистику проектов по типам и городам
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            # Базовый запрос
            projects = Project.objects.filter(
                is_deleted=False,
                latitude__isnull=False,
                longitude__isnull=False,
            )
            
            # Применяем права доступа
            is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
            is_organizer = hasattr(request.user, 'is_organizer') and request.user.is_organizer  # type: ignore[attr-defined]
            
            if not is_admin:
                if is_organizer:
                    projects = projects.filter(
                        Q(creator=request.user) | Q(status='approved')
                    )
                else:
                    projects = projects.filter(status='approved')
            
            # Статистика по типам
            type_stats = projects.values('volunteer_type').annotate(
                count=Count('id')
            ).order_by('-count')
            
            # Статистика по городам
            city_stats = projects.values('city').annotate(
                count=Count('id')
            ).order_by('-count')[:10]  # Топ 10 городов
            
            # Статистика по статусам (только для админов и организаторов)
            status_stats = []
            if is_admin or is_organizer:
                if is_admin:
                    all_projects = Project.objects.filter(is_deleted=False)
                else:
                    all_projects = Project.objects.filter(
                        creator=request.user,
                        is_deleted=False
                    )
                
                status_stats = list(all_projects.values('status').annotate(
                    count=Count('id')
                ))
            
            return Response({
                'success': True,
                'stats': {
                    'total': projects.count(),
                    'by_type': list(type_stats),
                    'by_city': list(city_stats),
                    'by_status': status_stats,
                }
            })
            
        except Exception as e:
            logger.error(f"Error in MapStatsView: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Ошибка при загрузке статистики',
            }, status=500)





