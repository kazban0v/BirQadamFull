from pathlib import Path
import os
import logging
from dotenv import load_dotenv

# Configure logging for settings
logger = logging.getLogger(__name__)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')



# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
# SECURITY WARNING: in production, this Key MUST be set in the environment.
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# In production, this should be a comma-separated list of your app's hostnames.
# Using '*' is insecure.
# ✅ PRODUCTION: ALLOWED_HOSTS должен быть задан через переменную окружения
# В DEBUG режиме разрешаем все для разработки
if DEBUG:
    ALLOWED_HOSTS = ['*']  # Только для разработки
else:
    # В production используем ALLOWED_HOSTS из .env, или значения по умолчанию для Railway
    allowed_hosts_str = os.getenv('ALLOWED_HOSTS', '').strip()
    if not allowed_hosts_str:
        # Значения по умолчанию для Railway
        ALLOWED_HOSTS = ['*', '*.railway.app']
        logger.warning(
            "ALLOWED_HOSTS not set in production! Using default: ['*', '*.railway.app']. "
            "For better security, set ALLOWED_HOSTS in .env file"
        )
    else:
        ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_str.split(',') if host.strip()]

# ✅ CORS настройки: в DEBUG разрешаем все, в production только из переменных окружения
CORS_ALLOW_ALL_ORIGINS = True  # True только в режиме разработки

# Базовые CORS origins для разработки
CORS_ALLOWED_ORIGINS_DEV = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8002",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.0.2.2:8000",  # Android Emulator
]

# В production используем только адреса из переменных окружения
_cors_allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
if DEBUG:
    # В разработке: dev адреса + адреса из .env (если есть)
    CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_DEV.copy()
    if _cors_allowed_origins_env:
        for origin in _cors_allowed_origins_env.split(","):
            origin = origin.strip()
            if not origin:
                continue
            if not origin.startswith(("http://", "https://")):
                origin = f"http://{origin}"  # в dev логичнее http
            if origin not in CORS_ALLOWED_ORIGINS:
                CORS_ALLOWED_ORIGINS.append(origin)

else:
    # В production: ТОЛЬКО из переменных окружения
    if not _cors_allowed_origins_env:
        # ⚠️ В production переменная CORS_ALLOWED_ORIGINS обязательна!
        CORS_ALLOWED_ORIGINS = []
        logger.error(
            "❌ CORS_ALLOWED_ORIGINS not set in production! "
            "Set CORS_ALLOWED_ORIGINS in .env file. "
            "CORS requests will be blocked!"
        )
    else:
        CORS_ALLOWED_ORIGINS = []
        for origin in _cors_allowed_origins_env.split(","):
            origin = origin.strip()
            if not origin:
                continue
            # если забыли протокол — добавляем https:// (в проде обычно так)
            if not origin.startswith(("http://", "https://")):
                origin = f"https://{origin}"
            CORS_ALLOWED_ORIGINS.append(origin)

CORS_ALLOW_CREDENTIALS = True

# Базовые CSRF trusted origins для разработки
CSRF_TRUSTED_ORIGINS_DEV = [
    "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5174",
    "https://cleanup.almau.edu.kz",
    "https://birqadam.almau.edu.kz",
]

# В production используем только адреса из переменных окружения
_csrf_trusted_origins_env = os.getenv("CSRF_TRUSTED_ORIGINS", "").strip()
if DEBUG:
    # В разработке: dev адреса + адреса из .env (если есть)
    CSRF_TRUSTED_ORIGINS = CSRF_TRUSTED_ORIGINS_DEV.copy()
    if _csrf_trusted_origins_env:
        CSRF_TRUSTED_ORIGINS.extend([
            origin.strip() for origin in _csrf_trusted_origins_env.split(",") 
            if origin.strip() and origin.strip() not in CSRF_TRUSTED_ORIGINS
        ])
