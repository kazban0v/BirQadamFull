# Инструкция по диагностике проблемы TrustFactor

## Что я исправил:

1. ✅ Улучшил метод `update_average_rating()` - теперь он явно принимает новую оценку и гарантированно учитывает её
2. ✅ Добавил более подробное логирование для отслеживания проблем

## Что мне нужно от вас для полной диагностики:

### ШАГ 1: Проверка в Django Shell

Откройте терминал и выполните:

```bash
cd BirQadamDjango
python manage.py shell
```

Затем выполните этот код:

```python
from core.models import User, Photo, TrustFactorHistory
from django.utils import timezone

# Найдите волонтера (замените на нужного)
volunteer = User.objects.filter(role='volunteer').first()
if not volunteer:
    print("Нет волонтеров в системе")
else:
    print(f"\n=== ИНФОРМАЦИЯ О ВОЛОНТЕРЕ ===")
    print(f"ID: {volunteer.id}")
    print(f"Username: {volunteer.username}")
    print(f"Trust Factor: {volunteer.trust_factor}")
    print(f"Average Rating: {volunteer.average_rating}")
    print(f"Consecutive Tasks: {volunteer.consecutive_completed_tasks}")
    print(f"Consecutive 5-star: {volunteer.consecutive_5star_photos}")
    
    # Проверьте последние фото с рейтингом
    photos = Photo.objects.filter(
        volunteer=volunteer, 
        rating__isnull=False
    ).order_by('-created_at')[:5]
    
    print(f"\n=== ПОСЛЕДНИЕ 5 ФОТО С РЕЙТИНГОМ ===")
    if photos:
        for p in photos:
            print(f"Photo ID {p.id}: rating={p.rating}, status={p.status}, created={p.created_at}")
    else:
        print("Нет фото с рейтингом")
    
    # Проверьте историю TF
    history = TrustFactorHistory.objects.filter(
        user=volunteer
    ).order_by('-created_at')[:10]
    
    print(f"\n=== ПОСЛЕДНИЕ 10 ИЗМЕНЕНИЙ TF ===")
    if history:
        for h in history:
            print(f"{h.created_at}: {h.old_value} -> {h.new_value} ({h.change_amount:+d}), reason={h.reason}")
    else:
        print("Нет истории изменений TF")
```

**Скопируйте и пришлите весь вывод этой команды.**

---

### ШАГ 2: Проверка логов сервера

1. Откройте терминал, где запущен Django сервер
2. Очистите экран (чтобы видеть только новые логи)
3. Выполните действие, которое не работает:
   - Оцените фото на 2 звезды
   - ИЛИ выйдите из проекта
4. Скопируйте все строки из логов, которые содержат:
   - `[RATING]`
   - `TF changed`
   - `average rating`
   - `Error`
   - `Exception`
   - `Traceback`

**Пришлите эти логи.**

---

### ШАГ 3: Проверка API запроса

1. Откройте браузер с DevTools (F12)
2. Перейдите на вкладку **Network**
3. Выполните действие (оцените фото или выйдите из проекта)
4. Найдите запрос к API (обычно `/custom-admin/api/v1/photo-reports/...` или `/custom-admin/api/v1/projects/.../leave/`)
5. Откройте этот запрос и скопируйте:
   - **Request Payload** (что отправлено на сервер)
   - **Response** (что вернул сервер)

**Пришлите скриншоты или скопированный текст.**

---

### ШАГ 4: Проверка миграций

Выполните в терминале:

```bash
cd BirQadamDjango
python manage.py showmigrations core | grep trust
```

**Пришлите результат.**

---

### ШАГ 5: Описание проблемы

Ответьте на вопросы:

1. **Что именно не работает?**
   - [ ] TF не изменяется после оценки фото
   - [ ] Рейтинг не изменяется после оценки фото  
   - [ ] TF не изменяется после выхода из проекта
   - [ ] История TF не отображается
   - [ ] Другое: ________________

2. **Когда это происходит?**
   - [ ] При оценке фото на 5 звезд
   - [ ] При оценке фото на 2 звезды
   - [ ] При выходе из проекта
   - [ ] Всегда

3. **Видите ли вы ошибки?**
   - В консоли браузера: ________________
   - В логах сервера: ________________
   - В ответе API: ________________

---

## Что я сделаю после получения информации:

1. ✅ Проанализирую все данные
2. ✅ Найду точную причину проблемы
3. ✅ Исправлю код
4. ✅ Добавлю дополнительные проверки
5. ✅ Предоставлю инструкции по проверке исправления

---

## Быстрая проверка прямо сейчас:

Если у вас есть доступ к базе данных, выполните эти SQL запросы:

```sql
-- 1. Проверка TF и рейтинга (замените <user_id>)
SELECT id, username, trust_factor, average_rating, 
       consecutive_completed_tasks, consecutive_5star_photos 
FROM core_user 
WHERE id = <user_id>;

-- 2. Последние изменения TF
SELECT created_at, old_value, new_value, change_amount, reason 
FROM core_trustfactorhistory 
WHERE user_id = <user_id> 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Последние фото с рейтингом
SELECT id, rating, status, volunteer_id, created_at 
FROM core_photo 
WHERE volunteer_id = <user_id> 
AND rating IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

**Пришлите результаты этих запросов.**

---

## Возможные проблемы, которые я уже исправил:

✅ **Проблема с обновлением рейтинга**: Метод `update_average_rating()` теперь явно принимает новую оценку и гарантированно учитывает её, даже если фото только что сохранено в транзакции.

✅ **Улучшено логирование**: Добавлены подробные логи на каждом этапе обновления TF и рейтинга.

---

**После того, как вы пришлете всю информацию, я смогу точно определить проблему и исправить её!**






