# custom_admin/stats_api_views.py

from typing import Any, Dict, List
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import logging
import traceback
from core.models import User, Project, Task, Photo, Activity, VolunteerProject

logger = logging.getLogger(__name__)


class UserStatsAPIView(APIView):
    """
    API для получения статистики пользователя с динамикой рейтинга
    GET /api/v1/user/stats/
    
    Возвращает:
    - Общую статистику (проекты, задачи, фото, рейтинг)
    - Динамику рейтинга за последние 30 дней
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            user = request.user
            
            # Базовая статистика
            stats = {
                'user_id': user.id if hasattr(user, 'id') else None,  # type: ignore[attr-defined]
                'username': user.username if hasattr(user, 'username') else 'unknown',  # type: ignore[attr-defined]
                'name': user.name if hasattr(user, 'name') else None,  # type: ignore[attr-defined]
                'role': user.role if hasattr(user, 'role') else None,  # type: ignore[attr-defined]
                'current_rating': float(user.rating) if hasattr(user, 'rating') and user.rating else 0.0,  # type: ignore[attr-defined]
            }
            
            # Статистика в зависимости от роли
            user_role = user.role if hasattr(user, 'role') else None  # type: ignore[attr-defined]
            if user_role == 'volunteer':
                stats.update(self._get_volunteer_stats(user))  # type: ignore[arg-type]
            elif user_role == 'organizer':
                stats.update(self._get_organizer_stats(user))  # type: ignore[arg-type]
            
            # Динамика рейтинга (Activity за последние 30 дней)
            stats['rating_history'] = self._get_rating_history(user)  # type: ignore[arg-type]
            
            return Response({
                'success': True,
                'stats': stats
            })
            
        except Exception as e:
            logger.error(f'❌ Error in UserStatsAPIView: {e}')
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc() if logger.level == logging.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_volunteer_stats(self, user: User) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
        """Статистика для волонтера"""
        # Проекты
        joined_projects = VolunteerProject.objects.filter(
            volunteer=user,
            is_active=True
        ).count()
        
        # Задачи (через TaskAssignment)
        assigned_tasks = Task.objects.filter(
            assignments__volunteer=user,
            assignments__accepted=True,
            is_deleted=False
        ).distinct().count()
        
        completed_tasks = Task.objects.filter(
            assignments__volunteer=user,
            assignments__completed=True,
            is_deleted=False
        ).distinct().count()
        
        # Фотоотчеты
        photo_reports = Photo.objects.filter(
            volunteer=user,
            is_deleted=False
        ).count()
        
        approved_photos = Photo.objects.filter(
            volunteer=user,
            status='approved',
            is_deleted=False
        ).count()
        
        # Достижения
        from core.models import UserAchievement  # type: ignore[attr-defined]
        achievements_count = 0
        if hasattr(user, 'user_achievements'):
            achievements_count = UserAchievement.objects.filter(  # type: ignore[attr-defined]
                user=user,
                unlocked_at__isnull=False
            ).count()
        
        return {
            'projects_count': joined_projects,
            'tasks_count': assigned_tasks,
            'completed_tasks_count': completed_tasks,
            'photo_reports_count': photo_reports,
            'approved_photos_count': approved_photos,
            'achievements_count': achievements_count,
        }
    
    def _get_organizer_stats(self, user: User) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
        """Статистика для организатора"""
        # Проекты организатора
        projects = Project.objects.filter(
            creator=user,
            is_deleted=False
        )
        
        total_projects = projects.count()
        # ✅ ИСПРАВЛЕНИЕ: В модели Project статус 'approved' означает одобренный (активный) проект
        active_projects = projects.filter(status='approved').count()
        # Завершенных проектов пока нет в модели, показываем 0
        completed_projects = 0
        
        # Debug логирование (без эмодзи из-за Windows console encoding)
        logger.info(f'[STATS] Organizer stats for {user.username if hasattr(user, "username") else "unknown"}:')  # type: ignore[attr-defined]
        logger.info(f'  Total projects: {total_projects}')
        logger.info(f'  Active (approved) projects: {active_projects}')
        logger.info(f'  Completed projects: {completed_projects}')
        logger.info(f'  Projects statuses: {list(projects.values_list("id", "title", "status"))}')
        
        # Волонтеры (уникальные участники проектов)
        volunteers_count = VolunteerProject.objects.filter(
            project__creator=user,
            project__is_deleted=False,
            is_active=True
        ).values('volunteer').distinct().count()
        
        # Задачи
        tasks_count = Task.objects.filter(
            project__creator=user,
            project__is_deleted=False,
            is_deleted=False
        ).count()
        
        completed_tasks = Task.objects.filter(
            project__creator=user,
            status='completed',
            project__is_deleted=False,
            is_deleted=False
        ).count()
        
        # Фотоотчеты (от волонтеров в проектах организатора)
        photo_reports = Photo.objects.filter(
            project__creator=user,
            project__is_deleted=False,
            is_deleted=False
        ).count()
        
        approved_photos = Photo.objects.filter(
            project__creator=user,
            status='approved',
            project__is_deleted=False,
            is_deleted=False
        ).count()
        
        return {
            'projects_count': total_projects,
            'active_projects_count': active_projects,
            'completed_projects_count': completed_projects,
            'volunteers_count': volunteers_count,
            'tasks_count': tasks_count,
            'completed_tasks_count': completed_tasks,
            'photo_reports_count': photo_reports,
            'approved_photos_count': approved_photos,
        }
    
    def _get_rating_history(self, user: User) -> List[Dict[str, Any]]:  # type: ignore[no-any-unimported]
        """
        Динамика рейтинга за последние 30 дней
        Возвращает массив точек для графика
        """
        end_date = timezone.now()
        start_date = end_date - timedelta(days=30)
        
        # Получаем все активности за последние 30 дней
        activities = Activity.objects.filter(
            user=user,
            created_at__gte=start_date,
            created_at__lte=end_date
        ).order_by('created_at')
        
        # Если нет активностей, возвращаем текущий рейтинг
        if not activities.exists():
            current_rating = float(user.rating) if user.rating else 0.0
            return [
                {
                    'date': (end_date - timedelta(days=29)).strftime('%Y-%m-%d'),
                    'rating': current_rating
                },
                {
                    'date': end_date.strftime('%Y-%m-%d'),
                    'rating': current_rating
                }
            ]
        
        # Строим историю рейтинга
        rating_history = []
        current_rating = float(user.rating) if user.rating else 0.0
        
        # Группируем по дням
        activities_by_day = {}
        for activity in activities:
            day = activity.created_at.strftime('%Y-%m-%d')
            if day not in activities_by_day:
                activities_by_day[day] = 0
            # Вычисляем изменение рейтинга из описания активности
            # (это упрощенный подход, в реальности лучше хранить изменение рейтинга в Activity)
            activities_by_day[day] += 1
        
        # Начальный рейтинг (вычисляем, вычитая прирост за последние 30 дней)
        total_activities = activities.count()
        estimated_rating_start = max(0, current_rating - (total_activities * 0.5))
        
        # Генерируем точки для каждого дня
        running_rating = estimated_rating_start
        for i in range(31):
            date = start_date + timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            
            # Добавляем рейтинг за активности этого дня
            if date_str in activities_by_day:
                running_rating += activities_by_day[date_str] * 0.5
            
            rating_history.append({
                'date': date_str,
                'rating': round(running_rating, 1)
            })
        
        # Корректируем последнюю точку на текущий рейтинг
        if rating_history:
            rating_history[-1]['rating'] = current_rating
        
        return rating_history


class UserActivityStatsAPIView(APIView):
    """
    API для получения детальной статистики активности
    GET /api/v1/user/activity-stats/
    
    Возвращает:
    - Статистику по дням недели
    - Статистику по типам активности
    - Последние достижения
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:  # type: ignore[override]
        try:
            user = request.user
            
            # Последние 7 дней
            end_date = timezone.now()
            start_date = end_date - timedelta(days=7)
            
            activities = Activity.objects.filter(
                user=user,
                created_at__gte=start_date,
                created_at__lte=end_date
            )
            
            # Группируем по типам
            activity_by_type = {}
            for activity in activities:
                activity_type = activity.type
                if activity_type not in activity_by_type:
                    activity_by_type[activity_type] = 0
                activity_by_type[activity_type] += 1
            
            # Последние достижения
            recent_achievements = []
            from core.models import UserAchievement  # type: ignore[attr-defined]
            user_role = user.role if hasattr(user, 'role') else None  # type: ignore[attr-defined]
            if user_role == 'volunteer' and hasattr(user, 'user_achievements'):
                achievements = UserAchievement.objects.filter(  # type: ignore[attr-defined]
                    user=user,
                    unlocked_at__isnull=False
                ).order_by('-unlocked_at')[:5]
                
                for ua in achievements:
                    recent_achievements.append({
                        'name': ua.achievement.name,
                        'description': ua.achievement.description,
                        'xp': ua.achievement.xp,
                        'unlocked_at': ua.unlocked_at.strftime('%Y-%m-%d %H:%M')
                    })
            
            return Response({
                'success': True,
                'activity_by_type': activity_by_type,
                'recent_achievements': recent_achievements,
            })
            
        except Exception as e:
            logger.error(f'❌ Error in UserActivityStatsAPIView: {e}')
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc() if logger.level == logging.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

