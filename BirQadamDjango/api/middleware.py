import logging
from django.utils import timezone
from django.db.models import Q
from typing import Any

logger = logging.getLogger(__name__)

class AutoCloseExpiredTasksMiddleware:
    """
    Middleware for Lazy Expiration of Tasks.
    It checks for expired tasks and closes them on every GET request to /api/ or /custom-admin/api/.
    Executes a highly optimized strict DB existence check before evaluating Python logic, making it virtually O(1).
    """
    def __init__(self, get_response: Any):
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        path = request.path
        
        # We only check expiration when interacting with API views
        if request.method == 'GET' and ('/api/' in path or '/custom-admin/' in path):
            self.close_expired_tasks_lazy()
            
        return self.get_response(request)

    def close_expired_tasks_lazy(self) -> None:
        from api.tasks.models import Task
        try:
            now = timezone.localtime(timezone.now())
            
            # Tasks where deadline date is completely in the past
            expired_by_date = Q(deadline_date__lt=now.date())
            
            # Tasks where deadline date is today, and the end time has naturally passed
            expired_by_time = Q(deadline_date=now.date(), end_time__isnull=False, end_time__lt=now.time())
            
            # Fast DB-level filter bounds
            expired_qs = Task.objects.filter(
                Q(status__in=['open', 'in_progress']) & 
                Q(is_deleted=False) &
                (expired_by_date | expired_by_time)
            )
            
            # If any exist, evaluate them fully to respect Django signals inside `close_if_expired`
            if expired_qs.exists():
                closed_count = 0
                for task in expired_qs:
                    if task.is_expired():  # Safe explicit python execution sanity check
                        task.close_if_expired()
                        closed_count += 1
                        
                if closed_count > 0:
                    logger.info(f'[LAZY EXPIRATION] Автоматически закрыто задач: {closed_count}')
                    
        except Exception as e:
            logger.error(f"[LAZY EXPIRATION] Ошибка при автоматическом закрытии задач: {e}")