else:
    # В production: ТОЛЬКО из переменных окружения
    if not _csrf_trusted_origins_env:
        CSRF_TRUSTED_ORIGINS = []
        logger.error(
            "❌ CSRF_TRUSTED_ORIGINS not set in production! "
            "Set CSRF_TRUSTED_ORIGINS in .env file. "
            "CSRF protection may fail!"
        )
    else:
        CSRF_TRUSTED_ORIGINS = [
            origin.strip() for origin in _csrf_trusted_origins_env.split(",") 
            if origin.strip()
        ]
    # if not _csrf_trusted_origins_env:
    #     # Значения по умолчанию для Railway
    #     CSRF_TRUSTED_ORIGINS = []
    #     logger.warning(
    #         "CSRF_TRUSTED_ORIGINS not set in production! Using empty list. "
    #         "For proper CSRF protection, set CSRF_TRUSTED_ORIGINS in .env file"
    #     )
    # # Обработка специального значения "*" для автоматического определения домена Railway
    # elif _csrf_trusted_origins_env == "*":
    #     CSRF_TRUSTED_ORIGINS = []
    #
    #     # Пытаемся определить домен Railway автоматически
    #     railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN") or os.getenv("RAILWAY_STATIC_URL", "")
    #     if railway_domain:
    #         # Убираем протокол если есть
    #         railway_domain = railway_domain.replace("https://", "").replace("http://", "").strip()
    #         if railway_domain:
    #             CSRF_TRUSTED_ORIGINS = [f"https://{railway_domain}"]
    #
    #     # Если не удалось определить из Railway переменных, используем ALLOWED_HOSTS
    #     if not CSRF_TRUSTED_ORIGINS:
    #         allowed_hosts = os.getenv("ALLOWED_HOSTS", "").strip()
    #         if allowed_hosts and allowed_hosts != "*":
    #             # Берем первый домен из ALLOWED_HOSTS
    #             first_host = allowed_hosts.split(",")[0].strip()
    #             if first_host and not first_host.startswith(("*", ".")):
    #                 CSRF_TRUSTED_ORIGINS = [f"https://{first_host}"]
    #
    #     # Если все еще не удалось определить - используем пустой список (предупреждение уже было)
    #     if not CSRF_TRUSTED_ORIGINS:
    #         logger.warning(
    #             "Could not auto-detect Railway domain for CSRF_TRUSTED_ORIGINS=*. "
    #             "Set CSRF_TRUSTED_ORIGINS explicitly in .env file"
    #         )
    #         CSRF_TRUSTED_ORIGINS = ['birqadam.almau.edu.kz',]
    # else:
    #     # Обычная обработка: список доменов через запятую
    #     CSRF_TRUSTED_ORIGINS = []
    #     for origin in _csrf_trusted_origins_env.split(","):
    #         origin = origin.strip()
    #         if not origin:
    #             continue
    #         # Автоматически добавляем https:// если протокол не указан
    #         if not origin.startswith(("http://", "https://")):
    #             # В production всегда используем https
    #             origin = f"https://{origin}"
    #         CSRF_TRUSTED_ORIGINS.append(origin)

# -------------------------
# Production hardening (proxy/https/cookies)
# Управляется через переменные окружения, чтобы не ломать локальную разработку.
# -------------------------

def _getenv_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


