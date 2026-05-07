from django.shortcuts import render, get_object_or_404
import json
from django.db.models import Count, Avg, Q, Prefetch, Subquery, OuterRef
from django.db.models.fields import TextField, CharField
from django.db import IntegrityError, transaction  # ✅ ИСПРАВЛЕНИЕ: Для обработки race condition
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, HttpRequest
from typing import Any
from django.views.generic import ListView, DeleteView, TemplateView, UpdateView
from django_filters.views import FilterView  # type: ignore[reportMissingTypeStubs]
from api.models import User, Project, Task, Photo, TaskAssignment, FeedbackSession, FeedbackMessage
from api.users.services.organizer_permissions import is_approved_organizer
from ..utils.filters import UserFilter, ProjectFilter, TaskFilter
from ..utils.forms import ProjectForm
from datetime import datetime, timedelta
from django.urls import reverse, reverse_lazy
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect  # ✅ ИСПРАВЛЕНИЕ КП-7
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.conf import settings
from django.contrib.auth.forms import UserChangeForm
from django.utils.encoding import force_bytes
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils.http import urlsafe_base64_encode, url_has_allowed_host_and_scheme
from django.contrib.auth.views import PasswordResetView
from django.contrib.auth.tokens import default_token_generator
import csv, os
from io import StringIO, BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.utils import timezone
from django.contrib import messages
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
import logging
from api.utils.api_errors import APIError  # ✅ Стандартизированные ошибки API
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.authentication import SessionAuthentication
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import IsAuthenticated
# Logger setup
logger = logging.getLogger(__name__)

# ✅ ИСПРАВЛЕНИЕ: Не используем глобальную переменную, так как она инициализируется один раз
# today = timezone.now().date()  # УДАЛЕНО: будем вычислять локально в каждой функции

# ✅ Импортируем централизованную функцию нормализации телефона
from api.utils.utils import normalize_phone

# Регистрация шрифтов с абсолютными путями
try:
    font_dir = os.path.join(settings.BASE_DIR, 'admin_panel', 'static', 'fonts')
    dejavu_serif_path = os.path.join(font_dir, 'DejaVuSerif.ttf')
    dejavu_serif_bold_path = os.path.join(font_dir, 'DejaVuSerif-Bold.ttf')
    
    if os.path.exists(dejavu_serif_path):
        pdfmetrics.registerFont(TTFont('DejaVuSerif', dejavu_serif_path))
    else:
        raise FileNotFoundError(f"Файл шрифта не найден: {dejavu_serif_path}")
    
    if os.path.exists(dejavu_serif_bold_path):
        pdfmetrics.registerFont(TTFont('DejaVuSerif-Bold', dejavu_serif_bold_path))
    else:
        raise FileNotFoundError(f"Файл шрифта не найден: {dejavu_serif_bold_path}")
    
    print(f"Шрифты успешно зарегистрированы из: {font_dir}")
except Exception as e:
    print(f"Ошибка загрузки шрифтов DejaVu: {e}")
    try:
        pdfmetrics.registerFont(TTFont('Arial', 'arial.ttf'))
        pdfmetrics.registerFont(TTFont('Arial-Bold', 'arialbd.ttf'))
        print("Используются резервные шрифты Arial")
    except Exception as e:
        print(f"Ошибка загрузки резервных шрифтов: {e}")
        pdfmetrics.registerFont(TTFont('Vera', 'Vera.ttf'))
        pdfmetrics.registerFont(TTFont('VeraBd', 'VeraBd.ttf'))
        print("Используются встроенные шрифты Vera")

@login_required
def feedback_detail(request: HttpRequest, session_id: int) -> HttpResponse:
    session = get_object_or_404(FeedbackSession, id=session_id)
    messages = session.messages.all()  # type: ignore[attr-defined]
    return render(request, 'admin_panel/feedback_detail.html', {
        'session': session,
        'messages': messages
    })


def _dashboard_live_counters() -> dict[str, int]:
    """Счётчики, которые должны совпадать с модерацией в админке при каждом запросе (контекст дашборда кешируется)."""
    return {
        'pending_projects': Project.objects.filter(  # type: ignore[attr-defined]
            status='pending', deleted_at__isnull=True, is_deleted=False
        ).count(),
        'pending_tasks': Task.objects.filter(status='open', is_deleted=False).count(),  # type: ignore[attr-defined]
        'total_volunteers': User.objects.filter(is_organizer=False).count(),  # type: ignore[attr-defined]
        'active_projects': Project.objects.filter(  # type: ignore[attr-defined]
            status='approved', deleted_at__isnull=True, is_deleted=False
        ).count(),
        'pending_organizers': User.objects.filter(  # type: ignore[attr-defined]
            Q(role='organizer') | Q(is_organizer=True),
            organizer_status='pending',
        ).distinct().count(),
    }


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    try:
        period = request.GET.get('period', 'month')  # Изменено на 'month' по умолчанию (30 дней)
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        
        # ✅ ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
        now = timezone.localtime(timezone.now())
        today = now.date()

        if date_from and date_to:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
            except ValueError:
                date_from = today - timedelta(days=30)
                date_to = today
        else:
            if period == 'week':
                days = 7
            elif period == 'month':
                days = 30
            elif period == 'year':
                days = 365
            else:
                days = 30  # По умолчанию 30 дней
            date_from = today - timedelta(days=days)
            date_to = today

        # ✅ ИСПРАВЛЕНИЕ: Преобразуем даты в datetime с локальной timezone для правильной фильтрации
        # Используем timezone.make_aware с правильной локальной датой
        date_from_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
        date_to_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

        from django.core.cache import cache
        cache_key = f"dashboard_data_{period}_{date_from}_{date_to}"
        cached_context = cache.get(cache_key)
        if cached_context:
            ctx = dict(cached_context)
            stats = dict(ctx.get('stats') or {})
            stats.update(_dashboard_live_counters())
            ctx['stats'] = stats
            return render(request, 'admin_panel/dashboard.html', ctx)

        live = _dashboard_live_counters()
        stats = {
            **live,
            'completed_tasks': Task.objects.filter(status='completed').count(),  # type: ignore[attr-defined]
            'photos': Photo.objects.select_related('volunteer', 'project').order_by('-uploaded_at')[:5],  # type: ignore[attr-defined]
        }

        # Используем datetime для правильной фильтрации с timezone
        project_stats = list(Project.objects.select_related('creator').filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt, deleted_at__isnull=True)  # type: ignore[attr-defined]
                            .values('status').annotate(count=Count('id')))
        task_stats = list(Task.objects.select_related('project', 'project__creator').filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt)  # type: ignore[attr-defined]
                         .values('status').annotate(count=Count('id')))
        activity_task_map: dict[Any, set[int]] = {}
        delta = (date_to - date_from).days
        for i in range(delta, -1, -1):
            date = date_from + timedelta(days=i)
            activity_task_map[date] = set()

        completed_assignments = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            completed=True,
            completed_at__gte=date_from_dt,
            completed_at__lte=date_to_dt,
            task__is_deleted=False
        )
        for assignment in completed_assignments:
            if assignment.completed_at:
                completed_date = timezone.localtime(assignment.completed_at).date()
                if completed_date in activity_task_map:
                    activity_task_map[completed_date].add(assignment.task_id)

        approved_task_photos = Photo.objects.filter(  # type: ignore[attr-defined]
            is_deleted=False,
            status='approved',
            task__isnull=False
        )
        for photo in approved_task_photos:
            activity_dt = photo.moderated_at or photo.uploaded_at
            if photo.task_id and activity_dt:
                activity_date = timezone.localtime(activity_dt).date()
                if activity_date in activity_task_map:
                    activity_task_map[activity_date].add(photo.task_id)

        activity_stats = []
        for i in range(delta, -1, -1):
            date = date_from + timedelta(days=i)
            activity_stats.append({
                'day': date.strftime('%Y-%m-%d'),
                'count': len(activity_task_map[date])
            })

        # Таблица лидеров
        top_volunteers = (
            User.objects.filter(is_organizer=False)  # type: ignore[attr-defined]
            .annotate(
                task_count=Count('assignments', filter=Q(
                    assignments__accepted=True,
                    assignments__accepted_at__gte=date_from_dt,
                    assignments__accepted_at__lte=date_to_dt
                ), distinct=True),
                completed_count=Count('assignments', filter=Q(
                    assignments__completed=True,
                    assignments__completed_at__gte=date_from_dt,
                    assignments__completed_at__lte=date_to_dt
                ), distinct=True),
            )  # type: ignore[attr-defined]
            .filter(task_count__gt=0)  # type: ignore[attr-defined]
            .order_by('-completed_count', '-task_count')[:5]  # type: ignore[attr-defined]
        )

        # Данные для карты
        projects_for_map = Project.objects.filter(  # type: ignore[attr-defined]
            status='approved',
            deleted_at__isnull=True,
            latitude__isnull=False,
            longitude__isnull=False
        ).distinct().values('title', 'latitude', 'longitude')

        context = {
            'stats': stats,
            'project_stats': json.dumps(project_stats, cls=DjangoJSONEncoder),
            'task_stats': json.dumps(task_stats, cls=DjangoJSONEncoder),
            'activity_stats': json.dumps(activity_stats, cls=DjangoJSONEncoder),
            'top_volunteers': list(top_volunteers),
            'projects_for_map': json.dumps(list(projects_for_map), cls=DjangoJSONEncoder),
            'period': period,
            'date_from': date_from,
            'date_to': date_to
        }

        context['stats']['photos'] = list(context['stats']['photos'])
        cache.set(cache_key, context, 900)

        return render(request, 'admin_panel/dashboard.html', context)
    except Exception as e:
        logger.error(f"Ошибка в dashboard: {e}", exc_info=True)
        from django.http import HttpResponseServerError
        import traceback
        return HttpResponseServerError(f"Ошибка при загрузке dashboard: {str(e)}\n\n{traceback.format_exc()}")

