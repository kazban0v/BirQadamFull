from abc import ABC, abstractmethod
from typing import Optional


class IAIService(ABC):
    """
    Абстрактный интерфейс для ИИ-сервисов
    """
    
    @abstractmethod
    def ask_question(self, question: str, user=None) -> str:
        """
        Задать вопрос ИИ и получить ответ
        
        Args:
            question: Вопрос пользователя
            user: Пользователь (для доступа к инструментам)
            
        Returns:
            Ответ от ИИ
        """
        pass
    
    @abstractmethod
    def sanitize_question(self, question: str) -> str:
        """
        Очистка и валидация вопроса
        
        Args:
            question: Вопрос пользователя
            
        Returns:
            Очищенный вопрос
        """
        pass