USE_X_FORWARDED_HOST = _getenv_bool("USE_X_FORWARDED_HOST", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if _getenv_bool("USE_X_FORWARDED_PROTO", False) else None

# Если сайт работает по HTTPS (обычно за nginx/traefik), включите эти флаги в .env
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True


# Для SPA на другом домене часто требуется SameSite=None + Secure=True
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SAMESITE = "None"

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'core.apps.CoreConfig',
    'taggit',
    'rest_framework',
    'rest_framework_simplejwt',
    'about_site',
    'custom_admin',
    ]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # ✅ Добавлено для админ-панели
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # ✅ ИСПРАВЛЕНИЕ СП-5: Добавлена пагинация по умолчанию
    'DEFAULT_PAGINATION_CLASS': 'custom_admin.utils.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),  # Access token живет 1 день
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),  # Refresh token живет 7 дней
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# Настройки для медиафайлов
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # ✅ ИСПРАВЛЕНИЕ КП-4: JWT Debug Middleware включается только в DEBUG режиме
    # 'custom_admin.middleware_jwt_debug.JWTDebugMiddleware',  # Отключено для production
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # ✅ ИСПРАВЛЕНИЕ НП-2: Compression для API responses
    'django.middleware.gzip.GZipMiddleware',
    'custom_admin.middleware.middleware.RememberMeMiddleware',
    'custom_admin.middleware.middleware.RateLimitMiddleware',  # Rate limiting
    'custom_admin.middleware.middleware.LoginAttemptMiddleware',  # Защита от брутфорса логина
]

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",  # 👈 вот это
    },
}

# Static files (настраиваем ниже единообразно)

# ✅ Добавляем JWT Debug Middleware только в DEBUG режиме
if DEBUG:
    MIDDLEWARE.insert(7, 'custom_admin.middleware.jwt_debug.JWTDebugMiddleware')

# Настройки Rate Limiting
RATE_LIMIT_ENABLED = True
RATE_LIMIT_REQUESTS = 100  # запросов за период
RATE_LIMIT_PERIOD = 60  # секунд
LOGIN_MAX_ATTEMPTS = 5  # максимум попыток входа
LOGIN_LOCKOUT_DURATION = 900  # блокировка на 15 минут (в секундах)

# Доверенные прокси для корректной работы с X-Forwarded-For
# Добавьте IP адреса ваших балансировщиков/прокси серверов
TRUSTED_PROXIES = []  # Пример: ['10.0.0.1', '172.16.0.1']

ROOT_URLCONF = 'volunteer_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')], 
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'about_site.context_processors.frontend_url',  # ✅ Добавлен для FRONTEND_URL
            ],
        },
    },
]

WSGI_APPLICATION = 'volunteer_project.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# Database configuration
# Поддержка DATABASE_URL (Railway предоставляет это) или отдельных переменных
DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

if DATABASE_URL:
    # Используем DATABASE_URL если он есть (Railway часто предоставляет это)
    import re
    # Парсим DATABASE_URL: postgresql://user:password@host:port/dbname
    match = re.match(r'postgres(ql)?://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', DATABASE_URL)
    if match:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': match.group(6),
                'USER': match.group(2),
                'PASSWORD': match.group(3),
                'HOST': match.group(4),
                'PORT': match.group(5),
                'OPTIONS': {
                    'sslmode': 'prefer',
                    'client_encoding': 'UTF8',
                },
            }
        }
    else:
        # Если формат не распознан, используем отдельные переменные
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.getenv('DB_NAME', 'postgres'),
                'USER': os.getenv('DB_USER', 'postgres'),
                'PASSWORD': os.getenv('DB_PASSWORD', ''),
                'HOST': os.getenv('DB_HOST', 'localhost'),
                'PORT': os.getenv('DB_PORT', '5432'),
                'OPTIONS': {
                    'sslmode': 'prefer',
                    'client_encoding': 'UTF8',
                },
            }
        }
