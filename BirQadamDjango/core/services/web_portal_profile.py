from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

from django.db.models import Count, Q

from django.utils import timezone

from core.models import Achievement, UserAchievement, Activity


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

    for achievement in achievements_qs:
        unlocked = achievement.id in unlocked_map
        unlocked_at = unlocked_map[achievement.id].unlocked_at if unlocked else None
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

    return {
        'rating': rating,
        'level': level,
        'next_level_rating': next_level_rating,
        'previous_level_rating': previous_level_rating,
        'progress': progress,
        'achievements': achievements_data,
        'unlocked_achievements': len(unlocked_map),
        'total_achievements': achievements_qs.count(),
    }


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

    activities_qs = (
        Activity.objects.filter(
            user=user,
            created_at__gte=start_date,
            type__in=['task_assigned', 'task_completed', 'photo_uploaded', 'project_joined'],
        )
        .values('type', 'created_at__year', 'created_at__month')
        .annotate(total=Count('id'))
    )

    data = {
        'months': [f"{year}-{month:02d}" for year, month in month_sequence],
        'task_assigned': [0] * len(month_sequence),
        'task_completed': [0] * len(month_sequence),
        'photo_uploaded': [0] * len(month_sequence),
        'project_joined': [0] * len(month_sequence),
    }

    index_map = { (year, month): idx for idx, (year, month) in enumerate(month_sequence) }

    for row in activities_qs:
        key = (row['created_at__year'], row['created_at__month'])
        idx = index_map.get(key)
        if idx is None:
            continue
        activity_type = row['type']
        total = row['total']
        if activity_type in data:
            data[activity_type][idx] = total

    totals = {
        'task_assigned': sum(data['task_assigned']),
        'task_completed': sum(data['task_completed']),
        'photo_uploaded': sum(data['photo_uploaded']),
        'project_joined': sum(data['project_joined']),
    }

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

