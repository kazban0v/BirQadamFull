# 📝 Инструкция по коммиту и пушу изменений в Git

## 🔍 Проверка текущего состояния

Сначала проверим, есть ли уже Git репозиторий:

```bash
cd C:\Users\User\Desktop\BirQadamFull-main
git status
```

---

## 📋 Вариант 1: Если репозиторий уже существует (подключен к GitHub)

### Шаг 1: Проверка изменений
```bash
git status
```

### Шаг 2: Добавление всех изменений
```bash
git add .
```

### Шаг 3: Коммит с описанием
```bash
git commit -m "Подготовка к деплою на Railway: исправлены пути к файлам, добавлены конфигурационные файлы для Railway"
```

### Шаг 4: Пуш в репозиторий
```bash
git push origin main
```
(или `git push origin master` если ваша ветка называется master)

---

## 📋 Вариант 2: Если репозитория нет (нужно создать новый)

### Шаг 1: Инициализация Git репозитория
```bash
cd C:\Users\User\Desktop\BirQadamFull-main
git init
```

### Шаг 2: Добавление всех файлов
```bash
git add .
```

### Шаг 3: Первый коммит
```bash
git commit -m "Initial commit: BirQadam project with Railway deployment configuration"
```

### Шаг 4: Подключение к GitHub репозиторию
```bash
# Если репозиторий уже создан на GitHub:
git remote add origin https://github.com/ваш-username/ваш-репозиторий.git

# Или если используете SSH:
git remote add origin git@github.com:ваш-username/ваш-репозиторий.git
```

### Шаг 5: Пуш в GitHub
```bash
git branch -M main
git push -u origin main
```

---

## 📋 Вариант 3: Если нужно обновить существующий репозиторий

### Шаг 1: Проверка текущей ветки
```bash
git branch
```

### Шаг 2: Добавление изменений
```bash
git add .
```

### Шаг 3: Коммит
```bash
git commit -m "Подготовка к деплою на Railway

- Исправлены пути к файлам в Telegram боте
- Добавлены Procfile и Procfile.bot для Railway
- Добавлены конфигурационные файлы для деплоя
- Исправлены настройки CORS и CSRF для production
- Добавлены инструкции по деплою"
```

### Шаг 4: Пуш
```bash
git push
```

---

## ⚠️ Важно: Проверка перед коммитом

### Убедитесь что .env файл НЕ закоммичен:
```bash
git check-ignore .env
git check-ignore BirQadamDjango/.env
```

Если файлы не игнорируются, добавьте их:
```bash
# Проверьте что .gitignore содержит:
# .env
# .env.*
# /BirQadamDjango/.env
```

---

## 📝 Что будет закоммичено

### Новые файлы:
- ✅ `BirQadamDjango/Procfile` - для Django сервиса
- ✅ `BirQadamDjango/Procfile.bot` - для Telegram бота
- ✅ `BirQadamDjango/railway.json` - конфигурация Railway
- ✅ `BirQadamDjango/RAILWAY_DEPLOYMENT_GUIDE.md` - инструкция по деплою
- ✅ `BirQadamDjango/RAILWAY_ENV_VARIABLES.md` - переменные окружения
- ✅ `BirQadamDjango/RAILWAY_DEPLOYMENT_CHECK.md` - отчет о проверке
- ✅ `BirQadamDjango/RAILWAY_ENV_SETUP.md` - настройка переменных
- ✅ `BirQadamDjango/SECURITY_WARNING.md` - предупреждение о безопасности
- ✅ `BirQadamDjango/about_site/context_processors.py` - context processor для FRONTEND_URL

### Измененные файлы:
- ✅ `BirQadamDjango/bot/bot.py` - исправлены пути к логам
- ✅ `BirQadamDjango/bot/telegram_bot.py` - исправлен путь к persistence файлу
- ✅ `BirQadamDjango/volunteer_project/settings.py` - исправлены CORS и CSRF настройки
- ✅ `BirQadamDjango/frontend/src/services/http.ts` - исправлен fallback URL
- ✅ `BirQadamDjango/about_site/templates/*.html` - исправлены ссылки на фронтенд

---

## 🚫 Что НЕ должно быть закоммичено

- ❌ `.env` файлы (должны быть в .gitignore)
- ❌ `firebase-service-account.json` (секретный файл)
- ❌ `__pycache__/` папки
- ❌ `node_modules/` папки
- ❌ `*.log` файлы
- ❌ `media/` папка (пользовательские загрузки)

---

## ✅ Быстрая команда (если репозиторий уже настроен)

```bash
cd C:\Users\User\Desktop\BirQadamFull-main
git add .
git commit -m "Подготовка к деплою на Railway"
git push
```

---

## 🔍 Проверка после пуша

После пуша проверьте на GitHub:
1. Все файлы загружены
2. `.env` файл НЕ виден в репозитории
3. Все изменения на месте

---

## 📚 Полезные команды

```bash
# Просмотр изменений перед коммитом
git diff

# Просмотр статуса
git status

# Просмотр истории коммитов
git log --oneline

# Отмена последнего коммита (если нужно)
git reset --soft HEAD~1
```

