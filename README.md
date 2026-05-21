<div align="center">

# 🌿 BirQadam — Волонтёрская платформа нового поколения

**BirQadam** — это полноценная экосистема для управления волонтёрской деятельностью: мобильное приложение, веб-портал и мощный бэкенд, объединённые в одном месте.

[![Django](https://img.shields.io/badge/Django-5.x-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Live Demo](https://img.shields.io/badge/🌐_Боевой_сервер-cleanup.almau.edu.kz-10B981?style=for-the-badge)](https://cleanup.almau.edu.kz)
[![Branch](https://img.shields.io/badge/branch-feature%2Fupdates-F59E0B?style=for-the-badge&logo=git&logoColor=white)](https://github.com/kazban0v/BirQadamFull/tree/feature/updates)

---

</div>

## 📱 О проекте

**BirQadam** (с казахского — «Один шаг») — это платформа, которая объединяет волонтёров и организаторов. Приложение помогает находить добровольческие проекты, управлять задачами, отправлять фотоотчёты и взаимодействовать с командой в чатах — всё в одном месте.

> 🎯 **Цель проекта** — сделать волонтёрство доступным, удобным и прозрачным для каждого жителя Казахстана.

---

## ✨ Ключевые возможности

<table>
<tr>
<td width="50%">

### 📲 Мобильное приложение (iOS + Android)
- 🏠 **Дашборд волонтёра** с умными карточками действий
- 📋 **Задачи и проекты** — поиск, запись, отслеживание статуса
- 📸 **Фотоотчёты** — загрузка, статус модерации, рейтинг
- 💬 **Групповые чаты** по проектам в реальном времени
- 🏆 **Достижения и уровни** с системой очков
- 📅 **Календарь** волонтёрских событий
- 🌍 **Мультиязычность** — Русский, Казахский, Английский
- 🌙 **Тёмная и светлая тема**
- 📵 **Оффлайн-режим** с уведомлением о потере связи

</td>
<td width="50%">

### 🛡️ Безопасность и модерация
- 🚫 **Блокировка пользователей** — скрытие контента на уровне сервера
- 🚩 **Жалобы на контент** — репорты с категориями причин
- 🔒 **Django Admin** — полная панель модератора
- ✅ **Уведомления** — push, in-app, Telegram-бот
- 🔑 **JWT-авторизация** с автообновлением токенов

</td>
</tr>
<tr>
<td width="50%">

### 🖥️ Веб-портал для организаторов
- 📊 Управление проектами и задачами
- 👥 Список волонтёров с их статусами
- 📸 Модерация фотоотчётов с выставлением рейтинга
- 💬 Мессенджер проекта
- 📈 Аналитика и статистика

</td>
<td width="50%">

### ⚙️ Бэкенд (Django REST)
- 🏗️ **Масштабируемая архитектура** с разделением по модулям
- 🤖 **Telegram-бот** для организаторов
- 📧 **Email-уведомления** через кастомный бэкенд
- 🔄 **Celery + Redis** для фоновых задач
- 📡 **REST API** с 100+ эндпоинтами

</td>
</tr>
</table>

---

## 🗂️ Структура проекта

```
BirQadamFull/
├── 📁 BirQadamDjango/          # Backend (Django REST Framework)
│   ├── api/                    # Основное приложение API
│   │   ├── api/                # Эндпоинты (web_portal.py)
│   │   ├── models.py           # Модели данных
│   │   ├── serializers/        # DRF-сериализаторы
│   │   ├── support/            # Модели Block, Report (модерация)
│   │   ├── migrations/         # Миграции базы данных
│   │   └── admin.py            # Django Admin панель
│   ├── telegram_bot/           # Telegram-бот для организаторов
│   ├── shared/                 # AI-сервисы, email, уведомления
│   ├── portal_frontend/        # Веб-интерфейс организатора
│   ├── admin_panel/            # Кастомная admin-панель
│   └── docker-compose.yml      # Docker конфигурация
│
└── 📁 BirQadamExpo/            # Mobile App (React Native + Expo)
    ├── src/
    │   ├── screens/            # 20+ экранов приложения
    │   │   └── volunteer/      # Экраны волонтёра
    │   ├── components/         # Переиспользуемые компоненты
    │   │   ├── ModerationMenu  # Меню блокировки/жалоб
    │   │   ├── Toast           # Уведомления
    │   │   └── skeleton/       # Skeleton-загрузки
    │   ├── store/              # Zustand (authStore, moderationStore...)
    │   ├── services/           # API-сервисы (api.ts)
    │   ├── theme/              # Дизайн-система (tokens.ts)
    │   ├── navigation/         # React Navigation
    │   └── locales/            # i18n (ru, kk, en)
    └── package.json
```

---

## 📸 Скриншоты приложения

| Дашборд | Проекты | Чат |
|:---:|:---:|:---:|
| ![Dashboard](https://via.placeholder.com/180x360/0A1628/10B981?text=Dashboard) | ![Projects](https://via.placeholder.com/180x360/0A1628/10B981?text=Projects) | ![Chat](https://via.placeholder.com/180x360/0A1628/10B981?text=Chat) |

| Профиль | Достижения | Фотоотчёт |
|:---:|:---:|:---:|
| ![Profile](https://via.placeholder.com/180x360/0A1628/10B981?text=Profile) | ![Achievements](https://via.placeholder.com/180x360/0A1628/10B981?text=Achievements) | ![Photo](https://via.placeholder.com/180x360/0A1628/10B981?text=Photo+Report) |

> 💡 *Скриншоты будут добавлены после деплоя в TestFlight*

---

## 🚀 Быстрый старт

### Требования
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16

### 🐳 Запуск бэкенда (Docker)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/kazban0v/BirQadamFull.git
cd BirQadamFull/BirQadamDjango

# 2. Скопировать и настроить переменные окружения
cp .env.example .env
# Отредактируйте .env (DB_HOST, SECRET_KEY, и т.д.)

# 3. Запустить через Docker Compose
docker-compose up -d --build

# 4. Применить миграции
docker-compose exec web python manage.py migrate

# 5. Создать суперпользователя
docker-compose exec web python manage.py createsuperuser
```

**🌐 Сервер запущен:** `http://localhost:8000`  
**🔧 Admin-панель:** `http://localhost:8000/admin/`

---

### 📱 Запуск мобильного приложения

```bash
# 1. Перейти в папку Expo
cd BirQadamFull/BirQadamExpo

# 2. Установить зависимости
npm install

# 3. Настроить URL бэкенда (опционально)
# Создайте файл .env:
echo "EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000" > .env

# 4. Запустить Metro Bundler
npx expo start

# 5. Отсканировать QR-код в Expo Go (iOS/Android)
#    или нажать 'a' для Android-эмулятора
```

---

## 🛠️ Технологический стек

### Backend
| Технология | Версия | Назначение |
|:---:|:---:|:---|
| ![Django](https://img.shields.io/badge/-Django-092E20?logo=django&logoColor=white) | 5.x | Основной фреймворк |
| ![DRF](https://img.shields.io/badge/-DRF-red?logo=django) | 3.x | REST API |
| ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-336791?logo=postgresql&logoColor=white) | 16 | База данных |
| ![Redis](https://img.shields.io/badge/-Redis-DC382D?logo=redis&logoColor=white) | 7 | Кэш и очереди |
| ![Celery](https://img.shields.io/badge/-Celery-37814A?logo=celery&logoColor=white) | 5.x | Фоновые задачи |
| ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white) | — | Контейнеризация |
| ![Nginx](https://img.shields.io/badge/-Nginx-009639?logo=nginx&logoColor=white) | — | Прокси-сервер |

### Frontend (Mobile)
| Технология | Версия | Назначение |
|:---:|:---:|:---|
| ![React Native](https://img.shields.io/badge/-React_Native-20232A?logo=react&logoColor=61DAFB) | 0.81 | Мобильный фреймворк |
| ![Expo](https://img.shields.io/badge/-Expo-000020?logo=expo&logoColor=white) | SDK 54 | Экосистема |
| ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white) | 5.x | Типизация |
| ![Zustand](https://img.shields.io/badge/-Zustand-FF6B2B?logo=react) | 5.x | Управление состоянием |
| ![Axios](https://img.shields.io/badge/-Axios-5A29E4?logo=axios&logoColor=white) | — | HTTP-клиент |

---

## 🛡️ Модерация контента (App Store Compliance)

Проект соответствует **требованиям Apple App Store** для приложений с пользовательским контентом:

```
✅ Блокировка пользователей       — POST /api/web/blocks/
✅ Разблокировка                  — DELETE /api/web/blocks/<id>/
✅ Список заблокированных         — GET /api/web/blocks/
✅ Жалобы на контент              — POST /api/web/reports/
✅ Панель модератора (Admin)       — /admin/
✅ Фильтрация контента на бэкенде — автоматически в чатах
```

**Кнопки "Пожаловаться" и "Заблокировать" доступны в:**
- 💬 Чат — на каждом чужом сообщении
- 👤 Профиль организатора
- 📸 Просмотр фотоотчёта
- ⚙️ Профиль → Безопасность → Заблокированные пользователи

---

## 🌐 Деплой (Production)

Сервер: **[cleanup.almau.edu.kz](https://cleanup.almau.edu.kz)**

```bash
# На сервере (после git pull):
docker-compose up -d --build
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py collectstatic --noinput
```

---

## 📋 API Документация

Основные группы эндпоинтов (префикс: `/api/web/`):

| Группа | Эндпоинты |
|---|---|
| 🔐 Авторизация | `POST /login/`, `POST /register/`, `POST /token/refresh/` |
| 👤 Профиль | `GET/PATCH /volunteer/profile/` |
| 📂 Проекты | `GET /volunteer/projects/`, `GET /volunteer/projects/<id>/` |
| ✅ Задачи | `GET /volunteer/tasks/`, `GET /volunteer/tasks/<id>/` |
| 📸 Фотоотчёты | `POST /volunteer/tasks/<id>/photo/`, `GET /volunteer/tasks/<id>/photos/` |
| 💬 Чаты | `GET /volunteer/chats/`, `GET /volunteer/chats/<id>/messages/` |
| 🚫 Блокировки | `GET/POST /blocks/`, `DELETE /blocks/<id>/` |
| 🚩 Жалобы | `POST /reports/` |
| 🔔 Уведомления | `GET /volunteer/notifications/` |
| 🏆 Достижения | `GET /volunteer/achievements/` |

---

## 📁 Переменные окружения

```env
# BirQadamDjango/.env

# База данных
DB_NAME=birqadam
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=postgres          # 'localhost' при локальной разработке
DB_PORT=5432

# Django
SECRET_KEY=your_secret_key
DEBUG=False
ALLOWED_HOSTS=cleanup.almau.edu.kz,localhost

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=your_app_password

# Sentry (опционально)
SENTRY_DSN=
```

---

## 🤝 Участие в разработке

```bash
# 1. Создать ветку для вашей фичи
git checkout -b feature/your-feature-name

# 2. Внести изменения и закоммитить
git commit -m "feat: описание фичи"

# 3. Отправить в репозиторий
git push origin feature/your-feature-name

# 4. Открыть Pull Request в feature/updates
```

### Соглашения о коммитах
| Префикс | Назначение |
|:---:|:---|
| `feat:` | Новая функциональность |
| `fix:` | Исправление бага |
| `docs:` | Изменения документации |
| `style:` | Форматирование кода |
| `refactor:` | Рефакторинг |
| `chore:` | Обновление зависимостей |

---

## 📊 Статистика проекта

```
📂 20+ экранов в мобильном приложении
🔗 100+ REST API эндпоинтов
🌍 3 языка интерфейса (RU, KZ, EN)
🛡️ Полная система модерации (App Store compliant)
📱 iOS + Android совместимость
🐳 Docker-ready деплой
```

---

## 📄 Лицензия

Этот проект создан в рамках **ALMAU** (Академический Университет Казахстана).  
Все права защищены © 2024–2025 BirQadam Team.

---

<div align="center">

**Сделано с ❤️ для волонтёров Казахстана**

[![GitHub](https://img.shields.io/badge/GitHub-kazban0v-181717?style=for-the-badge&logo=github)](https://github.com/kazban0v/BirQadamFull)
[![Live](https://img.shields.io/badge/🌐_Открыть_сайт-cleanup.almau.edu.kz-10B981?style=for-the-badge)](https://cleanup.almau.edu.kz)

*"Один шаг к лучшему миру начинается с BirQadam"* 🌿

</div>
