"""
JWT Debug Middleware - для диагностики проблем с токенами
"""
import logging
from typing import Any, Callable
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)


class JWTDebugMiddleware:
    """Middleware для отладки JWT токенов"""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Логируем только POST запросы к API
        if request.method == 'POST' and '/api/' in request.path:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            print('=' * 80)
            print(f'🔐 JWT Debug Middleware - {request.method} {request.path}')
            print(f'📝 Authorization header: {auth_header[:100] if auth_header else "MISSING"}...')
            print(f'👤 User before auth: {request.user}')
            print(f'🔓 Is authenticated before: {request.user.is_authenticated}')

            if auth_header:
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    print(f'🎫 Token length: {len(token)}')
                    print(f'🎫 Token preview: {token[:50]}...')

                    # Попробуем декодировать токен
                    try:
                        from rest_framework_simplejwt.tokens import AccessToken
                        decoded = AccessToken(token)
                        print(f'✅ Token is valid')
                        print(f'👤 User ID from token: {decoded.get("user_id")}')
                        print(f'⏰ Token expires: {decoded.get("exp")}')
                    except Exception as e:
                        print(f'❌ Token validation error: {e}')
                else:
                    print(f'⚠️ Authorization header does not start with "Bearer "')
            print('=' * 80)

        response = self.get_response(request)

        # Логируем результат
        if request.method == 'POST' and '/api/' in request.path:
            print(f'📡 Response status: {response.status_code}')
            print(f'👤 User after auth: {request.user}')
            print(f'🔓 Is authenticated after: {request.user.is_authenticated}')
            print('=' * 80)

        return response
