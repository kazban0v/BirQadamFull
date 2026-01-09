# 🚀 Полная инструкция по деплою на Railway

## ✅ Подготовка завершена

- ✅ Новый SECRET_KEY создан
- ✅ Пароль приложения Gmail создан
- ✅ Код проверен на ошибки
- ✅ Файлы для Railway созданы

---

## 📋 Шаг 1: Создание проекта в Railway

1. Зайдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите **"New Project"**
4. Выберите **"Deploy from GitHub repo"**
5. Выберите ваш репозиторий `BirQadamFull-main`

---

## 📋 Шаг 2: Создание PostgreSQL базы данных

1. В проекте Railway нажмите **"+ New"**
2. Выберите **"Database"** → **"PostgreSQL"**
3. Railway автоматически создаст базу
4. **Важно:** Запомните или скопируйте переменные из вкладки **"Variables"**:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

---

## 📋 Шаг 3: Создание Redis

1. Нажмите **"+ New"**
2. Выберите **"Database"** → **"Redis"**
3. Railway автоматически создаст Redis
4. Скопируйте `REDIS_URL` из вкладки **"Variables"**

---

## 📋 Шаг 4: Создание Django Web Service

1. Нажмите **"+ New"**
2. Выберите **"GitHub Repo"**
3. Выберите тот же репозиторий `BirQadamFull-main`
4. Railway определит Django автоматически
5. В настройках сервиса:
   - **Root Directory**: `BirQadamDjango`
   - **Start Command**: (оставьте пустым, Railway использует Procfile)

### Добавление переменных окружения:

Перейдите в **"Variables"** и добавьте:

```env
# Django Core
SECRET_KEY=qizm65-+2tfs*^-z5lmo1q0ycwy8@k_p&s(@@-al7!r_%#0!m(
DEBUG=False
ALLOWED_HOSTS=ваш-проект.railway.app,*.railway.app,api.birqadam.kz

# SSL & Security
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PROTO=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=False

# Database (из PostgreSQL сервиса)
DB_NAME=${PGDATABASE}
DB_USER=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}

# Redis (из Redis сервиса)
REDIS_URL=${REDIS_URL}
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}

# CORS (замените на ваш реальный домен!)
CORS_ALLOWED_ORIGINS=https://ваш-проект.railway.app
CSRF_TRUSTED_ORIGINS=https://ваш-проект.railway.app

# Frontend (замените на ваш реальный домен!)
FRONTEND_URL=https://ваш-фронтенд.railway.app

# Email
EMAIL_HOST_USER=kazban0v.beybit@gmail.com
EMAIL_HOST_PASSWORD=rcmbqxaqarpofuyv
DEFAULT_FROM_EMAIL=kazban0v.beybit@gmail.com

# Telegram Bot (⚠️ создайте новый токен если старый был показан!)
TELEGRAM_BOT_TOKEN=ваш-новый-токен-бота

# Firebase (опционально)
FCM_SERVER_KEY=

# Sentry (опционально)
SENTRY_DSN=
```

**⚠️ ВАЖНО:** 
- Замените `ваш-проект.railway.app` на реальный домен (Railway покажет его после деплоя)
- Замените `ваш-фронтенд.railway.app` на домен фронтенда (если есть)
- `${PGDATABASE}`, `${REDIS_URL}` и т.д. - Railway автоматически подставит значения

---

## 📋 Шаг 5: Создание Telegram Bot Service

1. Нажмите **"+ New"**
2. Выберите **"GitHub Repo"**
3. Выберите тот же репозиторий `BirQadamFull-main`
4. В настройках сервиса:
   - **Root Directory**: `BirQadamDjango`
   - **Start Command**: `python bot/bot.py`

### Добавление переменных окружения:

Добавьте **те же самые переменные** что и для Django Web Service (копируйте из Django сервиса).

---

## 📋 Шаг 6: Настройка домена

1. В Django Web Service перейдите в **"Settings"**
2. Нажмите **"Generate Domain"** или **"Custom Domain"**
3. Railway создаст домен типа: `birqadam-production.up.railway.app`
4. **Скопируйте этот домен** и обновите переменные:
   - `ALLOWED_HOSTS` - добавьте ваш домен
   - `CORS_ALLOWED_ORIGINS` - добавьте `https://ваш-домен.railway.app`
   - `CSRF_TRUSTED_ORIGINS` - добавьте `https://ваш-домен.railway.app`

---

## 📋 Шаг 7: Деплой

1. Railway автоматически начнет деплой после добавления репозитория
2. Следите за логами в **"Deployments"** вкладке
3. Если есть ошибки - проверьте логи

---

## 🔍 Проверка работы

### Django API:
1. Откройте ваш Railway домен: `https://ваш-проект.railway.app`
2. Проверьте health check: `https://ваш-проект.railway.app/health/`

### Telegram Bot:
1. Найдите вашего бота в Telegram
2. Отправьте `/start`
3. Бот должен ответить

---

## ⚠️ Частые проблемы

### Проблема: "ALLOWED_HOSTS must be set"
**Решение:** Добавьте ваш Railway домен в `ALLOWED_HOSTS`

### Проблема: "Database connection failed"
**Решение:** Проверьте что переменные `DB_*` правильно ссылаются на PostgreSQL сервис через `${PGDATABASE}` и т.д.

### Проблема: "Redis connection failed"
**Решение:** Проверьте что `REDIS_URL=${REDIS_URL}` правильно ссылается на Redis сервис

### Проблема: "Telegram bot not responding"
**Решение:** 
1. Проверьте что `TELEGRAM_BOT_TOKEN` правильный
2. Проверьте логи Telegram Bot Service
3. Убедитесь что бот запущен (в Railway Dashboard должно быть "Running")

---

## 📝 Чеклист после деплоя

- [ ] Django Web Service запущен и доступен
- [ ] Telegram Bot Service запущен
- [ ] Health check работает: `/health/`
- [ ] База данных подключена (проверьте логи)
- [ ] Redis подключен (проверьте логи)
- [ ] Email отправляется (протестируйте отправку)
- [ ] Telegram бот отвечает на команды
- [ ] Домен настроен и работает

---

## 🎉 Готово!

Ваш проект должен быть задеплоен на Railway!

Если возникнут проблемы - проверьте логи в Railway Dashboard и сообщите мне.

