"""
🗺️ API Views для интерактивной карты активности
"""
import logging
from typing import Any
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.request import Request
from django.db.models import Count, Q
from datetime import timedelta
from django.utils import timezone

from core.models import Project, User, Task

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])  # Карта доступна всем
def get_projects_map_data(request: Request) -> Response:
    """
    Получить данные проектов для отображения на карте
    
    GET /custom-admin/api/v1/map/projects/
    ?status=approved&city=Алматы&date_from=2025-01-01&cluster=true
    
    Returns GeoJSON format for easy map integration
    """
    try:
        # Фильтруем только проекты с координатами
        queryset = Project.objects.filter(
            is_deleted=False,
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        # Фильтр по статусу
        project_status = request.GET.get('status', 'approved')
        if project_status:
            queryset = queryset.filter(status=project_status)
        
        # Фильтр по городу с транслитерацией
        city = request.GET.get('city')
        if city:
            logger.info(f"[MAP] Filtering by city: '{city}'")
            
            # Транслитерация кириллицы в латиницу
            translit_map = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
                'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
                'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
                'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
                'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
                'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
                'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
                'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
            }
            
            city_latin = ''.join(translit_map.get(c, c) for c in city)
            logger.info(f"[MAP] Transliterated to: '{city_latin}'")
            
            # Ищем и по оригиналу и по транслитерации
            queryset = queryset.filter(
                Q(city__icontains=city) | 
                Q(city__icontains=city_latin) |
                Q(city__iexact=city) |
                Q(city__iexact=city_latin)
            )
            logger.info(f"[MAP] Found {queryset.count()} projects after city filter")
        
        # Фильтр по дате
        date_from = request.GET.get('date_from')
        if date_from:
            queryset = queryset.filter(start_date__gte=date_from)
        
        date_to = request.GET.get('date_to')
        if date_to:
            queryset = queryset.filter(start_date__lte=date_to)
        
        # Логируем уникальные города для отладки
        if city:
            all_cities = Project.objects.filter(is_deleted=False).values_list('city', flat=True).distinct()
            logger.info(f"[MAP] Available cities in DB: {list(all_cities)[:10]}")
        
        # Аннотации
        queryset = queryset.select_related('creator').annotate(
            volunteers_count=Count('volunteer_projects', filter=Q(volunteer_projects__is_active=True), distinct=True),
            tasks_count=Count('tasks', filter=Q(tasks__is_deleted=False), distinct=True)
        )
        
        # Формируем GeoJSON
        features = []
        for project in queryset:
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(project.longitude), float(project.latitude)]
                },
                'properties': {
                    'id': project.id,  # type: ignore[attr-defined]
                    'title': project.title,
                    'description': project.description[:200],
                    'status': project.status,
                    'city': project.city,
                    'creator': {
                        'id': project.creator.id if hasattr(project.creator, 'id') else None,  # type: ignore[attr-defined]
                        'name': (project.creator.name if hasattr(project.creator, 'name') else None) or (project.creator.username if hasattr(project.creator, 'username') else 'unknown')  # type: ignore[attr-defined]
                    },
                    'volunteers_count': project.volunteers_count,  # type: ignore[attr-defined]
                    'tasks_count': project.tasks_count,  # type: ignore[attr-defined]
                    'start_date': project.start_date.isoformat() if project.start_date else None,
                    'end_date': project.end_date.isoformat() if project.end_date else None,
                    'tags': [tag.name for tag in project.tags.all()[:5]]
                }
            })
        
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        return Response(geojson, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения данных карты проектов: {e}")
        return Response({
            'error': 'Ошибка загрузки данных карты',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_heatmap_data(request: Request) -> Response:
    """
    Получить данные для тепловой карты активности
    
    GET /custom-admin/api/v1/map/heatmap/
    ?days=30&intensity=volunteers
    
    intensity options: volunteers, projects, tasks
    """
    try:
        days = int(request.GET.get('days', 30))
        intensity_type = request.GET.get('intensity', 'projects')
        
        since_date = timezone.now() - timedelta(days=days)
        
        # Получаем активные проекты с координатами
        projects = Project.objects.filter(
            is_deleted=False,
            latitude__isnull=False,
            longitude__isnull=False,
            created_at__gte=since_date
        ).select_related('creator').annotate(
            volunteers_count=Count('volunteer_projects', filter=Q(volunteer_projects__is_active=True), distinct=True),
            tasks_count=Count('tasks', filter=Q(tasks__is_deleted=False), distinct=True)
        )
        
        heatmap_data = []
        for project in projects:
            # Определяем интенсивность
            if intensity_type == 'volunteers':
                intensity = project.volunteers_count  # type: ignore[attr-defined]
            elif intensity_type == 'tasks':
                intensity = project.tasks_count  # type: ignore[attr-defined]
            else:  # projects
                intensity = 1
            
            heatmap_data.append({
                'lat': float(project.latitude),
                'lng': float(project.longitude),
                'intensity': intensity,
                'project_id': project.id,  # type: ignore[attr-defined]
                'project_title': project.title
            })
        
        return Response({
            'heatmap_data': heatmap_data,
            'total_points': len(heatmap_data),
            'period_days': days,
            'intensity_type': intensity_type
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения данных тепловой карты: {e}")
        return Response({
            'error': 'Ошибка загрузки данных тепловой карты',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_city_statistics(request: Request) -> Response:
    """
    Получить статистику по городам для карты
    
    GET /custom-admin/api/v1/map/city-stats/
    """
    try:
        # Группируем проекты по городам
        from django.db.models import Count
        
        city_stats = Project.objects.filter(
            is_deleted=False,
            status='approved'
        ).values('city').annotate(
            projects_count=Count('id', distinct=True),
            total_volunteers=Count('volunteer_projects', filter=Q(volunteer_projects__is_active=True), distinct=True)
        ).order_by('-projects_count')[:20]  # Топ 20 городов
        
        result = []
        for stat in city_stats:
            if stat['city']:
                result.append({
                    'city': stat['city'],
                    'projects_count': stat['projects_count'],
                    'volunteers_count': stat['total_volunteers']
                })
        
        return Response({
            'cities': result,
            'total_cities': len(result)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения статистики по городам: {e}")
        return Response({
            'error': 'Ошибка загрузки статистики',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_project_clusters(request: Request) -> Response:
    """
    Получить кластеры проектов для оптимизации отображения на карте
    
    GET /custom-admin/api/v1/map/clusters/
    ?bounds=51.0,71.0,52.0,72.0&zoom=10
    """
    try:
        # Получаем bounds (границы видимой области карты)
        bounds = request.GET.get('bounds')  # format: minLat,minLng,maxLat,maxLng
        zoom = int(request.GET.get('zoom', 10))
        
        queryset = Project.objects.filter(
            is_deleted=False,
            status='approved',
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        # Если указаны границы, фильтруем по ним
        if bounds:
            try:
                min_lat, min_lng, max_lat, max_lng = map(float, bounds.split(','))
                queryset = queryset.filter(
                    latitude__gte=min_lat,
                    latitude__lte=max_lat,
                    longitude__gte=min_lng,
                    longitude__lte=max_lng
                )
            except ValueError:
                pass
        
        projects = queryset.select_related('creator').annotate(
            volunteers_count=Count('volunteer_projects', distinct=True)
        )
        
        # Для больших масштабов (zoom < 12) группируем в кластеры
        if zoom < 12:
            # Простая кластеризация по сетке
            grid_size = 0.1  # Размер ячейки сетки в градусах
            clusters = {}
            
            for project in projects:
                # Округляем координаты до ближайшей ячейки сетки
                lat_key = round(float(project.latitude) / grid_size) * grid_size
                lng_key = round(float(project.longitude) / grid_size) * grid_size
                cluster_key = (lat_key, lng_key)
                
                if cluster_key not in clusters:
                    clusters[cluster_key] = {
                        'lat': lat_key,
                        'lng': lng_key,
                        'projects': [],
                        'total_volunteers': 0
                    }
                
                clusters[cluster_key]['projects'].append({
                    'id': project.id,  # type: ignore[attr-defined]
                    'title': project.title
                })
                clusters[cluster_key]['total_volunteers'] += project.volunteers_count  # type: ignore[attr-defined]
            
            result = []
            for cluster_key, cluster_data in clusters.items():
                result.append({
                    'lat': cluster_data['lat'],
                    'lng': cluster_data['lng'],
                    'count': len(cluster_data['projects']),
                    'total_volunteers': cluster_data['total_volunteers'],
                    'projects': cluster_data['projects'][:5]  # Показываем первые 5
                })
            
            return Response({
                'clusters': result,
                'total_clusters': len(result),
                'is_clustered': True
            }, status=status.HTTP_200_OK)
        
        else:
            # Для маленьких масштабов показываем все проекты
            result = []
            for project in projects:
                result.append({
                    'id': project.id,  # type: ignore[attr-defined]
                    'lat': float(project.latitude),
                    'lng': float(project.longitude),
                    'title': project.title,
                    'volunteers_count': project.volunteers_count  # type: ignore[attr-defined]
                })
            
            return Response({
                'projects': result,
                'total_projects': len(result),
                'is_clustered': False
            }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения кластеров проектов: {e}")
        return Response({
            'error': 'Ошибка загрузки кластеров',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_volunteer_heatmap(request: Request) -> Response:
    """
    Тепловая карта активности волонтеров
    
    GET /custom-admin/api/v1/map/volunteer-heatmap/
    ?days=30
    """
    try:
        days = int(request.GET.get('days', 30))
        since_date = timezone.now() - timedelta(days=days)
        
        # Получаем активных волонтеров с их проектами
        from core.models import VolunteerProject
        
        volunteer_activities = VolunteerProject.objects.filter(
            joined_at__gte=since_date,
            is_active=True,
            project__latitude__isnull=False,
            project__longitude__isnull=False,
            project__is_deleted=False
        ).select_related('project', 'volunteer').values(
            'project__latitude',
            'project__longitude',
            'project__city'
        ).annotate(
            volunteer_count=Count('volunteer', distinct=True)
        )
        
        heatmap_data = []
        for activity in volunteer_activities:
            heatmap_data.append({
                'lat': float(activity['project__latitude']),
                'lng': float(activity['project__longitude']),
                'intensity': activity['volunteer_count'],
                'city': activity['project__city']
            })
        
        return Response({
            'heatmap_data': heatmap_data,
            'total_points': len(heatmap_data),
            'period_days': days
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения тепловой карты волонтеров: {e}")
        return Response({
            'error': 'Ошибка загрузки данных',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

