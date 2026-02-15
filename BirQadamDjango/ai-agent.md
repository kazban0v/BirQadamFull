Архитектура решения

Backend (Django)

1. Сервисный слой: core/services/ai_agent_service.py

Класс AIAgentService — основной сервис для работы с AI.
Основные методы:
create_assistant_agent() — создает агента с инструкциями
sanitize_question() — валидация и очистка входных данных
ask_question() — синхронный запрос к AI
ask_question_async() — асинхронный запрос
_get_fallback_response() — fallback-ответы для частых вопросов

Особенности:

Валидация: проверка пустых вопросов, лимит длины (1000 символов), очистка опасных символов

Обработка ошибок: try/except, логирование, fallback-ответы

Логирование: время выполнения, длина ответов, ошибки

Fallback: 5 готовых ответов для частых вопросов

Оптимизация: модель gpt-4o-mini, max_turns=1 для скорости

2. API Endpoint: core/api/web_portal.py

Класс AIAssistantAPIView — REST API для фронтенда.

URL: /api/web/ai/ask/

Метод: POST

Авторизация: IsAuthenticated (session-based)
Запрос:
{  "question": "Как стать волонтером?"}
Ответ:
{  "question": "Как стать волонтером?",  "answer": "Зарегистрируйтесь на платформе..."}

Обработка ошибок:
400 — пустой вопрос
403/401 — проблемы авторизации
500 — ошибки AI
503 — недоступен API ключ

Frontend (Vue 3 + TypeScript)

1. Сервис: frontend/src/services/ai.ts

Функция askAI() — обертка для API запросов.

export async function askAI(question: string): Promise<AIQuestionResponse>

Использует httpClient из services/http.ts с автоматической авторизацией.
