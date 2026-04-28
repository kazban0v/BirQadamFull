"""
User dashboard service
Сервис для работы с дашбордом пользователя
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict

from django.db.models import Count, Q, Exists, OuterRef, Subquery
from django.utils import timezone

from api.notifications.models import NotificationRecipient
from api.tasks.models import Photo, Task, TaskAssignment
from api.projects.models import VolunteerProject
from api.projects.services.lifecycle import (
    archive_finished_project_tasks,
    get_active_volunteer_projects_queryset,
)
from api.achievements.models import UserAchievement
from api.users.models import Activity

ACTIVE_TASK_STATUSES = ('open', 'in_progress', 'under_review', 'revision')


def get_volunteer_dashboard_data(user) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    now = timezone.now()
    upcoming_threshold = now + timedelta(days=7)
    today = now.date()

    archive_finished_project_tasks(today=today)

    active_volunteer_projects_qs = get_active_volunteer_projects_queryset(user, today=today)

    joined_project_ids = list(active_volunteer_projects_qs.values_list('project_id', flat=True))

    assignment_qs = TaskAssignment.objects.select_related('task').filter(
        volunteer=user,
        task__project_id__in=joined_project_ids,
        task__is_deleted=False,
    )
    assignment_map = {assignment.task_id: assignment for assignment in assignment_qs}

    # Задачи, которые волонтер еще не принял, должны отображаться, 
    # чтобы он мог их принять. Исключаем только реально удаленные.
    declined_task_ids = [
        assignment.task_id
        for assignment in assignment_qs
        if assignment.accepted is False
    ]

    # Базовый список всех активных задач пользователя (для счетчика)
    # Считаем все незавершенные и неархивные задачи
    all_active_tasks_qs = Task.objects.select_related('project').filter(
        project_id__in=joined_project_ids,
        is_deleted=False,
        status__in=ACTIVE_TASK_STATUSES,
    ).exclude(id__in=declined_task_ids).distinct()

    # Список задач именно для блока "Ближайшие задачи".
    # Если волонтёр уже как-то обработал задачу (принял или отклонил),
    # повторно в этот блок её не показываем.
    tasks_to_show_qs = all_active_tasks_qs.exclude(
        assignments__volunteer=user,
    ).order_by('deadline_date', '-created_at')

    photo_exists_subquery = Photo.objects.filter(
        task=OuterRef('pk'),
        volunteer=user,
        is_deleted=False,
    )

    latest_photo_status_subquery = Photo.objects.filter(
        task=OuterRef('pk'),
        volunteer=user,
        is_deleted=False,
    ).order_by('-uploaded_at').values('status')[:1]

    tasks_to_show_qs = tasks_to_show_qs.annotate(
        has_photo_report=Exists(photo_exists_subquery),
        photo_status=Subquery(latest_photo_status_subquery),
    )

    photo_map = {}
    for photo in Photo.objects.filter(
        task__in=tasks_to_show_qs,
        volunteer=user,
        is_deleted=False,
    ).order_by('-uploaded_at'):
        photo_map.setdefault(photo.task_id, []).append(photo)

    # Удаляем ручную сборку списка словарей tasks_data
    # tasks_data = []

    completed_assignments_count = sum(1 for assignment in assignment_qs if assignment.completed)

    upcoming_assignments_count = all_active_tasks_qs.filter(
        deadline_date__isnull=False,
        deadline_date__lte=upcoming_threshold.date(),
    ).count()

    volunteer_projects_qs = (
        VolunteerProject.objects.select_related('project', 'project__creator')
        .filter(id__in=active_volunteer_projects_qs.values('id'))
        .annotate(active_members=Count('project__volunteer_projects', filter=Q(project__volunteer_projects__is_active=True)))
        .order_by('-joined_at')
    )
    volunteer_projects = list(volunteer_projects_qs[:8])

    projects_total = volunteer_projects_qs.count()

    photo_reports_qs = (
        Photo.objects.select_related('project', 'task')
        .filter(volunteer=user, is_deleted=False)
        .order_by('-uploaded_at')
    )
    photo_reports = list(photo_reports_qs[:8])

    pending_photo_reports = photo_reports_qs.filter(status='pending').count()

    notifications_qs = (
        NotificationRecipient.objects.select_related('notification')
        .filter(user=user)
        .order_by('-created_at')
    )
    notifications = list(notifications_qs[:8])

    unread_notifications = (
        notifications_qs.filter(status__in=['pending', 'sent']).count() +
        Activity.objects.filter(user=user, is_read=False).count()
    )

    achievements_count = UserAchievement.objects.filter(user=user).count()

    total_hours = 0
    first_project = VolunteerProject.objects.filter(
        id__in=active_volunteer_projects_qs.values('id'),
        joined_at__isnull=False
    ).order_by('joined_at').first()
    
    if first_project and first_project.joined_at:
        import datetime
        if isinstance(first_project.joined_at, datetime.datetime):
            time_diff = now - first_project.joined_at
            total_hours = time_diff.total_seconds() / 3600
        else:
            time_diff = now.date() - first_project.joined_at
            total_hours = time_diff.total_seconds() / 3600

    summary = {
        'active_tasks': all_active_tasks_qs.count(),
        'completed_tasks': completed_assignments_count,
        'upcoming_tasks': upcoming_assignments_count,
        'active_projects': projects_total,
        'pending_photos': pending_photo_reports,
        'total_photos': photo_reports_qs.count(),
        'unread_notifications': unread_notifications,
        'achievements_count': achievements_count,
        'total_hours': round(total_hours, 1),
    }

    return {
        'summary': summary,
        'tasks': tasks_to_show_qs[:10],  # Только ещё не обработанные волонтёром задачи
        'projects': volunteer_projects,
        'photos': photo_reports,
        'notifications': notifications,
    }

