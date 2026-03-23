from pathlib import Path
import os
import logging
from dotenv import load_dotenv
from datetime import timedelta

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# Security
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'False') == 'True'

if DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    allowed_hosts_str = os.getenv('ALLOWED_HOSTS', '').strip()
    if not allowed_hosts_str:
        ALLOWED_HOSTS = ['*']
        logger.warning("ALLOWED_HOSTS not set in production! Set ALLOWED_HOSTS in .env file")
    else:
        ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_str.split(',') if host.strip()]

# CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS_DEV = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8002",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.0.2.2:8000",
]

_cors_allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
if DEBUG:
    CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_DEV.copy()
    if _cors_allowed_origins_env:
        for origin in _cors_allowed_origins_env.split(","):
            origin = origin.strip()
            if not origin:
                continue
            if not origin.startswith(("http://", "https://")):
                origin = f"http://{origin}"
            if origin not in CORS_ALLOWED_ORIGINS:
                CORS_ALLOWED_ORIGINS.append(origin)
else:
    if not _cors_allowed_origins_env:
        CORS_ALLOWED_ORIGINS = []
        logger.error("CORS_ALLOWED_ORIGINS not set in production! Set CORS_ALLOWED_ORIGINS in .env file")
    else:
        CORS_ALLOWED_ORIGINS = []
        for origin in _cors_allowed_origins_env.split(","):
            origin = origin.strip()
            if not origin:
                continue
            if not origin.startswith(("http://", "https://")):
                origin = f"https://{origin}"
            CORS_ALLOWED_ORIGINS.append(origin)

CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]

CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

# CSRF
CSRF_TRUSTED_ORIGINS_DEV = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://cleanup.almau.edu.kz",
    "https://birqadam.almau.edu.kz",
]

_csrf_trusted_origins_env = os.getenv("CSRF_TRUSTED_ORIGINS", "").strip()
if DEBUG:
    CSRF_TRUSTED_ORIGINS = CSRF_TRUSTED_ORIGINS_DEV.copy()
    if _csrf_trusted_origins_env:
        CSRF_TRUSTED_ORIGINS.extend([
            origin.strip() for origin in _csrf_trusted_origins_env.split(",") 
            if origin.strip() and origin.strip() not in CSRF_TRUSTED_ORIGINS
        ])
else:
    if not _csrf_trusted_origins_env:
        CSRF_TRUSTED_ORIGINS = []
        logger.error("CSRF_TRUSTED_ORIGINS not set in production! Set CSRF_TRUSTED_ORIGINS in .env file")
    else:
        CSRF_TRUSTED_ORIGINS = [
            origin.strip() for origin in _csrf_trusted_origins_env.split(",") 
            if origin.strip()
        ]

def _getenv_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}

USE_X_FORWARDED_HOST = _getenv_bool("USE_X_FORWARDED_HOST", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if _getenv_bool("USE_X_FORWARDED_PROTO", False) else None

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SAMESITE = "None"

# Applications
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'api.apps.ApiConfig',
    'taggit',
    'rest_framework',
    'rest_framework_simplejwt',
    'public_site',
    'admin_panel',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'admin_panel.utils.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
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

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'admin_panel.middleware.middleware.RememberMeMiddleware',
    'admin_panel.middleware.middleware.RateLimitMiddleware',
    'admin_panel.middleware.middleware.LoginAttemptMiddleware',
]

if DEBUG:
    MIDDLEWARE.insert(7, 'admin_panel.middleware.jwt_debug.JWTDebugMiddleware')

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

RATE_LIMIT_ENABLED = True
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 60
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_DURATION = 900

TRUSTED_PROXIES = []

ROOT_URLCONF = 'birqadam_project.urls'

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
                'public_site.context_processors.frontend_url',
            ],
        },
    },
]

WSGI_APPLICATION = 'birqadam_project.wsgi.application'

# Database
DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