@login_required
def analytics(request: HttpRequest) -> HttpResponse:
    period = request.GET.get('period', 'month')  # Изменено на 'month' по умолчанию (30 дней)
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    
    # ✅ ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
    now = timezone.localtime(timezone.now())
    today = now.date()

    if date_from and date_to:
        try:
            date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
            date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
        except ValueError:
            date_from = today - timedelta(days=30)
            date_to = today
    else:
        if period == 'week':
            days = 7
        elif period == 'month':
            days = 30
        elif period == 'year':
            days = 365
        else:
            days = 30  # По умолчанию 30 дней
        date_from = today - timedelta(days=days)
        date_to = today

    # ✅ ИСПРАВЛЕНИЕ: Преобразуем даты в datetime с локальной timezone для правильной фильтрации
    date_from_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
    date_to_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

    from django.core.cache import cache
    cache_key = f"analytics_v3_data_{period}_{date_from}_{date_to}"
    cached_context = cache.get(cache_key)
    if cached_context:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse(cached_context['chart_data'])
        return render(request, 'admin_panel/analytics.html', cached_context)

    project_data = (
        Project.objects.filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt, deleted_at__isnull=True)
        .values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    )

    task_data = (
        Task.objects.filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt)
        .values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    )

    # ✅ ИСПРАВЛЕНИЕ КП-6: Заменено .extra() на .annotate() с TruncDate для безопасности
    from django.db.models.functions import TruncDate
    
    activity_data = (
        Task.objects
        .filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    
    # Конвертируем даты в строки для JSON сериализации
    activity_data_serializable = [
        {
            'day': item['day'].isoformat() if item['day'] else None,
            'count': item['count']
        }
        for item in activity_data
    ]

    rating_data = [
        {'range': '0-20', 'count': User.objects.filter(is_organizer=False, rating__range=(0, 20)).count()},
        {'range': '21-40', 'count': User.objects.filter(is_organizer=False, rating__range=(21, 40)).count()},
        {'range': '41-60', 'count': User.objects.filter(is_organizer=False, rating__range=(41, 60)).count()},
        {'range': '61-80', 'count': User.objects.filter(is_organizer=False, rating__range=(61, 80)).count()},
        {'range': '81-100', 'count': User.objects.filter(is_organizer=False, rating__range=(81, 100)).count()},
    ]

    total_volunteers = User.objects.filter(is_organizer=False).count()
    active_volunteers = User.objects.filter(is_organizer=False).filter(
        volunteer_projects__joined_at__gte=date_from_dt,
        volunteer_projects__joined_at__lte=date_to_dt
    ).distinct().count()
    engagement_data = {
        'active': active_volunteers,
        'inactive': total_volunteers - active_volunteers
    }

    top_volunteers = (
        User.objects.filter(is_organizer=False)
        .annotate(
            task_count=Count('assignments', filter=Q(
                assignments__accepted=True,
                assignments__accepted_at__gte=date_from_dt,
                assignments__accepted_at__lte=date_to_dt
            ), distinct=True),
            completed_count=Count('assignments', filter=Q(
                assignments__completed=True,
                assignments__completed_at__gte=date_from_dt,
                assignments__completed_at__lte=date_to_dt
            ), distinct=True),
            avg_rating=Avg('photos__rating')
        )
        .filter(task_count__gt=0)
        .order_by('-completed_count', '-task_count', '-avg_rating')[:5]
    )

    # Преобразуем top_volunteers в сериализуемый формат для JSON
    top_volunteers_data = [
        {
            'username': vol.username,
            'task_count': vol.task_count,  # type: ignore[attr-defined]
            'avg_rating': float(vol.avg_rating) if vol.avg_rating else 0.0  # type: ignore[attr-defined]
        }
        for vol in top_volunteers
    ]

    # ─── БЛОК 1: Воронка волонтёров ───────────────────────────────────────────
    total_registered      = User.objects.filter(is_organizer=False).count()
    joined_project_ids    = User.objects.filter(
        is_organizer=False,
        volunteer_projects__is_active=True,
        volunteer_projects__project__is_deleted=False,
    ).distinct().values_list('id', flat=True)
    total_joined          = len(joined_project_ids)
    total_completed_task  = User.objects.filter(
        is_organizer=False,
        assignments__completed=True,
        assignments__task__is_deleted=False,
    ).distinct().count()
    total_regular         = User.objects.filter(
        is_organizer=False,
    ).annotate(
        done=Count('assignments', filter=Q(assignments__completed=True, assignments__task__is_deleted=False), distinct=True)
    ).filter(done__gte=3).count()

    funnel_data = [
        {'stage': 'Зарегистрировались',  'count': total_registered,     'icon': 'user-plus',       'color': '#6366f1'},
        {'stage': 'Вступили в проект',   'count': total_joined,         'icon': 'folder-open',     'color': '#3b82f6'},
        {'stage': 'Выполнили задачу',    'count': total_completed_task, 'icon': 'circle-check',    'color': '#10b981'},
        {'stage': 'Постоянные (3+ задач)', 'count': total_regular,      'icon': 'fire',            'color': '#f59e0b'},
    ]
    funnel_summary = {
        'regular_conversion': round(total_regular / total_registered * 100) if total_registered else 0,
        'drop_before_join': max(total_registered - total_joined, 0),
    }

    # ─── БЛОК 2: Статистика фото-отчётов ─────────────────────────────────────
    photos_pending  = Photo.objects.filter(is_deleted=False, status='pending').count()
    photos_approved = Photo.objects.filter(is_deleted=False, status='approved').count()
    photos_rejected = Photo.objects.filter(is_deleted=False, status='rejected').count()
    photos_total    = photos_pending + photos_approved + photos_rejected

    photo_stats = {
        'pending':  photos_pending,
        'approved': photos_approved,
        'rejected': photos_rejected,
        'total':    photos_total,
        'processed': photos_approved + photos_rejected,
        'approval_rate': round(photos_approved / photos_total * 100) if photos_total else 0,
    }

    # ─── БЛОК 3: Топ организаторов ───────────────────────────────────────────
    top_organizers = list(
        User.objects.filter(Q(role='organizer') | Q(is_organizer=True))
        .annotate(
            project_count=Count(
                'created_projects',
                filter=Q(created_projects__is_deleted=False, created_projects__deleted_at__isnull=True),
                distinct=True
            ),
            approved_count=Count(
                'created_projects',
                filter=Q(created_projects__status='approved', created_projects__is_deleted=False),
                distinct=True
            ),
            volunteer_count=Count(
                'created_projects__volunteer_projects',
                filter=Q(
                    created_projects__is_deleted=False,
                    created_projects__volunteer_projects__is_active=True,
                ),
                distinct=True
            ),
        )
        .filter(project_count__gt=0)
        .order_by('-volunteer_count', '-approved_count')[:5]
        .values('id', 'username', 'name', 'project_count', 'approved_count', 'volunteer_count')
    )

    response = {
        'project_data': list(project_data),
        'task_data': list(task_data),
        'activity_data': activity_data_serializable,
        'rating_data': rating_data,
        'engagement_data': engagement_data,
        'top_volunteers': top_volunteers_data,
        'funnel_data': funnel_data,
        'funnel_summary': funnel_summary,
        'photo_stats': photo_stats,
        'top_organizers': top_organizers,
        'colors': {
            'projects': ['#4e73df', '#1cc88a', '#e74a3b'],
            'tasks': ['#36b9cc', '#f6c23e', '#858796'],
            'ratings': ['#ff6384', '#36a2eb', '#ffcd56', '#4bc0c0', '#9966ff'],
            'engagement': ['#28a745', '#dc3545']
        }
    }
    analytics_summary = {
        'projects_total': sum(item['count'] for item in response['project_data']),
        'tasks_total': sum(item['count'] for item in response['task_data']),
        'activity_total': sum(item['count'] for item in activity_data_serializable),
        'active_volunteers': engagement_data['active'],
        'inactive_volunteers': engagement_data['inactive'],
        'photos_pending': photo_stats['pending'],
        'regular_volunteers': total_regular,
        'top_organizers_count': len(top_organizers),
        'top_volunteers_count': len(top_volunteers_data),
    }

    context = {
        'chart_data': response,
        'analytics_summary': analytics_summary,
        'top_volunteers': list(top_volunteers),
        'funnel_data': funnel_data,
        'funnel_summary': funnel_summary,
        'photo_stats': photo_stats,
        'top_organizers': top_organizers,
        'period': period,
        'date_from': date_from,
        'date_to': date_to
    }
    cache.set(cache_key, context, 900)

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse(response)

    return render(request, 'admin_panel/analytics.html', context)

@login_required
@require_POST
def export_report(request: HttpRequest) -> HttpResponse:
    """✅ УЛУЧШЕННЫЙ экспорт отчетов с красивым UI/UX + календарь для произвольных дат"""
    from admin_panel.services.export import create_enhanced_csv_report, create_enhanced_pdf_report
    from django.db.models.functions import TruncDate
    from datetime import datetime  # ✅ ИСПРАВЛЕНИЕ: Импорт в начале функции
    
    selected_data = request.POST.getlist('data_to_export')
    period = request.POST.get('period', 'week')
    export_format = request.POST.get('format', 'csv')
    
    # ✅ ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
    today = timezone.localtime(timezone.now()).date()

    # ✅ Обработка произвольного периода с календарем
    if period == 'custom':
        date_from_str = request.POST.get('date_from')
        date_to_str = request.POST.get('date_to')
        
        if date_from_str and date_to_str:
            try:
                date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
                date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
                
                # Валидация
                if date_from > date_to:
                    date_from, date_to = date_to, date_from  # Меняем местами
                
                # Ограничиваем максимум 1 год
                if (date_to - date_from).days > 365:
                    date_from = date_to - timedelta(days=365)
                
                period = f'custom_{date_from}_{date_to}'  # Для отображения в отчете
            except ValueError:
                # Если ошибка парсинга - используем месяц по умолчанию
                date_from = today - timedelta(days=30)
                date_to = today
        else:
            # Если даты не указаны - используем месяц по умолчанию
            date_from = today - timedelta(days=30)
            date_to = today
    else:
        # Стандартные периоды
        if period == 'week':
            days = 7
        elif period == 'month':
            days = 30
        elif period == 'year':
            days = 365
        else:
            days = 7
        
        date_from = today - timedelta(days=days)
        date_to = today

    # Преобразуем даты в datetime для запросов
    date_from_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
    date_to_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

    from django.core.cache import cache
    cache_key = f"analytics_data_{period}_{date_from}_{date_to}"
    cached_context = cache.get(cache_key)
    if cached_context:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse(cached_context['chart_data'])
        return render(request, 'admin_panel/analytics.html', cached_context)
    
    data = {
        'period': period,
        'created_at': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
        'date_from': date_from.strftime('%Y-%m-%d'),
        'date_to': date_to.strftime('%Y-%m-%d')
    }

    if not selected_data or 'projects' in selected_data:
        data['projects'] = list(Project.objects.filter(  # type: ignore[attr-defined]
            created_at__gte=date_from_dt,
            created_at__lte=date_to_dt,
            deleted_at__isnull=True
        ).values('status').annotate(count=Count('id')))  # type: ignore[arg-type]

    if not selected_data or 'tasks' in selected_data:
        data['tasks'] = list(Task.objects.filter(  # type: ignore[attr-defined]
            created_at__gte=date_from_dt,
            created_at__lte=date_to_dt
        ).values('status').annotate(count=Count('id')))  # type: ignore[arg-type]

    if not selected_data or 'activity' in selected_data:
        # ✅ Используем TruncDate вместо .extra() для безопасности
        from django.db.models.functions import TruncDate  # type: ignore[attr-defined]
        data['activity'] = list(TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            completed_at__gte=date_from_dt,
            completed_at__lte=date_to_dt
        ).annotate(day=TruncDate('completed_at'))  # type: ignore[attr-defined]
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day'))  # type: ignore[arg-type]

    if not selected_data or 'ratings' in selected_data:
        data['ratings'] = [  # type: ignore[arg-type]
            {'range': '0-20', 'count': User.objects.filter(is_organizer=False, rating__range=(0, 20)).count()},  # type: ignore[attr-defined]
            {'range': '21-40', 'count': User.objects.filter(is_organizer=False, rating__range=(21, 40)).count()},  # type: ignore[attr-defined]
            {'range': '41-60', 'count': User.objects.filter(is_organizer=False, rating__range=(41, 60)).count()},  # type: ignore[attr-defined]
            {'range': '61-80', 'count': User.objects.filter(is_organizer=False, rating__range=(61, 80)).count()},  # type: ignore[attr-defined]
            {'range': '81-100', 'count': User.objects.filter(is_organizer=False, rating__range=(81, 100)).count()},  # type: ignore[attr-defined]
        ]

    if not selected_data or 'engagement' in selected_data:
        total_volunteers = User.objects.filter(is_organizer=False).count()  # type: ignore[attr-defined]
        active_volunteers = User.objects.filter(is_organizer=False).filter(  # type: ignore[attr-defined]
            volunteer_projects__joined_at__gte=date_from_dt,  # type: ignore[attr-defined]
            volunteer_projects__joined_at__lte=date_to_dt  # type: ignore[attr-defined]
        ).distinct().count()
        data['engagement'] = {  # type: ignore[arg-type]
            'active': active_volunteers,
            'inactive': total_volunteers - active_volunteers
        }

    if not selected_data or 'top_volunteers' in selected_data:
        data['top_volunteers'] = list(User.objects.filter(is_organizer=False)  # type: ignore[attr-defined]
                                    .annotate(task_count=Count('assignments', filter=Q(assignments__completed=True)))  # type: ignore[attr-defined]
                                    .order_by('-task_count')[:5]  # type: ignore[attr-defined]
                                    .values('username', 'task_count'))  # type: ignore[arg-type]

    # ✅ Используем улучшенные функции экспорта
    if export_format == 'csv':
        return create_enhanced_csv_report(data)
    else:  # PDF
        return create_enhanced_pdf_report(data)

@login_required
def project_feedback(request: HttpRequest, pk: int | str) -> HttpResponse:
    project = get_object_or_404(Project, pk=pk, deleted_at__isnull=True)
    feedback_sessions = FeedbackSession.objects.filter(project=project).select_related(
        'volunteer', 'organizer'
    ).prefetch_related('messages').order_by('-created_at')
    
    if request.method == 'POST':
        session_id = request.POST.get('session_id')
        text = request.POST.get('message')
        if session_id and text:
            session = get_object_or_404(FeedbackSession, id=session_id)
            FeedbackMessage.objects.create(
                session=session,
                sender=request.user,
                text=text
            )
            return redirect('project_feedback', pk=pk)
    
    return render(request, 'admin_panel/project_feedback.html', {
        'project': project,
        'feedback_sessions': feedback_sessions
    })

@login_required
def volunteers(request: HttpRequest, user_id: int | None = None) -> HttpResponse:
    # ✅ ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
    today = timezone.localtime(timezone.now()).date()
    
    total_volunteers = User.objects.filter(is_organizer=False).count()  # type: ignore[attr-defined]
    avg_rating = User.objects.filter(is_organizer=False, photos__rating__isnull=False).aggregate(avg_rating=Avg('photos__rating'))['avg_rating'] or 0  # type: ignore[attr-defined]
    completed_task_ids = set(TaskAssignment.objects.filter(  # type: ignore[attr-defined]
        completed=True,
        task__is_deleted=False
    ).values_list('task_id', flat=True))
    approved_photo_task_ids = set(Photo.objects.filter(  # type: ignore[attr-defined]
        is_deleted=False,
        status='approved',
        task__isnull=False
    ).values_list('task_id', flat=True))
    total_tasks = len(completed_task_ids | approved_photo_task_ids)

    if user_id:
        volunteer = get_object_or_404(User, id=user_id, is_organizer=False)
        completed_assignments = volunteer.assignments.filter(completed=True).select_related('task__project')  # type: ignore[attr-defined]
        approved_task_photos = volunteer.photos.filter(  # type: ignore[attr-defined]
            is_deleted=False,
            status='approved',
            task__isnull=False
        ).select_related('task__project').order_by('-moderated_at', '-uploaded_at')

        completed_tasks_map: dict[int, dict[str, Any]] = {}
        for assignment in completed_assignments:
            task = assignment.task
            completed_tasks_map[task.id] = {
                'task': task,
                'project': task.project,
                'completed_at': assignment.completed_at or task.updated_at if hasattr(task, 'updated_at') else assignment.completed_at,
                'source': 'assignment',
            }

        for photo in approved_task_photos:
            if photo.task_id and photo.task_id not in completed_tasks_map:
                completed_tasks_map[photo.task_id] = {
                    'task': photo.task,
                    'project': photo.task.project,
                    'completed_at': photo.moderated_at or photo.uploaded_at,
                    'source': 'photo',
                }

        completed_tasks = sorted(
            completed_tasks_map.values(),
            key=lambda item: item['completed_at'] or timezone.now(),
            reverse=True
        )

        volunteer_display_name = (volunteer.name or '').strip() or volunteer.username
        volunteer_initial = volunteer_display_name[:1].upper() if volunteer_display_name else 'V'
        
        stats = {
            'username': volunteer.username,
            'rating': volunteer.rating if volunteer.rating is not None else 0,
            'project_count': volunteer.volunteer_projects.filter(is_active=True, project__is_deleted=False).count(),  # type: ignore[attr-defined]
            'task_count': len(completed_tasks),
            'photo_count': volunteer.photos.filter(is_deleted=False).count(),  # type: ignore[attr-defined]
        }
        
        volunteer_avg_rating = volunteer.photos.aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0  # type: ignore[attr-defined]
        
        rating_history = []
        for i in range(365, -1, -30):
            date_from = today - timedelta(days=i)
            date_to = today - timedelta(days=i - 30) if i > 0 else today
            rating = User.objects.filter(id=user_id, is_organizer=False).annotate(  # type: ignore[attr-defined]
                avg_rating=Avg('photos__rating', filter=Q(photos__moderated_at__range=(date_from, date_to)))  # type: ignore[attr-defined]
            ).values('avg_rating').first()
            rating_history.append({
                'period': date_from.strftime('%Y-%m'),
                'rating': rating['avg_rating'] if rating and rating['avg_rating'] is not None else 0
            })

        activity_task_map: dict[Any, set[int]] = {}
        for i in range(30, -1, -1):
            date = today - timedelta(days=i)
            activity_task_map[date] = set()

        for assignment in completed_assignments:
            if assignment.completed_at:
                completed_date = timezone.localtime(assignment.completed_at).date()
                if completed_date in activity_task_map:
                    activity_task_map[completed_date].add(assignment.task_id)

        for photo in approved_task_photos:
            if photo.task_id:
                activity_dt = photo.moderated_at or photo.uploaded_at
                if activity_dt:
                    activity_date = timezone.localtime(activity_dt).date()
                    if activity_date in activity_task_map:
                        activity_task_map[activity_date].add(photo.task_id)

        activity_data = []
        for i in range(30, -1, -1):
            date = today - timedelta(days=i)
            activity_data.append({
                'day': date.strftime('%Y-%m-%d'),
                'count': len(activity_task_map[date])
            })
        
        context = {
            'volunteer': volunteer,
            'volunteer_display_name': volunteer_display_name,
            'volunteer_initial': volunteer_initial,
            'stats': stats,
            'volunteer_avg_rating': volunteer_avg_rating,
            'rating_history': json.dumps(rating_history, cls=DjangoJSONEncoder),
            'activity_data': json.dumps(activity_data, cls=DjangoJSONEncoder),
            'show_analytics': True,
            'total_volunteers': total_volunteers,
            'avg_rating': avg_rating,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
        }
        return render(request, 'admin_panel/volunteer_analytics.html', context)
    else:
        sort_by = request.GET.get('sort', 'task_count')
        sort_dir = request.GET.get('dir', 'desc')
        allowed_sorts = {'task_count', 'project_count', 'avg_rating', 'date_joined', 'rating'}
        if sort_by not in allowed_sorts:
            sort_by = 'task_count'

        volunteers_qs = User.objects.filter(is_organizer=False).annotate(  # type: ignore[attr-defined]
            project_count=Count('volunteer_projects', filter=Q(volunteer_projects__is_active=True, volunteer_projects__project__is_deleted=False), distinct=True),
            task_count=Count('assignments', filter=Q(assignments__completed=True, assignments__task__is_deleted=False), distinct=True),
            avg_rating=Avg('photos__rating', filter=Q(photos__is_deleted=False, photos__status='approved')),
        )
        order_prefix = '-' if sort_dir == 'desc' else ''
        volunteers = list(volunteers_qs.order_by(f'{order_prefix}{sort_by}'))

        for volunteer in volunteers:
            completed_ids = set(volunteer.assignments.filter(  # type: ignore[attr-defined]
                completed=True,
                task__is_deleted=False
            ).values_list('task_id', flat=True))
            approved_ids = set(volunteer.photos.filter(  # type: ignore[attr-defined]
                is_deleted=False,
                status='approved',
                task__isnull=False
            ).values_list('task_id', flat=True))
            volunteer.task_count = len(completed_ids | approved_ids)  # type: ignore[attr-defined]

        context = {
            'volunteers': volunteers,
            'show_analytics': False,
            'total_volunteers': total_volunteers,
            'avg_rating': avg_rating,
            'total_tasks': total_tasks,
            'sort_by': sort_by,
            'sort_dir': sort_dir,
        }

    return render(request, 'admin_panel/volunteers.html', context)


@method_decorator(login_required, name='dispatch')
class ProjectDeleteView(DeleteView):
    model = Project
    template_name = 'admin_panel/project_confirm_delete.html'
    success_url = reverse_lazy('admin_panel:project_list')

    def delete(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseRedirect:
        self.object = self.get_object()
        self.object.delete()
        return HttpResponseRedirect(self.get_success_url())

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context['hide_sidebar'] = False
        return context
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"ok": True})

