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
from api.achievements.models import UserAchievement
from api.users.models import Activity


def get_volunteer_dashboard_data(user) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    now = timezone.now()
    upcoming_threshold = now + timedelta(days=7)

    joined_project_ids = list(
        VolunteerProject.objects.filter(
            volunteer=user,
            is_active=True,
            project__is_deleted=False,
        ).values_list('project_id', flat=True)
    )

    assignment_qs = TaskAssignment.objects.select_related('task').filter(
        volunteer=user,
        task__project_id__in=joined_project_ids,
        task__is_deleted=False,
    )
    assignment_map = {assignment.task_id: assignment for assignment in assignment_qs}

    # Задачи, которые волонтер еще не принял, должны отображаться, 
    # чтобы он мог их принять. Исключаем только реально удаленные.
    declined_task_ids = []

    # Базовый список всех активных задач пользователя (для счетчика)
    # Считаем все незавершенные и неархивные задачи
    all_active_tasks_qs = Task.objects.select_related('project').filter(
        Q(project_id__in=joined_project_ids) | Q(assignments__volunteer=user),
        is_deleted=False,
    ).exclude(status__in=['completed', 'archived', 'failed']).distinct()

    # Список задач именно для блока "Ближайшие задачи" (только не принятые)
    # Исключаем задачи, где уже есть статус accepted=True для этого пользователя
    tasks_to_show_qs = all_active_tasks_qs.exclude(
        assignments__volunteer=user,
        assignments__accepted=True
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

    upcoming_assignments_count = Task.objects.filter(
        project_id__in=joined_project_ids,
        is_deleted=False,
        deadline_date__isnull=False,
        deadline_date__lte=upcoming_threshold.date(),
    ).exclude(id__in=declined_task_ids).count()

    volunteer_projects_qs = (
        VolunteerProject.objects.select_related('project', 'project__creator')
        .filter(volunteer=user, is_active=True, project__is_deleted=False)
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
        volunteer=user,
        is_active=True,
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
        'tasks': tasks_to_show_qs[:10],  # Только не принятые задачи
        'projects': volunteer_projects,
        'photos': photo_reports,
        'notifications': notifications,
    }

