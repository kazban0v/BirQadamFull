# 🔐 Настройка переменных окружения для Railway

## ⚠️ КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ О БЕЗОПАСНОСТИ

**ВЫ ПОКАЗАЛИ СВОИ СЕКРЕТНЫЕ ДАННЫЕ В ОТКРЫТОМ ВИДЕ!**

Немедленно выполните:
1. ✅ **Смените TELEGRAM_BOT_TOKEN** - создайте нового бота в @BotFather
2. ✅ **Смените пароль базы данных** (если это production база)
3. ✅ **Смените EMAIL_HOST_PASSWORD** (пароль приложения Gmail)
4. ✅ **Смените SECRET_KEY** (сгенерируйте новый)

---

## 📋 Переменные окружения для Railway

### Django Settings

```env
# ✅ ОБЯЗАТЕЛЬНО: Сгенерируйте новый SECRET_KEY!
SECRET_KEY=ваш-новый-секретный-ключ-сгенерируйте-через-django

# Production настройки
DEBUG=False
ALLOWED_HOSTS=ваш-проект.railway.app,*.railway.app,api.birqadam.kz

# SSL настройки (для Railway с HTTPS)
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PROTO=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=False  # Railway сам делает редирект
```

### Database (Railway PostgreSQL)

Railway автоматически создаст PostgreSQL и предоставит переменные:
- `DATABASE_URL` - полный URL подключения
- Или отдельные переменные:
  - `PGHOST` - хост
  - `PGPORT` - порт
  - `PGUSER` - пользователь
  - `PGPASSWORD` - пароль
  - `PGDATABASE` - имя базы

**В Railway Dashboard:**
1. Создайте PostgreSQL сервис
2. Скопируйте переменные из "Variables" вкладки
3. Добавьте в ваш сервис Django:

```env
DB_NAME=${PGDATABASE}
DB_USER=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}
```

### Redis (Railway Redis)

Railway автоматически создаст Redis:

```env
REDIS_URL=${REDIS_URL}  # Railway автоматически предоставит
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}
```

### CORS Settings

```env
CORS_ALLOWED_ORIGINS=https://ваш-проект.railway.app,https://ваш-фронтенд.railway.app
CSRF_TRUSTED_ORIGINS=https://ваш-проект.railway.app,https://ваш-фронтенд.railway.app
```

### Frontend URL

```env
FRONTEND_URL=https://ваш-фронтенд.railway.app
```

### Telegram Bot

```env
# ⚠️ ВАЖНО: Используйте НОВЫЙ токен после того как показали старый!
TELEGRAM_BOT_TOKEN=ваш-новый-токен-бота
```

### Email Settings

```env
EMAIL_HOST_USER=kazban0v.beybit@gmail.com
EMAIL_HOST_PASSWORD=ваш-новый-пароль-приложения-gmail
DEFAULT_FROM_EMAIL=kazban0v.beybit@gmail.com
```

### Firebase (опционально)

```env
FCM_SERVER_KEY=ваш-fcm-ключ
```

### Sentry (опционально)

```env
SENTRY_DSN=ваш-sentry-dsn
```

---

## 🚀 Пошаговая настройка в Railway

### 1. Создайте проект в Railway

1. Зайдите на [railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите GitHub репозиторий

### 2. Создайте сервисы

#### A. PostgreSQL Database
1. Нажмите "+ New" → "Database" → "PostgreSQL"
2. Railway автоматически создаст базу
3. Скопируйте переменные из "Variables"

#### B. Redis
1. Нажмите "+ New" → "Database" → "Redis"
2. Railway автоматически создаст Redis
3. Скопируйте `REDIS_URL` из "Variables"

#### C. Django Web Service
1. Нажмите "+ New" → "GitHub Repo"
2. Выберите ваш репозиторий
3. Railway определит Django автоматически
4. Добавьте все переменные окружения из списка выше

#### D. Telegram Bot Service
1. Нажмите "+ New" → "GitHub Repo"
2. Выберите тот же репозиторий
3. В настройках:
   - **Root Directory**: `BirQadamDjango`
   - **Start Command**: `python bot/bot.py`
4. Добавьте переменные окружения (те же что и для Django)

---

## 📝 Полный список переменных для Railway

Скопируйте и заполните в Railway Dashboard:

```env
# Django Core
SECRET_KEY=сгенерируйте-новый-ключ
DEBUG=False
ALLOWED_HOSTS=ваш-проект.railway.app,*.railway.app

# Database (из Railway PostgreSQL)
DB_NAME=${PGDATABASE}
DB_USER=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}

# Redis (из Railway Redis)
REDIS_URL=${REDIS_URL}
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}

# CORS
CORS_ALLOWED_ORIGINS=https://ваш-проект.railway.app
CSRF_TRUSTED_ORIGINS=https://ваш-проект.railway.app

# Frontend
FRONTEND_URL=https://ваш-фронтенд.railway.app

# SSL
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PROTO=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True

# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш-новый-токен

# Email
EMAIL_HOST_USER=kazban0v.beybit@gmail.com
EMAIL_HOST_PASSWORD=ваш-новый-пароль-приложения
DEFAULT_FROM_EMAIL=kazban0v.beybit@gmail.com

# Firebase (опционально)
FCM_SERVER_KEY=

# Sentry (опционально)
SENTRY_DSN=
```

---

## 🔒 Генерация нового SECRET_KEY

Выполните в терминале:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## ⚠️ Чеклист безопасности

- [ ] Сгенерирован новый SECRET_KEY
- [ ] Создан новый Telegram бот и получен новый токен
- [ ] Создан новый пароль приложения Gmail
- [ ] Старые токены/пароли отозваны
- [ ] .env файл добавлен в .gitignore
- [ ] Переменные окружения добавлены в Railway (не в код!)

---

## 📚 Полезные ссылки

- [Railway Documentation](https://docs.railway.app/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

