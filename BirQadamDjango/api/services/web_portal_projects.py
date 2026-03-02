from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date
import logging

from django.db.models import Count, Exists, OuterRef, Q

from api.projects.models import Project, VolunteerProject
from api.tasks.models import Task

logger = logging.getLogger(__name__)


def _get_full_image_url(request, image_field):
    """Вспомогательная функция для получения полного URL изображения"""
    if not image_field or not image_field.url:
        return None
    try:
        url = request.build_absolute_uri(image_field.url)
        # Убеждаемся, что это полный URL и используем https
        if not url.startswith('http'):
            scheme = 'https'  # Всегда используем https
            host = request.get_host() if hasattr(request, 'get_host') else ''
            if host:
                url = f'{scheme}://{host}{image_field.url}'
        # Заменяем http на https, если есть
        elif url.startswith('http://'):
            url = url.replace('http://', 'https://')
        return url
    except Exception:
        # Fallback на относительный путь, если не удалось построить абсолютный
        return image_field.url if image_field.url else None


def get_projects_catalog(user, request=None) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    joined_projects = VolunteerProject.objects.filter(
        volunteer=user,
        is_active=True,
    )

    joined_project_ids = joined_projects.values_list('project_id', flat=True)
    joined_at_by_project_id = dict(joined_projects.values_list('project_id', 'joined_at'))

    # Для волонтеров скрываем проекты, у которых дата окончания прошла
    # Организаторы видят все свои проекты (включая архивные)
    today = date.today()
    is_organizer = hasattr(user, 'is_organizer') and user.is_organizer
    
    # Логирование для диагностики
    total_projects = Project.objects.count()
    approved_projects = Project.objects.filter(status='approved', is_deleted=False).count()
    all_statuses = list(Project.objects.values_list('status', flat=True).distinct())
    logger.info(f"[DEBUG] get_projects_catalog for user {user.username}: total_projects={total_projects}, approved_not_deleted={approved_projects}, is_organizer={is_organizer}, all_statuses={all_statuses}")
    print(f"[DEBUG] get_projects_catalog: total={total_projects}, approved={approved_projects}, statuses={all_statuses}")  # Для консоли
    
    projects_qs = (
        Project.objects.select_related('creator')
        .filter(
            is_deleted=False,
            status='approved',
        )
    )
    
    before_date_filter = projects_qs.count()
    logger.info(f"[DEBUG] Projects before date filter: {before_date_filter}")
    print(f"[DEBUG] Projects before date filter: {before_date_filter}")
    
    # Для волонтеров: скрываем проекты с истекшей датой окончания
    if not is_organizer:
        # Проверяем даты окончания проектов
        expired_projects = projects_qs.filter(end_date__lt=today, end_date__isnull=False).count()
        logger.info(f"[DEBUG] Expired projects (end_date < {today}): {expired_projects}")
        print(f"[DEBUG] Expired projects: {expired_projects}")
        
        projects_qs = projects_qs.filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        )
        after_date_filter = projects_qs.count()
        logger.info(f"[DEBUG] Projects after date filter (today={today}): {after_date_filter}")
        print(f"[DEBUG] Projects after date filter: {after_date_filter}")
    
    projects_qs = projects_qs.annotate(
        tasks_count=Count('tasks', filter=Q(tasks__is_deleted=False)),
        active_members=Count(
            'volunteer_projects',
            filter=Q(volunteer_projects__is_active=True),
        ),
        joined=Exists(
            VolunteerProject.objects.filter(
                volunteer=user,
                project=OuterRef('pk'),
                is_active=True,
            )
        ),
    ).prefetch_related('tags').order_by('start_date', '-created_at')

    final_count = projects_qs.count()
    logger.info(f"[DEBUG] Final projects count after all filters: {final_count}")

    projects = []
    for project in projects_qs:
        joined_at = joined_at_by_project_id.get(project.id)
        projects.append(
            {
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'city': project.city,
                'volunteer_type': project.volunteer_type,
                'start_date': project.start_date.isoformat() if project.start_date else None,
                'end_date': project.end_date.isoformat() if project.end_date else None,
                'status': project.status,
                'joined': bool(project.joined),
                'active_members': project.active_members,
                'tasks_count': project.tasks_count,
                'organizer_name': project.creator.name or project.creator.username,
                'organizer_id': project.creator.id,
                'joined_at': joined_at.isoformat() if joined_at else None,
                'address': project.address,
                'latitude': project.latitude,
                'longitude': project.longitude,
                'contact_person': project.contact_person,
                'contact_phone': project.contact_phone,
                'contact_email': project.contact_email,
                'contact_telegram': project.contact_telegram,
                'info_url': project.info_url,
                'gis2_url': project.gis2_url,
                'tags': list(project.tags.names()),
                'cover_image_url': _get_full_image_url(request, project.cover_image) if project.cover_image and request else None,
                'created_at': project.created_at.isoformat() if project.created_at else None,
            }
        )

    return {
        'projects': projects,
        'summary': {
            'total_available': projects_qs.count(),
            'joined_count': joined_projects.count(),
        },
    }

