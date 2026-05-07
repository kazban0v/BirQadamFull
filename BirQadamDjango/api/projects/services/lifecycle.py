from __future__ import annotations

from datetime import date
import logging

from django.db.models import Q
from django.utils import timezone

from api.projects.models import VolunteerProject
from api.tasks.models import Task


ACTIVE_PROJECT_STATUS = 'approved'
ARCHIVED_TASK_STATUSES = ('completed', 'archived', 'failed')
logger = logging.getLogger(__name__)


def resolve_today(today: date | None = None) -> date:
    return today or timezone.localdate()


def is_project_active(project, today: date | None = None) -> bool:  # type: ignore[no-untyped-def]
    if not project:
        return False

    current_day = resolve_today(today)
    end_date = getattr(project, 'end_date', None)

    return (
        not getattr(project, 'is_deleted', False)
        and getattr(project, 'status', None) == ACTIVE_PROJECT_STATUS
        and (end_date is None or end_date >= current_day)
    )


def get_active_volunteer_projects_queryset(user, today: date | None = None):
    current_day = resolve_today(today)
    return VolunteerProject.objects.filter(
        volunteer=user,
        is_active=True,
        project__is_deleted=False,
        project__status=ACTIVE_PROJECT_STATUS,
    ).filter(
        Q(project__end_date__isnull=True) | Q(project__end_date__gte=current_day)
    )


def get_active_volunteer_project_ids(user, today: date | None = None) -> list[int]:
    return list(
        get_active_volunteer_projects_queryset(user, today=today).values_list('project_id', flat=True)
    )


def get_archived_project_chats_queryset(today: date | None = None):
    from api.chat.models import Chat

    current_day = resolve_today(today)
    return Chat.objects.filter(chat_type='project').filter(
        Q(project__isnull=True)
        | Q(project__is_deleted=True)
        | ~Q(project__status=ACTIVE_PROJECT_STATUS)
        | Q(project__end_date__lt=current_day)
    ).distinct()


def cleanup_archived_project_chats(today: date | None = None) -> int:
    chats = list(
        get_archived_project_chats_queryset(today=today)
        .select_related('project')
        .prefetch_related('messages')
    )

    deleted_count = 0
    for chat in chats:
        for message in chat.messages.all():
            if message.image:
                try:
                    message.image.delete(save=False)
                except Exception:
                    logger.warning('Failed to delete chat image for message %s', message.pk, exc_info=True)

            if message.file:
                try:
                    message.file.delete(save=False)
                except Exception:
                    logger.warning('Failed to delete chat file for message %s', message.pk, exc_info=True)

        chat.delete()
        deleted_count += 1

    return deleted_count


def archive_finished_project_tasks(today: date | None = None) -> int:
    current_day = resolve_today(today)
    archived_tasks = Task.objects.filter(
        is_deleted=False,
        project__is_deleted=False,
        project__end_date__lt=current_day,
    ).exclude(
        status__in=ARCHIVED_TASK_STATUSES,
    ).update(status='archived')

    cleanup_archived_project_chats(today=current_day)

    return archived_tasks
