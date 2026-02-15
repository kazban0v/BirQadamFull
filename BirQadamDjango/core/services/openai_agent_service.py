import os
import re
import time
import logging
from typing import Optional
from agents import Agent, Runner, function_tool
from core.interfaces.ai_service import IAIService
from core.models import SupportTicket

logger = logging.getLogger(__name__)


class OpenAIAgentService(IAIService):
    """Сервис для работы с OpenAI API (оригинальная реализация)"""

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
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            logger.warning("OPENAI_API_KEY не установлен в переменных окружения")
            raise ValueError("OPENAI_API_KEY не установлен в переменных окружения")

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

    def create_assistant_agent(self, instructions: Optional[str] = None, user=None) -> Agent:
        """Создает агента-помощника для BirQadam"""
        default_instructions = (
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
            "ИНСТРУМЕНТЫ:\n"
            "- Используй get_active_projects() для получения списка доступных проектов\n"
            "- Используй check_user_status() для проверки статуса заявок пользователя\n"
            "- Используй create_support_ticket() ТОЛЬКО если не можешь ответить на вопрос или вопрос требует вмешательства администратора\n"
            "- НЕ создавай тикет для обычных вопросов, на которые ты можешь ответить\n\n"
            "Помогай пользователям с вопросами о волонтерстве, проектах, задачах и участии в добровольческих инициативах."
        )

        # Создаем инструменты с замыканием для доступа к user
        current_user = user  # Сохраняем user в локальной переменной для замыкания

        # Инструмент для получения активных проектов
        @function_tool
        def get_active_projects(limit: int = 5) -> str:
            """
            Получить список активных волонтерских проектов на платформе.

            Args:
                limit: Максимальное количество проектов для возврата (по умолчанию 5)

            Returns:
                Строка с информацией о проектах
            """
            try:
                from core.models import Project

                projects = Project.objects.filter(
                    is_deleted=False,
                    status='approved'
                ).select_related('creator')[:limit]

                if not projects.exists():
                    return "На данный момент нет доступных активных проектов."

                result = f"Найдено {projects.count()} активных проектов:\n\n"
                for project in projects:
                    result += f"• {project.title}\n"
                    result += f"  Тип: {project.get_volunteer_type_display()}\n"
                    result += f"  Город: {project.city}\n"
                    if project.description:
                        desc = project.description[:100] + "..." if len(project.description) > 100 else project.description
                        result += f"  Описание: {desc}\n"
                    result += f"  ID проекта: {project.id}\n\n"

                return result
            except Exception as e:
                logger.error(f"Ошибка при получении проектов: {e}")
                return "Не удалось получить список проектов. Попробуйте позже."

        # Инструмент для проверки статуса пользователя
        @function_tool
        def check_user_status() -> str:
            """
            Проверить статус заявок и участия текущего пользователя в проектах и задачах.

            Returns:
                Строка с информацией о статусе пользователя
            """
            if not current_user:
                return "Необходима авторизация для проверки статуса."

            try:
                from core.models import VolunteerProject, TaskAssignment, Project

                # Проекты, в которых участвует пользователь
                volunteer_projects = VolunteerProject.objects.filter(
                    volunteer=current_user,
                    is_active=True
                ).select_related('project')

                # Активные задачи
                active_tasks = TaskAssignment.objects.filter(
                    volunteer=current_user,
                    completed=False
                ).select_related('task', 'task__project')

                result = f"Статус пользователя {current_user.username}:\n\n"

                # Информация о проектах
                if volunteer_projects.exists():
                    result += f"Активных проектов: {volunteer_projects.count()}\n"
                    for vp in volunteer_projects[:3]:
                        result += f"  • {vp.project.title} (ID: {vp.project.id})\n"
                else:
                    result += "Вы не участвуете ни в одном проекте.\n"

                result += "\n"

                # Информация о задачах
                if active_tasks.exists():
                    result += f"Активных задач: {active_tasks.count()}\n"
                    for task_assignment in active_tasks[:3]:
                        result += f"  • {task_assignment.task.title} (Проект: {task_assignment.task.project.title})\n"
                else:
                    result += "У вас нет активных задач.\n"

                return result
            except Exception as e:
                logger.error(f"Ошибка при проверке статуса пользователя: {e}")
                return "Не удалось проверить статус. Попробуйте позже."

        # Инструмент для создания тикета поддержки
        @function_tool
        def create_support_ticket(message: str) -> str:
            """
            Создать тикет в службу поддержки, если AI не может ответить на вопрос.

            Args:
                message: Сообщение с вопросом или проблемой пользователя

            Returns:
                Подтверждение создания тикета
            """
            try:
                if not current_user:
                    return "Необходима авторизация для создания тикета."

                # Создаем тикет в БД
                ticket = SupportTicket.objects.create(
                    user=current_user,
                    message=message,
                    source='ai_chat',
                    status='open'
                )

                logger.info(f"Создан тикет поддержки #{ticket.id} от пользователя {current_user.username}: {message[:200]}")

                return (
                    f"Ваш вопрос передан в службу поддержки. "
                    f"Номер тикета: #{ticket.id}. "
                    f"Наша команда свяжется с вами в ближайшее время. "
                    f"Уведомление будет отправлено вам в системе."
                )
            except Exception as e:
                logger.error(f"Ошибка при создании тикета: {e}", exc_info=True)
                return "Не удалось создать тикет. Попробуйте обратиться в поддержку напрямую."

        tools = [get_active_projects, check_user_status, create_support_ticket]

        return Agent(
            name="BirQadam Assistant",
            instructions=instructions or default_instructions,
            model="gpt-4o-mini",
            tools=tools
        )

    def _get_fallback_response(self, question: str) -> Optional[str]:
        """Получить fallback ответ для частых вопросов"""
        question_lower = question.lower().strip()

        # Проверяем точные совпадения
        for key, response in self.FALLBACK_RESPONSES.items():
            if key in question_lower:
                logger.info(f"Использован fallback ответ для ключа: {key}")
                return response

        return None

    def ask_question(self, question: str, instructions: Optional[str] = None, max_turns: int = 3, user=None) -> str:
        """
        Задает вопрос агенту и возвращает ответ (синхронная версия)
        Включает валидацию, логирование, обработку ошибок и fallback

        Args:
            question: Вопрос пользователя
            instructions: Опциональные инструкции для агента
            max_turns: Максимальное количество итераций (увеличено для работы с инструментами)
            user: Пользователь Django (для доступа к инструментам)
        """
        start_time = time.time()

        try:
            # 1. Валидация и санитизация входных данных
            sanitized_question = self.sanitize_question(question)
            logger.info(f"AI запрос: {sanitized_question[:100]}...")

            # 2. Проверка на запрещенные темы
            is_prohibited, prohibition_reason = self._check_prohibited_topics(sanitized_question)
            if is_prohibited:
                duration = time.time() - start_time
                logger.warning(f"Запрещенная тема обнаружена за {duration:.2f}с")
                return prohibition_reason or "Я не могу ответить на этот вопрос. Обратитесь к специалисту."

            # 4. Проверяем fallback ответы
            fallback_response = self._get_fallback_response(sanitized_question)
            if fallback_response:
                duration = time.time() - start_time
                logger.info(f"Fallback ответ за {duration:.2f}с")
                return fallback_response

            # 5. Получаем ответ от AI с инструментами
            agent = self.create_assistant_agent(instructions, user=user)

            # Увеличиваем max_turns для работы с инструментами
            result = Runner.run_sync(agent, sanitized_question, max_turns=max_turns)

            # 4. Проверка результата
            if not result or not result.final_output:
                logger.warning("AI не вернул ответ")
                raise ValueError("AI не вернул ответ")

            answer = result.final_output.strip()

            # Проверяем, что ответ не пустой
            if not answer:
                logger.warning("AI вернул пустой ответ")
                raise ValueError("AI вернул пустой ответ")

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
            logger.error(f"Ошибка при работе с AI агентом за {duration:.2f}с: {str(e)}", exc_info=True)

            # 5. Fallback на общий ответ при ошибке
            return (
                "Извините, временно не могу ответить на ваш вопрос. "
                "Попробуйте переформулировать вопрос или обратиться в поддержку платформы."
            )