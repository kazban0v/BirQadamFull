"""
🔍 API Views для глобального поиска и расширенных фильтров
"""
import logging
from typing import Any, Dict
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.request import Request
from django.db.models import Q, Count, Avg
from django.core.paginator import Paginator

from api.models import User, Project, Task, Photo

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def global_search(request: Request) -> Response:
    """
    Глобальный поиск по всем сущностям
    
    GET /custom-admin/api/v1/search/global/?q=запрос&type=all&page=1
    
    Типы поиска:
    - all: поиск везде
    - users: только пользователи
    - projects: только проекты
    - tasks: только задачи
    """
    try:
        query = request.GET.get('q', '').strip()
        search_type = request.GET.get('type', 'all')
        page_num = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        
        if not query or len(query) < 2:
            return Response({
                'results': [],
                'total': 0,
                'message': 'Введите минимум 2 символа для поиска'
            }, status=status.HTTP_200_OK)
        
        results = {
            'query': query,
            'users': [],
            'projects': [],
            'tasks': [],
            'total': 0
        }
        
        # Поиск пользователей
        if search_type in ['all', 'users']:
            users = User.objects.filter(
                Q(username__icontains=query) |
                Q(name__icontains=query) |
                Q(email__icontains=query)
            ).annotate(
                projects_count=Count('created_projects', distinct=True),
                volunteer_count=Count('volunteer_projects', distinct=True)
            )[:page_size if search_type == 'users' else 5]
            
            results['users'] = [{
                'id': user.id if hasattr(user, 'id') else None,  # type: ignore[attr-defined]
                'username': user.username if hasattr(user, 'username') else 'unknown',  # type: ignore[attr-defined]
                'name': user.name if hasattr(user, 'name') else None,  # type: ignore[attr-defined]
                'email': user.email if hasattr(user, 'email') else None,  # type: ignore[attr-defined]
                'role': user.role if hasattr(user, 'role') else None,  # type: ignore[attr-defined]
                'rating': user.rating if hasattr(user, 'rating') else None,  # type: ignore[attr-defined]
                'avatar': user.avatar.url if hasattr(user, 'avatar') and user.avatar else None,
                'projects_count': user.projects_count,  # type: ignore[attr-defined]
                'volunteer_count': user.volunteer_count  # type: ignore[attr-defined]
            } for user in users]
        
        # Поиск проектов
        if search_type in ['all', 'projects']:
            projects = Project.objects.filter(
                Q(title__icontains=query) |
                Q(description__icontains=query) |
                Q(city__icontains=query) |
                Q(tags__name__icontains=query),
                deleted_at__isnull=True
            ).annotate(
                volunteers_count=Count('volunteer_projects', distinct=True)
            ).distinct()[:page_size if search_type == 'projects' else 5]
            
            results['projects'] = [{
                'id': project.id,  # type: ignore[attr-defined]
                'title': project.title,
                'description': project.description[:200],
                'city': project.city,
                'status': project.status,
                'creator': {
                    'id': project.creator.id if hasattr(project.creator, 'id') else None,  # type: ignore[attr-defined]
                    'name': (project.creator.name if hasattr(project.creator, 'name') else None) or (project.creator.username if hasattr(project.creator, 'username') else 'unknown')  # type: ignore[attr-defined]
                },
                'volunteers_count': project.volunteers_count,  # type: ignore[attr-defined]
                'start_date': project.start_date.isoformat() if project.start_date else None,
                'tags': [tag.name for tag in project.tags.all()[:5]]
            } for project in projects]
        
        # Поиск задач
        if search_type in ['all', 'tasks']:
            tasks = Task.objects.filter(
                Q(text__icontains=query) |
                Q(project__title__icontains=query),
                deleted_at__isnull=True
            ).select_related('project', 'creator').annotate(
                volunteers_count=Count('assignments', distinct=True)
            )[:page_size if search_type == 'tasks' else 5]
            
            results['tasks'] = [{
                'id': task.id,  # type: ignore[attr-defined]
                'text': task.text,
                'status': task.status,
                'project': {
                    'id': task.project.id,  # type: ignore[attr-defined]
                    'title': task.project.title
                },
                'creator': {
                    'id': task.creator.id if hasattr(task.creator, 'id') else None,  # type: ignore[attr-defined]
                    'name': (task.creator.name if hasattr(task.creator, 'name') else None) or (task.creator.username if hasattr(task.creator, 'username') else 'unknown')  # type: ignore[attr-defined]
                },
                'volunteers_count': task.volunteers_count,  # type: ignore[attr-defined]
                'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None
            } for task in tasks]
        
        results['total'] = len(results['users']) + len(results['projects']) + len(results['tasks'])
        
        return Response(results, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka globalnogo poiska: {e}")
        return Response({
            'error': 'Ошибка поиска',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def advanced_user_search(request: Request) -> Response:
    """
    Расширенный поиск пользователей с фильтрами
    
    GET /custom-admin/api/v1/search/users/?role=volunteer&city=Алматы&rating_min=10&rating_max=50&active=true
    """
    try:
        queryset = User.objects.all()
        
        # Фильтр по роли
        role = request.GET.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        # Фильтр по рейтингу
        rating_min = request.GET.get('rating_min')
        if rating_min:
            queryset = queryset.filter(rating__gte=int(rating_min))
        
        rating_max = request.GET.get('rating_max')
        if rating_max:
            queryset = queryset.filter(rating__lte=int(rating_max))
        
        # Фильтр по активности
        is_active = request.GET.get('active')
        if is_active == 'true':
            from datetime import timedelta
            from django.utils import timezone
            active_since = timezone.now() - timedelta(days=30)
            queryset = queryset.filter(last_login__gte=active_since)
        
        # Фильтр по статусу организатора
        is_organizer = request.GET.get('is_organizer')
        if is_organizer:
            queryset = queryset.filter(is_organizer=is_organizer == 'true')
        
        # Текстовый поиск
        search = request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(name__icontains=search) |
                Q(email__icontains=search)
            )
        
        # Сортировка
        sort_by = request.GET.get('sort_by', '-rating')
        queryset = queryset.order_by(sort_by)
        
        # Пагинация
        page_num = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_num)
        
        # Аннотации
        from api.models import VolunteerProject, TaskAssignment  # type: ignore[attr-defined]
        results = []
        for user in page:
            projects_count = 0
            tasks_completed = 0
            if hasattr(user, 'volunteer_projects'):
                projects_count = VolunteerProject.objects.filter(volunteer=user).count()  # type: ignore[attr-defined]
            if hasattr(user, 'assignments'):
                tasks_completed = TaskAssignment.objects.filter(volunteer=user, completed=True).count()  # type: ignore[attr-defined]
            
            results.append({
                'id': user.id if hasattr(user, 'id') else None,  # type: ignore[attr-defined]
                'username': user.username if hasattr(user, 'username') else 'unknown',  # type: ignore[attr-defined]
                'name': user.name if hasattr(user, 'name') else None,  # type: ignore[attr-defined]
                'email': user.email if hasattr(user, 'email') else None,  # type: ignore[attr-defined]
                'role': user.role if hasattr(user, 'role') else None,  # type: ignore[attr-defined]
                'rating': user.rating if hasattr(user, 'rating') else None,  # type: ignore[attr-defined]
                'is_organizer': user.is_organizer if hasattr(user, 'is_organizer') else False,  # type: ignore[attr-defined]
                'is_approved': user.is_approved if hasattr(user, 'is_approved') else False,  # type: ignore[attr-defined]
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'avatar': user.avatar.url if hasattr(user, 'avatar') and user.avatar else None,
                'projects_count': projects_count,
                'tasks_completed': tasks_completed
            })
        
        return Response({
            'results': results,
            'total': paginator.count,
            'page': page_num,
            'pages': paginator.num_pages,
            'page_size': page_size
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka rasshirennogo poiska polzovateley: {e}")
        return Response({
            'error': 'Ошибка поиска',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def advanced_project_search(request: Request) -> Response:
    """
    Расширенный поиск проектов с фильтрами
    
    GET /custom-admin/api/v1/search/projects/?status=approved&city=Алматы&tags=природа&date_from=2025-01-01
    """
    try:
        queryset = Project.objects.filter(deleted_at__isnull=True)
        
        # Фильтр по статусу
        project_status = request.GET.get('status')
        if project_status:
            queryset = queryset.filter(status=project_status)
        
        # Фильтр по городу
        city = request.GET.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        # Фильтр по тегам
        tags = request.GET.get('tags')
        if tags:
            tag_list = tags.split(',')
            for tag in tag_list:
                queryset = queryset.filter(tags__name__icontains=tag.strip())
        
        # Фильтр по дате
        date_from = request.GET.get('date_from')
        if date_from:
            queryset = queryset.filter(start_date__gte=date_from)
        
        date_to = request.GET.get('date_to')
        if date_to:
            queryset = queryset.filter(start_date__lte=date_to)
        
        # Фильтр по создателю
        creator_id = request.GET.get('creator_id')
        if creator_id:
            queryset = queryset.filter(creator_id=int(creator_id))
        
        # Текстовый поиск
        search = request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )
        
        # Сортировка
        sort_by = request.GET.get('sort_by', '-created_at')
        queryset = queryset.order_by(sort_by)
        
        # Пагинация
        page_num = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        queryset = queryset.select_related('creator').annotate(
            volunteers_count=Count('volunteer_projects', distinct=True)
        )
        
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_num)
        
        results = []
        for project in page:
            results.append({
                'id': project.id,  # type: ignore[attr-defined]
                'title': project.title,
                'description': project.description[:300],
                'city': project.city,
                'status': project.status,
                'creator': {
                    'id': project.creator.id if hasattr(project.creator, 'id') else None,  # type: ignore[attr-defined]
                    'name': (project.creator.name if hasattr(project.creator, 'name') else None) or (project.creator.username if hasattr(project.creator, 'username') else 'unknown'),  # type: ignore[attr-defined]
                    'username': project.creator.username if hasattr(project.creator, 'username') else 'unknown'  # type: ignore[attr-defined]
                },
                'volunteers_count': project.volunteers_count,  # type: ignore[attr-defined]
                'start_date': project.start_date.isoformat() if project.start_date else None,
                'end_date': project.end_date.isoformat() if project.end_date else None,
                'created_at': project.created_at.isoformat(),
                'tags': [tag.name for tag in project.tags.all()],
                'latitude': float(project.latitude) if project.latitude else None,
                'longitude': float(project.longitude) if project.longitude else None
            })
        
        return Response({
            'results': results,
            'total': paginator.count,
            'page': page_num,
            'pages': paginator.num_pages,
            'page_size': page_size
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka rasshirennogo poiska proektov: {e}")
        return Response({
            'error': 'Ошибка поиска',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def save_search_filter(request: Request) -> Response:
    """
    Сохранение пользовательского фильтра
    
    POST /custom-admin/api/v1/search/save-filter/
    {
        "name": "Мои волонтеры в Алматы",
        "filter_type": "users",
        "filters": {
            "role": "volunteer",
            "city": "Алматы",
            "rating_min": 10
        }
    }
    """
    try:
        from api.models import UserSearchFilter
        
        name = request.data.get('name')
        filter_type = request.data.get('filter_type')
        filters = request.data.get('filters', {})
        
        if not name or not filter_type:
            return Response({
                'error': 'Укажите название и тип фильтра'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем или обновляем фильтр
        search_filter, created = UserSearchFilter.objects.update_or_create(
            user=request.user,
            name=name,
            defaults={
                'filter_type': filter_type,
                'filters': filters
            }
        )
        
        return Response({
            'id': search_filter.id,  # type: ignore[attr-defined]
            'name': search_filter.name,
            'filter_type': search_filter.filter_type,
            'filters': search_filter.filters,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"[ERROR] Oshibka sokhraneniya filtra: {e}")
        return Response({
            'error': 'Ошибка сохранения фильтра',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_saved_filters(request: Request) -> Response:
    """
    Список сохраненных фильтров пользователя
    
    GET /custom-admin/api/v1/search/saved-filters/
    """
    try:
        from api.models import UserSearchFilter
        
        filters = UserSearchFilter.objects.filter(user=request.user).order_by('-created_at')
        
        results = [{
            'id': f.id,  # type: ignore[attr-defined]
            'name': f.name,
            'filter_type': f.filter_type,
            'filters': f.filters,
            'created_at': f.created_at.isoformat()
        } for f in filters]
        
        return Response({
            'results': results
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        # Если модели еще нет, возвращаем пустой список
        return Response({
            'results': []
        }, status=status.HTTP_200_OK)