@login_required
def project_detail(request: HttpRequest, pk: int | str) -> HttpResponse:
    project = get_object_or_404(Project, pk=pk, deleted_at__isnull=True)
    
    task_stats = (
        Task.objects.select_related('project', 'project__creator').filter(project=project)  # type: ignore[attr-defined]
        .values('status')
        .annotate(count=Count('id'))
    )
    
    # ✅ ИСПРАВЛЕНИЕ: Заменено .extra() на .annotate() с TruncDate для безопасности
    from django.db.models.functions import TruncDate
    
    activity_data = (
        TaskAssignment.objects.select_related('task', 'volunteer').filter(task__project=project, completed=True)  # type: ignore[attr-defined]
        .annotate(day=TruncDate('completed_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    
    # Конвертируем даты в строки для JSON сериализации
    activity_data_serializable = [
        {
            'day': item['day'].isoformat() if item['day'] else None,
            'count': item['count']
        }
        for item in activity_data
    ]
    
    top_volunteers = (
        User.objects.filter(  # type: ignore[attr-defined]
            is_organizer=False,
            assignments__task__project=project,  # type: ignore[attr-defined]
            assignments__completed=True  # type: ignore[attr-defined]
        )
        .annotate(  # type: ignore[attr-defined]
            task_count=Count('assignments', filter=Q(assignments__completed=True)),  # type: ignore[attr-defined]
            avg_rating=Avg('photos__rating')  # type: ignore[attr-defined]
        )
        .order_by('-task_count')[:5]  # type: ignore[attr-defined]
        .values('username', 'task_count', 'avg_rating')
    )
    
    context = {
        'project': project,
        'task_stats': json.dumps(list(task_stats)),
        'activity_data': json.dumps(activity_data_serializable),
        'top_volunteers': list(top_volunteers),
    }
    
    return render(request, 'admin_panel/project_detail.html', context)

@method_decorator(login_required, name='dispatch')
class ProjectUpdateView(UpdateView):
    model = Project
    form_class = ProjectForm
    template_name = 'admin_panel/project_edit.html'
    success_url = reverse_lazy('admin_panel:project_list')
    
    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context['is_edit'] = True
        return context
    
    def form_valid(self, form: Any) -> HttpResponseRedirect:
        """Обработка успешной валидации формы"""
        try:
            return super().form_valid(form)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error saving project: {e}", exc_info=True)
            # Возвращаем форму с ошибкой
            return self.form_invalid(form)

@login_required
def project_list(request: HttpRequest) -> HttpResponse:
    projects = Project.objects.select_related('creator').filter(  # type: ignore[attr-defined]
        deleted_at__isnull=True, is_deleted=False
    ).annotate(
        volunteer_count=Count('volunteer_projects', distinct=True),  # type: ignore[attr-defined]
        task_count=Count('tasks', distinct=True),  # type: ignore[attr-defined]
    ).order_by('-created_at')
    return render(request, 'admin_panel/projects.html', {'projects': projects})

@login_required
def task_list(request: HttpRequest) -> HttpResponse:
    tasks = Task.objects.select_related('project').annotate(  # type: ignore[attr-defined]
        assignment_count=Count('assignments')).order_by('-created_at')
    return render(request, 'admin_panel/tasks.html', {'tasks': tasks})

@require_POST
def custom_logout(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect('admin_panel:login')

@method_decorator(login_required, name='dispatch')
class ProjectListView(FilterView):
    model = Project
    filterset_class = ProjectFilter
    template_name = 'admin_panel/projects.html'
    paginate_by = 20

    def get_queryset(self) -> Any:
        return Project.objects.select_related('creator').filter(deleted_at__isnull=True).annotate(  # type: ignore[attr-defined]
            volunteer_count=Count('volunteer_projects', distinct=True),  # type: ignore[attr-defined]
            task_count=Count('tasks', distinct=True)  # type: ignore[attr-defined]
        )

@method_decorator(login_required, name='dispatch')
class TaskListView(FilterView):
    model = Task
    filterset_class = TaskFilter
    template_name = 'admin_panel/tasks.html'
    paginate_by = 25
    context_object_name = 'tasks'

    def get_queryset(self) -> Any:
        queryset = super().get_queryset().select_related('project').annotate(
            assignments_count=Count('assignments')
        )
        return queryset.order_by('-created_at')

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context['status_choices'] = Task.STATUS_CHOICES
        
        # Добавляем параметры фильтрации в контекст
        context['active_filters'] = {
            'search': self.request.GET.get('search', ''),
            'status': self.request.GET.get('status', ''),
            'date_from': self.request.GET.get('date_from', ''),
        }
        
        context['tasks_count'] = context['paginator'].count if 'paginator' in context else context['tasks'].count()
        
        # Добавляем статистику по статусам задач
        context['stats'] = {
            'open': Task.objects.select_related('project', 'project__creator').filter(status='open').count(),  # type: ignore[attr-defined]
            'in_progress': Task.objects.filter(status='in_progress').count(),  # type: ignore[attr-defined]
            'completed': Task.objects.filter(status='completed').count(),  # type: ignore[attr-defined]
            'failed': Task.objects.filter(status='failed').count(),  # type: ignore[attr-defined]
        }
        
        return context

@method_decorator(login_required, name='dispatch')
class VolunteerListView(FilterView):
    model = User
    filterset_class = UserFilter
    template_name = 'admin_panel/volunteers.html'
    paginate_by = 20

class CustomLoginView(auth_views.LoginView):
    template_name = 'admin_panel/login.html'
    success_url = reverse_lazy('admin_panel:dashboard')
    extra_context = {'hide_sidebar': True}

    def form_valid(self, form: Any) -> HttpResponseRedirect:
        remember_me = self.request.POST.get('remember_me')
        if not remember_me:
            self.request.session.set_expiry(0)  # Сессия закончится при закрытии браузера
        else:
            self.request.session.set_expiry(1209600) # 2 недели
        result = super(CustomLoginView, self).form_valid(form)
        if not isinstance(result, HttpResponseRedirect):
            from django.http import HttpResponseRedirect as HR
            return HR(self.get_success_url())
        return result

class RapidPasswordResetView(PasswordResetView):
    email_template_name = 'admin_panel/password_reset_email.html'
    token_generator = default_token_generator
    
    def send_mail(self, *args: Any, **kwargs: Any) -> None:
        settings.PASSWORD_RESET_TIMEOUT = 180
        return super().send_mail(*args, **kwargs)  # type: ignore[misc]

class ProfileView(LoginRequiredMixin, TemplateView):
    template_name = 'admin_panel/profile.html'

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        user = self.request.user
        is_admin_panel_user = bool(user.is_staff or getattr(user, 'is_admin', False))
        
        context['user'] = user
        context['is_admin_panel_user'] = is_admin_panel_user
        context['completed_tasks_count'] = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=user, 
            completed=True
        ).count()
        if hasattr(user, 'volunteer_projects'):
            context['active_projects_count'] = user.volunteer_projects.filter(  # type: ignore[attr-defined]
                is_active=True
            ).count()
        else:
            context['active_projects_count'] = 0
        if hasattr(user, 'photos'):
            context['photos_count'] = user.photos.count()  # type: ignore[attr-defined]
        else:
            context['photos_count'] = 0
        
        if hasattr(user, 'photos'):
            photo_rating = user.photos.filter(rating__isnull=False).aggregate(  # type: ignore[attr-defined]
                avg_rating=Avg('rating'))['avg_rating'] or 0
        else:
            photo_rating = 0
        assignment_rating = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=user, 
            rating__isnull=False
        ).aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0
        
        total_ratings = 0
        count = 0
        if photo_rating:
            total_ratings += photo_rating
            count += 1
        if assignment_rating:
            total_ratings += assignment_rating
            count += 1
        context['avg_rating'] = total_ratings / count if count > 0 else 0
        
        context['recent_assignments'] = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=user
        ).select_related('task', 'task__project').order_by('-completed_at')[:5]
        if hasattr(user, 'volunteer_projects'):
            context['current_projects'] = user.volunteer_projects.filter(  # type: ignore[attr-defined]
                is_active=True
            ).select_related('project').order_by('-joined_at')[:5]
        else:
            context['current_projects'] = []
        if hasattr(user, 'photos'):
            context['recent_photos'] = user.photos.select_related(  # type: ignore[attr-defined]
                'project'
            ).order_by('-uploaded_at')[:3]
        else:
            context['recent_photos'] = []
        
        feedback_query = Q(volunteer=user) | Q(organizer=user)
        context['feedback_sessions'] = FeedbackSession.objects.filter(feedback_query)  # type: ignore[attr-defined]

        if is_admin_panel_user:
            context['profile_role_label'] = 'Администратор системы'
            context['profile_role_summary'] = 'Координирует модерацию, следит за качеством данных и управляет ключевыми разделами платформы.'
            context['admin_metrics'] = {
                'volunteers': User.objects.filter(is_organizer=False, is_staff=False).count(),  # type: ignore[attr-defined]
                'organizers': User.objects.filter(Q(role='organizer') | Q(is_organizer=True)).distinct().count(),  # type: ignore[attr-defined]
                'pending_organizers': User.objects.filter(  # type: ignore[attr-defined]
                    Q(role='organizer') | Q(is_organizer=True), organizer_status='pending'
                ).distinct().count(),
                'pending_projects': Project.objects.select_related('creator').filter(  # type: ignore[attr-defined]
                    status='pending', deleted_at__isnull=True, is_deleted=False
                ).count(),
                'active_projects': Project.objects.filter(status='approved', deleted_at__isnull=True).count(),  # type: ignore[attr-defined]
                'open_tasks': Task.objects.select_related('project', 'project__creator').filter(status__in=['open', 'pending'], is_deleted=False).count(),  # type: ignore[attr-defined]
                'review_tasks': Task.objects.filter(status='under_review', is_deleted=False).count(),  # type: ignore[attr-defined]
                'pending_photos': Photo.objects.select_related('task', 'volunteer').filter(status='pending', is_deleted=False).count(),  # type: ignore[attr-defined]
                'approved_photos': Photo.objects.select_related('task', 'volunteer').filter(status='approved', is_deleted=False).count(),  # type: ignore[attr-defined]
            }
            context['admin_priority_links'] = [
                {
                    'label': 'На модерации проекты',
                    'value': context['admin_metrics']['pending_projects'],
                    'hint': 'Проверить перед публикацией',
                    'url': reverse('admin_panel:project_list'),
                    'icon': 'fas fa-layer-group',
                    'tone': 'warning',
                },
                {
                    'label': 'Фотоотчеты у организаторов',
                    'value': context['admin_metrics']['pending_photos'],
                    'hint': 'Проверку делают организаторы, админ наблюдает',
                    'url': reverse('admin_panel:analytics') + '#photo-reports-overview',
                    'icon': 'fas fa-camera-retro',
                    'tone': 'info',
                },
                {
                    'label': 'Организаторы ждут решения',
                    'value': context['admin_metrics']['pending_organizers'],
                    'hint': 'Подтвердить или отклонить заявку',
                    'url': reverse('admin_panel:organizers'),
                    'icon': 'fas fa-user-check',
                    'tone': 'success',
                },
            ]
            context['admin_quick_actions'] = [
                {
                    'label': 'Открыть dashboard',
                    'description': 'Главный обзор системы и карты активности',
                    'url': reverse('admin_panel:dashboard'),
                    'icon': 'fas fa-chart-pie',
                },
                {
                    'label': 'Проверить проекты',
                    'description': 'Управление модерацией и статусами проектов',
                    'url': reverse('admin_panel:project_list'),
                    'icon': 'fas fa-diagram-project',
                },
                {
                    'label': 'Разобрать задачи',
                    'description': 'Открытые, архивные и проверяемые задачи',
                    'url': reverse('admin_panel:task_list'),
                    'icon': 'fas fa-list-check',
                },
                {
                    'label': 'Открыть аналитику',
                    'description': 'Срез по активности, рейтингу и вовлеченности',
                    'url': reverse('admin_panel:analytics'),
                    'icon': 'fas fa-chart-line',
                },
            ]
            context['admin_recent_projects'] = Project.objects.select_related('creator').filter(  # type: ignore[attr-defined]
                deleted_at__isnull=True).order_by('-created_at')[:4]
            context['admin_recent_tasks'] = Task.objects.select_related('project').filter(  # type: ignore[attr-defined]
                is_deleted=False
            ).order_by('-created_at')[:4]
            context['admin_recent_photos'] = Photo.objects.select_related('volunteer', 'project').filter(  # type: ignore[attr-defined]
                is_deleted=False
            ).order_by('-uploaded_at')[:4]
        else:
            context['profile_role_label'] = 'Пользователь платформы'
            context['profile_role_summary'] = 'Личный профиль и базовые данные аккаунта.'
            context['admin_metrics'] = {}
            context['admin_priority_links'] = []
            context['admin_quick_actions'] = []
            context['admin_recent_projects'] = []
            context['admin_recent_tasks'] = []
            context['admin_recent_photos'] = []
        
        return context

class ProfileUpdateView(LoginRequiredMixin, UpdateView):
    template_name = 'admin_panel/profile_edit.html'
    form_class = UserChangeForm
    success_url = reverse_lazy('profile')

    def get_object(self, queryset: Any = None) -> Any:
        return self.request.user

    def get_form(self, form_class: Any = None) -> Any:
        form = super().get_form(form_class)
        for field in ['password', 'last_login', 'date_joined']:
            if field in form.fields:
                del form.fields[field]
        return form

@login_required
def project_restore(request: HttpRequest, pk: int | str) -> HttpResponse:
    project = get_object_or_404(Project, pk=pk, creator=request.user)
    project.deleted_at = None
    project.is_deleted = False
    project.save()
    messages.success(request, f'Проект "{project.title}" восстановлен')
    return redirect('project_list')


def _user_can_moderate_projects(request: HttpRequest) -> bool:
    u = request.user
    return bool(getattr(u, 'is_staff', False) or getattr(u, 'is_admin', False))


def _redirect_after_project_moderation(request: HttpRequest) -> HttpResponseRedirect:
    nxt = (request.POST.get('next') or '').strip()
    if nxt.startswith('/') and not nxt.startswith('//'):
        return HttpResponseRedirect(nxt)
    if nxt and url_has_allowed_host_and_scheme(
        nxt,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return HttpResponseRedirect(nxt)
    return HttpResponseRedirect(reverse('admin_panel:project_list') + '?status=pending')


@login_required
@require_POST
@csrf_protect
def project_moderate_approve(request: HttpRequest, pk: int) -> HttpResponseRedirect:
    if not _user_can_moderate_projects(request):
        return HttpResponse('Доступ запрещён', status=403)
    project = get_object_or_404(Project, pk=pk, deleted_at__isnull=True, is_deleted=False)
    if project.status != 'pending':
        messages.warning(request, f'Проект «{project.title}» уже не в статусе ожидания проверки.')
        return _redirect_after_project_moderation(request)
    with transaction.atomic():
        project.status = 'approved'
        project.save(update_fields=['status'])
        project.approve()
    messages.success(request, f'Проект «{project.title}» одобрен.')
    return _redirect_after_project_moderation(request)


@login_required
@require_POST
@csrf_protect
def project_moderate_reject(request: HttpRequest, pk: int) -> HttpResponseRedirect:
    if not _user_can_moderate_projects(request):
        return HttpResponse('Доступ запрещён', status=403)
    project = get_object_or_404(Project, pk=pk, deleted_at__isnull=True, is_deleted=False)
    if project.status != 'pending':
        messages.warning(request, f'Проект «{project.title}» уже не в статусе ожидания проверки.')
        return _redirect_after_project_moderation(request)
    with transaction.atomic():
        project.status = 'rejected'
        project.save(update_fields=['status'])
        project.reject()
    messages.success(request, f'Проект «{project.title}» отклонён.')
    return _redirect_after_project_moderation(request)

# API Views for Mobile App
class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Any) -> Response:
        try:
            # Flutter sends: name, email, phone, password1, password2, role, organization_name
            # Для DRF API используем request.data
            from rest_framework.request import Request as DRFRequest
            if isinstance(request, DRFRequest):
                data = request.data
            else:
                # Fallback для обычного Django request
                data = getattr(request, 'POST', {})
            
            name = data.get('name', '')  # type: ignore[attr-defined]
            email = data.get('email')  # type: ignore[attr-defined]
            phone = data.get('phone', '')  # type: ignore[attr-defined]
            password1 = data.get('password1')  # type: ignore[attr-defined]
            password2 = data.get('password2')  # type: ignore[attr-defined]
            role = data.get('role', 'volunteer')  # type: ignore[attr-defined]
            organization_name = data.get('organization_name', '')  # type: ignore[attr-defined]

            # ✅ Валидация обязательных полей
            missing = []
            if not email: missing.append('email')
            if not password1: missing.append('password')
            if not phone: missing.append('phone')
            if missing:
                return APIError.missing_fields(missing)

            # ✅ Проверка совпадения паролей
            if password1 != password2:
                return APIError.passwords_mismatch()

            # ✅ Нормализуем номер телефона
            phone = normalize_phone(phone)
            logger.info(f"📱 Регистрация с номером: {phone}")

            # 🔍 ВАРИАНТ 4: Проверяем существующего пользователя по ТЕЛЕФОНУ
            existing_user = User.objects.filter(phone_number=phone).first()
            
            if existing_user:
                logger.info(f"🔍 Найден существующий пользователь по телефону {phone}: {existing_user.username}")
                
                # ✅ Проверяем, есть ли уже email (уже зарегистрирован в приложении)
                if existing_user.email:
                    return APIError.account_already_linked()
                
                # ✅ ПРИВЯЗКА: Дополняем существующий Telegram аккаунт данными из приложения
                logger.info(f"[OK] Привязываем приложение к Telegram аккаунту {existing_user.id}")  # type: ignore[attr-defined]
                
                existing_user.email = email
                existing_user.username = email
                existing_user.set_password(password1)
                existing_user.name = name if name else existing_user.name  # Обновляем имя если указано
                existing_user.registration_source = 'both'  # Теперь доступен в обоих местах
                
                # Обновляем роль если указана
                if role and not existing_user.role:
                    existing_user.role = role
                
                if role == 'organizer':
                    existing_user.is_organizer = False
                    existing_user.is_approved = False
                    existing_user.organizer_status = 'pending'
                    if organization_name:
                        existing_user.organization_name = organization_name
                
                existing_user.save()
                logger.info(f"[OK] Пользователь обновлен: email={existing_user.email}, registration_source={existing_user.registration_source}")
                
                # 📨 Отправляем уведомление в TELEGRAM (если есть telegram_id)
                if existing_user.telegram_id:
                    try:
                        from admin_panel.services.notification_service import NotificationService
                        from asgiref.sync import async_to_sync
                        
                        telegram_message = (
                            f"✅ <b>Приложение привязано!</b>\n\n"
                            f"Ваш аккаунт теперь доступен в мобильном приложении BirQadam!\n\n"
                            f"📧 Email: {email}\n"
                            f"📱 Телефон: {phone}\n"
                            f"⭐ Рейтинг: {existing_user.rating}\n\n"
                            f"Теперь вы можете войти в приложение используя этот email и пароль!"
                        )
                        
                        async_to_sync(NotificationService.send_telegram_message)(
                            existing_user.telegram_id,
                            telegram_message
                        )
                        logger.info(f"[OK] Telegram уведомление о привязке приложения отправлено")
                    except Exception as e:
                        logger.error(f"[ERROR] Ошибка отправки Telegram уведомления: {e}")
                
                # Генерируем токен для входа
                refresh = RefreshToken.for_user(existing_user)
                
                return Response({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'message': 'Account linked successfully! Ваш Telegram аккаунт привязан к приложению.',
                    'linked': True,  # Флаг что аккаунт был привязан
                    'user': {
                        'id': existing_user.id,  # type: ignore[attr-defined]
                        'username': existing_user.username,  # type: ignore[attr-defined]
                        'email': existing_user.email,  # type: ignore[attr-defined]
                        'name': existing_user.name,  # type: ignore[attr-defined]
                        'role': existing_user.role,  # type: ignore[attr-defined]
                        'is_organizer': existing_user.is_organizer,  # type: ignore[attr-defined]
                        'is_approved': existing_user.is_approved,  # type: ignore[attr-defined]
                        'is_rejected': existing_user.organizer_status == 'rejected',  # type: ignore[attr-defined]
                        'rating': existing_user.rating,  # type: ignore[attr-defined]
                        'registration_source': existing_user.registration_source,  # type: ignore[attr-defined]
                        'telegram_linked': True  # Указываем что Telegram привязан
                    }
                }, status=status.HTTP_201_CREATED)
            
            # 🆕 Создаем НОВОГО пользователя (только через приложение)
            logger.info(f"🆕 Создаем нового пользователя через приложение: {email}")
            
            # ✅ ИСПРАВЛЕНИЕ Race Condition: используем try-except вместо exists()
            try:
                # Обеспечиваем что name и email не None
                user_name: str = name if name and isinstance(name, str) else ''
                user_email: str = email if email and isinstance(email, str) else ''
                if not user_email:
                    return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
                user = User.objects.create_user(  # type: ignore[attr-defined]
                    username=user_email,
                    email=user_email,
                    password=password1,
                    name=user_name,
                    phone_number=phone,
                    role=role,
                    registration_source='mobile_app'  # Только приложение
                )
            except IntegrityError as e:
                logger.warning(f"[WARNING] IntegrityError при регистрации: {e}")
                if 'email' in str(e).lower():
                    return APIError.email_exists(email)
                elif 'phone' in str(e).lower():
                    return Response({
                        'error': 'Пользователь с таким номером телефона уже существует'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return APIError.internal_error(e)

            # Organizers need approval and organization name
            if role == 'organizer':
                user.is_organizer = False  # Не одобрен пока
                user.is_approved = False
                user.organizer_status = 'pending'  # Устанавливаем статус "ожидает"
                if organization_name:
                    user.organization_name = organization_name
            else:
                user.is_approved = True
            user.save()
            
            logger.info(f"[OK] Новый пользователь создан: ID={user.id}, email={user.email}")  # type: ignore[attr-defined]

            refresh = RefreshToken.for_user(user)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'linked': False,  # Новый аккаунт, не привязан
                'user': {
                    'id': user.id,  # type: ignore[attr-defined]
                    'username': user.username,  # type: ignore[attr-defined]
                    'email': user.email,  # type: ignore[attr-defined]
                    'name': user.name,  # type: ignore[attr-defined]
                    'role': user.role,  # type: ignore[attr-defined]
                    'is_organizer': user.is_organizer,  # type: ignore[attr-defined]
                    'is_approved': user.is_approved,  # type: ignore[attr-defined]
                    'is_rejected': False,
                    'rating': user.rating,  # type: ignore[attr-defined]
                    'registration_source': user.registration_source,  # type: ignore[attr-defined]
                    'telegram_linked': False  # Telegram не привязан
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            logger.error(f"[ERROR] Registration error: {str(e)}")
            logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
            return APIError.internal_error(e)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Any) -> Response:
        try:
            # Для DRF API используем request.data
            from rest_framework.request import Request as DRFRequest
            if isinstance(request, DRFRequest):
                data = request.data
            else:
                data = getattr(request, 'POST', {})
            
            username = data.get('username')  # type: ignore[attr-defined]
            password = data.get('password')  # type: ignore[attr-defined]

            # ✅ Валидация обязательных полей
            missing = []
            if not username: missing.append('email')
            if not password: missing.append('password')
            if missing:
                return APIError.missing_fields(missing)

            # ✅ Аутентификация пользователя
            user = authenticate(username=username, password=password)

            if user is None:
                return APIError.invalid_credentials()

            refresh = RefreshToken.for_user(user)

            # Определяем is_rejected
            is_rejected = (hasattr(user, 'role') and user.role == 'organizer' and  # type: ignore[attr-defined]
                          hasattr(user, 'organizer_status') and user.organizer_status == 'rejected')  # type: ignore[attr-defined]
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id if hasattr(user, 'id') else 0,  # type: ignore[attr-defined]
                    'username': user.username if hasattr(user, 'username') else '',  # type: ignore[attr-defined]
                    'email': user.email if hasattr(user, 'email') else '',  # type: ignore[attr-defined]
                    'name': user.name if hasattr(user, 'name') else '',  # type: ignore[attr-defined]
                    'role': user.role if hasattr(user, 'role') else '',  # type: ignore[attr-defined]
                    'is_organizer': user.is_organizer if hasattr(user, 'is_organizer') else False,  # type: ignore[attr-defined]
                    'is_approved': user.is_approved if hasattr(user, 'is_approved') else False,  # type: ignore[attr-defined]
                    'is_rejected': is_rejected,
                    'rating': user.rating if hasattr(user, 'rating') else 0,  # type: ignore[attr-defined]
                    'registration_source': user.registration_source if hasattr(user, 'registration_source') else ''  # type: ignore[attr-defined]
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            # ✅ ИСПРАВЛЕНИЕ: Правильная обработка ошибок с поддержкой Unicode
            logger.error(f"Login error: {str(e)}")
            return APIError.internal_error(e)


class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        user = request.user
        
        # Определяем is_rejected: организатор с role='organizer' но не одобрен и не pending
        is_rejected = (hasattr(user, 'role') and user.role == 'organizer' and  # type: ignore[attr-defined]
                      hasattr(user, 'organizer_status') and user.organizer_status == 'rejected')  # type: ignore[attr-defined]
        
        return Response({
            'id': user.id if hasattr(user, 'id') else 0,  # type: ignore[attr-defined]
            'username': user.username if hasattr(user, 'username') else '',  # type: ignore[attr-defined]
            'email': user.email if hasattr(user, 'email') else '',  # type: ignore[attr-defined]
            'name': user.name if hasattr(user, 'name') else '',  # type: ignore[attr-defined]
            'role': user.role if hasattr(user, 'role') else '',  # type: ignore[attr-defined]
            'is_organizer': user.is_organizer if hasattr(user, 'is_organizer') else False,  # type: ignore[attr-defined]
            'is_approved': user.is_approved if hasattr(user, 'is_approved') else False,  # type: ignore[attr-defined]
            'is_rejected': is_rejected,
            'rating': user.rating if hasattr(user, 'rating') else 0,  # type: ignore[attr-defined]
            'registration_source': user.registration_source if hasattr(user, 'registration_source') else ''  # type: ignore[attr-defined]
        }, status=status.HTTP_200_OK)
    
    def patch(self, request: Any) -> Response:
        """Обновление профиля пользователя"""
        user = request.user
        
        try:
            # Для DRF API используем request.data
            from rest_framework.request import Request as DRFRequest
            if isinstance(request, DRFRequest):
                data = request.data
            else:
                data = getattr(request, 'POST', {})
            
            # Разрешённые поля для обновления
            name = data.get('name')  # type: ignore[attr-defined]
            email = data.get('email')  # type: ignore[attr-defined]
            
            # Обновляем имя если указано
            if name is not None and name.strip():
                user.name = name.strip()
                logger.info(f"[OK] Updated name for user {user.id}: {user.name}")
            
            # Обновляем email если указан и отличается
            if email is not None and email.strip():
                email = email.strip().lower()
                
                # Проверяем что email не занят другим пользователем
                if User.objects.filter(email=email).exclude(id=user.id).exists():  # type: ignore[attr-defined]
                    return Response({
                        'error': 'Пользователь с таким email уже существует'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                user.email = email
                user.username = email  # Также обновляем username
                logger.info(f"[OK] Updated email for user {user.id}: {user.email}")  # type: ignore[attr-defined]
            
            user.save()
            
            # Определяем is_rejected
            is_rejected = (hasattr(user, 'role') and user.role == 'organizer' and  # type: ignore[attr-defined]
                          hasattr(user, 'organizer_status') and user.organizer_status == 'rejected')  # type: ignore[attr-defined]
            
            return Response({
                'id': user.id if hasattr(user, 'id') else 0,  # type: ignore[attr-defined]
                'username': user.username if hasattr(user, 'username') else '',  # type: ignore[attr-defined]
                'email': user.email if hasattr(user, 'email') else '',  # type: ignore[attr-defined]
                'name': user.name if hasattr(user, 'name') else '',  # type: ignore[attr-defined]
                'role': user.role if hasattr(user, 'role') else '',  # type: ignore[attr-defined]
                'is_organizer': user.is_organizer if hasattr(user, 'is_organizer') else False,  # type: ignore[attr-defined]
                'is_approved': user.is_approved if hasattr(user, 'is_approved') else False,  # type: ignore[attr-defined]
                'is_rejected': is_rejected,
                'rating': user.rating if hasattr(user, 'rating') else 0,  # type: ignore[attr-defined]
                'registration_source': user.registration_source if hasattr(user, 'registration_source') else ''  # type: ignore[attr-defined]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"[ERROR] Error updating profile: {str(e)}")
            return Response({
                'error': f'Ошибка обновления профиля: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from api.projects.services.catalog import get_projects_catalog

        catalog = get_projects_catalog(request.user)
        return Response(catalog, status=status.HTTP_200_OK)

    def post(self, request: HttpRequest, project_id: int) -> Response:
        from api.models import VolunteerProject, Activity
        from api.projects.services.catalog import get_projects_catalog
        try:
            # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
            project = Project.objects.select_related('creator').get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            birqadam_project, created = VolunteerProject.objects.get_or_create(  # type: ignore[attr-defined]
                volunteer=request.user,
                project=project
            )
            if created:
                # Создаём активность
                Activity.objects.create(  # type: ignore[attr-defined]
                    user=request.user,
                    type='project_joined',
                    title='Присоединились к проекту',
                    description=f'Вы присоединились к проекту "{project.title}"',
                    project=project
                )
                message = 'Successfully joined project'
            else:
                message = 'Already joined'

            catalog = get_projects_catalog(request.user)
            catalog['message'] = message
            return Response(catalog, status=status.HTTP_200_OK)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


class JoinProjectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: HttpRequest, project_id: int) -> Response:
        from api.models import VolunteerProject, Activity
        try:
            # Проверка TrustFactor - если TF = 0, блокируем присоединение
            if not request.user.can_join_projects():  # type: ignore[attr-defined]
                return Response({
                    'error': 'Вы не можете присоединяться к проектам. Ваш Trust Factor равен 0.',
                    'trust_factor': request.user.trust_factor  # type: ignore[attr-defined]
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Проверка лимита активных проектов (максимум 2)
            active_projects_count = VolunteerProject.objects.select_related('creator').filter(# type: ignore[attr-defined]
                volunteer=request.user,
                is_active=True
            ).count()
            
            if active_projects_count >= 2:
                return Response({
                    'error': 'Вы уже участвуете в максимальном количестве проектов (2). Покиньте один из проектов, чтобы присоединиться к новому.',
                    'active_projects_count': active_projects_count
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
            project = Project.objects.select_related('creator').get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            # Проверяем, не присоединялся ли уже к этому проекту
            birqadam_project = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
                volunteer=request.user,
                project=project
            ).first()
            
            if birqadam_project:
                if birqadam_project.is_active:
                    return Response({'message': 'Already joined'}, status=status.HTTP_200_OK)
                else:
                    # Реактивируем участие
                    birqadam_project.is_active = True
                    birqadam_project.joined_at = timezone.now()
                    birqadam_project.save()
            else:
                # Создаем новое участие
                birqadam_project = VolunteerProject.objects.create(  # type: ignore[attr-defined]
                    volunteer=request.user,
                    project=project
                )
            
            # Создаём активность
            Activity.objects.create(  # type: ignore[attr-defined]
                user=request.user,
                type='project_joined',
                title='Присоединились к проекту',
                description=f'Вы присоединились к проекту "{project.title}"',
                project=project
            )
            
            return Response({
                'message': 'Successfully joined project',
                'trust_factor': request.user.trust_factor,  # type: ignore[attr-defined]
                'active_projects_count': active_projects_count + 1
            }, status=status.HTTP_201_CREATED)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Сессионная аутентификация БЕЗ CSRF-проверки.
    Используй только для точечных API, где это действительно нужно.
    """
    def enforce_csrf(self, request):
        return  # отключаем CSRF check


class UserTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: HttpRequest, task_id: int | None = None) -> Response:
        from api.models import VolunteerProject

        # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
        # Получаем активные проекты с датами присоединения
        joined_projects_data = VolunteerProject.objects.select_related('project', 'project__creator').filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            is_active=True
        ).values('project_id', 'joined_at')
        
        # Создаем словарь: project_id -> joined_at
        project_join_dates = {vp['project_id']: vp['joined_at'] for vp in joined_projects_data}
        joined_projects = list(project_join_dates.keys())

        # Также собираем ID проектов, из которых волонтёр вышел/были закрыты
        # (нужны для отображения архивных задач)
        archived_projects_data = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            is_active=False
        ).values('project_id', 'joined_at')
        archived_project_join_dates = {vp['project_id']: vp['joined_at'] for vp in archived_projects_data}

        # Если нет ни активных, ни старых проектов — возвращаем пустой список
        if not joined_projects and not archived_project_join_dates:
            return Response([], status=status.HTTP_200_OK)

        # Получаем назначения текущего пользователя (accepted=True) вместе с рейтингом
        accepted_assignments = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            accepted=True
        ).values('task_id', 'rating')
        assigned_task_ids = set(a['task_id'] for a in accepted_assignments)
        # Словарь task_id -> rating (оценка организатора)
        assignment_rating_map: dict = {a['task_id']: a['rating'] for a in accepted_assignments}
# Получаем ID заданий, которые волонтер отклонил (accepted=False)
        
        declined_task_ids = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            accepted=False
        ).values_list('task_id', flat=True)

        # ✅ Автоматически переводим просроченные задачи в архив перед выборкой
        now = timezone.now()
        # 1. Задачи просроченные по самой дате (вчера и раньше)
        Task.objects.select_related('project', 'project__creator').filter(status__in=['open', 'in_progress'],
            deadline_date__lt=now.date(),
            is_deleted=False
        ).update(status='archived')
        
        # 2. Задачи просроченные СЕГОДНЯ (по времени окончания)
        tasks_expiring_today = Task.objects.filter(
            status__in=['open', 'in_progress'],
            deadline_date=now.date(),
            is_deleted=False
        )
        for t in tasks_expiring_today:
            if t.is_expired():
                t.archive_if_expired()

        # 1. Задачи из активных проектов (только открытые ИЛИ назначенные текущему пользователю)
        tasks_qs = Task.objects.filter(  # type: ignore[attr-defined]
            Q(status='open') | Q(id__in=assigned_task_ids),
            project_id__in=joined_projects,
            is_deleted=False  # Исключаем удаленные задачи
        ).exclude(
            id__in=declined_task_ids  # Исключаем отклоненные задачи
        ).select_related('project', 'creator').order_by('-created_at')

        # 2. Задачи из закрытых/удалённых проектов (is_active=False):
        #    Только те, которые были назначены текущему пользователю.
        archived_tasks_qs = Task.objects.select_related('project', 'project__creator').filter(# type: ignore[attr-defined]
            id__in=assigned_task_ids,
            project_id__in=list(archived_project_join_dates.keys()),
            status__in=['archived', 'completed'],
            is_deleted=False
        ).exclude(
            id__in=declined_task_ids  # скрытые (dismissed) задачи тоже отфильтровываем
        ).select_related('project', 'creator').order_by('-created_at')

        # Объединяем join-даты для общего использования
        all_join_dates = {**archived_project_join_dates, **project_join_dates}

        # Формируем результат с обработкой имени создателя
        tasks = []

        # Предварительно загружаем фотоотчеты пользователя для текущих задач
        # Это оптимизация для списка
        user_photos = {
            p.task_id: p 
            for p in Photo.objects.select_related('task', 'volunteer').filter(volunteer=request.user, is_deleted=False).select_related('task').order_by('uploaded_at')
        }
        
        # Предварительно загружаем полные объекты назначений
        user_assignments = {
            a.task_id: a
            for a in TaskAssignment.objects.select_related('task', 'volunteer').filter(volunteer=request.user)
        }

        def _build_task_row(task) -> dict:  # type: ignore[no-untyped-def]
            is_assigned = task.id in assigned_task_ids  # type: ignore[attr-defined]
            joined_at = all_join_dates.get(task.project_id)  # type: ignore[attr-defined]
            is_required = bool(joined_at and task.created_at >= joined_at)  # type: ignore[attr-defined]
            return {
                'id': task.id,  # type: ignore[attr-defined]
                'title': task.text[:100] if task.text else "Без названия", # type: ignore[attr-defined]
                'text': task.text,
                'description': task.text, # type: ignore[attr-defined]
                'project_title': task.project.title,
                'project_id': task.project_id,  # type: ignore[attr-defined]
                'location': task.project.address or task.project.city, # type: ignore[attr-defined]
                'creator_name': task.creator.name if task.creator.name else task.creator.username,
                'creator_avatar': request.build_absolute_uri(task.creator.avatar.url) if task.creator.avatar and task.creator.avatar.url else None, # type: ignore[attr-defined]
                'status': task.status,
                'is_assigned': is_assigned,
                'assignment_status': is_assigned,  # Для совместимости
                'is_required': is_required,
                'rating': assignment_rating_map.get(task.id),  # Оценка организатора (1–5 или null)
                'reward_points': 10, # type: ignore[attr-defined] # Стандартное значение баллов
                'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
                'end_date': task.deadline_date.isoformat() if task.deadline_date else None, # type: ignore[attr-defined]
                'start_date': task.start_date.isoformat() if task.start_date else task.created_at.date().isoformat(), # type: ignore[attr-defined]
                'start_time': task.start_time.strftime('%H:%M') if task.start_time else None,
                'end_time': task.end_time.strftime('%H:%M') if task.end_time else None,
                'created_at': task.created_at.isoformat(),
                # Данные для таймлайна
                'accepted_at': user_assignments.get(task.id).accepted_at.isoformat() if user_assignments.get(task.id) and user_assignments.get(task.id).accepted_at else None,
                'completed_at': user_assignments.get(task.id).completed_at.isoformat() if user_assignments.get(task.id) and user_assignments.get(task.id).completed_at else None,
                'photo_uploaded_at': user_photos.get(task.id).uploaded_at.isoformat() if user_photos.get(task.id) else None,
                'photo_moderated_at': user_photos.get(task.id).moderated_at.isoformat() if user_photos.get(task.id) and user_photos.get(task.id).moderated_at else None,
                'photo_status': user_photos.get(task.id).status if task.id in user_photos else None,
                'rejection_reason': user_photos.get(task.id).rejection_reason if task.id in user_photos else None,
                'has_photo_report': task.id in user_photos
            }

        # Если запрошена конкретная задача
        if task_id:
            try:
                task = Task.objects.select_related('project', 'creator').get(id=task_id, is_deleted=False)
                # Проверяем, что волонтер имеет доступ к этой задаче
                if task.project_id not in all_join_dates:
                    return Response({'error': 'Доступ к этой задаче запрещен'}, status=status.HTTP_403_FORBIDDEN)
                
                return Response(_build_task_row(task), status=status.HTTP_200_OK)
            except Task.DoesNotExist:
                return Response({'error': 'Задача не найдена'}, status=status.HTTP_404_NOT_FOUND)

        for task in tasks_qs:
            tasks.append(_build_task_row(task))

        # Добавляем архивные задачи (избегаем дубликатов, если задача уже есть выше)
        existing_ids = {t['id'] for t in tasks}
        for task in archived_tasks_qs:
            if task.id not in existing_ids:  # type: ignore[attr-defined]
                tasks.append(_build_task_row(task))

        return Response(tasks, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")  # доп. страховка
class OrganizerProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]  # важно

    @staticmethod
    def _build_https_absolute_uri(request: HttpRequest, path: str) -> str:
        """Строит абсолютный URL с принудительным использованием HTTPS"""
        url = request.build_absolute_uri(path)
        # Заменяем http на https, если есть
        if url.startswith('http://'):
            url = url.replace('http://', 'https://')
        return url

    def _parse_tags(self, raw_tags: Any) -> list[str]:
        import json
        if not raw_tags:
            return []
        if isinstance(raw_tags, list):
            return [str(tag).strip() for tag in raw_tags if str(tag).strip()]
        if isinstance(raw_tags, str):
            raw_tags = raw_tags.strip()
            if not raw_tags:
                return []
            try:
                parsed = json.loads(raw_tags)
                if isinstance(parsed, list):
                    return [str(tag).strip() for tag in parsed if str(tag).strip()]
            except json.JSONDecodeError:
                pass
            return [tag.strip() for tag in raw_tags.split(',') if tag.strip()]
        return []

    def _parse_date(self, value: Any):
        from datetime import datetime
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, (list, tuple)):
            value = value[0]
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            # Поддерживаем форматы: YYYY-MM-DD, YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, DD.MM.YYYY
            # Если есть время, извлекаем только дату
            if 'T' in value:
                # ISO формат с временем: YYYY-MM-DDTHH:mm или YYYY-MM-DDTHH:mm:ss
                value = value.split('T')[0]
            for fmt in ('%Y-%m-%d', '%d.%m.%Y'):
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        return None

    def _parse_float(self, value: Any) -> float | None:
        if value in (None, '', 'null'):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def get(self, request: HttpRequest) -> Response:
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        from api.models import VolunteerProject
        projects_qs = (
            Project.objects.select_related('creator').filter(creator=request.user, is_deleted=False, deleted_at__isnull=True)
            .annotate(
                volunteer_count=Count(
                    'volunteer_projects',
                    filter=Q(volunteer_projects__is_active=True),
                    distinct=True
                ),
                task_count=Count('tasks', distinct=True),
            )
            .prefetch_related('tags')
            .order_by('-created_at')
        )

        projects: list[dict[str, Any]] = []
        for project in projects_qs:
            projects.append({
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'city': project.city,
                'status': project.status,
                'volunteer_type': project.volunteer_type,
                'start_date': project.start_date.isoformat() if project.start_date else None,
                'end_date': project.end_date.isoformat() if project.end_date else None,
                'created_at': project.created_at.isoformat() if project.created_at else None,
                'volunteer_count': project.volunteer_count,
                'task_count': project.task_count,
                'address': project.address,
                'latitude': project.latitude,
                'longitude': project.longitude,
                'contact_person': project.contact_person,
                'contact_phone': project.contact_phone,
                'contact_email': project.contact_email,
                'contact_telegram': project.contact_telegram,
                'info_url': project.info_url,
                'gis2_url': project.gis2_url,
                'tags': list(project.tags.names()),
                'cover_image_url': OrganizerProjectsAPIView._build_https_absolute_uri(request, project.cover_image.url) if project.cover_image and project.cover_image.url else None,
            })

        return Response(projects, status=status.HTTP_200_OK)

    def post(self, request) -> Response:
        # request здесь всегда DRF Request, можно сразу использовать request.data / request.FILES
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        
        # Логирование для отладки
        logger.info(f"[OrganizerProjectsAPIView] POST request data keys: {list(data.keys())}")
        logger.info(f"[OrganizerProjectsAPIView] gis2_url value: {data.get('gis2_url')}")
        logger.info(f"[OrganizerProjectsAPIView] end_date value: {data.get('end_date')}")

        from datetime import datetime, timedelta

        title = data.get('title')
        description = data.get('description')
        city = data.get('city')
        volunteer_type = data.get('volunteer_type', 'any')

        if not all([title, description, city]):
            logger.warning(f"[OrganizerProjectsAPIView] Missing required fields: title={bool(title)}, description={bool(description)}, city={bool(city)}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        # Дата начала автоматически устанавливается на сегодня, если не указана
        start_date = self._parse_date(data.get('start_date')) or datetime.now().date()
        
        # Дата окончания обязательна
        end_date = self._parse_date(data.get('end_date'))
        if not end_date:
            logger.warning(f"[OrganizerProjectsAPIView] End date validation failed. Received: {data.get('end_date')}")
            return Response({'error': 'Дата завершения проекта обязательна'}, status=status.HTTP_400_BAD_REQUEST)

        # Ссылка на 2ГИС обязательна
        gis2_url = data.get('gis2_url', '').strip()
        if not gis2_url:
            logger.warning(f"[OrganizerProjectsAPIView] gis2_url is empty or missing. Received: {repr(data.get('gis2_url'))}")
            return Response({'error': 'Ссылка на 2ГИС обязательна'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Валидация формата ссылки 2ГИС
        import re
        gis2_pattern = re.compile(r'^https?://(go\.)?2gis\.(com|kz|ru)(/.+)?$', re.IGNORECASE)
        if not gis2_pattern.match(gis2_url):
            logger.warning(f"[OrganizerProjectsAPIView] gis2_url format validation failed. Received: {gis2_url}")
            return Response({'error': 'Введите корректную ссылку на 2ГИС (например: https://go.2gis.com/vOZEO или https://2gis.kz/...)'}, status=status.HTTP_400_BAD_REQUEST)

        latitude = self._parse_float(data.get('latitude'))
        longitude = self._parse_float(data.get('longitude'))

        tags = self._parse_tags(data.get('tags'))

        project = Project.objects.create(
            title=title,
            description=description,
            city=city,
            start_date=start_date,
            end_date=end_date,
            volunteer_type=volunteer_type,
            creator=request.user,
            status='pending',
            latitude=latitude,
            longitude=longitude,
            address=data.get('address', ''),
            contact_person=data.get('contact_person', ''),
            contact_phone=data.get('contact_phone', ''),
            contact_email=data.get('contact_email'),
            contact_telegram=data.get('contact_telegram', ''),
            info_url=data.get('info_url'),
            gis2_url=gis2_url,
        )

        cover_image = request.FILES.get('cover_image')
        if cover_image:
            project.cover_image = cover_image
            project.save(update_fields=['cover_image'])

        if tags:
            project.tags.set(tags)

        return Response({
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'city': project.city,
            'status': project.status,
            'volunteer_count': 0,
            'task_count': 0,
            'created_at': project.created_at.isoformat(),
            'volunteer_type': project.volunteer_type,
            'address': project.address,
            'latitude': project.latitude,
            'longitude': project.longitude,
            'contact_person': project.contact_person,
            'contact_phone': project.contact_phone,
            'contact_email': project.contact_email,
            'contact_telegram': project.contact_telegram,
            'info_url': project.info_url,
            'gis2_url': project.gis2_url,
            'tags': tags,
            'cover_image_url': request.build_absolute_uri(project.cover_image.url) if project.cover_image and project.cover_image.url else None,
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, project_id: int) -> Response:
        """Редактирование проекта"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем наличие участников в проекте
        from api.models import VolunteerProject
        participants_count = VolunteerProject.objects.filter(
            project=project,
            is_active=True
        ).count()
        
        if participants_count > 0:
            return Response({
                'error': 'Редактирование проекта запрещено, так как в проекте уже есть участники. Удалите всех участников перед редактированием.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Разрешаем редактирование только если нет участников
        data = request.data
        from datetime import datetime

        # Обновляем поля
        if 'title' in data:
            project.title = data.get('title')
        if 'description' in data:
            project.description = data.get('description')
        if 'city' in data:
            project.city = data.get('city')
        if 'volunteer_type' in data:
            project.volunteer_type = data.get('volunteer_type', 'any')
        if 'start_date' in data:
            parsed_start_date = self._parse_date(data.get('start_date'))
            # Обновляем только если дата не None (None означает удаление даты)
            if parsed_start_date is not None:
                project.start_date = parsed_start_date
        if 'end_date' in data:
            parsed_end_date = self._parse_date(data.get('end_date'))
            # Обновляем только если дата не None (None означает удаление даты)
            if parsed_end_date is not None:
                project.end_date = parsed_end_date
        if 'latitude' in data:
            project.latitude = self._parse_float(data.get('latitude'))
        if 'longitude' in data:
            project.longitude = self._parse_float(data.get('longitude'))
        if 'address' in data:
            project.address = data.get('address', '')
        if 'contact_person' in data:
            project.contact_person = data.get('contact_person', '')
        if 'contact_phone' in data:
            project.contact_phone = data.get('contact_phone', '')
        if 'contact_email' in data:
            project.contact_email = data.get('contact_email')
        if 'contact_telegram' in data:
            project.contact_telegram = data.get('contact_telegram', '')
        if 'info_url' in data:
            project.info_url = data.get('info_url')
        if 'gis2_url' in data:
            gis2_url_value = data.get('gis2_url', '').strip()
            if not gis2_url_value:
                return Response({'error': 'Ссылка на 2ГИС обязательна'}, status=status.HTTP_400_BAD_REQUEST)
            # Валидация формата ссылки 2ГИС
            import re
            gis2_pattern = re.compile(r'^https?://(go\.)?2gis\.(com|kz|ru)(/.+)?$', re.IGNORECASE)
            if not gis2_pattern.match(gis2_url_value):
                return Response({'error': 'Введите корректную ссылку на 2ГИС (например: https://go.2gis.com/vOZEO или https://2gis.kz/...)'}, status=status.HTTP_400_BAD_REQUEST)
            project.gis2_url = gis2_url_value

        # Обновляем обложку
        cover_image = request.FILES.get('cover_image')
        if cover_image:
            project.cover_image = cover_image

        # Обновляем теги
        if 'tags' in data:
            tags = self._parse_tags(data.get('tags'))
            project.tags.set(tags)

        # При редактировании проекта отправляем его на модерацию заново
        # Сохраняем старый статус для логирования
        old_status = project.status
        
        # Логируем для отладки
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'Project {project.id} editing: current status is {old_status}')
        
        # ВАЖНО: Обновляем статус через прямой SQL запрос ПЕРЕД сохранением через ORM
        # Это гарантирует, что статус будет сохранен, даже если что-то пойдет не так с ORM
        from django.db import connection, transaction
        with transaction.atomic():
            # Обновляем статус напрямую в БД
            with connection.cursor() as cursor:
                cursor.execute("UPDATE core_project SET status = 'pending' WHERE id = %s", [project.id])
                logger.info(f'Project {project.id} status updated to pending via SQL')
            
            # Сохраняем все остальные изменения через ORM
            # Статус уже обновлен через SQL, поэтому он не будет перезаписан
            project.save()
            logger.info(f'Project {project.id} other fields saved via ORM')
        
        # Перезагружаем проект для получения актуальных данных из БД
        project.refresh_from_db()
        
        # Проверяем статус после перезагрузки
        logger.info(f'Project {project.id} status after refresh_from_db: {project.status}')
        
        # Финальная проверка - если статус все еще не 'pending', это критическая ошибка
        if project.status != 'pending':
            logger.error(f'CRITICAL: Project {project.id} status is {project.status}, expected pending after SQL update!')
            # Еще раз пытаемся обновить через SQL
            with connection.cursor() as cursor:
                cursor.execute("UPDATE core_project SET status = 'pending' WHERE id = %s", [project.id])
            project.refresh_from_db()
            logger.info(f'Project {project.id} status after second SQL update: {project.status}')
        
        logger.info(f'Project {project.id} final status before response: {project.status}')

        return Response({
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'city': project.city,
            'status': project.status,
            'volunteer_count': project.volunteer_projects.filter(is_active=True).count(),
            'task_count': project.tasks.filter(is_deleted=False).count(),
            'start_date': project.start_date.isoformat() if project.start_date else None,
            'end_date': project.end_date.isoformat() if project.end_date else None,
            'created_at': project.created_at.isoformat() if project.created_at else None,
            'volunteer_type': project.volunteer_type,
            'address': project.address,
            'latitude': project.latitude,
            'longitude': project.longitude,
            'contact_person': project.contact_person,
            'contact_phone': project.contact_phone,
            'contact_email': project.contact_email,
            'contact_telegram': project.contact_telegram,
            'info_url': project.info_url,
            'gis2_url': project.gis2_url,
            'tags': list(project.tags.names()),
            'cover_image_url': request.build_absolute_uri(project.cover_image.url) if project.cover_image and project.cover_image.url else None,
        }, status=status.HTTP_200_OK)

    def delete(self, request, project_id: int) -> Response:
        """Удаление проекта"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Разрешаем удаление для всех проектов организатора
        # Мягкое удаление проекта
        project.delete()

        return Response({'message': 'Проект успешно удалён'}, status=status.HTTP_200_OK)


class ProjectParticipantsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest, project_id: int) -> Response:
        from api.models import VolunteerProject
        try:
            project = Project.objects.get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]

            # Получаем участников с правильной структурой для Flutter
            volunteer_projects = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
                project=project
            ).select_related('volunteer').annotate(  # type: ignore[attr-defined]
                completed_tasks_count=Count(  # type: ignore[attr-defined]
                    'volunteer__assignments',
                    filter=Q(volunteer__assignments__completed=True, volunteer__assignments__task__project=project)  # type: ignore[attr-defined]
                ),
                total_tasks_count=Count(  # type: ignore[attr-defined]
                    'volunteer__assignments',
                    filter=Q(volunteer__assignments__task__project=project)  # type: ignore[attr-defined]
                )
            )

            participants = []
            for vp in volunteer_projects:
                participants.append({
                    'id': vp.volunteer.id,
                    'name': vp.volunteer.name or vp.volunteer.username,
                    'email': vp.volunteer.email,
                    'rating': vp.volunteer.rating or 0,
                    'joined_at': vp.joined_at.isoformat(),
                    'completed_tasks': vp.completed_tasks_count,  # type: ignore[attr-defined]
                    'total_tasks': vp.total_tasks_count  # type: ignore[attr-defined]
                })

            return Response({'participants': participants}, status=status.HTTP_200_OK)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


class ProjectManagementAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Any, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)  # type: ignore[attr-defined]
            # Для DRF API используем request.data
            from rest_framework.request import Request as DRFRequest
            if isinstance(request, DRFRequest):
                data = request.data
            else:
                data = getattr(request, 'POST', {})
            title = data.get('title')  # type: ignore[attr-defined]
            description = data.get('description')  # type: ignore[attr-defined]

            if title:
                project.title = title
            if description:
                project.description = description
            project.save()

            return Response({'message': 'Project updated'}, status=status.HTTP_200_OK)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


class ProjectTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: HttpRequest, project_id: int) -> Response:
        """Получить список задач проекта (для организатора или участника проекта)"""
        try:
            # Проверяем, что проект существует и не удален
            project = Project.objects.get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            # Проверяем доступ: пользователь должен быть либо создателем проекта, либо участником
            from api.models import VolunteerProject
            
            is_creator = project.creator == request.user
            is_participant = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
                project=project,
                volunteer=request.user,
                is_active=True
            ).exists()
            
            if not (is_creator or is_participant):
                return Response(
                    {'error': 'У вас нет доступа к задачам этого проекта'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Получаем все задачи проекта (не удаленные)
            tasks_qs = Task.objects.select_related('project', 'project__creator').filter(# type: ignore[attr-defined]
                project_id=project_id,
                is_deleted=False
            ).annotate(
                assignment_count=Count('assignments', filter=Q(assignments__accepted=True))
            ).prefetch_related(
                Prefetch(
                    'task_photos',
                    queryset=Photo.objects.select_related('task', 'volunteer').filter(is_deleted=False).select_related('volunteer'),
                    to_attr='prefetched_photos'
                )).order_by('-created_at')

            normalized_tasks = []
            for task in tasks_qs:
                # Задача может быть отредактирована только создателем, если никто еще не "зашел" (не принял задачу)
                can_edit = is_creator and task.assignment_count == 0 and task.status == 'open'
                
                # Photos
                photos_data = []
                for p in getattr(task, 'prefetched_photos', []):
                    photos_data.append({
                        'id': p.id,
                        'url': p.image.url if p.image else None,
                        'volunteer_name': p.volunteer.name or p.volunteer.username if p.volunteer else 'Unknown',
                        'comment': p.volunteer_comment,
                        'status': p.status,
                        'uploaded_at': p.uploaded_at.isoformat() if p.uploaded_at else None,
                    })

                normalized_tasks.append(
                    {
                        'id': task.id,
                        'text': task.text,
                        'status': task.status,
                        'created_at': task.created_at.isoformat() if task.created_at else None,
                        'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
                        'start_time': task.start_time.strftime('%H:%M') if task.start_time else None,
                        'end_time': task.end_time.strftime('%H:%M') if task.end_time else None,
                        'can_edit': can_edit,
                        'photos': photos_data,
                    }
                )

            return Response(normalized_tasks, status=status.HTTP_200_OK)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error getting project tasks: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request: HttpRequest, project_id: int) -> Response:
        """Удаление задачи из проекта (только для создателя проекта)"""
        try:
            # Проверяем, что проект существует и пользователь - его создатель
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            # Получаем task_id из query параметров или request.data
            task_id = request.query_params.get('task_id') or request.data.get('task_id')  # type: ignore[attr-defined]
            
            if not task_id:
                return Response(
                    {'error': 'task_id обязателен для удаления задачи'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                task_id_int = int(task_id)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Неверный формат task_id'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Проверяем, что задача существует и принадлежит проекту
            task = Task.objects.get(  # type: ignore[attr-defined]
                id=task_id_int,
                project=project,
                is_deleted=False
            )
            
            # Мягкое удаление задачи
            task.is_deleted = True
            task.deleted_at = timezone.now()
            task.save()
            
            logger.info(f"Task {task_id_int} deleted by organizer {request.user.username if hasattr(request.user, 'username') else 'unknown'}")  # type: ignore[attr-defined]
            
            return Response(
                {'message': 'Задача успешно удалена'},
                status=status.HTTP_200_OK
            )
            
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Проект не найден или вы не являетесь его создателем'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена или не принадлежит этому проекту'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error deleting task: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request: Any, project_id: int) -> Response:
        """Создание новой задачи для проекта"""
        try:
            # Проверяем, что проект существует и пользователь - его создатель
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            # Для DRF API используем request.data
            from rest_framework.request import Request as DRFRequest
            if isinstance(request, DRFRequest):
                data = request.data
            else:
                data = getattr(request, 'POST', {})

            text = data.get('text')  # type: ignore[attr-defined]
            deadline_date = data.get('deadline_date')  # type: ignore[attr-defined]
            start_time = data.get('start_time')  # type: ignore[attr-defined]
            end_time = data.get('end_time')  # type: ignore[attr-defined]

            from datetime import date as _date, time as _time
            from django.utils.dateparse import parse_date, parse_datetime, parse_time

            def _normalize_date(value: Any) -> _date | None:
                if value in (None, '', False):
                    return None
                if isinstance(value, _date):
                    return value
                if isinstance(value, str):
                    candidate = parse_date(value)
                    if candidate:
                        return candidate
                    candidate_dt = parse_datetime(value)
                    if candidate_dt:
                        return candidate_dt.date()
                raise ValueError("Неверный формат даты. Используйте формат YYYY-MM-DD.")

            def _normalize_time(value: Any) -> _time | None:
                if value in (None, '', False):
                    return None
                if isinstance(value, _time):
                    return value.replace(microsecond=0, tzinfo=None)
                if isinstance(value, str):
                    candidate = parse_time(value)
                    if candidate:
                        return candidate.replace(microsecond=0)
                    candidate_dt = parse_datetime(value)
                    if candidate_dt:
                        time_value = candidate_dt.timetz() if candidate_dt.tzinfo else candidate_dt.time()
                        return time_value.replace(microsecond=0, tzinfo=None)
                raise ValueError("Неверный формат времени. Используйте формат HH:MM.")

            try:
                normalized_deadline_date = _normalize_date(deadline_date)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            try:
                normalized_start_time = _normalize_time(start_time)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            try:
                normalized_end_time = _normalize_time(end_time)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            if not text:
                return Response({'error': 'Task text is required'}, status=status.HTTP_400_BAD_REQUEST)

            # Создаём задачу
            task = Task.objects.create(  # type: ignore[attr-defined]
                project=project,
                creator=request.user,
                text=text,
                deadline_date=normalized_deadline_date,
                start_time=normalized_start_time,
                end_time=normalized_end_time,
                status='open'
            )

            # 🔔 СОЗДАЕМ Activity ЗАПИСИ ДЛЯ ВСЕХ ВОЛОНТЕРОВ ПРОЕКТА
            from api.models import VolunteerProject, Activity
            
            try:
                # Получаем всех активных волонтеров проекта
                volunteer_projects = VolunteerProject.objects.select_related('creator').filter(# type: ignore[attr-defined]
                    project=project,
                    is_active=True
                ).select_related('volunteer')
                
                # Создаем Activity записи для каждого волонтера
                activities = []
                for vp in volunteer_projects:
                    if vp.volunteer and vp.volunteer.is_active:
                        # Используем тип 'task_assigned' если он есть, иначе 'project_joined'
                        # Но нужно добавить этот тип в Activity
                        # Формируем описание задания с деталями
                        task_description = f'В проекте "{project.title}" создано новое задание: "{task.text}"'
                        if task.deadline_date:
                            task_description += f'\nСрок выполнения: {task.deadline_date.strftime("%d.%m.%Y")}'
                            if task.start_time and task.end_time:
                                task_description += f' ({task.start_time.strftime("%H:%M")} - {task.end_time.strftime("%H:%M")})'
                        
                        activity = Activity(  # type: ignore[attr-defined]
                            user=vp.volunteer,
                            type='task_assigned',  # Используем новый тип для заданий
                            title='🎯 Новое задание в проекте',
                            description=task_description,
                            project=project
                        )
                        activities.append(activity)
                
                if activities:
                    Activity.objects.bulk_create(activities)  # type: ignore[attr-defined]
                    logger.info(f"[OK] Created {len(activities)} Activity records for task {task.id}")  # type: ignore[attr-defined]
            except Exception as e:
                logger.error(f"[WARNING] Failed to create Activity records for task {task.id}: {e}", exc_info=True)  # type: ignore[attr-defined]
            
            # 📧 ОТПРАВЛЯЕМ EMAIL И PUSH УВЕДОМЛЕНИЯ В ФОНОВОМ РЕЖИМЕ
            # Чтобы не блокировать ответ API, запускаем уведомления асинхронно
            from threading import Thread
            from shared.notifications.email.service import notify_volunteer_new_task
            from shared.notifications.utils import notify_all_project_volunteers
            import asyncio
            
            def send_notifications_background():
                """Отправка уведомлений в фоновом потоке"""
                try:
                    # Email уведомления
                    email_sent_count = 0
                    for vp in volunteer_projects:
                        if vp.volunteer and vp.volunteer.email:
                            try:
                                if notify_volunteer_new_task(vp.volunteer, task, project):
                                    email_sent_count += 1
                            except Exception as e:
                                logger.warning(f"Failed to send email to {vp.volunteer.email}: {e}")
                    
                    if email_sent_count > 0:
                        logger.info(f"Sent email notifications to {email_sent_count} volunteers about new task {task.id}")
                    
                    # Telegram + FCM уведомления
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        stats = loop.run_until_complete(notify_all_project_volunteers(project, task))
                        loop.close()
                        logger.info(f"[OK] Task {task.id} notifications sent: {stats}")
                    except Exception as e:
                        logger.error(f"[WARNING] Failed to send push notifications for task {task.id}: {e}", exc_info=True)
                except Exception as e:
                    logger.error(f"[ERROR] Notifications background thread failed for task {task.id}: {e}", exc_info=True)
            
            # Запускаем отправку уведомлений в фоновом потоке
            notification_thread = Thread(target=send_notifications_background, daemon=True)
            notification_thread.start()
            logger.info(f"[OK] Task {task.id} created, notifications scheduled in background")  # type: ignore[attr-defined]

            return Response({
                'id': task.id,  # type: ignore[attr-defined]
                'text': task.text,
                'status': task.status,
                'created_at': task.created_at.isoformat(),
                'deadline_date': str(task.deadline_date) if task.deadline_date else None,
                'start_time': str(task.start_time) if task.start_time else None,
                'end_time': str(task.end_time) if task.end_time else None,
                'message': 'Task created and notifications sent to all volunteers'
            }, status=status.HTTP_201_CREATED)

        except Project.DoesNotExist:
            return Response({'error': 'Project not found or you are not the creator'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request: Any, project_id: int) -> Response:
        """Редактирование существующей задачи (только если нет активных волонтеров)"""
        try:
            # Проверяем, что проект существует и пользователь - его создатель
            project = Project.objects.get(id=project_id, creator=request.user, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            data = request.data
            task_id = data.get('task_id')
            
            if not task_id:
                return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Ищем задачу и аннотируем её количеством принятых назначений
            task = Task.objects.select_related('project', 'project__creator').filter(id=task_id, 
                project=project, 
                is_deleted=False
            ).annotate(
                assignment_count=Count('assignments', filter=Q(assignments__accepted=True))
            ).first()
            
            if not task:
                return Response({'error': 'Задача не найдена'}, status=status.HTTP_404_NOT_FOUND)
            
            # Проверяем возможность редактирования
            if task.assignment_count > 0 or task.status != 'open':
                return Response(
                    {'error': 'Редактирование запрещено: задача уже принята волонтером или не в статусе "Открыта"'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Обновляем поля
            text = data.get('text')
            deadline_date = data.get('deadline_date')
            start_time = data.get('start_time')
            end_time = data.get('end_time')
            
            from django.utils.dateparse import parse_date, parse_time, parse_datetime
            from datetime import date as _date, time as _time

            def _normalize_date(value: Any) -> _date | None:
                if value in (None, '', False): return None
                if isinstance(value, _date): return value
                if isinstance(value, str):
                    candidate = parse_date(value)
                    if candidate: return candidate
                    dt = parse_datetime(value)
                    if dt: return dt.date()
                return None

            def _normalize_time(value: Any) -> _time | None:
                if value in (None, '', False): return None
                if isinstance(value, _time): return value
                if isinstance(value, str):
                    candidate = parse_time(value)
                    if candidate: return candidate
                    dt = parse_datetime(value)
                    if dt: return dt.time()
                return None

            if text:
                task.text = text
            
            if 'deadline_date' in data:
                task.deadline_date = _normalize_date(deadline_date)
            
            if 'start_time' in data:
                task.start_time = _normalize_time(start_time)
                
            if 'end_time' in data:
                task.end_time = _normalize_time(end_time)
                
            task.save()
            
            logger.info(f"Task {task.id} updated by organizer {request.user}")
            
            return Response({
                'id': task.id,
                'text': task.text,
                'status': task.status,
                'created_at': task.created_at.isoformat(),
                'deadline_date': str(task.deadline_date) if task.deadline_date else None,
                'start_time': task.start_time.strftime('%H:%M') if task.start_time else None,
                'end_time': task.end_time.strftime('%H:%M') if task.end_time else None,
            }, status=status.HTTP_200_OK)
            
        except Project.DoesNotExist:
            return Response({'error': 'Project not found or you are not the creator'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating task: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LeaveProjectAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: HttpRequest, project_id: int) -> Response:
        from api.models import VolunteerProject, Activity
        from django.utils import timezone
        
        # Получаем причину выхода из запроса
        leave_reason = request.data.get('reason', '') if hasattr(request, 'data') else request.POST.get('reason', '')
        
        if not leave_reason or not leave_reason.strip():
            return Response({
                'error': 'Необходимо указать причину выхода из проекта'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            birqadam_project = VolunteerProject.objects.select_related('project').get(  # type: ignore[attr-defined]
                volunteer=request.user,
                project_id=project_id
            )
            project = birqadam_project.project
            
            # Проверяем, не отменен ли проект организатором
            # Если проект отменен, штраф не начисляется
            should_penalize = project.status != 'cancelled'
            
            # Деактивируем участие вместо удаления (для истории)
            birqadam_project.is_active = False
            birqadam_project.save(update_fields=['is_active'])
            
            # Обрабатываем задачи волонтера при выходе из проекта
            from api.tasks.models import TaskAssignment, Task
            from django.db.models import Q
            
            # Находим все невыполненные назначения волонтера в этом проекте
            incomplete_assignments = TaskAssignment.objects.filter(
                volunteer=request.user,
                task__project=project,
                task__is_deleted=False,
                completed=False  # Только невыполненные задачи
            ).select_related('task')
            
            logger.info(f"[DEBUG] leave_project: Found {incomplete_assignments.count()} incomplete assignments for user {request.user.username} in project {project.id}")
            
            # Отменяем все невыполненные назначения
            for assignment in incomplete_assignments:
                task = assignment.task
                was_accepted = assignment.accepted
                
                # Отменяем назначение (не помечаем как completed!)
                assignment.accepted = False
                assignment.completed = False
                assignment.completed_at = None
                assignment.save(update_fields=['accepted', 'completed', 'completed_at'])
                
                logger.info(f"[DEBUG] leave_project: Cancelled assignment for task {task.id} (was_accepted={was_accepted})")
                
                # Если задача была принята этим волонтером и больше нет принятых назначений,
                # возвращаем задачу в статус 'open' (но НЕ помечаем как failed или completed!)
                if was_accepted:
                    has_other_accepted = TaskAssignment.objects.filter(
                        task=task,
                        accepted=True,
                        completed=False
                    ).exclude(volunteer=request.user).exists()
                    
                    # Возвращаем задачу в статус 'open', если больше нет активных назначений
                    # и задача была в работе (но НЕ помечаем как completed или failed!)
                    if not has_other_accepted and task.status == 'in_progress':
                        task.status = 'open'
                        task.save(update_fields=['status'])
                        logger.info(f"[DEBUG] leave_project: Task {task.id} returned to 'open' status (was in_progress)")
            
            # Начисляем штраф -5 TF, если проект не отменен
            if should_penalize:
                from django.db import transaction
                
                with transaction.atomic():
                    # Получаем пользователя с блокировкой
                    user = User.objects.select_for_update().get(pk=request.user.pk)
                    # Изменяем TF (метод сам сохранит историю)
                    user._change_trust_factor(-5, 'project_leave', 'project', project_id)
                
                # Обновляем request.user для ответа
                request.user.refresh_from_db()
                updated_trust_factor = request.user.trust_factor  # type: ignore[attr-defined]
            else:
                updated_trust_factor = request.user.trust_factor  # type: ignore[attr-defined]
            
            # Создаём активность
            Activity.objects.create(  # type: ignore[attr-defined]
                user=request.user,
                type='project_left',
                title='Покинули проект',
                description=f'Вы покинули проект "{project.title}". Причина: {leave_reason}',
                project=project
            )

            return Response({
                'message': 'Successfully left project',
                'trust_factor': updated_trust_factor,
                'penalty_applied': should_penalize
            }, status=status.HTTP_200_OK)
        except VolunteerProject.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Not a member of this project'}, status=status.HTTP_404_NOT_FOUND)


class TrustFactorHistoryAPIView(APIView):
    """API для получения истории изменений TrustFactor"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: HttpRequest) -> Response:
        from api.models import TrustFactorHistory
        import logging
        import traceback
        
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"TrustFactorHistoryAPIView: Request from user {request.user.username}")
            
            # Обновляем пользователя из БД для получения актуальных значений
            request.user.refresh_from_db()
            
            # Получаем историю изменений для текущего пользователя
            history = TrustFactorHistory.objects.filter(  # type: ignore[attr-defined]
                user=request.user).order_by('-created_at')[:50]  # Последние 50 записей
            
            history_list = list(history)
            logger.info(f"TrustFactorHistoryAPIView: Found {len(history_list)} history records for user {request.user.username}")
            
            history_data = []
            for record in history_list:
                try:
                    reason_display = record.get_reason_display()
                except Exception as e:
                    logger.warning(f"Error getting reason_display for record {record.id}: {e}")
                    reason_display = record.reason  # Fallback to raw reason
                
                history_data.append({
                    'id': record.id,  # type: ignore[attr-defined]
                    'change_amount': record.change_amount,
                    'reason': record.reason,
                    'reason_display': reason_display,
                    'old_value': record.old_value,
                    'new_value': record.new_value,
                    'created_at': record.created_at.isoformat(),
                    'related_object_type': record.related_object_type,
                    'related_object_id': record.related_object_id,
                })
            
            return Response({
                'history': history_data,
                'current_trust_factor': request.user.trust_factor,  # type: ignore[attr-defined]
                'current_average_rating': request.user.average_rating,  # type: ignore[attr-defined]
            }, status=status.HTTP_200_OK)
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error in TrustFactorHistoryAPIView: {e}\n{error_details}")
            return Response(
                {'error': f'Ошибка при получении истории TrustFactor: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


from api.models import DeviceToken

class DeviceTokenAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Any) -> Response:
        # Для DRF API используем request.data
        from rest_framework.request import Request as DRFRequest
        if isinstance(request, DRFRequest):
            data = request.data
        else:
            data = getattr(request, 'POST', {})
        token = data.get('token')  # type: ignore[attr-defined]
        platform = data.get('platform', 'android')  # type: ignore[attr-defined]
        device_name = data.get('device_name', '')  # type: ignore[attr-defined]

        print('=' * 80)
        print('📱 DeviceTokenAPIView POST')
        print(f'   User: {request.user.username if hasattr(request.user, "username") else "Unknown"} (ID: {request.user.id if hasattr(request.user, "id") else 0})')  # type: ignore[attr-defined]
        print(f'   Token: {token[:50]}...' if token else '   Token: None')
        print(f'   Platform: {platform}')
        print('=' * 80)

        if token:
            # Используем только token как уникальный идентификатор
            # Это позволяет одному токену принадлежать только одному пользователю
            device_token, created = DeviceToken.objects.update_or_create(  # type: ignore[attr-defined]
                token=token,  # Уникальный идентификатор
                defaults={
                    'user': request.user,  # Обновляем пользователя если токен уже существует
                    'platform': platform,
                    'device_name': device_name,
                    'is_active': True
                }
            )

            action = 'created' if created else 'updated'
            print(f'✅ Device token {action} for user {request.user.username if hasattr(request.user, "username") else "Unknown"}')  # type: ignore[attr-defined]

            return Response({
                'status': 'success',
                'message': 'Device token saved',
                'action': action
            }, status=status.HTTP_200_OK)

        print('❌ No token provided in request')
        return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Any) -> Response:
        # Для DRF API используем request.data
        from rest_framework.request import Request as DRFRequest
        if isinstance(request, DRFRequest):
            data = request.data
        else:
            data = getattr(request, 'POST', {})
        token = data.get('token')  # type: ignore[attr-defined]
        if token:
            DeviceToken.objects.filter(user=request.user, token=token).update(is_active=False)  # type: ignore[attr-defined]
            return Response({'message': 'Token deactivated'}, status=status.HTTP_200_OK)
        return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)


# Organizer approval functions
@login_required
def organizers(request: HttpRequest, user_id: int | None = None) -> HttpResponse:
    if user_id:
        organizer = get_object_or_404(User, id=user_id)
        projects = Project.objects.select_related('creator').filter(creator=organizer, deleted_at__isnull=True).annotate(  # type: ignore[attr-defined]
            volunteer_count=Count('volunteer_projects', distinct=True),  # type: ignore[attr-defined]
            task_count=Count('tasks', distinct=True)  # type: ignore[attr-defined]
        )
        
        # Данные для графиков
        project_status_data = list(Project.objects.select_related('creator').filter(creator=organizer, deleted_at__isnull=True).values('status').annotate(count=Count('id')))
        task_status_data = list(Task.objects.select_related('project', 'project__creator').filter(project__creator=organizer, project__deleted_at__isnull=True).values('status').annotate(count=Count('id')))
        
        context = {
            'organizer': organizer,
            'projects': projects,
            'stats': {
                'project_count': projects.count(),
                'task_count': sum(p.task_count for p in projects),
                'approved_projects': projects.filter(status='approved').count(),
                'pending_projects': projects.filter(status='pending').count(),
            },
            'project_status_data': json.dumps(project_status_data, cls=DjangoJSONEncoder),
            'task_status_data': json.dumps(task_status_data, cls=DjangoJSONEncoder),
            'show_analytics': True
        }
        return render(request, 'admin_panel/organizer_analytics.html', context)
    else:
        # Show all organizers with approval status
        from api.users.models import OrganizerApplication

        _oa = OrganizerApplication.objects.filter(user_id=OuterRef('pk'))
        organizers_list = User.objects.filter(  # type: ignore[attr-defined]
            Q(role='organizer') | Q(is_organizer=True)
        ).annotate(
            organizer_app_notes=Subquery(_oa.values('notes')[:1], output_field=TextField()),
            organizer_app_description=Subquery(_oa.values('description')[:1], output_field=TextField()),
            organizer_app_city=Subquery(_oa.values('city')[:1], output_field=CharField(max_length=100)),
            organizer_app_website=Subquery(_oa.values('website')[:1], output_field=CharField(max_length=200)),
            organizer_app_contact_person=Subquery(_oa.values('contact_person')[:1], output_field=CharField(max_length=120)),
        ).annotate(  # type: ignore[attr-defined]
            project_count=Count('created_projects', filter=Q(created_projects__is_deleted=False), distinct=True),  # type: ignore[attr-defined]
            approved_project_count=Count('created_projects', filter=Q(created_projects__status='approved', created_projects__is_deleted=False), distinct=True),  # type: ignore[attr-defined]
            task_count=Count('created_projects__tasks', filter=Q(created_projects__is_deleted=False, created_projects__tasks__is_deleted=False), distinct=True)).order_by('-is_approved', '-date_joined')  # type: ignore[attr-defined]

        pending_organizers = organizers_list.filter(organizer_status='pending')
        approved_organizers = organizers_list.filter(organizer_status='approved')
        rejected_organizers = organizers_list.filter(organizer_status='rejected')

        context = {
            'organizers': organizers_list,
            'pending_organizers': pending_organizers,
            'approved_organizers': approved_organizers,
            'rejected_organizers': rejected_organizers,
            'show_analytics': False,
            'pending_count': pending_organizers.count(),
            'approved_count': approved_organizers.count(),
            'rejected_count': rejected_organizers.count()
        }

    return render(request, 'admin_panel/organizers.html', context)


@login_required
@require_POST
@csrf_protect  # ✅ ИСПРАВЛЕНИЕ КП-7: Явная CSRF защита
def approve_organizer(request: HttpRequest, user_id: int) -> HttpResponse:
    import traceback
    from api.utils.audit_logger import log_audit_action, AuditActions
    
    try:
        organizer = get_object_or_404(User, id=user_id)
        logger.info(f"[DEBUG] approve_organizer: Found organizer {organizer.username} (ID: {user_id})")
        
        organizer.is_approved = True
        organizer.is_organizer = True
        organizer.organizer_status = 'approved'
        # Обновляем только нужные поля, чтобы избежать ошибок с длинными значениями
        organizer.save(update_fields=['is_approved', 'is_organizer', 'organizer_status'])
        logger.info(f"[DEBUG] approve_organizer: Saved organizer {organizer.username}")

        try:
            from api.users.models import OrganizerApplication
            OrganizerApplication.objects.filter(user=organizer).update(status='approved')
        except Exception as app_exc:
            logger.warning("approve_organizer: не удалось обновить статус заявки OrganizerApplication: %s", app_exc)
        
        # Audit log
        try:
            log_audit_action(AuditActions.ORGANIZER_APPROVED, user=request.user, organizer_id=user_id)
            logger.info(f"[DEBUG] approve_organizer: Audit log created")
        except Exception as e:
            logger.error(f"[ERROR] approve_organizer: Failed to create audit log: {e}")
            logger.error(traceback.format_exc())
        
        # 📨 Отправляем уведомления (Telegram + FCM)
        try:
            # 1. Telegram уведомление
            from telegram_bot.organization_handlers import notify_organizer_status
            from asgiref.sync import async_to_sync
            async_to_sync(notify_organizer_status)(organizer)
            logger.info(f"Telegram уведомление об одобрении организатора {organizer.username} отправлено")
        except Exception as e:
            logger.error(f"Ошибка при отправке Telegram уведомления организатору {organizer.username}: {e}")
            logger.error(traceback.format_exc())
        
        try:
            # 2. FCM уведомление в приложение
            from admin_panel.services.notification_service import NotificationService
            from asgiref.sync import async_to_sync
            async_to_sync(NotificationService.notify_organizer_status_changed)(organizer, is_approved=True)
            logger.info(f"FCM уведомление об одобрении организатора {organizer.username} отправлено")
        except Exception as e:
            logger.error(f"Ошибка при отправке FCM уведомления организатору {organizer.username}: {e}")
            logger.error(traceback.format_exc())
        
        # 3. Email уведомление
        try:
            if organizer.email:
                from django.core.mail import send_mail
                from django.conf import settings
                from datetime import datetime
                
                subject = "Статус организатора одобрен!"
                message = f"""
Здравствуйте, {organizer.name or organizer.username}!

Поздравляем! Ваш запрос на статус организатора был одобрен администратором.

Теперь вы можете:
- Создавать и управлять проектами
- Принимать и модератировать фотоотчёты от волонтёров
- Управлять командой волонтёров в ваших проектах

Войдите в свой личный кабинет организатора для начала работы.

─────────────────────────────────────────────────────────

Дата одобрения: {datetime.now().strftime('%d.%m.%Y в %H:%M')}

─────────────────────────────────────────────────────────
С уважением,
Команда BirQadam
Вместе делаем город чище!
"""
                
                send_mail(
                    subject=f"BirQadam - {subject}",
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[organizer.email],
                    fail_silently=False,
                )
                logger.info(f"Email уведомление об одобрении организатора {organizer.username} отправлено на {organizer.email}")
            else:
                logger.warning(f"У организатора {organizer.username} нет email адреса, email уведомление не отправлено")
        except Exception as e:
            logger.error(f"Ошибка при отправке email уведомления организатору {organizer.username}: {e}")
            logger.error(traceback.format_exc())
        
        messages.success(request, f'Организатор {organizer.username} одобрен')
        return redirect('admin_panel:organizers')
    
    except Exception as e:
        logger.error(f"[ERROR] approve_organizer: Critical error: {e}")
        logger.error(traceback.format_exc())
        messages.error(request, f'Ошибка при одобрении организатора: {str(e)}')
        return redirect('admin_panel:organizers')


@login_required
@require_POST
@csrf_protect  # ✅ ИСПРАВЛЕНИЕ КП-7: Явная CSRF защита
def reject_organizer(request: HttpRequest, user_id: int) -> HttpResponse:
    from api.utils.audit_logger import log_audit_action, AuditActions
    
    organizer = get_object_or_404(User, id=user_id)
    
    # Audit log
    log_audit_action(AuditActions.ORGANIZER_REJECTED, user=request.user, organizer_id=user_id)
    # Оставляем role='organizer' но отклоняем
    organizer.is_approved = False
    organizer.is_organizer = False
    organizer.organizer_status = 'rejected'
    # Обновляем только нужные поля, чтобы избежать ошибок с длинными значениями
    organizer.save(update_fields=['is_approved', 'is_organizer', 'organizer_status'])

    try:
        from api.users.models import OrganizerApplication
        OrganizerApplication.objects.filter(user=organizer).update(status='rejected')
    except Exception as app_exc:
        logger.warning("reject_organizer: не удалось обновить статус заявки OrganizerApplication: %s", app_exc)
    
    # 📨 Отправляем уведомления (Telegram + FCM)
    try:
        # 1. Telegram уведомление
        from telegram_bot.organization_handlers import notify_organizer_status
        from asgiref.sync import async_to_sync
        async_to_sync(notify_organizer_status)(organizer)
        logger.info(f"Telegram уведомление об отклонении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"Ошибка при отправке Telegram уведомления организатору {organizer.username}: {e}")
    
    try:
        # 2. FCM уведомление в приложение
        from admin_panel.services.notification_service import NotificationService
        from asgiref.sync import async_to_sync
        async_to_sync(NotificationService.notify_organizer_status_changed)(organizer, is_approved=False)
        logger.info(f"FCM уведомление об отклонении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"Ошибка при отправке FCM уведомления организатору {organizer.username}: {e}")
    
    messages.warning(request, f'Организатор {organizer.username} отклонён')
    return redirect('admin_panel:organizers')


# Activity API
class ActivitiesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from api.models import Activity
        from django.db.models import F

        # Получаем активности текущего пользователя
        activities = Activity.objects.filter(  # type: ignore[attr-defined]
            user=request.user
        ).select_related('project').annotate(  # type: ignore[attr-defined]
            project_name=F('project__title')
        ).values(
            'id',
            'type',
            'title',
            'description',
            'project_name',
            'created_at'
        ).order_by('-created_at')[:50]  # Последние 50 активностей

        return Response(list(activities), status=status.HTTP_200_OK)

# Achievements API
class AchievementsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        # ✅ ИСПРАВЛЕНИЕ СП-8: Кеширование достижений пользователя
        from api.models import Achievement, UserAchievement
        from django.db.models import Exists, OuterRef
        from django.core.cache import cache
        from api.utils.constants import CACHE_TIMEOUT_ACHIEVEMENTS

        user = request.user
        cache_key = f'achievements_user_{user.id if hasattr(user, "id") else 0}'  # type: ignore[attr-defined]
        
        # Проверяем кеш
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result, status=status.HTTP_200_OK)

        # Подзапрос для проверки, разблокировано ли достижение
        user_achievement_subquery = UserAchievement.objects.filter(
            achievement=OuterRef('pk'),
            user=user
        )

        # Получаем все достижения
        achievements = Achievement.objects.annotate(
            is_unlocked=Exists(user_achievement_subquery)
        ).values(
            'id', 'name', 'description', 'icon', 'required_rating',
            'xp', 'is_unlocked'
        ).order_by('required_rating')

        # Добавляем unlocked_at для разблокированных достижений
        result = []
        for achievement in achievements:
            ach_data = dict(achievement)
            if ach_data['is_unlocked']:
                user_ach = UserAchievement.objects.filter(
                    achievement_id=ach_data['id'],
                    user=user
                ).first()
                ach_data['unlocked_at'] = user_ach.unlocked_at.isoformat() if user_ach else None
            else:
                ach_data['unlocked_at'] = None
            result.append(ach_data)
        
        # ✅ Сохраняем в кеш
        cache.set(cache_key, result, CACHE_TIMEOUT_ACHIEVEMENTS)

        return Response(result, status=status.HTTP_200_OK)


class UserProgressAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from api.models import Achievement, UserAchievement

        user = request.user

        # Получаем разблокированные достижения пользователя
        unlocked_achievements = UserAchievement.objects.filter(user=user).select_related('achievement')  # type: ignore[attr-defined]
        current_xp = sum(ua.achievement.xp for ua in unlocked_achievements)

        # Находим следующее достижение
        unlocked_ids = [ua.achievement_id for ua in unlocked_achievements]  # type: ignore[attr-defined]
        user_rating = user.rating if hasattr(user, 'rating') else 0  # type: ignore[attr-defined]
        next_achievement = Achievement.objects.exclude(id__in=unlocked_ids).filter(  # type: ignore[attr-defined]
            required_rating__gt=user_rating
        ).order_by('required_rating').first()

        # Текущий уровень (последнее разблокированное достижение)
        current_achievement = Achievement.objects.filter(  # type: ignore[attr-defined]
            id__in=unlocked_ids
        ).order_by('-required_rating').first()

        current_level = current_achievement.name if current_achievement else 'Новичок'
        next_level = next_achievement.name if next_achievement else 'Максимальный уровень'
        next_level_xp = next_achievement.xp if next_achievement else current_xp

        # Рассчитываем процент прогресса на основе рейтинга
        if next_achievement:
            current_threshold = current_achievement.required_rating if current_achievement else 0
            next_threshold = next_achievement.required_rating
            rating_range = next_threshold - current_threshold
            rating_progress = user_rating - current_threshold  # Используем user_rating вместо user.rating
            progress_percent = (rating_progress / rating_range * 100) if rating_range > 0 else 0
        else:
            progress_percent = 100

        return Response({
            'current_xp': current_xp,
            'next_level_xp': next_level_xp,
            'current_level': current_level,
            'next_level': next_level,
            'progress_percent': min(100, max(0, progress_percent))
        }, status=status.HTTP_200_OK)


class LeaderboardAPIView(APIView):
    """API для получения таблицы лидеров по рейтингу"""
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from api.models import Achievement, UserAchievement
        from django.db.models import Count, F

        # Получаем параметры
        limit = int(request.GET.get('limit', 100))  # По умолчанию топ-100
        period = request.GET.get('period', 'all')  # all, month, week

        # Базовый запрос для волонтеров
        queryset = User.objects.filter(is_organizer=False)

        # Фильтрация по периоду (пока оставляем all, можно расширить)
        if period == 'month':
            # TODO: Добавить фильтрацию по месяцу на основе истории рейтинга
            pass
        elif period == 'week':
            # TODO: Добавить фильтрацию по неделе
            pass

        # Получаем топ волонтеров с аннотациями
        leaderboard = queryset.annotate(
            achievements_count=Count('user_achievements'),
            projects_count=Count('volunteer_projects', distinct=True),
            tasks_completed=Count('assignments', filter=Q(assignments__completed=True), distinct=True)
        ).order_by('-rating', '-achievements_count')[:limit]

        # Формируем результат
        result = []
        for index, user in enumerate(leaderboard, start=1):
            # Получаем текущее достижение пользователя
            current_achievement = Achievement.objects.filter(
                user_achievements__user=user
            ).order_by('-required_rating').first()

            user_data = {
                'rank': index,
                'id': user.id,  # type: ignore[attr-defined]
                'name': user.name or user.username,
                'username': user.username,
                'rating': user.rating,  # type: ignore[attr-defined]
                'achievements_count': user.achievements_count,  # type: ignore[attr-defined]
                'projects_count': user.projects_count,  # type: ignore[attr-defined]
                'tasks_completed': user.tasks_completed,  # type: ignore[attr-defined]
                'current_achievement': {
                    'name': current_achievement.name,
                    'icon': current_achievement.icon
                } if current_achievement else None
            }
            result.append(user_data)

        # Находим позицию текущего пользователя, если он не в топе
        current_user_rank = None
        current_user_data = None

        if request.user not in [u for u in leaderboard]:
            all_users = User.objects.filter(is_organizer=False).order_by('-rating', '-id')  # type: ignore[attr-defined]
            request_user_id = request.user.id if hasattr(request.user, 'id') else 0  # type: ignore[attr-defined]
            for index, user in enumerate(all_users, start=1):
                if user.id == request_user_id:  # type: ignore[attr-defined]
                    current_user_rank = index
                    current_achievement = Achievement.objects.filter(  # type: ignore[attr-defined]
                        user_achievements__user=user  # type: ignore[attr-defined]
                    ).order_by('-required_rating').first()

                    current_user_data = {
                        'rank': index,
                        'id': user.id,  # type: ignore[attr-defined]
                        'name': user.name or user.username,
                        'username': user.username,
                        'rating': user.rating,  # type: ignore[attr-defined]
                        'achievements_count': user.user_achievements.count(),  # type: ignore[attr-defined]
                        'projects_count': user.volunteer_projects.count(),  # type: ignore[attr-defined]
                        'tasks_completed': user.assignments.filter(completed=True).count(),  # type: ignore[attr-defined]
                        'current_achievement': {
                            'name': current_achievement.name,
                            'icon': current_achievement.icon
                        } if current_achievement else None
                    }
                    break

        return Response({
            'leaderboard': result,
            'current_user_rank': current_user_rank,
            'current_user': current_user_data,
            'total_volunteers': User.objects.filter(is_organizer=False).count()
        }, status=status.HTTP_200_OK)


# ==================== МАССОВЫЕ РАССЫЛКИ ====================

@login_required
def bulk_notifications(request: HttpRequest) -> HttpResponse:
    """Страница управления массовыми рассылками"""
    is_staff = hasattr(request.user, 'is_staff') and request.user.is_staff  # type: ignore[attr-defined]
    is_admin = hasattr(request.user, 'is_admin') and request.user.is_admin  # type: ignore[attr-defined]
    if not is_staff and not is_admin:
        return HttpResponse("Доступ запрещен", status=403)
    
    return render(request, 'admin_panel/bulk_notifications.html', {
        'active_page': 'bulk_notifications'
    })


@login_required
def global_search(request: HttpRequest) -> HttpResponse:
    """Страница глобального поиска"""
    return render(request, 'admin_panel/global_search.html', {
        'active_page': 'global_search'
    })


@login_required
def activity_map(request: HttpRequest) -> HttpResponse:
    """Страница интерактивной карты активности (OpenStreetMap)"""
    return render(request, 'admin_panel/activity_map.html', {
        'active_page': 'activity_map'
    })


@login_required
def calendar_admin(request: HttpRequest) -> HttpResponse:
    """📅 Страница календаря событий для администратора"""
    from api.models import Event
    
    # Получить все события (не удаленные)
    events = Event.objects.filter(is_deleted=False).select_related('creator', 'project', 'task').prefetch_related('participants').order_by('start_date', 'start_time')
    
    # Статистика по событиям
    upcoming_events = events.filter(start_date__gte=timezone.now().date()).count()
    today_events = events.filter(start_date=timezone.now().date()).count()

    events_data: list[dict[str, Any]] = []
    for event in events:
        project = event.project
        task = event.task
        hero_image = None

        if task and getattr(task, 'task_image', None):
            try:
                hero_image = task.task_image.url
            except ValueError:
                hero_image = None
        elif project and getattr(project, 'cover_image', None):
            try:
                hero_image = project.cover_image.url
            except ValueError:
                hero_image = None

        events_data.append({
            'id': event.id,
            'date': event.start_date.isoformat(),
            'title': event.title,
            'subtitle': (
                task.text[:80] if task else
                project.title if project else
                (event.description[:90] if event.description else None)
            ),
            'description': event.description or '',
            'type': event.event_type,
            'type_display': event.get_event_type_display(),
            'source_type': 'task' if task else 'project' if project else 'custom',
            'source_id': task.id if task else project.id if project else event.id,
            'start_time': event.start_time.strftime('%H:%M:%S') if event.start_time else None,
            'end_time': event.end_time.strftime('%H:%M:%S') if event.end_time else None,
            'end_date': event.end_date.isoformat() if event.end_date else None,
            'is_all_day': event.is_all_day,
            'visibility': event.visibility,
            'visibility_display': event.get_visibility_display(),
            'location': event.location or '',
            'status': task.status if task else project.status if project else None,
            'creator_username': getattr(event.creator, 'username', '') or '',
            'creator_name': event.creator.get_full_name() or getattr(event.creator, 'username', '') or '',
            'participants_count': event.participants.count(),
            'project_id': project.id if project else None,
            'project_title': project.title if project else None,
            'project_city': project.city if project and project.city else None,
            'project_type': project.get_volunteer_type_display() if project and project.volunteer_type else None,
            'project_address': project.address if project and project.address else None,
            'project_gis2_url': project.gis2_url if project and project.gis2_url else None,
            'project_latitude': project.latitude if project else None,
            'project_longitude': project.longitude if project else None,
            'project_url': reverse('admin_panel:project_detail', args=[project.id]) if project else None,
            'task_id': task.id if task else None,
            'task_title': task.text[:120] if task else None,
            'task_url': f'/custom-admin/tasks/?task_id={task.id}' if task else None,
            'hero_image': hero_image,
        })
    
    print(f"📅 Calendar Admin: {events.count()} events found")  # Debug
    
    return render(request, 'admin_panel/calendar.html', {
        'active_page': 'calendar',
        'events': events,
        'events_data': events_data,
        'upcoming_events': upcoming_events,
        'today_events': today_events,
    })
