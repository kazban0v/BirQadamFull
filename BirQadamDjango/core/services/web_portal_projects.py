from __future__ import annotations

from typing import Any, Dict, List

from django.db.models import Count, Exists, OuterRef, Q

from core.models import Project, Task, VolunteerProject


def get_projects_catalog(user) -> Dict[str, Any]:  # type: ignore[no-any-unimported]
    joined_projects = VolunteerProject.objects.filter(
        volunteer=user,
        is_active=True,
    )

    joined_project_ids = joined_projects.values_list('project_id', flat=True)

    projects_qs = (
        Project.objects.select_related('creator')
        .filter(
            is_deleted=False,
            status='approved',
        )
        .annotate(
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
        )
        .prefetch_related('tags')
        .order_by('start_date', '-created_at')
    )

    projects = []
    for project in projects_qs:
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
                'joined_at': None,
                'address': project.address,
                'latitude': project.latitude,
                'longitude': project.longitude,
                'contact_person': project.contact_person,
                'contact_phone': project.contact_phone,
                'contact_email': project.contact_email,
                'contact_telegram': project.contact_telegram,
                'info_url': project.info_url,
                'tags': list(project.tags.names()),
                'cover_image_url': project.cover_image.url if project.cover_image else None,
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

