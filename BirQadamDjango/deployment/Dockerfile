# Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# Системные зависимости (при необходимости добавишь свои)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Зависимости Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . /app/

# Порт (если запускаешь через gunicorn на 8000)
EXPOSE 8000

# Старт по умолчанию: gunicorn
# ЗАМЕНИ `config.wsgi:application` на свой модуль wsgi
CMD ["gunicorn", "birqadam_project.wsgi:application", "--bind", "0.0.0.0:8000"]