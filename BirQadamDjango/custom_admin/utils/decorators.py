# decorators.py
from typing import Any, Callable, Optional
from django.contrib.auth.decorators import login_required, user_passes_test
from django.utils.decorators import method_decorator
from django.http import HttpRequest, HttpResponse

def admin_required(function: Optional[Callable[..., HttpResponse]] = None) -> Any:  # type: ignore[no-any-unimported]
    actual_decorator = user_passes_test(
        lambda u: u.is_active and (hasattr(u, 'is_staff') and u.is_staff),  # type: ignore[attr-defined]
        login_url='/admin/login/'
    )
    if function:
        return actual_decorator(function)
    return actual_decorator

class LoginRequiredMixin:
    @method_decorator(login_required)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:  # type: ignore[override]
        return super().dispatch(request, *args, **kwargs)  # type: ignore[misc]

class AdminRequiredMixin:
    @method_decorator(admin_required)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:  # type: ignore[override]
        return super().dispatch(request, *args, **kwargs)  # type: ignore[misc]