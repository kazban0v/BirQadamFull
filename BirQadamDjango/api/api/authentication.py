from __future__ import annotations

from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        jwt_authenticator = JWTAuthentication()
        jwt_result = jwt_authenticator.authenticate(request)
        if jwt_result is not None:
            return jwt_result

        return super().authenticate(request)

    def enforce_csrf(self, request):  # noqa: D401
        return
