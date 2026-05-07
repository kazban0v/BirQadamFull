import os
import re
import time
import logging
from typing import Optional
import google.generativeai as genai  # Используем старое имя для совместимости с установленной версией
from shared.ai.interfaces import IAIService
from api.support.models import SupportTicket

logger = logging.getLogger(__name__)


class GeminiAIService(IAIService):
    """Сервис для работы с Google Gemini API"""

    FALLBACK_RESPONSES = {
        "как зарегистрироваться": "Для регистрации перейдите на страницу регистрации и заполните форму. Вы можете зарегистрироваться как волонтер или организатор.",
        "как войти": "Используйте номер телефона или email и пароль для входа в систему. Если забыли пароль, используйте функцию восстановления.",
        "что такое волонтерство": "Волонтерство - это добровольная безвозмездная помощь людям и обществу. На платформе BirQadam вы можете участвовать в различных проектах и задачах.",
        "как стать волонтером": "Зарегистрируйтесь на платформе, заполните профиль, выберите интересный проект и подайте заявку на участие.",
        "как создать проект": "Для создания проекта нужно зарегистрироваться как организатор. После одобрения администратором вы сможете создавать проекты и задачи.",
    }

    # Максимальная длина вопроса
    MAX_QUESTION_LENGTH = 1000

    # Таймаут для запроса (секунды)
    REQUEST_TIMEOUT = 30

    def __init__(self):
        # Проверяем наличие API ключа
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            logger.warning("GEMINI_API_KEY не установлен в переменных окружения")
            raise ValueError("GEMINI_API_KEY не установлен в переменных окружения")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        
        # Инструкции для модели Gemini
        self.default_prompt = (
            "Ты дружелюбный помощник для платформы BirQadam - платформы для волонтерства.\n\n"
            "ПРАВИЛА ОТВЕТА:\n"
            "1. Отвечай кратко и по делу (максимум 2-3 предложения)\n"
            "2. Если не знаешь точного ответа, честно скажи об этом\n"
            "3. Не придумывай информацию о платформе - если не уверен, направь в поддержку\n"
            "4. Будь вежливым и профессиональным\n"
            "5. Если вопрос не по теме платформы, вежливо перенаправь на вопросы о волонтерстве\n"
            "6. Всегда отвечай на русском языке\n"
            "7. Не используй markdown форматирование в ответе (никаких **, ##, списков с -)\n"
            "8. Отвечай простым текстом, без эмодзи\n\n"
            "ЗАПРЕЩЕННЫЕ ТЕМЫ (НИКОГДА НЕ ОТВЕЧАЙ НА ЭТИ ВОПРОСЫ):\n"
            "- Медицинские советы, рекомендации по лечению, диагнозы\n"
            "- Сбор персональных данных (паспорт, банковские карты, CVV/CVC)\n"
            "- Финансовые консультации по инвестициям\n"
            "- Юридические консультации\n\n"
            "Если пользователь задает вопрос по запрещенной теме, вежливо откажись и направь к специалисту.\n\n"
            "Помогай пользователям с вопросами о волонтерстве, проектах, задачах и участии в добровольческих инициативах."
        )

    def sanitize_question(self, question: str) -> str:
        """
        Очистка и валидация вопроса
        """
        if not question:
            raise ValueError("Вопрос не может быть пустым")

        # Убираем лишние пробелы
        question = ' '.join(question.split())

        if len(question.strip()) == 0:
            raise ValueError("Вопрос не может быть пустым")

        # Ограничиваем длину
        if len(question) > self.MAX_QUESTION_LENGTH:
            question = question[:self.MAX_QUESTION_LENGTH]
            logger.warning(f"Вопрос обрезан до {self.MAX_QUESTION_LENGTH} символов")

        # Убираем потенциально опасные символы, которые могут сломать промпт
        # Оставляем только буквы, цифры, пробелы и основные знаки препинания
        question = re.sub(r'[^\w\s\?\.\,\!\-\:\;\(\)\"]', '', question)

        return question.strip()

    def _check_prohibited_topics(self, question: str) -> tuple[bool, Optional[str]]:
        """
        Проверка на запрещенные темы
        Возвращает (is_prohibited, reason)
        """
        question_lower = question.lower()

        # Запрещенные темы
        prohibited_patterns = {
            'медицинск': 'Я не могу давать медицинские советы. Обратитесь к врачу.',
            'лекарств': 'Я не могу рекомендовать лекарства. Обратитесь к врачу.',
            'диагноз': 'Я не могу ставить диагнозы. Обратитесь к врачу.',
            'лечить': 'Я не могу давать советы по лечению. Обратитесь к врачу.',
            'паспорт': 'Я не могу обрабатывать персональные данные (паспорт, карты). Обратитесь в поддержку.',
            'банковск': 'Я не могу обрабатывать банковские данные. Обратитесь в поддержку.',
            'карт': 'Я не могу обрабатывать данные банковских карт. Обратитесь в поддержку.',
            'cvv': 'Я не могу обрабатывать данные банковских карт. Обратитесь в поддержку.',
            'cvc': 'Я не могу обрабатывать данные банковских карт. Обратитесь в поддержку.',
        }

        for pattern, reason in prohibited_patterns.items():
            if pattern in question_lower:
                logger.warning(f"Обнаружена запрещенная тема: {pattern}")
                return True, reason

        return False, None

    def _get_fallback_response(self, question: str) -> Optional[str]:
        """Получить fallback ответ для частых вопросов"""
        question_lower = question.lower().strip()

        # Проверяем точные совпадения
        for key, response in self.FALLBACK_RESPONSES.items():
            if key in question_lower:
                logger.info(f"Использован fallback ответ для ключа: {key}")
                return response

        # Обработка простых приветствий
        greeting_patterns = [
            'привет', 'здравствуй', 'добрый день', 'добрый вечер', 'доброе утро',
            'hello', 'hi', 'салам', 'сәлем', 'прив', 'дарова', 'йоу'
        ]

        for greeting in greeting_patterns:
            if greeting in question_lower:
                greeting_response = "Привет! Я - AI-помощник платформы BirQadam. Могу ли я чем-то помочь вам с волонтерством, проектами или задачами?"
                logger.info(f"Использован приветственный ответ для: {greeting}")
                return greeting_response

        # Обработка прощаний
        goodbye_patterns = [
            'пока', 'до свидания', 'до встречи', 'bye', 'goodbye', 'увидимся'
        ]

        for goodbye in goodbye_patterns:
            if goodbye in question_lower:
                goodbye_response = "До свидания! Если у вас возникнут вопросы о волонтерстве или проектах на платформе BirQadam - обращайтесь снова."
                logger.info(f"Использован прощальный ответ для: {goodbye}")
                return goodbye_response

        return None

    def create_support_ticket(self, message: str, user=None) -> str:
        """
        Создать тикет в службу поддержки, если AI не может ответить на вопрос.
        """
        try:
            if not user:
                return "Необходима авторизация для создания тикета."

            # Создаем тикет в БД
            ticket = SupportTicket.objects.create(
                user=user,
                message=message,
                source='ai_chat',
                status='open'
            )

            logger.info(f"Создан тикет поддержки #{ticket.id} от пользователя {user.username if user else 'Anonymous'}: {message[:200]}")

            return (
                f"Ваш вопрос передан в службу поддержки. "
                f"Номер тикета: #{ticket.id}. "
                f"Наша команда свяжется с вами в ближайшее время. "
                f"Уведомление будет отправлено вам в системе."
            )
        except Exception as e:
            logger.error(f"Ошибка при создании тикета: {e}", exc_info=True)
            return "Не удалось создать тикет. Попробуйте обратиться в поддержку напрямую."

    def ask_question(self, question: str, user=None) -> str:
        """
        Задает вопрос Gemini и возвращает ответ
        Включает валидацию, логирование, обработку ошибок и fallback

        Args:
            question: Вопрос пользователя
            user: Пользователь Django (для доступа к инструментам)
        """
        start_time = time.time()

        try:
            # 1. Валидация и санитизация входных данных
            sanitized_question = self.sanitize_question(question)
            logger.info(f"Gemini запрос: {sanitized_question[:100]}...")

            # 2. Проверка на запрещенные темы
            is_prohibited, prohibition_reason = self._check_prohibited_topics(sanitized_question)
            if is_prohibited:
                duration = time.time() - start_time
                logger.warning(f"Запрещенная тема обнаружена за {duration:.2f}с")
                return prohibition_reason or "Я не могу ответить на этот вопрос. Обратитесь к специалисту."

            # 3. Проверяем fallback ответы (включая приветствия)
            fallback_response = self._get_fallback_response(sanitized_question)
            if fallback_response:
                duration = time.time() - start_time
                logger.info(f"Fallback ответ за {duration:.2f}с")
                return fallback_response

            # 4. Получаем ответ от Gemini
            full_prompt = f"{self.default_prompt}\n\nВопрос пользователя: {sanitized_question}"

            response = self.model.generate_content(full_prompt)

            if not response or not response.text:
                logger.warning("Gemini не вернул ответ")
                # Попробуем создать тикет, если Gemini не смог ответить
                ticket_result = self.create_support_ticket(sanitized_question, user)
                return ticket_result

            answer = response.text.strip()

            # Проверяем, что ответ не пустой
            if not answer:
                logger.warning("Gemini вернул пустой ответ")
                # Попробуем создать тикет, если Gemini не смог ответить
                ticket_result = self.create_support_ticket(sanitized_question, user)
                return ticket_result

            duration = time.time() - start_time
            logger.info(f"Gemini ответ получен за {duration:.2f}с, длина: {len(answer)} символов")

            return answer

        except ValueError as e:
            # Ошибки валидации - возвращаем понятное сообщение
            duration = time.time() - start_time
            logger.warning(f"Ошибка валидации за {duration:.2f}с: {str(e)}")
            raise

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Ошибка при работе с Gemini API за {duration:.2f}с: {str(e)}", exc_info=True)

            # Попробуем создать тикет, если произошла ошибка
            ticket_result = self.create_support_ticket(question, user)
            return ticket_result