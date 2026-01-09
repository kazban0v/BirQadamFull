# 🔧 Исправление ошибки деплоя на Railway

## ❌ Проблема

Railway не может найти Procfile или неправильно настроен root directory.

---

## ✅ Решение

### Вариант 1: Настройка Root Directory в Railway Dashboard

1. В Railway Dashboard откройте ваш сервис **BirQadamFull**
2. Перейдите в **Settings**
3. Найдите **Root Directory**
4. Установите: `BirQadamDjango`
5. Сохраните изменения
6. Railway автоматически перезапустит деплой

### Вариант 2: Создать Procfile в корне проекта (альтернатива)

Если Railway не может найти Procfile в подпапке, создайте его в корне:

**Создайте файл `Procfile` в корне проекта** (рядом с .gitignore):

```
web: cd BirQadamDjango && python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn volunteer_project.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120
```

---

## 🔍 Проверка логов

В Railway Dashboard:
1. Откройте ваш сервис
2. Перейдите в **Deployments**
3. Нажмите на последний deployment
4. Посмотрите **Logs**

**Типичные ошибки:**

### Ошибка: "No Procfile found"
**Решение:** Установите Root Directory = `BirQadamDjango` в Settings

### Ошибка: "ModuleNotFoundError"
**Решение:** Проверьте что `requirements.txt` находится в `BirQadamDjango/`

### Ошибка: "ALLOWED_HOSTS must be set"
**Решение:** Добавьте переменную окружения `ALLOWED_HOSTS` в Railway Variables

### Ошибка: "Database connection failed"
**Решение:** 
1. Создайте PostgreSQL сервис в Railway
2. Добавьте переменные `DB_NAME=${PGDATABASE}`, `DB_HOST=${PGHOST}` и т.д.

---

## 📋 Чеклист для Railway

- [ ] Root Directory установлен: `BirQadamDjango`
- [ ] PostgreSQL сервис создан
- [ ] Redis сервис создан (если нужен)
- [ ] Все переменные окружения добавлены
- [ ] `ALLOWED_HOSTS` содержит ваш Railway домен
- [ ] `SECRET_KEY` задан
- [ ] `DEBUG=False`

---

## 🚀 После исправления

1. Railway автоматически перезапустит деплой
2. Следите за логами
3. Если ошибки - проверьте логи и исправьте проблемы

