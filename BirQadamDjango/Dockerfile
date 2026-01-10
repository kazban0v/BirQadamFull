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

# Порт будет установлен через переменную окружения $PORT
EXPOSE 8000

# Entrypoint (migrate + collectstatic at runtime)
RUN chmod +x /app/entrypoint.sh
RUN chmod +x /app/start.sh

# Старт по умолчанию: используем start.sh который обрабатывает PORT
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/start.sh"]
