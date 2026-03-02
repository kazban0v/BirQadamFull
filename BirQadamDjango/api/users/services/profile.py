"""
User profile service
Сервис для работы с профилем пользователя
"""
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
    
    logger.info(f'get_volunteer_stats: returning {len(achievements_data)} achievements')
    if achievements_data:
        logger.info(f'First achievement: {achievements_data[0]}')
    
    return result


def _generate_month_sequence(months: int) -> List[Tuple[int, int]]:
    now = timezone.now()
    year = now.year
    month = now.month
    sequence: List[Tuple[int, int]] = []
    for _ in range(months):
        sequence.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    sequence.reverse()
    return sequence


def get_volunteer_activity(user, months: int = 6) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    months = max(1, min(months, 12))
    month_sequence = _generate_month_sequence(months)

    start_year, start_month = month_sequence[0]
    start_date = datetime(year=start_year, month=start_month, day=1, tzinfo=timezone.get_current_timezone())

    logger.info(f"Getting activity for user {user.username}, months={months}, start_date={start_date}")

    data = {
        'months': [f"{year}-{month:02d}" for year, month in month_sequence],
        'task_assigned': [0] * len(month_sequence),
        'task_completed': [0] * len(month_sequence),
        'photo_uploaded': [0] * len(month_sequence),
        'project_joined': [0] * len(month_sequence),
    }

    index_map = { (year, month): idx for idx, (year, month) in enumerate(month_sequence) }

    # Задач взято (TaskAssignment с accepted=True)
    task_assigned_qs = (
        TaskAssignment.objects.filter(
            volunteer=user,
            accepted=True,
            task__created_at__gte=start_date,
        )
        .select_related('task')
        .values('task__created_at__year', 'task__created_at__month')
        .annotate(total=Count('id'))
    )

    for row in task_assigned_qs:
        key = (row['task__created_at__year'], row['task__created_at__month'])
        idx = index_map.get(key)
        if idx is not None:
            data['task_assigned'][idx] = row['total']

    # Задач выполнено (TaskAssignment с completed=True и completed_at)
    task_completed_qs = (
        TaskAssignment.objects.filter(
            volunteer=user,
            completed=True,
            completed_at__isnull=False,
            completed_at__gte=start_date,
        )
        .values('completed_at__year', 'completed_at__month')
        .annotate(total=Count('id'))
    )

    for row in task_completed_qs:
        key = (row['completed_at__year'], row['completed_at__month'])
        idx = index_map.get(key)
        if idx is not None:
            data['task_completed'][idx] = row['total']

    # Фотоотчётов (Photo)
    photo_uploaded_qs = (
        Photo.objects.filter(
            volunteer=user,
            is_deleted=False,
            uploaded_at__gte=start_date,
        )
        .values('uploaded_at__year', 'uploaded_at__month')
        .annotate(total=Count('id'))
    )

    for row in photo_uploaded_qs:
        key = (row['uploaded_at__year'], row['uploaded_at__month'])
        idx = index_map.get(key)
        if idx is not None:
            data['photo_uploaded'][idx] = row['total']

    # Новые проекты (VolunteerProject использует joined_at, а не created_at)
    project_joined_qs = (
        VolunteerProject.objects.filter(
            volunteer=user,
            joined_at__gte=start_date,
        )
        .values('joined_at__year', 'joined_at__month')
        .annotate(total=Count('id'))
    )

    for row in project_joined_qs:
        key = (row['joined_at__year'], row['joined_at__month'])
        idx = index_map.get(key)
        if idx is not None:
            data['project_joined'][idx] = row['total']

    totals = {
        'task_assigned': sum(data['task_assigned']),
        'task_completed': sum(data['task_completed']),
        'photo_uploaded': sum(data['photo_uploaded']),
        'project_joined': sum(data['project_joined']),
    }

    logger.info(f"Activity totals for {user.username}: {totals}")

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

