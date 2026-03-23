from __future__ import annotations

from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session authentication without CSRF enforcement.
    
    Also transparently handles JWT Bearer tokens so that all views that
    use this class work with both browser sessions and mobile app JWT tokens.
    """

    def enforce_csrf(self, request):  # noqa: D401
        return

    def authenticate(self, request):
        # If the request carries a Bearer token, delegate to JWTAuthentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            return JWTAuthentication().authenticate(request)
        # Otherwise use session-based auth
        return super().authenticate(request)
