"""
Вспомогательные функции для работы с Feedback системой через Telegram
"""
import logging
from typing import Any, Optional
from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes
from api.models import User, Project, Photo, FeedbackSession, FeedbackMessage

logger = logging.getLogger(__name__)


@sync_to_async
def create_feedback_session_for_photo(photo: Photo) -> Optional[FeedbackSession]:  # type: ignore[no-any-unimported]
    """
    Создать или получить feedback сессию для фотоотчета
    """
    try:
        session = FeedbackSession.get_or_create_for_photo(photo)  # type: ignore[attr-defined]
        logger.info(f"Создана/получена feedback сессия {session.id if hasattr(session, 'id') else 'unknown'} для фото {photo.id if hasattr(photo, 'id') else 'unknown'}")  # type: ignore[attr-defined]
        return session
    except Exception as e:
        logger.error(f"Ошибка создания feedback сессии: {e}")
        return None


@sync_to_async
def create_photo_feedback_message(session: FeedbackSession, photo: Photo, sender: User) -> Optional[FeedbackMessage]:  # type: ignore[no-any-unimported]
    """
    Создать сообщение в feedback при отправке фотоотчета
    """
    try:
        # Создаем сообщение о фотоотчете
        message = FeedbackMessage.create_from_telegram(  # type: ignore[attr-defined]
            session=session,
            sender=sender,
            text=f"Отправил(а) фотоотчет",
            message_type='photo',
            photo=photo,
            telegram_message_id=None  # Обновим позже
        )
        logger.info(f"Создано feedback сообщение {message.id if hasattr(message, 'id') else 'unknown'} для фото {photo.id if hasattr(photo, 'id') else 'unknown'}")  # type: ignore[attr-defined]
        return message
    except Exception as e:
        logger.error(f"Ошибка создания feedback сообщения: {e}")
        return None


@sync_to_async
def create_organizer_comment_message(session: FeedbackSession, photo: Photo, organizer: User, comment_text: str, telegram_message_id: Optional[int] = None) -> Optional[FeedbackMessage]:  # type: ignore[no-any-unimported]
    """
    Создать сообщение с комментарием организатора
    """
    try:
        # Создаем текстовое сообщение с комментарием
        message = FeedbackMessage.create_from_telegram(  # type: ignore[attr-defined]
            session=session,
            sender=organizer,
            text=comment_text,
            message_type='text',
            photo=photo,  # Связываем с фото
            telegram_message_id=telegram_message_id
        )
        logger.info(f"Создан комментарий организатора {message.id if hasattr(message, 'id') else 'unknown'} к фото {photo.id if hasattr(photo, 'id') else 'unknown'}")  # type: ignore[attr-defined]
        return message
    except Exception as e:
        logger.error(f"Ошибка создания комментария: {e}")
        return None


@sync_to_async
def create_system_message(session: FeedbackSession, text: str) -> Optional[FeedbackMessage]:  # type: ignore[no-any-unimported]
    """
    Создать системное сообщение (например, "Фото одобрено" или "Фото отклонено")
    """
    try:
        message = FeedbackMessage.objects.create(  # type: ignore[attr-defined]
            session=session,
            sender=session.organizer,  # От имени организатора
            text=text,
            message_type='system',
            is_read=False
        )
        logger.info(f"Создано системное сообщение {message.id if hasattr(message, 'id') else 'unknown'}: {text}")  # type: ignore[attr-defined]
        return message
    except Exception as e:
        logger.error(f"Ошибка создания системного сообщения: {e}")
        return None


@sync_to_async
def get_feedback_session_by_project_and_volunteer(project_id: int, volunteer_telegram_id: str) -> Optional[FeedbackSession]:  # type: ignore[no-any-unimported]
    """
    Получить активную feedback сессию для проекта и волонтера
    """
    try:
        volunteer = User.objects.get(telegram_id=volunteer_telegram_id)
        project = Project.objects.get(id=project_id)

        session = FeedbackSession.objects.filter(
            volunteer=volunteer,
            project=project,
            is_active=True
        ).first()

        return session
    except Exception as e:
        logger.error(f"Ошибка получения feedback сессии: {e}")
        return None


@sync_to_async
def send_message_to_session(session: FeedbackSession, sender_telegram_id: str, text: str, telegram_message_id: Optional[int] = None) -> Optional[FeedbackMessage]:  # type: ignore[no-any-unimported]
    """
    Отправить текстовое сообщение в feedback сессию
    """
    try:
        sender = User.objects.get(telegram_id=sender_telegram_id)  # type: ignore[attr-defined]

        message = FeedbackMessage.create_from_telegram(  # type: ignore[attr-defined]
            session=session,
            sender=sender,
            text=text,
            message_type='text',
            telegram_message_id=telegram_message_id
        )

        logger.info(f"Сообщение {message.id if hasattr(message, 'id') else 'unknown'} добавлено в сессию {session.id if hasattr(session, 'id') else 'unknown'}")  # type: ignore[attr-defined]
        return message
    except Exception as e:
        logger.error(f"Ошибка отправки сообщения: {e}")
        return None


