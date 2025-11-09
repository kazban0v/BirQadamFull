# 📖 Инструкция по использованию результатов аудита

**Дата проведения аудита:** 27 октября 2025

---

## 📂 Созданные файлы

В папке проекта созданы следующие документы:

1. **`AUDIT_REPORT.md`** - Полный детальный отчёт (32 проблемы)
2. **`КРАТКОЕ_РЕЗЮМЕ.md`** - Быстрое резюме на русском языке
3. **`CHECKLIST_ИСПРАВЛЕНИЙ.md`** - Чек-лист для отслеживания прогресса
4. **`README_AUDIT.md`** - Этот файл (инструкция)

---

## 🚀 С ЧЕГО НАЧАТЬ

### Шаг 1: Ознакомьтесь с результатами

1. **Быстрый обзор** → Прочитайте `КРАТКОЕ_РЕЗЮМЕ.md`
2. **Детальный анализ** → Изучите `AUDIT_REPORT.md`
3. **План действий** → Откройте `CHECKLIST_ИСПРАВЛЕНИЙ.md`

### Шаг 2: Исправьте критические проблемы

**⚠️ ВАЖНО:** Начните с критических проблем (🔴)

#### **Задача #1: Создать `.env` файл (КРИТИЧНО)**

**Где:** Backend проект (`C:\Users\User\Desktop\ItStartUp\CleanUpAlmatyV1`)

**Что делать:**

1. Создайте файл `.env` в корне проекта:

```bash
cd C:\Users\User\Desktop\ItStartUp\CleanUpAlmatyV1
notepad .env
```

2. Скопируйте содержимое:

```env
# Django
SECRET_KEY=генерируйте-новый-секретный-ключ-здесь
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,ваш-домен.kz

# Database
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=ваш-пароль-от-базы
DB_HOST=localhost
DB_PORT=5432

# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш-телеграм-токен

# Email
EMAIL_HOST_USER=ваш-email@gmail.com
EMAIL_HOST_PASSWORD=ваш-пароль-приложения
DEFAULT_FROM_EMAIL=ваш-email@gmail.com

# FCM
FCM_SERVER_KEY=ваш-fcm-ключ
```

3. Создайте `.env.example` (без реальных данных):

```bash
copy .env .env.example
```

Отредактируйте `.env.example` и замените реальные значения на плейсхолдеры.

4. Добавьте `.env` в `.gitignore`:

```bash
echo .env >> .gitignore
echo firebase-service-account.json >> .gitignore
```

5. **НЕ КОММИТЬТЕ `.env` в git!**

---

#### **Задача #2: Исправить Race Condition в Photo.approve()**

**Где:** `core/models.py`, строка 358

**Текущий код:**
```python
def approve(self, rating=None, feedback=None):
    photo = Photo.objects.select_for_update().get(pk=self.pk)
    if photo.status == 'approved':
        return
    # ... остальной код
```

**Исправленный код:**
```python
def approve(self, rating=None, feedback=None):
    from django.db import transaction
    
    with transaction.atomic():
        # Атомарное обновление с проверкой статуса
        updated = Photo.objects.filter(
            pk=self.pk,
            status='pending'  # ✅ Только pending фото
        ).update(
            status='approved',
            rating=rating,
            organizer_comment=feedback,
            moderated_at=timezone.now()
        )
        
        # Если обновление не произошло (уже approved)
        if updated == 0:
            logger.warning(f"Photo {self.pk} already processed")
            return False
        
        # Начисляем рейтинг только если обновление успешно
        if rating:
            volunteer = User.objects.select_for_update().get(pk=self.volunteer_id)
            volunteer.update_rating(rating)
        
        # ... остальная логика для задачи и активности
        
        return True
```

**Как протестировать:**
```python
# В Django shell
from core.models import Photo
photo = Photo.objects.get(pk=1)

# Имитируем два одновременных запроса
import threading

def approve_photo():
    photo.approve(rating=5)

t1 = threading.Thread(target=approve_photo)
t2 = threading.Thread(target=approve_photo)

t1.start()
t2.start()
t1.join()
t2.join()

# Проверяем что рейтинг начислен только один раз
```

---

#### **Задача #3: Настроить HTTPS для production**

**Flutter App (`lib/config/app_config.dart`):**

```dart
class AppConfig {
  // Определяем окружение
  static const bool isProduction = bool.fromEnvironment(
    'PRODUCTION',
    defaultValue: false,
  );

  // Базовый URL в зависимости от окружения
  static String get apiBaseUrl {
    if (isProduction) {
      return 'https://api.birqadam.kz';  // ✅ HTTPS для production
    } else {
      // Для разработки
      return const String.fromEnvironment(
        'API_URL',
        defaultValue: 'http://10.0.2.2:8000',
      );
    }
  }
  
  // ... остальной код
}
```

**Запуск:**
```bash
# Development
flutter run

# Production
flutter run --dart-define=PRODUCTION=true

# Build production APK
flutter build apk --release --dart-define=PRODUCTION=true
```

---

#### **Задача #4: Исправить normalize_phone()**

**Где:** `core/utils.py`

**Исправленная версия:**

