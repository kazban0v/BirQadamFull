from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q
from api.models import SupportTicket, User


@login_required
def support_tickets(request):
    """
    Страница управления тикетами в кастомной админ-панели
    """
    try:
        status_filter = request.GET.get('status', '')
        source_filter = request.GET.get('source', '')
        search_query = request.GET.get('search', '')

        tickets = SupportTicket.objects.select_related('user').all()

        # Применяем фильтры
        if status_filter:
            tickets = tickets.filter(status=status_filter)
        
        if source_filter:
            tickets = tickets.filter(source=source_filter)
        
        if search_query:
            tickets = tickets.filter(
                Q(user__username__icontains=search_query) |
                Q(user__email__icontains=search_query) |
                Q(user__name__icontains=search_query) |
                Q(message__icontains=search_query)
            )

        # Сортируем по дате создания (новые первыми)
        tickets = tickets.order_by('-created_at')

        # Пагинация
        paginator = Paginator(tickets, 20)  # 20 тикетов на страницу
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)

        context = {
            'tickets': page_obj,
            'status_filter': status_filter,
            'source_filter': source_filter,
            'search_query': search_query,
            'total_tickets': tickets.count(),
        }
        
        return render(request, 'admin_panel/support_tickets.html', context)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Ошибка в support_tickets: {e}", exc_info=True)
        from django.http import HttpResponseServerError
        return HttpResponseServerError(f"Ошибка при загрузке тикетов: {str(e)}")


@login_required
@require_http_methods(["POST"])
def update_ticket_status(request, ticket_id):
    """
    Обновление статуса тикета
    """
    ticket = get_object_or_404(SupportTicket, id=ticket_id)
    
    new_status = request.POST.get('status')
    if new_status in dict(SupportTicket.STATUS_CHOICES):
        old_status = ticket.status
        ticket.status = new_status
        
        # Если тикет решен, устанавливаем дату решения
        if new_status == 'resolved' and old_status != 'resolved':
            from django.utils import timezone
            ticket.resolved_at = timezone.now()
        
        ticket.save()
        
        messages.success(request, f'Статус тикета #{ticket.id} обновлен на "{ticket.get_status_display()}"')
        return JsonResponse({'success': True, 'message': 'Статус обновлен'})
    else:
        return JsonResponse({'success': False, 'message': 'Неверный статус'})


@login_required
@require_http_methods(["POST"])
def add_ticket_response(request, ticket_id):
    """
    Добавление ответа администратора к тикету
    """
    ticket = get_object_or_404(SupportTicket, id=ticket_id)
    
    response_text = request.POST.get('response')
    if response_text:
        ticket.admin_response = response_text
        ticket.save()
        
        # Отправляем уведомление пользователю
        try:
            from api.support.services.notifications import notify_user_about_ticket_update
            notify_user_about_ticket_update(ticket, 'new_response')
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Ошибка при отправке уведомления о тикете: {e}")
            # Продолжаем выполнение даже если уведомление не отправилось
        
        messages.success(request, f'Ответ к тикету #{ticket.id} добавлен')
        return JsonResponse({'success': True, 'message': 'Ответ добавлен'})
    else:
        return JsonResponse({'success': False, 'message': 'Текст ответа не может быть пустым'})


@login_required
def ticket_detail(request, ticket_id):
    """
    Детальная страница тикета
    """
    ticket = get_object_or_404(SupportTicket, id=ticket_id)
    
    context = {
        'ticket': ticket
    }
    
    return render(request, 'admin_panel/ticket_detail.html', context)