else:
    # Используем отдельные переменные
    # Пробуем DB_HOST, если нет - используем PGHOST (Railway предоставляет это)
    db_host = os.getenv('DB_HOST', '').strip() or os.getenv('PGHOST', '').strip()
    db_port = os.getenv('DB_PORT', '5432').strip() or os.getenv('PGPORT', '5432').strip()
    
    # Убираем порт из DB_HOST если он там есть (например: host:5432 -> host)
    if db_host and ':' in db_host:
        parts = db_host.split(':')
        db_host = parts[0]
        if len(parts) > 1 and not db_port or db_port == '5432':
            db_port = parts[1]
    
    # Валидация: если DB_HOST пустой, используем localhost только в DEBUG
    if not db_host:
        if DEBUG:
            db_host = 'localhost'
        else:
            # Логируем для отладки
            logger.error(
                f"DB_HOST is not set! Available env vars: "
                f"DB_HOST={os.getenv('DB_HOST')}, "
                f"PGHOST={os.getenv('PGHOST')}, "
                f"DATABASE_URL={'SET' if os.getenv('DATABASE_URL') else 'NOT SET'}"
            )
            raise ValueError(
                "DB_HOST must be set in production! "
                "Set it in Railway Variables: DB_HOST=${PGHOST} or use DATABASE_URL. "
                f"Current DB_HOST value: '{os.getenv('DB_HOST')}'"
            )
    
    # Дополнительная валидация: DB_HOST не должен быть пустой строкой
    if not db_host or db_host == '':
        raise ValueError(
            f"DB_HOST cannot be empty! Current value: '{os.getenv('DB_HOST')}'. "
            "Set DB_HOST=${PGHOST} in Railway Variables."
        )
    
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'postgres'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': db_host,
            'PORT': db_port,
            'OPTIONS': {
                'sslmode': 'prefer',
                'client_encoding': 'UTF8',
            },
        }
    }
    
    # Логируем настройки БД (без пароля) для отладки
    if not DEBUG:
        logger.info(f"Database config: HOST={db_host}, PORT={db_port}, NAME={os.getenv('DB_NAME', 'postgres')}, USER={os.getenv('DB_USER', 'postgres')}")


# Настройки кеширования для улучшения производительности
# Используем файловое кеширование (работает со SQLite без дополнительных зависимостей)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-cleanupalmaty',
        'TIMEOUT': 300,  # 5 минут по умолчанию
        'OPTIONS': {
            'MAX_ENTRIES': 1000
        }
    }
}

# Для production с Redis (лучше производительность, требует: pip install redis django-redis):
# CACHES = {
#     'default': {
#         'BACKEND': 'django_redis.cache.RedisCache',
#         'LOCATION': 'redis://127.0.0.1:6379/1',
#         'OPTIONS': {
#             'CLIENT_CLASS': 'django_redis.client.DefaultClient',
#         }
#     }
# }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'ru-ru'

TIME_ZONE = 'Asia/Almaty'

USE_I18N = True
USE_L10N = True
USE_TZ = True


# Static files
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'custom_admin/static'),
]
# WhiteNoise ожидает реальный путь на диске (не строковый абсолютный URL)
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')


# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'core.User'


# Настройки почты
# Приоритет: Resend API > SendGrid API > SMTP (Gmail и др.)
# Resend и SendGrid работают через HTTP API и не требуют SMTP подключений (Railway блокирует SMTP порты)

RESEND_API_KEY = os.getenv('RESEND_API_KEY', '').strip()
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '').strip()

