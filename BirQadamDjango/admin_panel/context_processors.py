from __future__ import annotations

from django.db import connection
from django.urls import reverse
from django.utils import timezone


def build_admin_topbar_payload() -> dict:
    """Build the shared payload for the custom admin top bar."""
    now = timezone.localtime()
    payload = {
        "alerts_total": 0,
        "pending_projects": 0,
        "pending_photos": 0,
        "review_tasks": 0,
        "db_online": False,
        "api_online": True,
        "now_label": now.strftime("%d.%m.%Y"),
        "time_label": now.strftime("%H:%M"),
        "items": [],
    }

    try:
        from api.models import Photo, Project, Task

        connection.ensure_connection()
        pending_projects = Project.objects.filter(status="pending", is_deleted=False).count()
        pending_photos = Photo.objects.filter(status="pending", is_deleted=False).count()
        review_tasks = Task.objects.filter(status="under_review", is_deleted=False).count()
        alerts_total = pending_projects + pending_photos + review_tasks

        payload.update(
            {
                "alerts_total": alerts_total,
                "pending_projects": pending_projects,
                "pending_photos": pending_photos,
                "review_tasks": review_tasks,
                "db_online": True,
                "items": [
                    {
                        "key": "projects",
                        "label": "Проекты на модерации",
                        "hint": "Нужно решение администратора",
                        "count": pending_projects,
                        "icon": "fa-folder-open",
                        "tone": "warning",
                        "url": f"{reverse('admin_panel:project_list')}?status=pending",
                    },
                    {
                        "key": "photos",
                        "label": "Фотоотчёты у организаторов",
                        "hint": "Админ наблюдает, проверяют организаторы",
                        "count": pending_photos,
                        "icon": "fa-camera",
                        "tone": "info",
                        "url": f"{reverse('admin_panel:analytics')}#photo-reports-overview",
                    },
                    {
                        "key": "tasks",
                        "label": "Задачи на проверке",
                        "hint": "Открыть задачи со статусом проверки",
                        "count": review_tasks,
                        "icon": "fa-clipboard-check",
                        "tone": "primary",
                        "url": f"{reverse('admin_panel:task_list')}?status=under_review",
                    },
                ],
            }
        )
    except Exception:
        payload["api_online"] = False

    return payload


def admin_topbar(request):
    """Small, shared payload for the custom admin top bar."""
    user = getattr(request, "user", None)
    if (
        not request.path.startswith("/custom-admin/")
        or not user
        or not user.is_authenticated
        or not (user.is_staff or getattr(user, "is_admin", False))
    ):
        return {}

    return {"admin_topbar": build_admin_topbar_payload()}