@sync_to_async
def get_organizer_by_project(project_id: int) -> Optional[User]:  # type: ignore[no-any-unimported]
    """
    Получить организатора проекта
    """
    try:
        project = Project.objects.get(id=project_id)  # type: ignore[attr-defined]
        return project.creator
    except Exception as e:
        logger.error(f"Ошибка получения организатора: {e}")
        return None


@sync_to_async
def get_photo_by_id(photo_id: int) -> Optional[Photo]:  # type: ignore[no-any-unimported]
    """
    Получить фотоотчет по ID
    """
    try:
        return Photo.objects.select_related('volunteer', 'project').get(id=photo_id)  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Ошибка получения фото: {e}")
        return None


async def notify_organizer_about_photo(context: ContextTypes.DEFAULT_TYPE, photo_id: int, session_id: int) -> None:
    """
    Отправить уведомление организатору о новом фотоотчете
    """
    try:
        photo = await get_photo_by_id(photo_id)
        if not photo:
            logger.error(f"Фото {photo_id} не найдено")
            return

        organizer = photo.project.creator

        if not organizer.telegram_id:
            logger.warning(f"У организатора {organizer.username} нет telegram_id")
            return

        message_text = (
            f"📸 Новый фотоотчет от {photo.volunteer.name or photo.volunteer.username}\n\n"
            f"Проект: {photo.project.title}\n"
            f"Время: {photo.uploaded_at.strftime('%d.%m.%Y %H:%M')}\n\n"
            f"⭐ Нажмите на кнопку «Проверить фото» в меню организатора, чтобы оценить работу волонтера."
        )

        # Отправляем фото организатору
        await context.bot.send_photo(
            chat_id=organizer.telegram_id,
            photo=photo.image.path if hasattr(photo.image, 'path') else photo.image.url,
            caption=message_text
        )

        logger.info(f"Уведомление о фото {photo_id} отправлено организатору {organizer.telegram_id}")

    except Exception as e:
        logger.error(f"Ошибка отправки уведомления организатору: {e}")


async def notify_volunteer_about_comment(context: ContextTypes.DEFAULT_TYPE, volunteer_telegram_id: str, comment_text: str, photo_status: str) -> None:
    """
    Отправить уведомление волонтеру о комментарии организатора
    """
    try:
        status_emoji = "✅" if photo_status == "approved" else "❌" if photo_status == "rejected" else "💬"

        message_text = (
            f"{status_emoji} Комментарий от организатора:\n\n"
            f"{comment_text}"
        )

        await context.bot.send_message(
            chat_id=volunteer_telegram_id,
            text=message_text
        )

        logger.info(f"Уведомление о комментарии отправлено волонтеру {volunteer_telegram_id}")

    except Exception as e:
        logger.error(f"Ошибка отправки уведомления волонтеру: {e}")


# Обработчик для сохранения сообщений из Telegram в БД
async def handle_feedback_message_from_telegram(update: Update, context: ContextTypes.DEFAULT_TYPE, session_id: int) -> None:
    """
    Обработать сообщение из Telegram и сохранить в БД
    """
    try:
        if not update.effective_user:
            logger.error("No effective_user in update")
            return
        if not update.message or not update.message.text:
            logger.error("No message or message text in update")
            return
        user_telegram_id = str(update.effective_user.id)
        message_text = update.message.text
        telegram_message_id = update.message.message_id

        # Получаем сессию
        session = await sync_to_async(FeedbackSession.objects.get)(id=session_id)  # type: ignore[attr-defined]

        # Сохраняем сообщение
        message = await send_message_to_session(
            session=session,
            sender_telegram_id=user_telegram_id,
            text=message_text,
            telegram_message_id=telegram_message_id
        )

        if message:
            logger.info(f"Сообщение из Telegram сохранено: {message.id if hasattr(message, 'id') else 'unknown'}")  # type: ignore[attr-defined]

            # Проверяем, не помечено ли как спам
            if message.is_flagged:
                if update.message:
                    await update.message.reply_text(
                        "⚠️ Ваше сообщение содержит недопустимый контент и будет проверено модератором."
                    )
        else:
            logger.error("Не удалось сохранить сообщение")

    except Exception as e:
        logger.error(f"Ошибка обработки сообщения из Telegram: {e}")
