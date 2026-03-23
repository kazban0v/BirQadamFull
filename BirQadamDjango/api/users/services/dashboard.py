from __future__ import annotations

from datetime import timedelta, datetime, date, time
from typing import Any, Dict

from django.db.models import Count, Q, Exists, OuterRef, Subquery
from django.utils import timezone

from api.notifications.models import NotificationRecipient
from api.tasks.models import Photo, Task, TaskAssignment
from api.projects.models import VolunteerProject


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
        # Исправление: проверяем, что список не пустой перед доступом к элементу
        photo_status = None
        if has_photo_report and photo_map.get(task.id):
            photo_list = photo_map[task.id]
            if photo_list and len(photo_list) > 0:
                photo_status = photo_list[0].status
        if photo_status is None:
            photo_status = getattr(task, 'photo_status', None)
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
                'image': task.task_image.url if task.task_image else (task.project.cover_image.url if task.project.cover_image else None),
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

    # Расчет общего времени участия в проектах (в часах)
    # Считаем время с момента первого присоединения к любому активному проекту
    # Это общее время волонтерской деятельности пользователя
    total_hours = 0
    first_join_date = None
    
    # Находим самую раннюю дату присоединения к активному проекту
    for vp in volunteer_projects_qs:
        if vp.joined_at:
            if first_join_date is None or vp.joined_at < first_join_date:
                first_join_date = vp.joined_at
    
    # Если есть активные проекты, считаем время с первой даты присоединения
    if first_join_date:
        time_diff = now - first_join_date
        total_hours = time_diff.total_seconds() / 3600

    # Получаем все проекты (и активные, и архивные)
    all_project_ids = list(
        VolunteerProject.objects.filter(
            volunteer=user,
            project__is_deleted=False,
        ).values_list('project_id', flat=True)
    )
    # Расширенная статистика для summary
    
    # Все назначения пользователя (включая архивные проекты)
    all_assignment_qs = TaskAssignment.objects.filter(
        volunteer=user,
        task__is_deleted=False
    ).select_related('task')
    
    # Общее количество задач (принятых и не отклоненных)
    # Включаем задачи из архивных проектов, чтобы совпадало с "Мои задачи"
    total_tasks_count = all_assignment_qs.filter(
        accepted=True
    ).count()
    
    # Количество выполненных задач
    completed_tasks_count = all_assignment_qs.filter(
        completed=True
    ).count()
    
    # Расчет общего количества часов (сумма длительности выполненных задач)
    total_seconds = 0
    completed_assignments = all_assignment_qs.filter(completed=True)
    for assignment in completed_assignments:
        task = assignment.task
        if task.start_time and task.end_time:
            # Используем фиктивную дату для расчета разницы во времени
            dummy_date = date(2000, 1, 1)
            t1 = datetime.combine(dummy_date, task.start_time)
            t2 = datetime.combine(dummy_date, task.end_time)
            if t2 > t1:
                total_seconds += (t2 - t1).total_seconds()
            else:
                # Если задача длится через полночь (маловероятно, но на всякий случай)
                total_seconds += (t2 + timedelta(days=1) - t1).total_seconds()
    
    total_hours = total_seconds / 3600
    
    # Общее количество проектов, в которых участвует волонтер (все когда-либо присоединенные)
    total_projects_count = VolunteerProject.objects.filter(
        volunteer=user,
        project__is_deleted=False
    ).count()

    summary = {
        'total_tasks_count': total_tasks_count,
        'active_tasks': tasks_qs.count(),
        'completed_tasks': completed_tasks_count,
        'upcoming_tasks': all_assignment_qs.filter(accepted=True, completed=False).count(),
        'active_projects': total_projects_count,
        'pending_photos': pending_photo_reports,
        'total_photos': photo_reports_qs.count(),
        'unread_notifications': unread_notifications,
        'total_hours': float(round(total_hours, 1)),
        'rating': getattr(user, 'rating', 0),
        'trust_factor': getattr(user, 'trust_factor', 100),
        'average_rating': getattr(user, 'average_rating', 0),
        'achievements_count': user.user_achievements.count(),
    }

    return {
        'summary': summary,
        'tasks': tasks_data,
        'projects': volunteer_projects,
        'photos': photo_reports,
        'notifications': notifications,
    }

