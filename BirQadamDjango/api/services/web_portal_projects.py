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
        return url
    except Exception as e:
        logger.error(f"[ERROR] Failed to build image URL: {e}")
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
    
    # 🔍 ДИАГНОСТИКА: Проверяем ВСЕ проекты в БД
    all_projects = Project.objects.filter(is_deleted=False)
    logger.info(f"🔍 [get_projects_catalog] User: {user.username}")
    logger.info(f"📊 Всего проектов в БД (не удалённых): {all_projects.count()}")
    
    # Проверяем проекты с разными статусами
    pending_count = all_projects.filter(status='pending').count()
    approved_count_all = all_projects.filter(status='approved').count()
    rejected_count = all_projects.filter(status='rejected').count()
    logger.info(f"📊 Статусы проектов: pending={pending_count}, approved={approved_count_all}, rejected={rejected_count}")
    
    # Ищем проект "2GIS" или похожие
    gis_projects = all_projects.filter(title__icontains='2gis').values('id', 'title', 'status', 'is_deleted')
    if gis_projects.exists():
        logger.info(f"🔍 Найдены проекты с '2gis' в названии:")
        for p in gis_projects:
            logger.info(f"  📋 ID={p['id']}, Title={p['title']}, Status={p['status']}, is_deleted={p['is_deleted']}")
    
    projects_qs = (
        Project.objects.select_related('creator')
        .filter(
            is_deleted=False,
            status='approved',
        )
    )
    
    approved_count = projects_qs.count()
    logger.info(f"✅ Одобренных проектов (approved): {approved_count}")
    
    # Для волонтеров: скрываем проекты с истекшей датой окончания
    # ВРЕМЕННО ОТКЛЮЧЕНО ДЛЯ ОТЛАДКИ
    # if not is_organizer:
    #     # Проверяем даты окончания проектов
    #     expired_projects = projects_qs.filter(end_date__lt=today, end_date__isnull=False).count()
    #     logger.info(f"[DEBUG] Expired projects (end_date < {today}): {expired_projects}")
    #     print(f"[DEBUG] Expired projects: {expired_projects}")
    #     
    #     projects_qs = projects_qs.filter(
    #         Q(end_date__isnull=True) | Q(end_date__gte=today)
    #     )
    #     after_date_filter = projects_qs.count()
    #     logger.info(f"[DEBUG] Projects after date filter (today={today}): {after_date_filter}")
    #     print(f"[DEBUG] Projects after date filter: {after_date_filter}")
    
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

    projects = []
    for project in projects_qs:
        joined_at = joined_at_by_project_id.get(project.id)
        
        # Строим URL изображения
        cover_image_url = _get_full_image_url(request, project.cover_image) if project.cover_image and request else None
        
        project_data = {
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
                'cover_image_url': cover_image_url,
                'created_at': project.created_at.isoformat() if project.created_at else None,
            }
        
        logger.info(f"📤 Отправляем проект ID={project.id}: has_image={bool(project.cover_image)}, url={cover_image_url}")
        projects.append(project_data)
    
    logger.info(f"📦 Итого отправляем проектов: {len(projects)}")

    return {
        'projects': projects,
        'summary': {
            'total_available': projects_qs.count(),
            'joined_count': joined_projects.count(),
        },
    }

