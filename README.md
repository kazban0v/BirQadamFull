# BirQadam Full Stack Project 🌱

<div align="center">
  <img src="BirQadamApp/assets/images/logo_birqadam.png" alt="BirQadam Logo" width="200"/>
  
  **Комплексная платформа для управления волонтерскими проектами в Алматы**
  
  [![Flutter](https://img.shields.io/badge/Flutter-3.24.0-blue)](https://flutter.dev)
  [![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
  [![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📖 О проекте

**BirQadam** (ранее CleanUpAlmaty) - это полнофункциональная платформа для координации волонтерской деятельности, включающая:

- 📱 **Мобильное приложение** (Flutter) для iOS и Android
- 🌐 **Веб-портал** (Vue.js + Vite)
- 🔧 **Backend API** (Django REST Framework)
- 🎨 **Admin Panel** (Vue.js + Django)
- 🤖 **Telegram бот** для уведомлений и регистрации

---

## 📁 Структура проекта

```
BirQadamFull/
├── BirQadamApp/              # Flutter мобильное приложение
│   ├── lib/                  # Исходный код Dart
│   ├── android/              # Android конфигурация
│   ├── ios/                  # iOS конфигурация
│   └── README.md             # Документация приложения
│
├── BirQadamDjango/           # Django Backend + Admin Panel
│   ├── api/                  # API модуль (доменная архитектура)
│   │   ├── users/            # Домен пользователей
│   │   ├── projects/         # Домен проектов
│   │   ├── tasks/            # Домен задач
│   │   ├── notifications/    # Домен уведомлений
│   │   ├── chat/             # Домен чата
│   │   ├── achievements/     # Домен достижений
│   │   └── support/          # Домен поддержки
│   ├── admin_panel/          # Расширенная админ-панель
│   ├── portal_frontend/      # Vue.js фронтенд для веб-портала
│   ├── telegram_bot/         # Telegram бот
│   ├── public_site/          # Публичный сайт (landing page)
│   ├── shared/               # Инфраструктурные сервисы (AI, notifications)
│   ├── common/               # Общие утилиты
│   ├── deployment/           # Docker и Jenkins конфигурации
│   ├── config/               # Конфигурационные файлы (секреты)
│   └── birqadam_project/     # Основные настройки Django
│
└── README.md                 # Этот файл
```

---

## ✨ Основные возможности

### Для волонтеров:
- 🎯 Просмотр и участие в проектах
- ✅ Управление задачами с дедлайнами
- 📊 Отслеживание прогресса и статистики
- 🏆 Система достижений и рейтинга
- 📸 Загрузка фотоотчетов
- 🔔 Push-уведомления (FCM)
- 📍 Геолокация проектов
- 💬 Чат с организаторами

### Для организаторов:
- 📝 Создание и управление проектами
- 👥 Назначение задач волонтерам
- 📈 Мониторинг участников
- ✅ Модерация фотоотчетов
- 📊 Статистика проектов
- 🔔 Массовые рассылки
- 🗓️ Календарь событий

---

## 🛠 Технологии

### Mobile App (BirQadamApp)
- **Flutter** 3.24.0
- **Dart** 3.0
- **Provider** - State Management
- **Firebase** - Push Notifications
- **Google Maps** - Карты и геолокация

### Backend (BirQadamDjango)
- **Django** 5.2
- **Django REST Framework** 3.15
- **PostgreSQL** - База данных
- **Celery** - Асинхронные задачи
- **Redis** - Кэширование и брокер сообщений
- **Firebase Admin SDK** - Push уведомления
- **python-telegram-bot** - Telegram интеграция

### Web Portal (BirQadamDjango/portal_frontend)
- **Vue.js** 3
- **TypeScript**
- **Vuetify** - UI компоненты
- **Pinia** - State Management
- **Vite** - Build tool

### Admin Panel (BirQadamDjango/admin_panel)
- **Vue.js** 3
- **TypeScript**
- **Vuetify** - UI компоненты
- **Django Templates** - Backend рендеринг

---

## 🚀 Быстрый старт

### Мобильное приложение

```bash
cd BirQadamApp
flutter pub get
flutter run
```

Подробнее: [BirQadamApp/README.md](BirQadamApp/README.md)

### Backend API

```bash
cd BirQadamDjango
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Web Portal (Frontend)

```bash
cd BirQadamDjango/portal_frontend
npm install
npm run dev
```

### Admin Panel

Админ-панель доступна по адресу: `http://localhost:8000/custom-admin/`

### Telegram Bot

```bash
cd BirQadamDjango
python manage.py runserver  # Backend должен быть запущен
# Запустите бота отдельным процессом
python telegram_bot/bot.py
```

---

## 📦 Развертывание

Проект настроен для развертывания через:

- **Docker** - Контейнеризация приложения
- **Docker Compose** - Оркестрация сервисов (Django, Celery, Redis, Frontend)
- **Jenkins** - CI/CD pipeline для автоматического деплоя
- **Firebase** - Push уведомления
- **Google Play / App Store** - Мобильное приложение

### Docker Compose

```bash
cd BirQadamDjango/deployment
docker compose -f docker-compose.yml up -d
```

Подробнее: [BirQadamDjango/deployment/README.md](BirQadamDjango/deployment/README.md)

---

## 🏗 Архитектура

Проект использует **доменно-ориентированную архитектуру (DDD)**:

- **api/users/** - Управление пользователями, регистрация, профили
- **api/projects/** - Проекты и участие волонтеров
- **api/tasks/** - Задачи и фотоотчеты
- **api/notifications/** - Система уведомлений
- **api/chat/** - Чат между участниками
- **api/achievements/** - Система достижений
- **api/support/** - Поддержка пользователей

**Инфраструктурные сервисы:**
- **shared/ai/** - AI сервисы (Gemini, OpenAI)
- **shared/notifications/** - Email и push уведомления
- **common/storage/** - Общие утилиты для работы с файлами

---

## 👥 Команда

- **Backend Developer**: Beybit Kazbanov
- **Mobile Developer**: Flutter Team
- **UI/UX Designer**: Design Team

---

## 📞 Контакты

- **Email**: kazban0v.beybit@gmail.com
- **GitHub**: [@kazban0v](https://github.com/kazban0v)
- **Telegram Bot**: @VolunteerDlyaLyudei_bot

---

## 📄 Лицензия

MIT License - см. файл LICENSE для деталей

---

<div align="center">
  <p>Сделано с ❤️ для волонтеров Алматы</p>
  <p><b>BirQadam</b> - Вместе делаем город чище! 🌱</p>
</div>
