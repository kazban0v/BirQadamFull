"""
Custom Middleware для админ-панели
"""
import time
import ipaddress
from typing import Any, Callable
from django.core.cache import cache
from django.http import HttpResponse, HttpRequest
from django.conf import settings
from django.contrib.sessions.middleware import SessionMiddleware
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request: HttpRequest) -> str:
    """
    Получение IP адреса клиента с валидацией
    Общая функция для использования во всех middleware
    """
    # Получаем список доверенных прокси из настроек
    trusted_proxies = getattr(settings, 'TRUSTED_PROXIES', [])

    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    remote_addr = request.META.get('REMOTE_ADDR', '')

    # Валидируем IP адрес
    def is_valid_ip(ip_str: str) -> bool:
        try:
            ipaddress.ip_address(ip_str)
            return True
        except ValueError:
            return False

    if x_forwarded_for:
        # Берем только первый IP из списка и валидируем его
        ip = x_forwarded_for.split(',')[0].strip()

        # Проверяем, что запрос идет через доверенный прокси
        if trusted_proxies and remote_addr not in trusted_proxies:
            # Если прокси не доверенный, используем REMOTE_ADDR
            ip = remote_addr

        # Валидируем IP
        if not is_valid_ip(ip):
            logger.warning(f"Invalid IP address in X-Forwarded-For: {ip}")
            ip = remote_addr
    else:
        ip = remote_addr

    # Финальная валидация
    if not is_valid_ip(ip):
        logger.error(f"Invalid IP address: {ip}, using fallback")
        return '0.0.0.0'

    return ip


class RememberMeMiddleware:
    """
    Middleware для функции "Запомнить меня" при входе
    """
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.method == 'POST' and 'remember_me' in request.POST:
            if request.POST['remember_me'] == 'on':
                request.session.set_expiry(30 * 24 * 60 * 60)  # 30 дней
        return self.get_response(request)


class RateLimitMiddleware:
    """
    Middleware для ограничения частоты запросов
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

        # Настройки по умолчанию
        self.rate_limit_enabled = getattr(settings, 'RATE_LIMIT_ENABLED', True)
        self.rate_limit_requests = getattr(settings, 'RATE_LIMIT_REQUESTS', 100)  # запросов
        self.rate_limit_period = getattr(settings, 'RATE_LIMIT_PERIOD', 60)  # в секундах

        # ✅ ИСПРАВЛЕНИЕ СП-9: Rate limiting на фото и критичные эндпоинты
        self.strict_endpoints = {
            '/admin/login/': {'requests': 5, 'period': 300},  # 5 попыток за 5 минут
            '/custom-admin/api/register/': {'requests': 3, 'period': 3600},  # 3 регистрации в час (было 10)
            '/custom-admin/api/v1/register/': {'requests': 3, 'period': 3600},  # 3 регистрации в час
            '/admin/password_reset/': {'requests': 3, 'period': 3600},  # 3 сброса в час
            '/custom-admin/api/tasks/': {'requests': 10, 'period': 300, 'path_contains': '/photo-reports/'},  # 10 фото за 5 минут
            '/custom-admin/api/v1/tasks/': {'requests': 10, 'period': 300, 'path_contains': '/photo-reports/'},  # 10 фото за 5 минут
        }

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not self.rate_limit_enabled:
            return self.get_response(request)

        # Получаем IP адрес клиента
        ip_address = get_client_ip(request)

        # Проверяем rate limit
        if self.is_rate_limited(ip_address, request.path):
            logger.warning(f"Rate limit exceeded for IP: {ip_address}, path: {request.path}")
            return HttpResponse(
                "Слишком много запросов. Попробуйте позже.",
                status=429,
                content_type="text/plain; charset=utf-8"
            )

        response = self.get_response(request)
        return response

    def is_rate_limited(self, ip_address, path):
        """Проверка превышения лимита запросов"""
        # Определяем лимиты для текущего пути
        limit_config = self.strict_endpoints.get(path)

        if limit_config:
            requests_limit = limit_config['requests']
            period = limit_config['period']
            cache_key = f'rate_limit_strict_{ip_address}_{path}'
        else:
            requests_limit = self.rate_limit_requests
            period = self.rate_limit_period
            cache_key = f'rate_limit_{ip_address}'

        # Получаем текущее количество запросов
        current_requests = cache.get(cache_key, 0)

        if current_requests >= requests_limit:
            return True

        # Увеличиваем счетчик
        if current_requests == 0:
            # Первый запрос - устанавливаем TTL
            cache.set(cache_key, 1, period)
        else:
            # Увеличиваем счетчик без изменения TTL
            cache.incr(cache_key)

        return False


class LoginAttemptMiddleware:
    """
    Middleware для отслеживания неудачных попыток входа
    Блокирует IP после нескольких неудачных попыток
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.max_attempts = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 5)
        self.lockout_duration = getattr(settings, 'LOGIN_LOCKOUT_DURATION', 900)  # 15 минут

    def __call__(self, request):
        # Проверяем блокировку перед обработкой запроса на логин
        if request.path == '/admin/login/' and request.method == 'POST':
            ip_address = get_client_ip(request)

            if self.is_locked_out(ip_address):
                logger.warning(f"Login attempt from locked out IP: {ip_address}")
                return HttpResponse(
                    "Слишком много неудачных попыток входа. Попробуйте позже.",
                    status=403,
                    content_type="text/plain; charset=utf-8"
                )

        response = self.get_response(request)

        # Отслеживаем неудачные попытки входа после обработки
        if request.path == '/admin/login/' and request.method == 'POST':
            if response.status_code != 302:  # Не редирект = неудачная попытка
                ip_address = get_client_ip(request)
                self.record_failed_attempt(ip_address)

        return response

    def is_locked_out(self, ip_address):
        """Проверка блокировки IP"""
        cache_key = f'login_lockout_{ip_address}'
        return cache.get(cache_key, False)

    def record_failed_attempt(self, ip_address):
        """Запись неудачной попытки входа"""
        cache_key = f'login_attempts_{ip_address}'
        attempts = cache.get(cache_key, 0)
        attempts += 1

        if attempts >= self.max_attempts:
            # Блокируем IP
            lockout_key = f'login_lockout_{ip_address}'
            cache.set(lockout_key, True, self.lockout_duration)
            logger.warning(f"IP {ip_address} locked out after {attempts} failed login attempts")
            # Сбрасываем счетчик
            cache.delete(cache_key)
        else:
            # Увеличиваем счетчик (храним 1 час)
            cache.set(cache_key, attempts, 3600)
