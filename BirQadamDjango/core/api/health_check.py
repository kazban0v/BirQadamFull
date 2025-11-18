"""
✅ ИСПРАВЛЕНИЕ СредП-12: Health Check Endpoint
Мониторинг здоровья системы для производственного окружения
"""
from typing import Any, Dict
from django.http import JsonResponse, HttpRequest
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
import firebase_admin  # type: ignore[reportMissingTypeStubs]
import logging

logger = logging.getLogger(__name__)


def health_check(request: HttpRequest) -> JsonResponse:
    """
    Проверяет состояние всех критичных компонентов системы
    
    Проверяет:
    - Базу данных (PostgreSQL)
    - Кеш (Redis/Memory)
    - Firebase Admin SDK
    
    Returns:
        JsonResponse с статусом здоровья системы
    """
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'checks': {}
    }
    
    # 1. Проверка базы данных
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        health_status['checks']['database'] = {
            'status': 'healthy',
            'message': 'Database connection OK'
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'message': f'Database error: {str(e)}'
        }
        logger.error(f"Health check database error: {e}")
    
    # 2. Проверка кеша
    try:
        cache_key = 'health_check_test'
        cache_value = 'test_value'
        cache.set(cache_key, cache_value, 10)
        retrieved_value = cache.get(cache_key)
        
        if retrieved_value == cache_value:
            health_status['checks']['cache'] = {
                'status': 'healthy',
                'message': 'Cache working OK'
            }
        else:
            health_status['status'] = 'degraded'
            health_status['checks']['cache'] = {
                'status': 'degraded',
                'message': 'Cache not returning expected values'
            }
    except Exception as e:
        health_status['status'] = 'degraded'
        health_status['checks']['cache'] = {
            'status': 'degraded',
            'message': f'Cache error: {str(e)}'
        }
        logger.warning(f"Health check cache error: {e}")
    
    # 3. Проверка Firebase
    try:
        # Проверяем, что Firebase инициализирован
        if firebase_admin._apps:
            health_status['checks']['firebase'] = {
                'status': 'healthy',
                'message': 'Firebase Admin SDK initialized'
            }
        else:
            health_status['status'] = 'degraded'
            health_status['checks']['firebase'] = {
                'status': 'degraded',
                'message': 'Firebase Admin SDK not initialized'
            }
    except Exception as e:
        health_status['status'] = 'degraded'
        health_status['checks']['firebase'] = {
            'status': 'degraded',
            'message': f'Firebase check error: {str(e)}'
        }
        logger.warning(f"Health check firebase error: {e}")
    
    # Определяем HTTP status code
    if health_status['status'] == 'healthy':
        status_code = 200
    elif health_status['status'] == 'degraded':
        status_code = 200  # Всё ещё работает, но с ограничениями
    else:
        status_code = 503  # Service Unavailable
    
    return JsonResponse(health_status, status=status_code)


def readiness_check(request: HttpRequest) -> JsonResponse:
    """
    Проверка готовности приложения принимать запросы
    Более простая проверка для Kubernetes/Docker health checks
    """
    try:
        # Простая проверка БД
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        
        return JsonResponse({
            'status': 'ready',
            'timestamp': timezone.now().isoformat()
        }, status=200)
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JsonResponse({
            'status': 'not_ready',
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=503)


def liveness_check(request: HttpRequest) -> JsonResponse:
    """
    Проверка живости приложения (application is running)
    Самая простая проверка для контейнеров
    """
    return JsonResponse({
        'status': 'alive',
        'timestamp': timezone.now().isoformat()
    }, status=200)

