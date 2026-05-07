from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from admin_panel.context_processors import build_admin_topbar_payload


@login_required
def topbar_status(request):
    user = request.user
    if not (user.is_staff or getattr(user, "is_admin", False)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return JsonResponse(build_admin_topbar_payload())
