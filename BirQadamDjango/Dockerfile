# Используем официальный Python
FROM python:3.12

# Настройки среды
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Рабочая директория
WORKDIR /app

# Копируем зависимости и устанавливаем
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Копируем всё
COPY . .

# Команда запуска Django
CMD ["bash", "-c", "python manage.py runserver 0.0.0.0:8003 & python bot.py"]

