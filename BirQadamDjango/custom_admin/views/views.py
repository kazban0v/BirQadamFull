from django.shortcuts import render, get_object_or_404
import json
from django.db.models import Count, Avg, Q
from django.db import IntegrityError  # ✅ ИСПРАВЛЕНИЕ: Для обработки race condition
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, HttpRequest
from typing import Any
from django.views.generic import ListView, DeleteView, TemplateView, UpdateView
from django_filters.views import FilterView  # type: ignore[reportMissingTypeStubs]
from core.models import User, Project, Task, Photo, TaskAssignment, FeedbackSession, FeedbackMessage
from ..utils.filters import UserFilter, ProjectFilter, TaskFilter
from ..utils.forms import ProjectForm
from datetime import datetime, timedelta
from django.urls import reverse_lazy
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
from django.utils.http import urlsafe_base64_encode
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
from core.utils.api_errors import APIError  # ✅ Стандартизированные ошибки API

# Logger setup
logger = logging.getLogger(__name__)

# ✅ ИСПРАВЛЕНИЕ: Не используем глобальную переменную, так как она инициализируется один раз
# today = timezone.now().date()  # УДАЛЕНО: будем вычислять локально в каждой функции

# ✅ Импортируем централизованную функцию нормализации телефона
from core.utils.utils import normalize_phone

# Регистрация шрифтов с абсолютными путями
try:
    font_dir = os.path.join(settings.BASE_DIR, 'custom_admin', 'static', 'fonts')
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
    return render(request, 'custom_admin/feedback_detail.html', {
        'session': session,
        'messages': messages
    })

@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
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

    stats = {
        'total_volunteers': User.objects.filter(is_organizer=False).count(),  # type: ignore[attr-defined]
        'active_projects': Project.objects.filter(status='approved', deleted_at__isnull=True).count(),  # type: ignore[attr-defined]
        'pending_projects': Project.objects.filter(status='pending', deleted_at__isnull=True).count(),  # type: ignore[attr-defined]
        'pending_tasks': Task.objects.filter(status='open').count(),  # type: ignore[attr-defined]
        'completed_tasks': Task.objects.filter(status='completed').count(),  # type: ignore[attr-defined]
        'photos': Photo.objects.select_related('volunteer', 'project').order_by('-uploaded_at')[:5]  # type: ignore[attr-defined]
    }

    # Используем datetime для правильной фильтрации с timezone
    project_stats = list(Project.objects.filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt, deleted_at__isnull=True)  # type: ignore[attr-defined]
                        .values('status').annotate(count=Count('id')))
    task_stats = list(Task.objects.filter(created_at__gte=date_from_dt, created_at__lte=date_to_dt)  # type: ignore[attr-defined]
                     .values('status').annotate(count=Count('id')))
    activity_stats = []
    delta = (date_to - date_from).days
    for i in range(delta, -1, -1):
        date = date_from + timedelta(days=i)
        count = TaskAssignment.objects.filter(completed_at__date=date).count()  # type: ignore[attr-defined]
        activity_stats.append({
            'day': date.strftime('%Y-%m-%d'),
            'count': count
        })

    # Таблица лидеров
    top_volunteers = (
        User.objects.filter(is_organizer=False)  # type: ignore[attr-defined]
        .annotate(task_count=Count('assignments', filter=Q(assignments__completed=True, assignments__completed_at__gte=date_from_dt, assignments__completed_at__lte=date_to_dt)))  # type: ignore[attr-defined]
        .filter(task_count__gt=0)  # type: ignore[attr-defined]
        .order_by('-task_count')[:5]  # type: ignore[attr-defined]
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
        'top_volunteers': top_volunteers,
        'projects_for_map': json.dumps(list(projects_for_map), cls=DjangoJSONEncoder),
        'period': period,
        'date_from': date_from,
        'date_to': date_to
    }

    return render(request, 'custom_admin/dashboard.html', context)

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
                assignments__completed=True,
                assignments__completed_at__gte=date_from_dt,
                assignments__completed_at__lte=date_to_dt
            )),
            avg_rating=Avg('photos__rating')
        )
        .filter(task_count__gt=0)
        .order_by('-task_count')[:5]
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

    response = {
        'project_data': list(project_data),
        'task_data': list(task_data),
        'activity_data': activity_data_serializable,
        'rating_data': rating_data,
        'engagement_data': engagement_data,
        'top_volunteers': top_volunteers_data,  # Используем сериализованные данные
        'colors': {
            'projects': ['#4e73df', '#1cc88a', '#e74a3b'],
            'tasks': ['#36b9cc', '#f6c23e', '#858796'],
            'ratings': ['#ff6384', '#36a2eb', '#ffcd56', '#4bc0c0', '#9966ff'],
            'engagement': ['#28a745', '#dc3545']
        }
    }

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse(response)

    return render(request, 'custom_admin/analytics.html', {
        'chart_data': json.dumps(response, cls=DjangoJSONEncoder),
        'top_volunteers': top_volunteers,  # Передаем объекты User для отображения в шаблоне
        'period': period,
        'date_from': date_from,
        'date_to': date_to
    })