if RESEND_API_KEY:
    # Используем Resend через REST API (проще в настройке, без проверок аккаунта)
    EMAIL_BACKEND = 'core.email_backends.ResendEmailBackend'
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'birqadamofficial@gmail.com')
    
    print(f"[EMAIL CONFIG] [OK] Using Resend API backend (RESEND_API_KEY is set)")
    print(f"[EMAIL CONFIG] FROM_EMAIL={DEFAULT_FROM_EMAIL}")
    logger.info(f"Using Resend API backend. FROM_EMAIL={DEFAULT_FROM_EMAIL}")
    
    # Дополнительные настройки (не используются, но оставляем для совместимости)
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
elif SENDGRID_API_KEY:
    # Fallback на SendGrid через REST API (не требует SMTP, работает на Railway)
    EMAIL_BACKEND = 'core.email_backends.SendGridEmailBackend'
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'birqadamofficial@gmail.com')
    
    print(f"[EMAIL CONFIG] [OK] Using SendGrid API backend (SENDGRID_API_KEY is set)")
    print(f"[EMAIL CONFIG] FROM_EMAIL={DEFAULT_FROM_EMAIL}")
    logger.info(f"Using SendGrid API backend. FROM_EMAIL={DEFAULT_FROM_EMAIL}")
    
    # Дополнительные настройки для SendGrid (не используются, но оставляем для совместимости)
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
else:
    # Fallback на SMTP (Gmail) - может не работать на Railway из-за блокировки портов
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    
    # Railway часто блокирует порт 587, используем 465 с SSL по умолчанию
    # Порт 465 с SSL работает лучше на Railway, чем 587 с TLS
    _email_port = os.getenv('EMAIL_PORT', '').strip()
    if _email_port:
        EMAIL_PORT = int(_email_port)
    else:
        # По умолчанию пробуем 465 (SSL), если не указано
        EMAIL_PORT = 465
    
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'birqadamofficial@gmail.com')
    # Gmail App Password: убираем пробелы, если они есть (Gmail показывает пароль как "rcmb qxaq arpo fuyv", но нужен "rcmbqxaqarpofuyv")
    _email_password_raw = os.getenv('EMAIL_HOST_PASSWORD', '').strip()
    EMAIL_HOST_PASSWORD = _email_password_raw.replace(' ', '').replace('-', '') if _email_password_raw else ''  # Убираем пробелы и дефисы из App Password
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', os.getenv('EMAIL_HOST_USER', 'birqadamofficial@gmail.com'))
    
    # Дополнительные настройки для Gmail
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))  # Увеличиваем таймаут до 30 секунд
    
    # Для порта 465 используем SSL, для 587 - TLS
    if EMAIL_PORT == 465:
        EMAIL_USE_SSL = True
        EMAIL_USE_TLS = False
    elif EMAIL_PORT == 587:
        EMAIL_USE_SSL = False
        EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
    else:
        # Если указан другой порт, используем настройки из env
        EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 'yes')
        EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
    
    # Логирование настроек email для отладки (всегда, но без пароля)
    # Используем print для гарантированного вывода в логи Railway
    print(f"[EMAIL CONFIG] Using SMTP backend: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, SSL={EMAIL_USE_SSL}, TLS={EMAIL_USE_TLS}, USER={EMAIL_HOST_USER}, FROM={DEFAULT_FROM_EMAIL}, TIMEOUT={EMAIL_TIMEOUT}")
    logger.info(f"Email settings loaded: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, SSL={EMAIL_USE_SSL}, TLS={EMAIL_USE_TLS}, USER={EMAIL_HOST_USER}, FROM={DEFAULT_FROM_EMAIL}, TIMEOUT={EMAIL_TIMEOUT}")
    
    if not EMAIL_HOST_PASSWORD:
        warning_msg = "⚠️ EMAIL_HOST_PASSWORD не установлен! Email не будет работать. Рекомендуем использовать SendGrid: установите SENDGRID_API_KEY в Railway."
        print(f"[EMAIL CONFIG] {warning_msg}")
        logger.warning(warning_msg)
    else:
        # Логируем длину пароля (без самого пароля) и проверяем, что пробелы убраны
        password_length = len(EMAIL_HOST_PASSWORD)
        had_spaces = ' ' in _email_password_raw if _email_password_raw else False
        success_msg = f"[OK] EMAIL_HOST_PASSWORD установлен (длина: {password_length} символов, пробелы были удалены: {had_spaces})"
        try:
            print(f"[EMAIL CONFIG] {success_msg}")
        except UnicodeEncodeError:
            print(f"[EMAIL CONFIG] [OK] EMAIL_HOST_PASSWORD установлен")
        logger.info(success_msg)
        
        # Совет по использованию SendGrid для Railway
        advice_msg = "[INFO] Совет: Railway блокирует SMTP порты. Рекомендуем использовать SendGrid API вместо SMTP. Установите SENDGRID_API_KEY в Railway."
        try:
            print(f"[EMAIL CONFIG] {advice_msg}")
        except UnicodeEncodeError:
            print(f"[EMAIL CONFIG] [INFO] Railway blocks SMTP ports. Use SendGrid API instead.")
        logger.info(advice_msg)  