if DATABASE_URL:
    import re
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
    db_host = os.getenv('DB_HOST', '').strip() or os.getenv('PGHOST', '').strip()
    db_port = os.getenv('DB_PORT', '5432').strip() or os.getenv('PGPORT', '5432').strip()
    
    if db_host and ':' in db_host:
        parts = db_host.split(':')
        db_host = parts[0]
        if len(parts) > 1 and not db_port or db_port == '5432':
            db_port = parts[1]
    
    if not db_host:
        if DEBUG:
            db_host = 'localhost'
        else:
            logger.error(
                f"DB_HOST is not set! Available env vars: "
                f"DB_HOST={os.getenv('DB_HOST')}, "
                f"PGHOST={os.getenv('PGHOST')}, "
                f"DATABASE_URL={'SET' if os.getenv('DATABASE_URL') else 'NOT SET'}"
            )
            raise ValueError(
                "DB_HOST must be set in production! "
                "Set DB_HOST in environment variables or use DATABASE_URL."
            )
    
    if not db_host or db_host == '':
        raise ValueError("DB_HOST cannot be empty! Set DB_HOST in environment variables.")
    
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
    
    if not DEBUG:
        logger.info(f"Database config: HOST={db_host}, PORT={db_port}, NAME={os.getenv('DB_NAME', 'postgres')}, USER={os.getenv('DB_USER', 'postgres')}")

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-cleanupalmaty',
        'TIMEOUT': 300,
        'OPTIONS': {
            'MAX_ENTRIES': 1000
        }
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Asia/Almaty'
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'admin_panel/static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'api.User'

# Email
RESEND_API_KEY = os.getenv('RESEND_API_KEY', '').strip()
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '').strip()

if RESEND_API_KEY:
    EMAIL_BACKEND = 'api.email_backends.ResendEmailBackend'
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'birqadamofficial@gmail.com')
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
    logger.info(f"Using Resend API backend. FROM_EMAIL={DEFAULT_FROM_EMAIL}")
elif SENDGRID_API_KEY:
    EMAIL_BACKEND = 'api.email_backends.SendGridEmailBackend'
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'birqadamofficial@gmail.com')
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
    logger.info(f"Using SendGrid API backend. FROM_EMAIL={DEFAULT_FROM_EMAIL}")
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    
    _email_port = os.getenv('EMAIL_PORT', '').strip()
    if _email_port:
        EMAIL_PORT = int(_email_port)
    else:
        EMAIL_PORT = 465
    
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'birqadamofficial@gmail.com')
    _email_password_raw = os.getenv('EMAIL_HOST_PASSWORD', '').strip()
    EMAIL_HOST_PASSWORD = _email_password_raw.replace(' ', '').replace('-', '') if _email_password_raw else ''
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', os.getenv('EMAIL_HOST_USER', 'birqadamofficial@gmail.com'))
    EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
    
    if EMAIL_PORT == 465:
        EMAIL_USE_SSL = True
        EMAIL_USE_TLS = False
    elif EMAIL_PORT == 587:
        EMAIL_USE_SSL = False
        EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
    else:
        EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 'yes')
        EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
    
    logger.info(f"Email settings: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, SSL={EMAIL_USE_SSL}, TLS={EMAIL_USE_TLS}, USER={EMAIL_HOST_USER}, FROM={DEFAULT_FROM_EMAIL}")
    
    if not EMAIL_HOST_PASSWORD:
        logger.warning("EMAIL_HOST_PASSWORD not set! Email will not work. Consider using SendGrid: set SENDGRID_API_KEY.")

# Session
SESSION_COOKIE_AGE = 86400 * 7
SESSION_SAVE_EVERY_REQUEST = True

LOGIN_URL = '/custom-admin/login/'
LOGIN_REDIRECT_URL = '/custom-admin/'
LOGOUT_REDIRECT_URL = '/custom-admin/login/'
PASSWORD_RESET_TIMEOUT = 180

# FCM
FCM_SERVER_KEY = os.getenv('FCM_SERVER_KEY', '')
FCM_API_URL = 'https://fcm.googleapis.com/fcm/send'
FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, 'config', 'firebase-service-account.json')

# Telegram Bot
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')

# Logging
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
            'maxBytes': 10485760,
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'audit.log',
            'maxBytes': 10485760,
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'error.log',
            'maxBytes': 10485760,
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
        'api': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'admin_panel': {
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

# Celery
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TASK_COMPRESSION = 'gzip'
CELERY_RESULT_COMPRESSION = 'gzip'
CELERY_TASK_DEFAULT_RATE_LIMIT = '100/m'

# Sentry
SENTRY_DSN = os.getenv('SENTRY_DSN', '')

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                DjangoIntegration(),
                CeleryIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR
                ),
            ],
            traces_sample_rate=0.1 if DEBUG else 0.05,
            profiles_sample_rate=0.1 if DEBUG else 0.05,
            send_default_pii=False,
            environment='development' if DEBUG else 'production',
        )
        
        logger.info('Sentry initialized for error monitoring')
    except ImportError:
        logger.warning('sentry-sdk not installed - install: pip install sentry-sdk')
else:
    logger.warning('SENTRY_DSN not set - error monitoring disabled')
