from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict

from django.db.models import Count, Q, Exists, OuterRef, Subquery
from django.utils import timezone

from core.models import (
    NotificationRecipient,
    Photo,
    Task,
    TaskAssignment,
    VolunteerProject,
)


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

    declined_task_ids = [
        assignment.task_id
        for assignment in assignment_qs
        if not assignment.accepted
    ]

    tasks_qs = (
        Task.objects.select_related('project')
        .filter(
            project_id__in=joined_project_ids,
            is_deleted=False,
        )
        .exclude(id__in=declined_task_ids)
        .order_by('deadline_date', '-created_at')
    )

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

    tasks_qs = tasks_qs.annotate(
        has_photo_report=Exists(photo_exists_subquery),
        photo_status=Subquery(latest_photo_status_subquery),
    )

    photo_map = {}
    for photo in Photo.objects.filter(
        task__in=tasks_qs,
        volunteer=user,
        is_deleted=False,
    ).order_by('-uploaded_at'):
        photo_map.setdefault(photo.task_id, []).append(photo)

    tasks_data = []
    for task in tasks_qs[:10]:
        assignment = assignment_map.get(task.id)
        accepted = bool(assignment and assignment.accepted)
        completed = bool(assignment and assignment.completed)
        has_photo_report = bool(photo_map.get(task.id))
        photo_status = photo_map[task.id][0].status if has_photo_report else getattr(task, 'photo_status', None)
        can_upload_photo = accepted and not has_photo_report

        tasks_data.append(
            {
                'task_id': task.id,
                'text': task.text,
                'status': task.status,
                'deadline_date': task.deadline_date,
                'start_time': task.start_time,
                'end_time': task.end_time,
                'project_id': task.project_id,
                'project_title': task.project.title,
                'project_city': task.project.city,
                'project_status': task.project.status,
                'accepted': accepted,
                'completed': completed,
                'is_expired': task.is_expired(),
                'has_photo_report': has_photo_report,
                'photo_status': photo_status,
                'can_upload_photo': can_upload_photo,
            }
        )

    completed_assignments_count = sum(1 for assignment in assignment_qs if assignment.completed)

    upcoming_assignments_count = Task.objects.filter(
        id__in=[item['task_id'] for item in tasks_data],
        deadline_date__isnull=False,
        deadline_date__lte=upcoming_threshold.date(),
    ).count()

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

    unread_notifications = notifications_qs.filter(
        status__in=['pending', 'sent'],
    ).count()

    summary = {
        'active_tasks': tasks_qs.count(),
        'completed_tasks': completed_assignments_count,
        'upcoming_tasks': upcoming_assignments_count,
        'active_projects': projects_total,
        'pending_photos': pending_photo_reports,
        'total_photos': photo_reports_qs.count(),
        'unread_notifications': unread_notifications,
    }

    return {
        'summary': summary,
        'tasks': tasks_data,
        'projects': volunteer_projects,
        'photos': photo_reports,
        'notifications': notifications,
    }