SESSION_COOKIE_AGE = 86400 * 7  # 7 дней
SESSION_SAVE_EVERY_REQUEST = True  # Обновляем время жизни сессии при каждом запросе

LOGIN_URL = '/custom-admin/login/'
LOGIN_REDIRECT_URL = '/custom-admin/'
LOGOUT_REDIRECT_URL = '/custom-admin/login/'


PASSWORD_RESET_TIMEOUT = 180

# FCM (Firebase Cloud Messaging) настройки для push-уведомлений
# Используем настоящий Android API Key из Google Cloud Console
FCM_SERVER_KEY = os.getenv('FCM_SERVER_KEY', '')
FCM_API_URL = 'https://fcm.googleapis.com/fcm/send'

# Firebase Admin SDK настройки
# ✅ Файл находится в корне проекта: firebase-service-account.json
# Используется в custom_admin/fcm_modern.py напрямую
FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, 'firebase-service-account.json')

# Telegram Bot настройки
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')

# ✅ ИСПРАВЛЕНИЕ СП-3: Structured Logging и Audit Trail
import os
if not os.path.exists(BASE_DIR / 'logs'):
    os.makedirs(BASE_DIR / 'logs')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'audit.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'error.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
        'audit': {
            'handlers': ['audit_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'custom_admin': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}

# ✅ CELERY CONFIGURATION
# https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html

CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Настройки Celery
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Для асинхронных задач - не блокировать Django при рассылках
CELERY_TASK_ALWAYS_EAGER = False  # В production ДОЛЖНО быть False
CELERY_TASK_EAGER_PROPAGATES = False

# Ограничение на размер задачи (для больших рассылок)
CELERY_TASK_COMPRESSION = 'gzip'
CELERY_RESULT_COMPRESSION = 'gzip'

# Rate limiting для защиты от перегрузки
CELERY_TASK_DEFAULT_RATE_LIMIT = '100/m'  # Максимум 100 задач в минуту

# ✅ SENTRY CONFIGURATION - Мониторинг ошибок
# https://docs.sentry.io/platforms/python/guides/django/

SENTRY_DSN = os.getenv('SENTRY_DSN', '')  # Получаем из переменных окружения

if SENTRY_DSN:
    try:
        import sentry_sdk  # type: ignore[reportMissingImports]
        from sentry_sdk.integrations.django import DjangoIntegration  # type: ignore[reportMissingImports]
        from sentry_sdk.integrations.celery import CeleryIntegration  # type: ignore[reportMissingImports]
        from sentry_sdk.integrations.logging import LoggingIntegration  # type: ignore[reportMissingImports]
        
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                DjangoIntegration(),
                CeleryIntegration(),
                LoggingIntegration(
                    level=logging.INFO,  # Capture info and above as breadcrumbs
                    event_level=logging.ERROR  # Send errors as events
                ),
            ],
            # Set traces_sample_rate to 1.0 to capture 100% of transactions for performance monitoring.
            traces_sample_rate=0.1 if DEBUG else 0.05,  # 10% в dev, 5% в production
            
            # Set profiles_sample_rate to 1.0 to profile 100% of sampled transactions.
            profiles_sample_rate=0.1 if DEBUG else 0.05,
            
            # Send default PII (Personally Identifiable Information) - emails, usernames
            send_default_pii=False,  # Для GDPR compliance
            
            # Environment name
            environment='development' if DEBUG else 'production',
            
            # Release tracking
            # release='birqadam@1.0.0',  # Раскомментируйте для tracking релизов
        )
        
        logger.info('[OK] Sentry инициализирован для мониторинга ошибок')
    except ImportError:
        logger.warning('[WARNING] sentry-sdk не установлен - установите: pip install sentry-sdk')
else:
    logger.warning('[WARNING] SENTRY_DSN не установлен - мониторинг ошибок отключен')