# BirQadam Full Stack Project 🌱

<div align="center">
  <img src="BirQadamExpo/assets/images/logo_birqadam.png" alt="BirQadam Logo" width="200"/>
  
  **Комплексная платформа для управления волонтерскими проектами в Алматы**
  
  [![React Native](https://img.shields.io/badge/React_Native-19.1.0-blue)](https://reactnative.dev)
  [![Expo](https://img.shields.io/badge/Expo-54.0.33-black)](https://expo.dev)
  [![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
  [![Vue.js](https://img.shields.io/badge/Vue.js-3.5-green.svg)](https://vuejs.org/)
  [![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📖 О проекте

**BirQadam** (ранее CleanUpAlmaty) - это полнофункциональная платформа для координации волонтерской деятельности, включающая:

- 📱 **Мобильное приложение** (React Native / Expo) для iOS и Android
- 🌐 **Веб-портал** (Vue.js + Vite)
- 🔧 **Backend API** (Django REST Framework)
- 🎨 **Admin Panel** (Vue.js + Django)
- 🤖 **Telegram бот** для уведомлений и регистрации

---

## 📁 Структура проекта

```
BirQadamFull/
├── BirQadamExpo/             # React Native (Expo) мобильное приложение
│   ├── src/                  # Исходный код приложения
│   ├── assets/               # Ресурсы (изображения, шрифты)
│   ├── App.tsx               # Точка входа в приложение
│   └── package.json          # Зависимости проекта
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
│   ├── deployment/           # Docker конфигурации
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
- 🔔 Push-уведомления (Expo Notifications)
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

### Mobile App (BirQadamExpo)
- **React Native** 0.81.5
- **Expo** ~54.0.33
- **TypeScript** ~5.9.2
- **Zustand** - State Management
- **React Navigation** - Навигация
- **Expo Notifications** - Push уведомления
- **Expo Location** - Геолокация
- **Axios** - HTTP-клиент

### Backend (BirQadamDjango)
- **Django** 5.2
- **Django REST Framework** 3.15
- **PostgreSQL** - База данных
- **Celery** - Асинхронные задачи
- **Redis** - Кэширование и брокер сообщений
- **python-telegram-bot** - Telegram интеграция

### Web Portal (BirQadamDjango/portal_frontend)
- **Vue.js** 3
- **TypeScript**
- **Vuetify** - UI компоненты
- **Pinia** - State Management
- **Vite** - Build tool

---

## 🚀 Быстрый старт

### Мобильное приложение (React Native / Expo)

```bash
cd BirQadamExpo
npm install
npx expo start
```

### Backend API

```bash
cd BirQadamDjango
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
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

### Docker Compose

```bash
cd BirQadamDjango/deployment
docker compose -f docker-compose.yml up -d
```

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
- **shared/ai/** - AI сервисы
- **shared/notifications/** - Email и push уведомления
- **common/storage/** - Общие утилиты для работы с файлами

---

## 👥 Команда

- **Backend Developer**: Beybit Kazbanov
- **Mobile Developer**: React Native (Expo) Team
- **UI/UX Designer**: Design Team

---

## 📞 Контакты

- **Email**: kazban0v.beybit@gmail.com
- **GitHub**: [@kazban0v](https://github.com/kazban0v)

---

## 📄 Лицензия

MIT License - см. файл LICENSE для деталей

---

<div align="center">
  <p>Сделано с ❤️ для волонтеров Алматы</p>
  <p><b>BirQadam</b> - Вместе делаем город чище! 🌱</p>
</div>
