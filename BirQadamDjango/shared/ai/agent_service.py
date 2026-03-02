"""
AI Agent Service
Сервис для работы с AI агентами (поддерживает разные провайдеры)
"""
import os
import time
import logging
from enum import Enum
from typing import Optional
from shared.ai.gemini_service import GeminiAIService
from shared.ai.openai_service import OpenAIAgentService

logger = logging.getLogger(__name__)


class AIServiceType(Enum):
    GEMINI = "gemini"
    OPENAI = "openai"


class AIAgentService:
    """Сервис для работы с AI агентами (поддерживает разные провайдеры)"""

    def __init__(self):
        self.service_type = os.getenv('AI_SERVICE_TYPE', 'gemini').lower()
        
        if self.service_type == AIServiceType.GEMINI.value:
            self.service = GeminiAIService()
        elif self.service_type == AIServiceType.OPENAI.value:
            self.service = OpenAIAgentService()
        else:
            # По умолчанию используем Gemini
            self.service = GeminiAIService()
    
    def sanitize_question(self, question: str) -> str:
        """
        Очистка и валидация вопроса
        """
        return self.service.sanitize_question(question)

    def ask_question(self, question: str, instructions: Optional[str] = None, max_turns: int = 3, user=None) -> str:
        """
        Задает вопрос ИИ и возвращает ответ
        Включает валидацию, логирование, обработку ошибок и fallback

        Args:
            question: Вопрос пользователя
            instructions: Опциональные инструкции (не используется в Gemini)
            max_turns: Максимальное количество итераций (не используется в Gemini)
            user: Пользователь Django (для доступа к инструментам)
        """
        start_time = time.time()

        try:
            # Вызов соответствующего сервиса для обработки вопроса
            if hasattr(self.service, 'ask_question'):
                answer = self.service.ask_question(question, user)
            else:
                # Для обратной совместимости
                answer = self.service.ask_question(question, instructions, max_turns, user)

            duration = time.time() - start_time
            logger.info(f"AI ответ получен за {duration:.2f}с, длина: {len(answer)} символов")

            return answer

        except ValueError as e:
            # Ошибки валидации - возвращаем понятное сообщение
            duration = time.time() - start_time
            logger.warning(f"Ошибка валидации за {duration:.2f}с: {str(e)}")
            raise

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Ошибка при работе с AI API за {duration:.2f}с: {str(e)}", exc_info=True)

            # Fallback на общий ответ при ошибке
            return (
                "Извините, временно не могу ответить на ваш вопрос. "
                "Попробуйте переформулировать вопрос или обратитесь в поддержку платформы."
            )

    async def ask_question_async(self, question: str, instructions: Optional[str] = None, max_turns: int = 3, user=None) -> str:
        """Асинхронная версия для использования в Django views"""
        # Для большинства ИИ-сервисов асинхронная версия будет такой же, как и синхронная
        return self.ask_question(question, instructions, max_turns, user)

