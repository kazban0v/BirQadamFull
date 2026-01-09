# BirQadam Backend - Django REST API 🌱

<div align="center">
  <img src="https://raw.githubusercontent.com/kazban0v/TazaQala-mobile-app-/main/assets/images/logo_birqadam.png" alt="BirQadam Logo" width="200"/>
  
  **Backend API для мобильного приложения BirQadam**
  
  [![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
  [![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
  [![DRF](https://img.shields.io/badge/DRF-3.15-red.svg)](https://www.django-rest-framework.org/)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
</div>

---

## 📖 О проекте

**BirQadam** (ранее CleanUpAlmaty) - это комплексная платформа для управления волонтерскими проектами, включающая:

- 🌐 **Backend API** (Django REST Framework) - этот репозиторий
- 📱 **Mobile App** ([Flutter](https://github.com/kazban0v/TazaQala-mobile-app-)) для iOS и Android
- 🤖 **Telegram Bot** для уведомлений и регистрации
- 🎨 **Admin Panel** с расширенным функционалом

---

## ✨ Основные возможности

### 🔐 Аутентификация и авторизация
- JWT токены для мобильного приложения
- Session authentication для веб-панели
- Регистрация через приложение и Telegram
- Привязка аккаунтов (app + telegram)
- Роли: Волонтер, Организатор, Администратор

### 📊 Управление проектами
- CRUD операции для проектов
- Управление задачами с дедлайнами
- Назначение волонтеров на задачи
- Статусы задач (pending, in_progress, completed)
- Фотоотчеты с модерацией

### 👥 Система пользователей
- Профили с рейтингом
- Система достижений
- История участия в проектах
- Статистика активности
- Геолокация пользователей

### 🔔 Уведомления
- **Push-уведомления** (Firebase Cloud Messaging)
- **Email-уведомления** (SMTP)
- **Telegram-уведомления** (Bot API)
- Массовые рассылки с фильтрацией
- Шаблоны уведомлений

### 📈 Административная панель
- Расширенная аналитика
- Глобальный поиск
- Интерактивная карта активности
- Экспорт данных (CSV, JSON, PDF)
- Управление правами доступа
- Модерация контента

---

## 🛠 Технологии

### Backend
- **Django** 5.2 - Web framework
- **Django REST Framework** 3.15 - API
- **PostgreSQL** - Production database
- **SQLite** - Development database
- **Celery** - Асинхронные задачи
- **Redis** - Кэширование

### Интеграции
- **Firebase Admin SDK** - Push-уведомления
- **Python Telegram Bot** - Telegram интеграция
- **SMTP** - Email рассылки
- **JWT** - Токены аутентификации

### Инструменты
- **Git** - Контроль версий
- **Docker** - Контейнеризация
- **GitHub Actions** - CI/CD
- **Gunicorn** - WSGI сервер
- **Nginx** - Reverse proxy

---

## 🚀 Быстрый старт

### Предварительные требования

- Python 3.11+
- pip
- Git
- PostgreSQL (опционально, для production)

### Установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/kazban0v/CleanUpAlmaty.git
cd CleanUpAlmaty

# 2. Создайте виртуальное окружение
python -m venv benv

# 3. Активируйте виртуальное окружение
# Windows:
.\benv\Scripts\activate
# Linux/Mac:
source benv/bin/activate

# 4. Установите зависимости
pip install -r requirements.txt

# 5. Создайте файл .env
cp .env.example .env
# Отредактируйте .env и добавьте свои ключи

# 6. Примените миграции
python manage.py migrate

# 7. Создайте суперпользователя
python manage.py createsuperuser

# 8. Запустите сервер разработки
python manage.py runserver
```

Сервер будет доступен по адресу: `http://127.0.0.1:8000/`

---

## 🤖 Запуск Telegram бота

```bash
# В отдельном терминале:
cd telegram
python bot.py
```

Подробная инструкция: [bot/README.md](bot/README.md)

---

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (PostgreSQL)
DB_NAME=birqadam_db
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432

# Firebase
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# JWT
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DELTA=3600
```

### Firebase Setup

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/)
2. Скачайте `firebase-service-account.json`
3. Поместите файл в корень проекта
4. Добавьте путь в `.env`

---

## 📂 Структура проекта

```
CleanUpAlmatyV1/
├── about_site/                    # Информационные страницы
│   ├── static/                    # CSS, JS, файлы
│   └── templates/                 # HTML шаблоны
│
├── core/                          # Основная бизнес-логика
│   ├── models.py                  # User, Project, Task, Achievement
│   ├── views.py                   # API endpoints
│   ├── utils.py                   # Вспомогательные функции
│   └── signals.py                 # Django signals
│
├── custom_admin/                  # Расширенная админ-панель
│   ├── views.py                   # Административные представления
│   ├── notification_service.py    # Сервис уведомлений
│   ├── fcm_modern.py              # Firebase интеграция
│   └── templates/                 # Админ шаблоны
│       ├── analytics.html         # Аналитика
│       ├── bulk_notifications.html # Массовые рассылки
│       ├── activity_map.html      # Карта активности
│       └── global_search.html     # Глобальный поиск
│
├── bot/                      # Telegram бот
│   ├── bot.py                     # Основной файл бота
│   ├── volunteer_handlers.py      # Обработчики для волонтеров
│   ├── organization_handlers.py   # Обработчики для организаторов
│   └── README.md                  # Документация бота
│
├── volunteer_project/             # Настройки Django
│   ├── settings.py                # Конфигурация
│   ├── urls.py                    # URL роутинг
│   └── wsgi.py                    # WSGI точка входа
│
├── media/                         # Загруженные файлы
│   ├── avatars/                   # Аватары пользователей
│   ├── photos/                    # Фото проектов
│   └── tasks/                     # Фото задач
│
├── docs/                          # Документация
│   ├── api/                       # API документация
│   ├── deployment/                # Гайды по деплою
│   └── development/               # Гайды для разработчиков
│
├── scripts/                       # Утилиты
│   ├── cleanup_project.py         # Очистка проекта
│   └── unlock_all_achievements.py # Разблокировка достижений
│
├── requirements.txt               # Python зависимости
├── manage.py                      # Django CLI
├── .env.example                   # Пример переменных окружения
├── .gitignore                     # Git ignore правила
└── README.md                      # Этот файл
```

---

## 🔌 API Endpoints

### Аутентификация

```http
POST   /custom-admin/api/login/           # Вход (JWT)
POST   /custom-admin/api/register/        # Регистрация
POST   /custom-admin/api/refresh/         # Обновление токена
POST   /custom-admin/api/logout/          # Выход
```

### Пользователи

```http
GET    /custom-admin/api/users/           # Список пользователей
GET    /custom-admin/api/users/<id>/      # Профиль пользователя
PUT    /custom-admin/api/users/<id>/      # Обновление профиля
DELETE /custom-admin/api/users/<id>/      # Удаление пользователя
```

### Проекты

```http
GET    /custom-admin/api/projects/        # Список проектов
POST   /custom-admin/api/projects/        # Создание проекта
GET    /custom-admin/api/projects/<id>/   # Детали проекта
PUT    /custom-admin/api/projects/<id>/   # Обновление проекта
DELETE /custom-admin/api/projects/<id>/   # Удаление проекта
```

### Задачи

```http
GET    /custom-admin/api/tasks/           # Список задач
POST   /custom-admin/api/tasks/           # Создание задачи
PUT    /custom-admin/api/tasks/<id>/      # Обновление задачи
POST   /custom-admin/api/tasks/<id>/join/ # Присоединиться к задаче
```

### Уведомления

```http
POST   /custom-admin/api/bulk-notifications/              # Массовая рассылка
GET    /custom-admin/api/bulk-notifications/preview/      # Предпросмотр получателей
GET    /custom-admin/api/notifications/<id>/              # История уведомления
```

### Аналитика

```http
GET    /custom-admin/api/analytics/stats/                 # Статистика
GET    /custom-admin/api/analytics/map/                   # Данные карты
GET    /custom-admin/api/search/                          # Глобальный поиск
```

Полная документация API: [docs/api/README.md](docs/api/README.md)

---

## 🧪 Тестирование

```bash
# Запустить все тесты
python manage.py test

# Запустить тесты конкретного приложения
python manage.py test core

# Проверка покрытия
coverage run --source='.' manage.py test
coverage report
```

---

## 🚢 Деплой

### Production с Docker

```bash
# 1. Соберите образ
docker build -t birqadam-backend .

# 2. Запустите контейнер
docker run -d -p 8000:8000 --env-file .env birqadam-backend

# 3. Примените миграции
docker exec birqadam-backend python manage.py migrate

# 4. Соберите статику
docker exec birqadam-backend python manage.py collectstatic --noinput
```

### Production с Gunicorn + Nginx

```bash
# 1. Установите зависимости
pip install -r requirements.txt gunicorn

# 2. Соберите статику
python manage.py collectstatic

# 3. Запустите Gunicorn
gunicorn volunteer_project.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120
```

Подробная инструкция: [docs/deployment/PRODUCTION.md](docs/deployment/PRODUCTION.md)

---

## 📊 Мониторинг

### Логи

```bash
# Django логи
tail -f logs/django.log

# Telegram bot логи
tail -f logs/bot.log

# Nginx логи
tail -f /var/log/nginx/access.log
```

### Метрики

- Количество пользователей
- Количество проектов/задач
- Активность по дням
- Статистика уведомлений

---

## 🤝 Участие в разработке

Мы приветствуем вклад в проект! Пожалуйста:

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

### Соглашения о коде

- Следуйте [PEP 8](https://pep8.org/)
- Добавляйте docstrings к функциям
- Покрывайте код тестами
- Обновляйте документацию

---

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

---

## 👥 Команда

- **Backend Developer**: Beybit Kazbanov
- **Mobile Developer**: Flutter Team
- **UI/UX Designer**: Design Team

---

## 📞 Контакты

- **Email**: kazban0v.beybit@gmail.com
- **GitHub**: [@kazban0v](https://github.com/kazban0v)
- **Mobile App**: [TazaQala-mobile-app](https://github.com/kazban0v/TazaQala-mobile-app-)
- **Telegram Bot**: @VolunteerDlyaLyudei_bot

---

## 🎯 Roadmap

### ✅ Реализовано:

- JWT аутентификация
- CRUD для проектов/задач
- Push/Email/Telegram уведомления
- Telegram бот с регистрацией
- Расширенная админ-панель
- Система достижений
- Интерактивная карта
- Массовые рассылки
- Глобальный поиск
- Экспорт данных

### 🚧 В разработке:

- WebSocket для real-time обновлений
- GraphQL API
- Расширенная аналитика
- Система чата
- Интеграция с социальными сетями

### 📅 Планируется:

- Мобильное приложение для организаторов
- Интеграция с картами (Яндекс.Карты, 2GIS)
- Система рекомендаций проектов
- Геймификация (больше достижений)
- Многоязычность (РУ/КЗ/EN)

---

## 🙏 Благодарности

- [Django](https://www.djangoproject.com/) - The web framework for perfectionists
- [Django REST Framework](https://www.django-rest-framework.org/) - Powerful and flexible toolkit
- [Firebase](https://firebase.google.com/) - Push notifications
- [python-telegram-bot](https://python-telegram-bot.org/) - Telegram integration

---

<div align="center">
  
**BirQadam** - Вместе делаем город чище! 🌱

Сделано с ❤️ для волонтеров Алматы

[Мобильное приложение](https://github.com/kazban0v/TazaQala-mobile-app-) • [Backend API](https://github.com/kazban0v/CleanUpAlmaty) • [Telegram Bot](#-запуск-telegram-бота)

</div>