```python
def normalize_phone(phone):
    """
    Нормализует номер телефона к формату +77XXXXXXXXX (Казахстан)
    """
    if not phone:
        return phone
    
    # Удаляем пробелы, скобки, дефисы
    phone = phone.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')
    
    # Удаляем + для унификации
    if phone.startswith('+'):
        phone = phone[1:]
    
    # Обработка казахстанских номеров
    if phone.startswith('8') and len(phone) == 11:
        # 87XXXXXXXXX → +77XXXXXXXXX
        phone = '+7' + phone[1:]
    elif phone.startswith('77') and len(phone) == 11:
        # 77XXXXXXXXX → +77XXXXXXXXX
        phone = '+' + phone
    elif phone.startswith('7') and len(phone) == 11:
        # 7XXXXXXXXXX → +7XXXXXXXXXX
        phone = '+' + phone
    elif len(phone) == 10 and phone.startswith('7'):
        # 7XXXXXXXXX (без кода страны) → +77XXXXXXXXX
        phone = '+7' + phone
    elif len(phone) == 10:
        # XXXXXXXXXX → +77XXXXXXXXXX
        phone = '+77' + phone
    else:
        # Любой другой случай
        if not phone.startswith('+'):
            phone = '+' + phone
    
    logger.debug(f"📱 Normalized: {phone}")
    return phone
```

**Unit Test:**

```python
# tests/test_utils.py
from django.test import TestCase
from core.utils import normalize_phone

class PhoneNormalizationTest(TestCase):
    def test_kazakhstan_formats(self):
        """Тест казахстанских форматов"""
        # Формат 8 (7XX) XXX-XX-XX
        self.assertEqual(normalize_phone('87012345678'), '+77012345678')
        
        # Формат +7 7XX XXX XX XX
        self.assertEqual(normalize_phone('+77012345678'), '+77012345678')
        
        # Формат 7 7XX XXX XX XX
        self.assertEqual(normalize_phone('77012345678'), '+77012345678')
        
        # С пробелами и дефисами
        self.assertEqual(normalize_phone('8 (701) 234-56-78'), '+77012345678')
        self.assertEqual(normalize_phone('+7 701 234 56 78'), '+77012345678')
    
    def test_edge_cases(self):
        """Тест граничных случаев"""
        self.assertEqual(normalize_phone(''), '')
        self.assertEqual(normalize_phone(None), None)
```

**Запуск тестов:**
```bash
python manage.py test tests.test_utils
```

---

### Шаг 3: Настройте Monitoring (Sentry)

1. **Создайте аккаунт:** https://sentry.io

2. **Установите пакет:**
```bash
pip install sentry-sdk
```

3. **Настройте в `settings.py`:**
```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

if not DEBUG:
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment='production'
    )
```

4. **Добавьте в `.env`:**
```env
SENTRY_DSN=ваш-sentry-dsn
```

---

### Шаг 4: Настройте Celery для фоновых задач

1. **Установите пакеты:**
```bash
pip install celery redis
```

2. **Создайте `celery.py`:**
```python
# volunteer_project/celery.py
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')

app = Celery('volunteer_project')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

3. **Обновите `settings.py`:**
```python
# Celery Configuration
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Almaty'
```

4. **Запустите Celery worker:**
```bash
celery -A volunteer_project worker -l INFO
```

---

## 📊 Tracking прогресса

### Используйте чек-лист

Откройте `CHECKLIST_ИСПРАВЛЕНИЙ.md` и отмечайте выполненные задачи:

```markdown
- [x] #1 - Создать .env файл ✅
  - [x] Создать файл
  - [x] Переместить SECRET_KEY
  - [x] Добавить в .gitignore
```

### Измеряйте прогресс

Обновляйте секцию "ПРОГРЕСС" в чек-листе:

```markdown
**Выполнено:** 5 / 32 (15.6%)

🔴 Критические:  3 / 5  (60%)
🟠 Серьёзные:    1 / 8  (12.5%)
```

---

## 🆘 Помощь и поддержка

### Если что-то не понятно:

1. **Детали проблемы** → Смотрите в `AUDIT_REPORT.md`
2. **Примеры кода** → Там же в разделе "Решение"
3. **Приоритеты** → В разделе "Рекомендации по приоритетам"

### Если нужна помощь:

1. Опишите проблему детально
2. Укажите номер проблемы из отчёта (например, "#2 - Race Condition")
3. Приложите лог ошибки (если есть)

---

## 📚 Полезные ресурсы

### Django

- [Django Security](https://docs.djangoproject.com/en/5.2/topics/security/)
- [Django Performance](https://docs.djangoproject.com/en/5.2/topics/performance/)
- [Celery Documentation](https://docs.celeryproject.org/)

### Flutter

- [Flutter Best Practices](https://flutter.dev/docs/development/data-and-backend/state-mgmt/options)
- [Firebase for Flutter](https://firebase.flutter.dev/)

### Security

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Django Security Checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/)

---

## ✅ Финальный чек-лист перед запуском

**Перед выкладкой в production, убедитесь что:**

- [x] `.env` файл создан и все секреты перенесены
- [x] `.env` добавлен в `.gitignore`
- [x] `firebase-service-account.json` в `.gitignore`
- [x] Race conditions исправлены
- [x] HTTPS настроен для production
- [x] `normalize_phone()` работает корректно
- [x] Sentry настроен для мониторинга
- [x] Celery настроен для фоновых задач
- [x] Rate limiting настроен
- [x] CORS правильно настроен
- [x] SSL сертификат установлен
- [x] Database backups настроены
- [x] Автоматические тесты пройдены

---

**Удачи в исправлении! 🚀**

---

**Контакты:** Если нужна помощь, обращайтесь к автору отчёта.  
**Версия:** 1.0  
**Дата:** 27 октября 2025

