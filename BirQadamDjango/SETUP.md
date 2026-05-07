## Первый запуск проекта

1. Клонируйте репозиторий
2. Создайте `.env` файл в `BirQadamDjango/` (скопируйте из `.env.example` если есть)
3. Установите Python зависимости:sh
   cd BirQadamDjango
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   4. Настройте базу данных в `.env`
5. Выполните миграции:h
   python manage.py migrate
   6. Соберите статические файлы:
   python manage.py collectstatic
   7. Для фронтенда:
   
   cd portal_frontend
   npm install
   npm run build
   
Данные для .env 

SECRET_KEY=qizm65-+2tfs*^-z5lmo1q0ycwy8@k_p&s(@@-al7!r_%#0!m(

DB_NAME=cleanup_almaty_db
DB_USER=postgres
DB_PASSWORD=Beybit0606
DB_HOST=localhost
DB_PORT=5432

DEBUG=False
ALLOWED_HOSTS=*

TELEGRAM_BOT_TOKEN=8321441790:AAHuOthanfr8iK-W2bbbhRFAnaD1DwVSn9w

FCM_SERVER_KEY=

SENTRY_DSN=

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=birqadamofficial@gmail.com
EMAIL_HOST_PASSWORD=rcmb qxaq arpo fuyv
DEFAULT_FROM_EMAIL=birqadamofficial@gmail.com

SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000


AI_SERVICE_TYPE=gemini  
GEMINI_API_KEY=AIzaSyBJTaYtwl2RSOnrtDFsyj8Al4tsF8F4y30
VITE_GEOAPIFY_API_KEY=1e13ad192bb242a3ade10cb5d52edf5a
VITE_YANDEX_GEOCODER_KEY=91d16fd9-a396-4ffa-ba73-b071b559962a