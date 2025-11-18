"""
✅ ИСПРАВЛЕНИЕ СредП-2: Централизованные константы проекта
Этот файл содержит все magic numbers и константы, используемые в проекте
"""

# === ПАГИНАЦИЯ ===
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
ACTIVITIES_LIMIT = 50
LEADERBOARD_LIMIT = 100
PHOTOS_PER_PAGE = 5

# === БЕЗОПАСНОСТЬ ===
MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_DURATION = 900  # секунд (15 минут)
PASSWORD_RESET_ATTEMPTS = 3
PASSWORD_RESET_PERIOD = 3600  # секунд (1 час)

# === RATE LIMITING ===
RATE_LIMIT_REQUESTS = 100  # запросов за период
RATE_LIMIT_PERIOD = 60  # секунд
RATE_LIMIT_REGISTER = 3  # регистраций в час
RATE_LIMIT_REGISTER_PERIOD = 3600
RATE_LIMIT_PHOTO_UPLOAD = 10  # фото за период
RATE_LIMIT_PHOTO_PERIOD = 300  # секунд (5 минут)

# === ВОЛОНТЁРСТВО ===
MAX_PROJECTS_PER_VOLUNTEER = 1
MIN_PROJECT_DESCRIPTION_LENGTH = 20
MAX_PROJECT_DESCRIPTION_LENGTH = 5000
MAX_PROJECT_TITLE_LENGTH = 255
MAX_TASK_TITLE_LENGTH = 255

# === ФАЙЛЫ И МЕДИА ===
MAX_PHOTO_SIZE_MB = 5
MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024
ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
THUMBNAIL_SIZE = (300, 300)
OPTIMIZED_IMAGE_SIZE = (1920, 1080)
IMAGE_QUALITY = 85

# === РЕЙТИНГ ===
MIN_RATING = 0
MAX_RATING = 500
DEFAULT_RATING = 0
RATING_INCREMENT_PHOTO_APPROVED = 5
RATING_INCREMENT_TASK_COMPLETED = 10
RATING_INCREMENT_PROJECT_CREATED = 15

# === УВЕДОМЛЕНИЯ ===
FCM_NOTIFICATION_TIMEOUT = 10  # секунд
MAX_NOTIFICATION_RETRIES = 3
NOTIFICATION_TTL = 86400  # секунд (24 часа)

# === КЕШИРОВАНИЕ ===
CACHE_TIMEOUT_SHORT = 300  # 5 минут
CACHE_TIMEOUT_MEDIUM = 1800  # 30 минут
CACHE_TIMEOUT_LONG = 3600  # 1 час
CACHE_TIMEOUT_ACHIEVEMENTS = 300
CACHE_TIMEOUT_LEADERBOARD = 300
CACHE_TIMEOUT_STATS = 600

# === СТАТУСЫ ===
PROJECT_STATUS_CHOICES = [
    ('pending', 'На модерации'),
    ('approved', 'Одобрен'),
    ('rejected', 'Отклонён'),
    ('completed', 'Завершён'),
]

TASK_STATUS_CHOICES = [
    ('open', 'Открыта'),
    ('in_progress', 'В процессе'),
    ('completed', 'Завершена'),
    ('cancelled', 'Отменена'),
]

PHOTO_STATUS_CHOICES = [
    ('pending', 'На проверке'),
    ('approved', 'Одобрено'),
    ('rejected', 'Отклонено'),
]

VOLUNTEER_TYPE_CHOICES = [
    ('individual', 'Индивидуальный'),
    ('group', 'Групповой'),
]

# === ТИПЫ АКТИВНОСТИ ===
ACTIVITY_TYPE_CHOICES = [
    ('project_joined', 'Присоединился к проекту'),
    ('project_created', 'Создал проект'),
    ('project_completed', 'Завершил проект'),
    ('photo_uploaded', 'Загрузил фото'),
    ('achievement_unlocked', 'Получил достижение'),
    ('rating_increased', 'Повысил рейтинг'),
]

# === РОЛИ ПОЛЬЗОВАТЕЛЕЙ ===
USER_ROLE_VOLUNTEER = 'volunteer'
USER_ROLE_ORGANIZER = 'organizer'
USER_ROLE_ADMIN = 'admin'

USER_ROLE_CHOICES = [
    (USER_ROLE_VOLUNTEER, 'Волонтёр'),
    (USER_ROLE_ORGANIZER, 'Организатор'),
    (USER_ROLE_ADMIN, 'Администратор'),
]

# === ГОРОДА ===
CITY_CHOICES = [
    ('Almaty', 'Алматы'),
    ('Astana', 'Астана'),
    ('Shymkent', 'Шымкент'),
    ('Other', 'Другой'),
]

# === ВАЛИДАЦИЯ ===
PHONE_REGEX = r'^\+?\d{10,15}$'
EMAIL_MAX_LENGTH = 255
USERNAME_MAX_LENGTH = 150
COMMENT_MAX_LENGTH = 500

# === ДОСТИЖЕНИЯ ===
ACHIEVEMENT_FIRST_PROJECT = 1  # ID достижения за первый проект
ACHIEVEMENT_FIRST_PHOTO = 2  # ID достижения за первое фото
ACHIEVEMENT_RATING_100 = 3  # ID достижения за рейтинг 100
ACHIEVEMENT_RATING_500 = 4  # ID достижения за рейтинг 500

# === TELEGRAM BOT ===
TELEGRAM_MAX_MESSAGE_LENGTH = 4096
TELEGRAM_PHOTO_MAX_SIZE_MB = 10

# === API ===
API_VERSION = 'v1'
API_TIMEOUT = 30  # секунд