@login_required
@require_POST
def export_report(request: HttpRequest) -> HttpResponse:
    """✅ УЛУЧШЕННЫЙ экспорт отчетов с красивым UI/UX + календарь для произвольных дат"""
    from custom_admin.services.export import create_enhanced_csv_report, create_enhanced_pdf_report
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
    
    return render(request, 'custom_admin/project_feedback.html', {
        'project': project,
        'feedback_sessions': feedback_sessions
    })

@login_required
def volunteers(request: HttpRequest, user_id: int | None = None) -> HttpResponse:
    # ✅ ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
    today = timezone.localtime(timezone.now()).date()
    
    total_volunteers = User.objects.filter(is_organizer=False).count()  # type: ignore[attr-defined]
    avg_rating = User.objects.filter(is_organizer=False, photos__rating__isnull=False).aggregate(avg_rating=Avg('photos__rating'))['avg_rating'] or 0  # type: ignore[attr-defined]
    total_tasks = TaskAssignment.objects.filter(completed=True).count()  # type: ignore[attr-defined]

    if user_id:
        volunteer = get_object_or_404(User, id=user_id, is_organizer=False)
        completed_assignments = volunteer.assignments.filter(completed=True).select_related('task__project')  # type: ignore[attr-defined]
        
        stats = {
            'username': volunteer.username,
            'rating': volunteer.rating if volunteer.rating is not None else 0,
            'project_count': volunteer.volunteer_projects.filter(is_active=True, project__is_deleted=False).count(),  # type: ignore[attr-defined]
            'task_count': completed_assignments.count(),
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

        activity_data = []
        for i in range(30, -1, -1):
            date = today - timedelta(days=i)
            count = TaskAssignment.objects.filter(volunteer=volunteer, completed_at__date=date).count()  # type: ignore[attr-defined]
            activity_data.append({'day': date.strftime('%Y-%m-%d'), 'count': count})
        
        context = {
            'volunteer': volunteer,
            'stats': stats,
            'volunteer_avg_rating': volunteer_avg_rating,
            'rating_history': json.dumps(rating_history, cls=DjangoJSONEncoder),
            'activity_data': json.dumps(activity_data, cls=DjangoJSONEncoder),
            'show_analytics': True,
            'total_volunteers': total_volunteers,
            'avg_rating': avg_rating,
            'total_tasks': total_tasks,
            'completed_assignments': completed_assignments,
        }
    else:
        volunteers = User.objects.filter(is_organizer=False).annotate(  # type: ignore[attr-defined]
            project_count=Count('volunteer_projects', filter=Q(volunteer_projects__is_active=True, volunteer_projects__project__is_deleted=False)),  # type: ignore[attr-defined]
            task_count=Count('assignments', filter=Q(assignments__completed=True, assignments__task__is_deleted=False))  # type: ignore[attr-defined]
        )
        context = {
            'volunteers': volunteers,
            'show_analytics': False,
            'total_volunteers': total_volunteers,
            'avg_rating': avg_rating,
            'total_tasks': total_tasks,
        }
    
    return render(request, 'custom_admin/volunteers.html', context)

class ProjectDeleteView(DeleteView):
    model = Project
    template_name = 'custom_admin/project_confirm_delete.html'
    success_url = reverse_lazy('project_list')

    def delete(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseRedirect:
        self.object = self.get_object()
        self.object.delete()
        return HttpResponseRedirect(self.get_success_url())

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context['hide_sidebar'] = False
        return context

@login_required
def project_detail(request: HttpRequest, pk: int | str) -> HttpResponse:
    project = get_object_or_404(Project, pk=pk, deleted_at__isnull=True)
    
    task_stats = (
        Task.objects.filter(project=project)  # type: ignore[attr-defined]
        .values('status')
        .annotate(count=Count('id'))
    )
    
    activity_data = (
        TaskAssignment.objects.filter(task__project=project, completed=True)  # type: ignore[attr-defined]
        .extra({'day': "date(completed_at)"})
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
    
    return render(request, 'custom_admin/project_detail.html', context)

class ProjectUpdateView(UpdateView):
    model = Project
    form_class = ProjectForm
    template_name = 'custom_admin/project_edit.html'
    success_url = reverse_lazy('project_list')
    
    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context['is_edit'] = True
        return context

@login_required
def project_list(request: HttpRequest) -> HttpResponse:
    projects = Project.objects.filter(deleted_at__isnull=True).annotate(  # type: ignore[attr-defined]
        volunteer_count=Count('volunteer_projects'),  # type: ignore[attr-defined]
        task_count=Count('tasks')  # type: ignore[attr-defined]
    )
    return render(request, 'custom_admin/projects.html', {'projects': projects})

@login_required
def task_list(request: HttpRequest) -> HttpResponse:
    tasks = Task.objects.select_related('project').annotate(  # type: ignore[attr-defined]
        assignment_count=Count('assignments')  # type: ignore[attr-defined]
    ).order_by('-created_at')
    return render(request, 'custom_admin/tasks.html', {'tasks': tasks})

@require_POST
def custom_logout(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect('login')

@method_decorator(login_required, name='dispatch')
class ProjectListView(FilterView):
    model = Project
    filterset_class = ProjectFilter
    template_name = 'custom_admin/projects.html'
    paginate_by = 20

    def get_queryset(self) -> Any:
        return Project.objects.filter(deleted_at__isnull=True).annotate(  # type: ignore[attr-defined]
            volunteer_count=Count('volunteer_projects'),  # type: ignore[attr-defined]
            task_count=Count('tasks')  # type: ignore[attr-defined]
        )

@method_decorator(login_required, name='dispatch')
class TaskListView(FilterView):
    model = Task
    filterset_class = TaskFilter
    template_name = 'custom_admin/tasks.html'
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
            'open': Task.objects.filter(status='open').count(),  # type: ignore[attr-defined]
            'in_progress': Task.objects.filter(status='in_progress').count(),  # type: ignore[attr-defined]
            'completed': Task.objects.filter(status='completed').count(),  # type: ignore[attr-defined]
            'failed': Task.objects.filter(status='failed').count(),  # type: ignore[attr-defined]
        }
        
        return context

@method_decorator(login_required, name='dispatch')
class VolunteerListView(FilterView):
    model = User
    filterset_class = UserFilter
    template_name = 'custom_admin/volunteers.html'
    paginate_by = 20

class CustomLoginView(auth_views.LoginView):
    template_name = 'custom_admin/login.html'
    success_url = reverse_lazy('dashboard')
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
    email_template_name = 'custom_admin/password_reset_email.html'
    token_generator = default_token_generator
    
    def send_mail(self, *args: Any, **kwargs: Any) -> None:
        settings.PASSWORD_RESET_TIMEOUT = 180
        return super().send_mail(*args, **kwargs)  # type: ignore[misc]

class ProfileView(LoginRequiredMixin, TemplateView):
    template_name = 'custom_admin/profile.html'

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        context['user'] = user
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
        
        return context

class ProfileUpdateView(LoginRequiredMixin, UpdateView):
    template_name = 'custom_admin/profile_edit.html'
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
                logger.info(f"✅ Привязываем приложение к Telegram аккаунту {existing_user.id}")  # type: ignore[attr-defined]
                
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
                logger.info(f"✅ Пользователь обновлен: email={existing_user.email}, registration_source={existing_user.registration_source}")
                
                # 📨 Отправляем уведомление в TELEGRAM (если есть telegram_id)
                if existing_user.telegram_id:
                    try:
                        from custom_admin.services.notification_service import NotificationService
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
                        logger.info(f"✅ Telegram уведомление о привязке приложения отправлено")
                    except Exception as e:
                        logger.error(f"❌ Ошибка отправки Telegram уведомления: {e}")
                
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
                logger.warning(f"⚠️ IntegrityError при регистрации: {e}")
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
            
            logger.info(f"✅ Новый пользователь создан: ID={user.id}, email={user.email}")  # type: ignore[attr-defined]

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
            logger.error(f"❌ Registration error: {str(e)}")
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
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
                logger.info(f"✅ Updated name for user {user.id}: {user.name}")
            
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
                logger.info(f"✅ Updated email for user {user.id}: {user.email}")  # type: ignore[attr-defined]
            
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
            logger.error(f"❌ Error updating profile: {str(e)}")
            return Response({
                'error': f'Ошибка обновления профиля: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from core.services.web_portal_projects import get_projects_catalog

        catalog = get_projects_catalog(request.user)
        return Response(catalog, status=status.HTTP_200_OK)

    def post(self, request: HttpRequest, project_id: int) -> Response:
        from core.models import VolunteerProject, Activity
        from core.services.web_portal_projects import get_projects_catalog
        try:
            # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
            project = Project.objects.select_related('creator').get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            volunteer_project, created = VolunteerProject.objects.get_or_create(  # type: ignore[attr-defined]
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
        from core.models import VolunteerProject, Activity
        try:
            # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
            project = Project.objects.select_related('creator').get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            volunteer_project, created = VolunteerProject.objects.get_or_create(  # type: ignore[attr-defined]
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
                return Response({'message': 'Successfully joined project'}, status=status.HTTP_201_CREATED)
            else:
                return Response({'message': 'Already joined'}, status=status.HTTP_200_OK)
        except Project.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)


class UserTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from core.models import VolunteerProject

        # ✅ ИСПРАВЛЕНИЕ НП-1: Добавлен select_related для оптимизации
        # Получаем проекты, к которым присоединился волонтер
        joined_projects = VolunteerProject.objects.select_related('project', 'project__creator').filter(  # type: ignore[attr-defined]
            volunteer=request.user
        ).values_list('project_id', flat=True)

        # Получаем ID заданий, которые назначены текущему пользователю (accepted=True)
        assigned_task_ids = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            accepted=True
        ).values_list('task_id', flat=True)

        # Получаем ID заданий, которые волонтер отклонил (accepted=False)
        declined_task_ids = TaskAssignment.objects.filter(  # type: ignore[attr-defined]
            volunteer=request.user,
            accepted=False
        ).values_list('task_id', flat=True)

        # Получаем все задачи из этих проектов, исключая отклоненные и удаленные
        tasks_qs = Task.objects.filter(  # type: ignore[attr-defined]
            project_id__in=joined_projects,
            is_deleted=False  # Исключаем удаленные задачи
        ).exclude(
            id__in=declined_task_ids  # Исключаем отклоненные задачи
        ).select_related('project', 'creator').order_by('-created_at')

        # Формируем результат с обработкой имени создателя
        tasks = []
        for task in tasks_qs:
            is_assigned = task.id in assigned_task_ids  # type: ignore[attr-defined]
            
            tasks.append({
                'id': task.id,  # type: ignore[attr-defined]
                'text': task.text,
                'project_title': task.project.title,  # Исправлено
                'project_id': task.project_id,  # type: ignore[attr-defined]
                'creator_name': task.creator.name if task.creator.name else task.creator.username,  # Исправлено
                'status': task.status,
                'is_assigned': is_assigned,  # Добавлено
                'assignment_status': is_assigned,  # Для совместимости
                'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
                'start_time': task.start_time.strftime('%H:%M') if task.start_time else None,
                'end_time': task.end_time.strftime('%H:%M') if task.end_time else None,
                'created_at': task.created_at.isoformat()
            })

        return Response(tasks, status=status.HTTP_200_OK)


class OrganizerProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _is_approved_organizer(user: Any) -> bool:
        """
        Дополнительная проверка на случай, если флаг is_approved ещё не синхронизирован
        с новым статусом organizer_status в модели пользователя.
        """
        is_organizer = getattr(user, 'is_organizer', False)
        is_approved_flag = getattr(user, 'is_approved', False)
        organizer_status = getattr(user, 'organizer_status', None)

        return bool(is_organizer and (is_approved_flag or organizer_status == 'approved'))

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
        if not self._is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        projects_qs = (
            Project.objects.filter(creator=request.user, deleted_at__isnull=True)
            .annotate(
                volunteer_count=Count('volunteer_projects', distinct=True),  # type: ignore[attr-defined]
                task_count=Count('tasks', distinct=True),  # type: ignore[attr-defined]
            )
            .prefetch_related('tags')
            .order_by('-created_at')
        )

        projects: list[dict[str, Any]] = []
        for project in projects_qs:
            projects.append(
                {
                    'id': project.id,  # type: ignore[attr-defined]
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
                    'tags': list(project.tags.names()),
                    'cover_image_url': project.cover_image.url if project.cover_image else None,
                }
            )

        return Response(projects, status=status.HTTP_200_OK)

    def post(self, request: Any) -> Response:
        # Детальное логирование для диагностики 401 ошибки
        print('=' * 80)
        print('🔍 OrganizerProjectsAPIView POST request debugging')
        print(f'📧 request.user: {request.user}')
        print(f'🔐 request.user.is_authenticated: {request.user.is_authenticated}')
        print(f'👤 request.user type: {type(request.user)}')
        if hasattr(request.user, 'is_organizer'):
            print(f'👔 request.user.is_organizer: {request.user.is_organizer}')
        if hasattr(request.user, 'is_approved'):
            print(f'✅ request.user.is_approved: {request.user.is_approved}')
        if hasattr(request.user, 'organizer_status'):
            print(f'📌 request.user.organizer_status: {request.user.organizer_status}')
        print(f'📝 Headers: {dict(request.headers) if hasattr(request, "headers") else "N/A"}')
        # Для DRF API используем request.data
        from rest_framework.request import Request as DRFRequest
        if isinstance(request, DRFRequest):
            data = request.data
        else:
            data = getattr(request, 'POST', {})
        print(f'📦 request.data: {data}')
        print('=' * 80)

        try:
            from datetime import datetime, timedelta

            title = data.get('title')  # type: ignore[attr-defined]
            description = data.get('description')  # type: ignore[attr-defined]
            city = data.get('city')  # type: ignore[attr-defined]
            volunteer_type = data.get('volunteer_type', 'any')  # type: ignore[attr-defined]

            if not all([title, description, city]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

            start_date = self._parse_date(data.get('start_date'))  # type: ignore[attr-defined]
            end_date = self._parse_date(data.get('end_date'))  # type: ignore[attr-defined]

            if not start_date:
                start_date = datetime.now().date()
            if not end_date:
                end_date = (datetime.now() + timedelta(days=30)).date()

            latitude = self._parse_float(data.get('latitude'))  # type: ignore[attr-defined]
            longitude = self._parse_float(data.get('longitude'))  # type: ignore[attr-defined]

            tags = self._parse_tags(data.get('tags'))  # type: ignore[attr-defined]

            project = Project.objects.create(  # type: ignore[attr-defined]
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
                address=data.get('address', ''),  # type: ignore[attr-defined]
                contact_person=data.get('contact_person', ''),  # type: ignore[attr-defined]
                contact_phone=data.get('contact_phone', ''),  # type: ignore[attr-defined]
                contact_email=data.get('contact_email'),  # type: ignore[attr-defined]
                contact_telegram=data.get('contact_telegram', ''),  # type: ignore[attr-defined]
                info_url=data.get('info_url'),  # type: ignore[attr-defined]
            )

            cover_image = getattr(request, 'FILES', {}).get('cover_image')  # type: ignore[attr-defined]
            if cover_image:
                project.cover_image = cover_image
                project.save(update_fields=['cover_image'])

            if tags:
                project.tags.set(tags)

            return Response({
                'id': project.id,  # type: ignore[attr-defined]
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
                'tags': tags,
                'cover_image_url': project.cover_image.url if project.cover_image else None,
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjectParticipantsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest, project_id: int) -> Response:
        from core.models import VolunteerProject
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

    def get(self, request: HttpRequest, project_id: int) -> Response:
        """Получить список задач проекта (для организатора или участника проекта)"""
        try:
            # Проверяем, что проект существует и не удален
            project = Project.objects.get(id=project_id, deleted_at__isnull=True)  # type: ignore[attr-defined]
            
            # Проверяем доступ: пользователь должен быть либо создателем проекта, либо участником
            from core.models import VolunteerProject
            
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
            tasks = Task.objects.filter(  # type: ignore[attr-defined]
                project_id=project_id,
                is_deleted=False
            ).values(
                'id',
                'text',
                'status',
                'created_at',
                'deadline_date',
                'start_time',
                'end_time',
            ).order_by('-created_at')

            normalized_tasks = []
            for task in tasks:
                normalized_tasks.append(
                    {
                        'id': task['id'],
                        'text': task['text'],
                        'status': task['status'],
                        'created_at': task['created_at'].isoformat() if task['created_at'] else None,
                        'deadline_date': task['deadline_date'].isoformat() if task['deadline_date'] else None,
                        'start_time': task['start_time'].strftime('%H:%M') if task['start_time'] else None,
                        'end_time': task['end_time'].strftime('%H:%M') if task['end_time'] else None,
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
            from core.models import VolunteerProject, Activity
            
            try:
                # Получаем всех активных волонтеров проекта
                volunteer_projects = VolunteerProject.objects.filter(  # type: ignore[attr-defined]
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
                    logger.info(f"✅ Created {len(activities)} Activity records for task {task.id}")  # type: ignore[attr-defined]
            except Exception as e:
                logger.error(f"⚠️ Failed to create Activity records for task {task.id}: {e}", exc_info=True)  # type: ignore[attr-defined]
            
            # 🔔 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ ВСЕМ ВОЛОНТЕРАМ (Telegram + FCM)
            import asyncio
            from core.services.notification_utils import notify_all_project_volunteers

            try:
                # Запускаем асинхронную отправку уведомлений
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                stats = loop.run_until_complete(notify_all_project_volunteers(project, task))
                loop.close()

                logger.info(f"✅ Task {task.id} notifications sent: {stats}")  # type: ignore[attr-defined]
            except Exception as e:
                # Не блокируем создание задачи если уведомления не отправились
                logger.error(f"⚠️ Failed to send notifications for task {task.id}: {e}", exc_info=True)  # type: ignore[attr-defined]

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


class LeaveProjectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: HttpRequest, project_id: int) -> Response:
        from core.models import VolunteerProject, Activity
        try:
            volunteer_project = VolunteerProject.objects.get(  # type: ignore[attr-defined]
                volunteer=request.user,
                project_id=project_id
            )
            project = volunteer_project.project
            volunteer_project.delete()

            # Создаём активность
            Activity.objects.create(  # type: ignore[attr-defined]
                user=request.user,
                type='project_left',
                title='Покинули проект',
                description=f'Вы покинули проект "{project.title}"',
                project=project
            )

            return Response({'message': 'Successfully left project'}, status=status.HTTP_200_OK)
        except VolunteerProject.DoesNotExist:  # type: ignore[attr-defined]
            return Response({'error': 'Not a member of this project'}, status=status.HTTP_404_NOT_FOUND)


from core.models import DeviceToken

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
        organizer = get_object_or_404(User, id=user_id, is_organizer=True)
        projects = Project.objects.filter(creator=organizer, deleted_at__isnull=True).annotate(  # type: ignore[attr-defined]
            volunteer_count=Count('volunteer_projects'),  # type: ignore[attr-defined]
            task_count=Count('tasks')  # type: ignore[attr-defined]
        )
        context = {
            'organizer': organizer,
            'projects': projects,
            'show_analytics': True
        }
    else:
        # Show all organizers with approval status
        organizers_list = User.objects.filter(  # type: ignore[attr-defined]
            Q(role='organizer') | Q(is_organizer=True)
        ).annotate(  # type: ignore[attr-defined]
            project_count=Count('created_projects', filter=Q(created_projects__is_deleted=False)),  # type: ignore[attr-defined]
            approved_project_count=Count('created_projects', filter=Q(created_projects__status='approved', created_projects__is_deleted=False)),  # type: ignore[attr-defined]
            task_count=Count('created_projects__tasks', filter=Q(created_projects__is_deleted=False, created_projects__tasks__is_deleted=False))  # type: ignore[attr-defined]
        ).order_by('-is_approved', '-date_joined')  # type: ignore[attr-defined]

        # Split into pending and approved
        # Показываем всех неодобренных (новые и отклоненные будут вместе)
        # Админ сам разберется
        pending_organizers = organizers_list.filter(organizer_status='pending')
        approved_organizers = organizers_list.filter(organizer_status='approved')
        rejected_organizers = organizers_list.filter(organizer_status='rejected')

        context = {
            'organizers': organizers_list,
            'pending_organizers': pending_organizers,
            'approved_organizers': approved_organizers,
            'rejected_organizers': rejected_organizers, # Добавлено
            'show_analytics': False,
            'pending_count': pending_organizers.count(),
            'approved_count': approved_organizers.count(),
            'rejected_count': rejected_organizers.count() # Добавлено
        }

    return render(request, 'custom_admin/organizers.html', context)


@login_required
@require_POST
@csrf_protect  # ✅ ИСПРАВЛЕНИЕ КП-7: Явная CSRF защита
def approve_organizer(request: HttpRequest, user_id: int) -> HttpResponse:
    from core.utils.audit_logger import log_audit_action, AuditActions
    
    organizer = get_object_or_404(User, id=user_id)
    organizer.is_approved = True
    organizer.is_organizer = True
    organizer.organizer_status = 'approved'
    organizer.save()
    
    # Audit log
    log_audit_action(AuditActions.ORGANIZER_APPROVED, user=request.user, organizer_id=user_id)
    
    # 📨 Отправляем уведомления (Telegram + FCM)
    try:
        # 1. Telegram уведомление
        from bot.organization_handlers import notify_organizer_status
        from asgiref.sync import async_to_sync
        async_to_sync(notify_organizer_status)(organizer)
        logger.info(f"✅ Telegram уведомление об одобрении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке Telegram уведомления организатору {organizer.username}: {e}")
    
    try:
        # 2. FCM уведомление в приложение
        from custom_admin.services.notification_service import NotificationService
        from asgiref.sync import async_to_sync
        async_to_sync(NotificationService.notify_organizer_status_changed)(organizer, is_approved=True)
        logger.info(f"✅ FCM уведомление об одобрении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке FCM уведомления организатору {organizer.username}: {e}")
    
    messages.success(request, f'Организатор {organizer.username} одобрен')
    return redirect('organizers')


@login_required
@require_POST
@csrf_protect  # ✅ ИСПРАВЛЕНИЕ КП-7: Явная CSRF защита
def reject_organizer(request: HttpRequest, user_id: int) -> HttpResponse:
    from core.utils.audit_logger import log_audit_action, AuditActions
    
    organizer = get_object_or_404(User, id=user_id)
    
    # Audit log
    log_audit_action(AuditActions.ORGANIZER_REJECTED, user=request.user, organizer_id=user_id)
    # Оставляем role='organizer' но отклоняем
    organizer.is_approved = False
    organizer.is_organizer = False
    organizer.organizer_status = 'rejected'
    organizer.save()
    
    # 📨 Отправляем уведомления (Telegram + FCM)
    try:
        # 1. Telegram уведомление
        from bot.organization_handlers import notify_organizer_status
        from asgiref.sync import async_to_sync
        async_to_sync(notify_organizer_status)(organizer)
        logger.info(f"✅ Telegram уведомление об отклонении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке Telegram уведомления организатору {organizer.username}: {e}")
    
    try:
        # 2. FCM уведомление в приложение
        from custom_admin.services.notification_service import NotificationService
        from asgiref.sync import async_to_sync
        async_to_sync(NotificationService.notify_organizer_status_changed)(organizer, is_approved=False)
        logger.info(f"✅ FCM уведомление об отклонении организатора {organizer.username} отправлено")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке FCM уведомления организатору {organizer.username}: {e}")
    
    messages.warning(request, f'Организатор {organizer.username} отклонён')
    return redirect('organizers')


# Activity API
class ActivitiesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest) -> Response:
        from core.models import Activity
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
        from core.models import Achievement, UserAchievement
        from django.db.models import Exists, OuterRef
        from django.core.cache import cache
        from core.utils.constants import CACHE_TIMEOUT_ACHIEVEMENTS

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
        from core.models import Achievement, UserAchievement

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
        from core.models import Achievement, UserAchievement
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
    
    return render(request, 'custom_admin/bulk_notifications.html', {
        'active_page': 'bulk_notifications'
    })


@login_required
def global_search(request: HttpRequest) -> HttpResponse:
    """Страница глобального поиска"""
    return render(request, 'custom_admin/global_search.html', {
        'active_page': 'global_search'
    })


@login_required
def activity_map(request: HttpRequest) -> HttpResponse:
    """Страница интерактивной карты активности (OpenStreetMap)"""
    return render(request, 'custom_admin/activity_map.html', {
        'active_page': 'activity_map'
    })


@login_required
def calendar_admin(request: HttpRequest) -> HttpResponse:
    """📅 Страница календаря событий для администратора"""
    from core.models import Event
    
    # Получить все события (не удаленные)
    events = Event.objects.filter(is_deleted=False).select_related('creator', 'project', 'task').prefetch_related('participants').order_by('start_date', 'start_time')
    
    # Статистика по событиям
    upcoming_events = events.filter(start_date__gte=timezone.now().date()).count()
    today_events = events.filter(start_date=timezone.now().date()).count()
    
    print(f"📅 Calendar Admin: {events.count()} events found")  # Debug
    
    return render(request, 'custom_admin/calendar.html', {
        'active_page': 'calendar',
        'events': events,
        'upcoming_events': upcoming_events,
        'today_events': today_events,
    })
