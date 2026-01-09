# 🚀 Пошаговая настройка Railway - ПРЯМО СЕЙЧАС

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Два обязательных шага

### ШАГ 1: Установить Root Directory

1. В Railway Dashboard откройте ваш сервис **BirQadamFull**
2. Слева найдите и нажмите **"Settings"** (Настройки)
3. Прокрутите вниз до секции **"Service"**
4. Найдите поле **"Root Directory"**
5. Введите: `BirQadamDjango`
6. Нажмите **"Save"** (Сохранить)

**БЕЗ ЭТОГО Railway НЕ НАЙДЕТ ваш код!**

---

### ШАГ 2: Добавить переменные окружения

1. В Railway Dashboard откройте ваш сервис **BirQadamFull**
2. Слева найдите и нажмите **"Variables"** (Переменные)
3. Нажмите **"+ New Variable"** (Новая переменная)
4. Добавьте каждую переменную по очереди:

---

## 📋 СПИСОК ПЕРЕМЕННЫХ (копируйте по одной)

### 1. SECRET_KEY
```
Name: SECRET_KEY
Value: qizm65-+2tfs*^-z5lmo1q0ycwy8@k_p&s(@@-al7!r_%#0!m(
```

### 2. DEBUG
```
Name: DEBUG
Value: False
```

### 3. ALLOWED_HOSTS (временно используйте *)
```
Name: ALLOWED_HOSTS
Value: *
```
**Позже замените на ваш Railway домен**

### 4. USE_X_FORWARDED_HOST
```
Name: USE_X_FORWARDED_HOST
Value: True
```

### 5. USE_X_FORWARDED_PROTO
```
Name: USE_X_FORWARDED_PROTO
Value: True
```

### 6. CSRF_COOKIE_SECURE
```
Name: CSRF_COOKIE_SECURE
Value: True
```

### 7. SESSION_COOKIE_SECURE
```
Name: SESSION_COOKIE_SECURE
Value: True
```

### 8. EMAIL_HOST_USER
```
Name: EMAIL_HOST_USER
Value: kazban0v.beybit@gmail.com
```

### 9. EMAIL_HOST_PASSWORD
```
Name: EMAIL_HOST_PASSWORD
Value: rcmbqxaqarpofuyv
```

### 10. DEFAULT_FROM_EMAIL
```
Name: DEFAULT_FROM_EMAIL
Value: kazban0v.beybit@gmail.com
```

### 11. TELEGRAM_BOT_TOKEN
```
Name: TELEGRAM_BOT_TOKEN
Value: 8321441790:AAHuOthanfr8iK-W2bbbhRFAnaD1DwVSn9w
```
**⚠️ ВАЖНО: Если этот токен был показан публично - создайте новый!**

---

## 📋 Переменные для базы данных (после создания PostgreSQL)

### 12. DB_NAME
```
Name: DB_NAME
Value: ${PGDATABASE}
```
(Используйте переменную из PostgreSQL сервиса)

### 13. DB_USER
```
Name: DB_USER
Value: ${PGUSER}
```

### 14. DB_PASSWORD
```
Name: DB_PASSWORD
Value: ${PGPASSWORD}
```

### 15. DB_HOST
```
Name: DB_HOST
Value: ${PGHOST}
```

### 16. DB_PORT
```
Name: DB_PORT
Value: ${PGPORT}
```

---

## 📋 Переменные для Redis (после создания Redis)

### 17. REDIS_URL
```
Name: REDIS_URL
Value: ${REDIS_URL}
```

### 18. CELERY_BROKER_URL
```
Name: CELERY_BROKER_URL
Value: ${REDIS_URL}
```

### 19. CELERY_RESULT_BACKEND
```
Name: CELERY_RESULT_BACKEND
Value: ${REDIS_URL}
```

---

## 📋 CORS настройки (после получения домена)

После того как Railway создаст домен (например: `birqadam-production.up.railway.app`):

### 20. CORS_ALLOWED_ORIGINS
```
Name: CORS_ALLOWED_ORIGINS
Value: https://ваш-домен.railway.app
```
(Замените на ваш реальный домен)

### 21. CSRF_TRUSTED_ORIGINS
```
Name: CSRF_TRUSTED_ORIGINS
Value: https://ваш-домен.railway.app
```

### 22. FRONTEND_URL
```
Name: FRONTEND_URL
Value: https://ваш-фронтенд.railway.app
```
(Если есть отдельный фронтенд)

---

## ✅ Минимальный набор для старта (без БД и Redis)

Если база данных и Redis еще не созданы, добавьте хотя бы эти:

1. ✅ SECRET_KEY
2. ✅ DEBUG=False
3. ✅ ALLOWED_HOSTS=*
4. ✅ USE_X_FORWARDED_HOST=True
5. ✅ USE_X_FORWARDED_PROTO=True
6. ✅ CSRF_COOKIE_SECURE=True
7. ✅ SESSION_COOKIE_SECURE=True
8. ✅ EMAIL_HOST_USER
9. ✅ EMAIL_HOST_PASSWORD
10. ✅ DEFAULT_FROM_EMAIL
11. ✅ TELEGRAM_BOT_TOKEN

---

## 🔄 После добавления переменных

1. Railway автоматически перезапустит деплой
2. Следите за логами в **Deployments** → **Logs**
3. Если ошибки - проверьте что все переменные добавлены правильно

---

## ⚠️ Важно

- **Root Directory** ДОЛЖЕН быть установлен в `BirQadamDjango`
- **Переменные окружения** ДОЛЖНЫ быть добавлены в **Variables**
- После создания PostgreSQL и Redis - добавьте переменные для них

