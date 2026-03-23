import json
from django.shortcuts import render
from django.http import HttpRequest, HttpResponse, JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
# from .models import Visit, Event  # <-- Раскомментируйте, когда создадите модели!

def home(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/index.html')

def services(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/services.html')

def instruction(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/instruction.html')

def admin_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/admin_guide.html')

def volunteer_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/volunteer_guide.html')

def organizer_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/organizer_guide.html')

# ----------------------------------------------------------------------
# API ДЛЯ СБОРА АНАЛИТИКИ
# ----------------------------------------------------------------------

# @csrf_exempt временно отключает защиту CSRF для этого API-эндпоинта.
# Это часто используется для простых API, но если вы отправляете CSRF-токен 
# с фронтенда (как мы настроили), лучше использовать @csrf_protect или 
# стандартную Django-защиту. Для простоты демонстрации оставим так:
@csrf_exempt 
@require_http_methods(["POST"])
def track_analytics_data(request):
    """
    Принимает объединенные данные о визите и событии в формате JSON.
    """
    try:
        # 1. Декодирование JSON-тела запроса
        data = json.loads(request.body.decode('utf-8'))
        
        user_id = data.get('user_id')
        visit_data = data.get('visit_data')
        event_data = data.get('event_data')
        
        if not user_id:
            return JsonResponse({'error': 'Missing user_id'}, status=400)
        
        processed_visit = False
        processed_event = False
        
        # 2. Обработка данных о визите (если они есть и это новый визит)
        # Мы проверяем, что тип визита — 'new', как мы его маркировали на фронтенде.
        if visit_data and visit_data.get('type') == 'new':
            # --- ЛОГИКА ЗАПИСИ ВИЗИТА ---
            # Visit.objects.create(
            #     user_id=user_id,
            #     type=visit_data.get('type'),
            #     url=visit_data.get('url'),
            #     # referrer: visit_data.get('referrer'),
            #     # timestamp: timezone.now(),
            # )
            print(f"ANALYTICS: New Visit Recorded for User ID {user_id} on {visit_data.get('url')}")
            processed_visit = True
        
        # 3. Обработка данных о событии (если присутствуют)
        if event_data and event_data.get('event_name') == 'click':
            # --- ЛОГИКА ЗАПИСИ СОБЫТИЯ ---
            # Event.objects.create(
            #     user_id=user_id,
            #     event_name=event_data.get('event_name'),
            #     action=event_data.get('action'), # Например: 'Telegram_Link_Clicked'
            #     url=event_data.get('url'),
            # )
            print(f"ANALYTICS: Click Event Recorded: {event_data.get('action')} by User ID {user_id}")
            processed_event = True
            
        # 4. Отправка успешного ответа
        if not processed_visit and not processed_event:
             return JsonResponse({'message': 'No new data received/processed.'}, status=200)

        return JsonResponse({
            'status': 'success',
            'visit_tracked': processed_visit,
            'event_tracked': processed_event,
            'user_id': user_id
        }, status=201)

    except json.JSONDecodeError:
        # Ошибка, если тело запроса не является валидным JSON
        return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    except Exception as e:
        # Обработка других возможных ошибок (например, при записи в базу данных)
        print(f"Tracking error: {e}")
        return JsonResponse({'error': 'Internal server error'}, status=500)