from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple
import logging

from django.db.models import Count, Q

from django.utils import timezone

from api.achievements.models import Achievement, UserAchievement
from api.users.models import Activity
from api.tasks.models import TaskAssignment, Photo
from api.projects.models import VolunteerProject

logger = logging.getLogger(__name__)


def get_volunteer_stats(user) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    rating = user.rating or 0
    max_rating = 750
    level_size = 100
    level = min((rating // level_size) + 1, max_rating // level_size + 1)
    next_level_rating = min((level) * level_size, max_rating)
    previous_level_rating = max(0, next_level_rating - level_size)
    span = max(next_level_rating - previous_level_rating, 1)
    progress = min(max((rating - previous_level_rating) / span, 0), 1)

    user_achievements_qs = UserAchievement.objects.select_related('achievement').filter(user=user)
    unlocked_map = {ua.achievement_id: ua for ua in user_achievements_qs}

    achievements_data: List[Dict[str, Any]] = []
    achievements_qs = Achievement.objects.all().order_by('required_rating')
    
    # Логируем для отладки
    import logging
    logger = logging.getLogger(__name__)
    achievements_count = achievements_qs.count()
    logger.info(f'Found {achievements_count} achievements in database')
    if achievements_count > 0:
        logger.info(f'First achievement: {achievements_qs.first().name if achievements_qs.first() else None}')

    for achievement in achievements_qs:
        unlocked = achievement.id in unlocked_map
        unlocked_at = None
        if unlocked and achievement.id in unlocked_map:
            unlocked_at_obj = unlocked_map[achievement.id].unlocked_at
            if unlocked_at_obj:
                # Оставляем как datetime объект, сериализатор сам преобразует
                unlocked_at = unlocked_at_obj
        achievements_data.append(
            {
                'id': achievement.id,
                'name': achievement.name,
                'description': achievement.description,
                'icon': achievement.icon,
                'required_rating': achievement.required_rating,
                'xp': achievement.xp,
                'unlocked': unlocked,
                'unlocked_at': unlocked_at,
            }
        )

    result = {
        'rating': rating,
        'level': level,
        'next_level_rating': next_level_rating,
        'previous_level_rating': previous_level_rating,
        'progress': progress,
        'achievements': achievements_data,
        'unlocked_achievements': len(unlocked_map),
        'total_achievements': achievements_qs.count(),
    }
    
    # Логируем для отладки
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f'get_volunteer_stats: returning {len(achievements_data)} achievements')
    if achievements_data:
        logger.info(f'First achievement: {achievements_data[0]}')
    
    return result


from datetime import timedelta

def get_volunteer_activity(user, start_date_str: str = None, end_date_str: str = None) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    now = timezone.now()
    
    if start_date_str:
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=timezone.get_current_timezone())
    else:
        start_dt = now - timedelta(days=180) # Default to 6 months
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        
    if end_date_str:
        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").replace(tzinfo=timezone.get_current_timezone())
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
    else:
        end_dt = now

    days_diff = (end_dt - start_dt).days
    group_by = 'day' if days_diff <= 31 else 'month'

    logger.info(f"Getting activity for user {user.username}, start={start_dt}, end={end_dt}, groupBy={group_by}")

    labels = []
    index_map = {}
    
    if group_by == 'day':
        current = start_dt
        idx = 0
        while current.date() <= end_dt.date():
            label = current.strftime("%Y-%m-%d")
            labels.append(label)
            index_map[(current.year, current.month, current.day)] = idx
            idx += 1
            current += timedelta(days=1)
    else:
        current = start_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_cap = end_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        idx = 0
        while current <= end_cap:
            label = current.strftime("%Y-%m")
            labels.append(label)
            index_map[(current.year, current.month)] = idx
            idx += 1
            next_month = current.month + 1
            next_year = current.year
            if next_month > 12:
                next_month = 1
                next_year += 1
            current = current.replace(year=next_year, month=next_month)

    data = {
        'months': labels,
        'task_assigned': [0] * len(labels),
        'task_completed': [0] * len(labels),
        'photo_uploaded': [0] * len(labels),
        'project_joined': [0] * len(labels),
    }

    def fill_data(qs, date_field, dest_list):
        if group_by == 'day':
            values = [f'{date_field}__year', f'{date_field}__month', f'{date_field}__day']
        else:
            values = [f'{date_field}__year', f'{date_field}__month']
            
        qs = qs.values(*values).annotate(total=Count('id'))
        
        for row in qs:
            if group_by == 'day':
                key = (row[f'{date_field}__year'], row[f'{date_field}__month'], row[f'{date_field}__day'])
            else:
                key = (row[f'{date_field}__year'], row[f'{date_field}__month'])
                
            idx = index_map.get(key)
            if idx is not None:
                data[dest_list][idx] = row['total']

    fill_data(
        TaskAssignment.objects.filter(volunteer=user, accepted=True, task__created_at__gte=start_dt, task__created_at__lte=end_dt),
        'task__created_at', 'task_assigned'
    )
    
    fill_data(
        TaskAssignment.objects.filter(volunteer=user, completed=True, completed_at__isnull=False, completed_at__gte=start_dt, completed_at__lte=end_dt),
        'completed_at', 'task_completed'
    )
    
    fill_data(
        Photo.objects.filter(volunteer=user, is_deleted=False, uploaded_at__gte=start_dt, uploaded_at__lte=end_dt),
        'uploaded_at', 'photo_uploaded'
    )
    
    fill_data(
        VolunteerProject.objects.filter(volunteer=user, joined_at__gte=start_dt, joined_at__lte=end_dt),
        'joined_at', 'project_joined'
    )

    totals = {
        'task_assigned': sum(data['task_assigned']),
        'task_completed': sum(data['task_completed']),
        'photo_uploaded': sum(data['photo_uploaded']),
        'project_joined': sum(data['project_joined']),
    }
    
    # We output "total_rating" roughly as task_completed*10 + photo_uploaded*5 just for UI convenience if needed
    totals['total_rating'] = user.rating or sum(data['task_completed']) * 10
    totals['completed_tasks'] = totals['task_completed']

    return {
        'months': data['months'],
        'series': {
            'task_assigned': data['task_assigned'],
            'task_completed': data['task_completed'],
            'photo_uploaded': data['photo_uploaded'],
            'project_joined': data['project_joined'],
        },
        'totals': totals,
    }

