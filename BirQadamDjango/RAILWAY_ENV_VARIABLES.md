# 🔐 Переменные окружения для Railway

## ✅ Ваши данные

- **SECRET_KEY**: `qizm65-+2tfs*^-z5lmo1q0ycwy8@k_p&s(@@-al7!r_%#0!m(`
- **EMAIL_HOST_PASSWORD**: `rcmbqxaqarpofuyv` (без пробелов)
- **БД**: Используем существующую (данные там есть)

---

## 📋 Полный список переменных для Railway Dashboard

Скопируйте эти переменные в Railway Dashboard → Ваш сервис → Variables:

```env
# ============================================
# Django Core Settings
# ============================================
SECRET_KEY=qizm65-+2tfs*^-z5lmo1q0ycwy8@k_p&s(@@-al7!r_%#0!m(
DEBUG=False
ALLOWED_HOSTS=ваш-проект.railway.app,*.railway.app,api.birqadam.kz

# ============================================
# SSL & Security (для Railway HTTPS)
# ============================================
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PROTO=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=False

# ============================================
# Database (из Railway PostgreSQL)
# ⚠️ Railway автоматически создаст PostgreSQL
# Скопируйте эти переменные из Railway PostgreSQL сервиса
# ============================================
DB_NAME=${PGDATABASE}
DB_USER=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}

# Или если Railway предоставляет DATABASE_URL:
# DATABASE_URL=${DATABASE_URL}

# ============================================
# Redis (из Railway Redis)
# ⚠️ Railway автоматически создаст Redis
# ============================================
REDIS_URL=${REDIS_URL}
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}

# ============================================
# CORS Settings
# ⚠️ Замените на ваш реальный Railway домен
# ============================================
CORS_ALLOWED_ORIGINS=https://ваш-проект.railway.app,https://ваш-фронтенд.railway.app
CSRF_TRUSTED_ORIGINS=https://ваш-проект.railway.app,https://ваш-фронтенд.railway.app

# ============================================
# Frontend URL
# ⚠️ Замените на ваш реальный Railway домен фронтенда
# ============================================
FRONTEND_URL=https://ваш-фронтенд.railway.app

# ============================================
# Email Settings (Gmail)
# ============================================
EMAIL_HOST_USER=kazban0v.beybit@gmail.com
EMAIL_HOST_PASSWORD=rcmbqxaqarpofuyv
DEFAULT_FROM_EMAIL=kazban0v.beybit@gmail.com

# ============================================
# Telegram Bot
# ⚠️ Нужно создать новый токен если старый был показан
# ============================================
TELEGRAM_BOT_TOKEN=ваш-новый-токен-бота

# ============================================
# Firebase (опционально)
# ============================================
FCM_SERVER_KEY=

# ============================================
# Sentry (опционально)
# ============================================
SENTRY_DSN=
```

---

## ⚠️ ВАЖНО: Замените плейсхолдеры

1. **`ваш-проект.railway.app`** - замените на реальный домен Railway (например: `birqadam-production.up.railway.app`)
2. **`ваш-фронтенд.railway.app`** - замените на домен фронтенда (если есть отдельный сервис)
3. **`${PGDATABASE}`, `${PGUSER}`, и т.д.** - Railway автоматически подставит значения из PostgreSQL сервиса
4. **`${REDIS_URL}`** - Railway автоматически подставит значение из Redis сервиса

---

## 🔄 Как использовать переменные из других сервисов в Railway

Railway позволяет ссылаться на переменные других сервисов:

1. Создайте PostgreSQL сервис → Railway покажет переменные: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
2. Создайте Redis сервис → Railway покажет переменную: `REDIS_URL`
3. В вашем Django сервисе используйте: `${PGDATABASE}`, `${REDIS_URL}` и т.д.

Railway автоматически подставит значения!

---

## 📝 Пошаговая инструкция

### Шаг 1: Создайте PostgreSQL
1. В Railway Dashboard нажмите "+ New" → "Database" → "PostgreSQL"
2. Railway создаст базу и покажет переменные
3. Запомните названия переменных (PGHOST, PGPORT, и т.д.)

### Шаг 2: Создайте Redis
1. Нажмите "+ New" → "Database" → "Redis"
2. Railway создаст Redis и покажет `REDIS_URL`

### Шаг 3: Создайте Django Web Service
1. Нажмите "+ New" → "GitHub Repo"
2. Выберите ваш репозиторий
3. Railway определит Django
4. В настройках сервиса:
   - **Root Directory**: `BirQadamDjango`
5. Перейдите в "Variables" и добавьте все переменные из списка выше

### Шаг 4: Создайте Telegram Bot Service
1. Нажмите "+ New" → "GitHub Repo"
2. Выберите тот же репозиторий
3. В настройках:
   - **Root Directory**: `BirQadamDjango`
   - **Start Command**: `python bot/bot.py`
4. В "Variables" добавьте те же переменные что и для Django

---

## ✅ Чеклист

- [ ] PostgreSQL сервис создан
- [ ] Redis сервис создан
- [ ] Django Web Service создан
- [ ] Telegram Bot Service создан
- [ ] Все переменные окружения добавлены
- [ ] Заменены плейсхолдеры на реальные домены
- [ ] TELEGRAM_BOT_TOKEN обновлен (если старый был показан)

