# Deployment Configuration

Эта папка содержит все файлы для развертывания проекта через Docker и Jenkins.

## Структура

- **Dockerfile** - Основной Dockerfile для Django приложения
- **docker-compose.yml** - Docker Compose конфигурация для всех сервисов
- **Jenkinsfile** - Jenkins CI/CD pipeline конфигурация
- **entrypoint.sh** - Entrypoint скрипт для Docker контейнера (с переменными окружения)
- **entrypoint.backend.sh** - Базовый entrypoint скрипт для Docker контейнера

## Использование

### Docker Compose

```bash
cd deployment
docker compose -f docker-compose.yml up -d
```

### Jenkins

Jenkinsfile настроен для автоматического деплоя через Jenkins CI/CD.

### Dockerfile

Dockerfile находится в папке deployment, но контекст сборки - родительская директория (BirQadamDjango).

