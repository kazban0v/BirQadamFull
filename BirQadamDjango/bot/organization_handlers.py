import logging
import os
from datetime import datetime, time
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove, Update, KeyboardButton
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes
from telegram.error import TimedOut
from asgiref.sync import sync_to_async
from django.db import transaction 
from django.utils import timezone
import asyncio
from django.db.models import Q
import traceback
from telegram.error import TelegramError
import aiofiles 
from bot.telegram_bot import application
from core.models import User, Project, VolunteerProject, Task, TaskAssignment, Photo, FeedbackSession, FeedbackMessage
from typing import Any
# Настройка логирования
logger = logging.getLogger(__name__)

# Состояния для ConversationHandler
TITLE, DESCRIPTION, VOLUNTEER_TYPE, CITY, TAGS, LOCATION = range(6)
SELECT_PROJECT, SELECT_RECIPIENTS, SELECT_VOLUNTEERS, TASK_TEXT, TASK_DEADLINE_DATE, TASK_DEADLINE_START_TIME, TASK_DEADLINE_END_TIME, TASK_PHOTO, TASK_PHOTO_UPLOAD, CONFIRM_TASK, FEEDBACK = range(11)
MODERATE_PHOTO, MODERATE_PHOTO_ACTION, FEEDBACK_SESSION = range(3)
VOLUNTEER_FEEDBACK = 0

# Количество элементов на странице для пагинации
PHOTOS_PER_PAGE = 5

# В функции get_org_keyboard() добавим новую кнопку
def get_org_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📝 Создать проект", callback_data="create_project"),
         InlineKeyboardButton("👥 Просмотреть волонтёров", callback_data="manage_volunteers")],
        [InlineKeyboardButton("📌 Отправить задание", callback_data="send_task"),
         InlineKeyboardButton("🖼️ Проверить фото", callback_data="check_photos")],
        [InlineKeyboardButton("📂 Мои проекты", callback_data="my_projects")]  
    ])
async def send_telegram_message(chat_id: int | str, text: str, context: Any = None) -> None:
    try:
        if context and hasattr(context, 'bot'):
            await context.bot.send_message(chat_id=chat_id, text=text)
        elif application and application.bot:
            await application.bot.send_message(chat_id=chat_id, text=text)
        else:
            logger.error("Ни context.bot, ни application.bot не доступны для отправки сообщения")
            return
        logger.info(f"Сообщение отправлено в {chat_id}: {text}")
    except Exception as e:
        logger.error(f"Ошибка отправки в {chat_id}: {str(e)}\n{traceback.format_exc()}")        
# Вспомогательные функции с sync_to_async
@sync_to_async
def get_user(telegram_id: str) -> Any:
    try:
        user = User.objects.get(telegram_id=telegram_id)
        logger.info(f"User found: {user.username} (telegram_id: {telegram_id})")
        return user
    except User.DoesNotExist:  # type: ignore[attr-defined]
        logger.warning(f"User not found with telegram_id: {telegram_id}")
        return None

@sync_to_async
def get_admin() -> Any:
    try:
        admin = User.objects.filter(is_staff=True).first()
        if admin:
            logger.info(f"Admin found: {admin.username}")
            return admin
        else:
            logger.warning("No admin found")
            return None
    except Exception as e:
        logger.error(f"Error fetching admin: {e}\n{traceback.format_exc()}")
        return None

@sync_to_async
def create_project(title: str, description: str, city: str, tags: str, creator: Any, latitude: float | None = None, longitude: float | None = None, volunteer_type: str = "environmental") -> Any:
    logger.info(f"Creating project: {title} by {creator.username}")
    try:
        # ✅ ИСПРАВЛЕНИЕ: Автоматически одобряем проекты от одобренных организаторов
        project_status = 'approved' if creator.is_approved else 'pending'
        
        project = Project.objects.create(
            title=title,
            description=description,
            city=city,
            creator=creator,
            status=project_status,
            latitude=latitude,
            longitude=longitude,
            volunteer_type=volunteer_type
        )
        project.tags.add(*tags.split(','))
        logger.info(f"Project created: {project.title} (id: {project.id}) with status '{project_status}' and location ({latitude}, {longitude})")  # type: ignore[attr-defined]
        return project
    except Exception as e:
        logger.error(f"Error creating project: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def get_volunteers_for_project(creator: Any) -> list[tuple[str, list[str]]]:
    logger.info(f"Fetching volunteers for creator: {creator.username}")
    try:
        projects = Project.objects.filter(creator=creator).prefetch_related('volunteer_projects__volunteer')
        result = []
        for project in projects:
            volunteers = [vp.volunteer.username for vp in project.volunteer_projects.all()]  # type: ignore[attr-defined]
            result.append((project.title, volunteers))
        logger.info(f"Found {len(result)} projects with volunteers for {creator.username}")
        return result
    except Exception as e:
        logger.error(f"Error fetching volunteers: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def get_organizer_projects(organizer: Any) -> list[Any]:
    logger.info(f"Fetching active projects for organizer: {organizer.username}")
    try:
        projects = Project.objects.filter(
            creator=organizer,
            status='approved',
            is_deleted=False,
            deleted_at__isnull=True
        ).order_by('-created_at')
        
        logger.info(f"Found {projects.count()} active projects for organizer {organizer.username}")
        return list(projects)
    except Exception as e:
        logger.error(f"Error fetching organizer projects: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def get_project_volunteers(project: Any) -> list[tuple[Any, str, str | None]]:
    logger.info(f"Fetching volunteers for project: {project.title} (id: {project.id})")
    try:
        volunteer_projects = VolunteerProject.objects.filter(project=project, is_active=True).select_related('volunteer')
        logger.info(f"Found {volunteer_projects.count()} VolunteerProject records")
        for vp in volunteer_projects:
            logger.info(f"VolunteerProject id={vp.id}, volunteer={vp.volunteer.username if vp.volunteer else 'None'}, is_active={vp.is_active}")  # type: ignore[attr-defined]
        result = []
        for vp in volunteer_projects:
            if vp.volunteer:
                logger.info(f"Found volunteer: {vp.volunteer.username} (telegram_id: {vp.volunteer.telegram_id})")
                result.append((vp.volunteer, vp.volunteer.username, vp.volunteer.telegram_id))
            else:
                logger.warning(f"VolunteerProject {vp.id} has no volunteer")  # type: ignore[attr-defined]
        logger.info(f"Total volunteers found: {len(result)}")
        return result
    except Exception as e:
        logger.error(f"Error fetching project volunteers: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def create_task(project: Any, creator: Any, text: str, deadline_date: Any | None, start_time: Any | None, end_time: Any | None, photo_path: str | None = None) -> Any:
    logger.info(f"Creating task for project: {project.title} by {creator.username}")
    try:
        task = Task.objects.create(project=project, creator=creator, text=text, deadline_date=deadline_date, start_time=start_time, end_time=end_time)
        if photo_path:
            task.task_image = photo_path
            task.save()
        logger.info(f"Task created: {task.id}")  # type: ignore[attr-defined]
        return task
    except Exception as e:
        logger.error(f"Error creating task: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def get_pending_photos_for_organizer(organizer: Any, page: int = 0, per_page: int = PHOTOS_PER_PAGE) -> tuple[list[tuple[Any, str, str, Any | None]], int]:
    logger.info(f"Fetching pending photos for organizer: {organizer.username}, page: {page}")
    try:
        photos = Photo.objects.filter(project__creator=organizer, status='pending').select_related('volunteer', 'project', 'task')
        total = photos.count()
        photos = photos[page * per_page:(page + 1) * per_page]
        result = [(photo, photo.volunteer.username, photo.project.title, photo.task) for photo in photos]
        logger.info(f"Found {len(result)} pending photos for organizer {organizer.username} on page {page}")
        return result, total
    except Exception as e:
        logger.error(f"Error fetching pending photos: {e}\n{traceback.format_exc()}")
        raise

@sync_to_async
def approve_photo(photo: Any) -> None:
    logger.info(f"Approving photo from {photo.volunteer.username} for project {photo.project.title}")
    try:
        with transaction.atomic():
            photo.status = 'approved'
            photo.moderated_at = timezone.now()
            photo.save()
            # Обновляем TaskAssignment
            if photo.task:
                assignment = TaskAssignment.objects.filter(task=photo.task, volunteer=photo.volunteer).first()
                if assignment:
                    assignment.completed = True
                    assignment.completed_at = timezone.now()
                    assignment.rating = photo.rating
                    assignment.save()

                    # Создаём активность для выполнения задачи
                    from core.models import Activity
                    Activity.objects.create(
                        user=photo.volunteer,
                        type='task_completed',
                        title='Задача выполнена',
                        description=f'Вы выполнили задачу в проекте "{photo.project.title}"',
                        project=photo.project
                    )

                # Обновляем статус задачи
                task = photo.task
                task.status = 'completed'
                task.save()
            logger.info(f"Photo approved: {photo.id}, Task {photo.task.id if photo.task else 'None'} updated to completed")
    except Exception as e:
        logger.error(f"Error approving photo: {e}\n{traceback.format_exc()}")
        raise

async def my_projects(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    
    if not query.from_user:
        return
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        if query.message:
            await query.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return
    
    try:
        # Получаем проекты организатора, включая удаленные
        projects = await sync_to_async(list)(Project.objects.filter(
            creator=db_user
        ).order_by('-created_at'))
        
        if not projects:
            if query.message:
                await query.message.reply_text("У вас пока нет проектов.")  # type: ignore[attr-defined]
            return
        
        for project in projects:
            status = "✅ Активен" if not project.deleted_at else "❌ Удален"
            buttons = []
            if not project.deleted_at:
                buttons.append(InlineKeyboardButton("❌ Удалить", callback_data=f"delete_project_{project.id}"))  # type: ignore[attr-defined]
            
            keyboard = InlineKeyboardMarkup([buttons]) if buttons else None
            
            if query.message:
                await query.message.reply_text(  # type: ignore[attr-defined]
                f"Проект: {project.title}\n"
                f"Статус: {status}\n"
                f"Дата создания: {project.created_at.strftime('%d.%m.%Y')}\n"
                f"Дата регистрации: {project.registration_date.strftime('%d.%m.%Y') if project.registration_date else 'Не указана'}",
                reply_markup=keyboard
            )
    except Exception as e:
        logger.error(f"Error in my_projects: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при получении списка проектов.")  # type: ignore[attr-defined]


async def delete_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    
    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return
    
    try:
        project_id = int(query.data.split('_')[2])
        project = await sync_to_async(Project.objects.get)(id=project_id)
        
        # Мягкое удаление проекта
        project.deleted_at = timezone.now()
        project.is_deleted = True
        await sync_to_async(project.save)()
        
        logger.info(f"Project {project.title} (ID: {project.id}) marked as deleted by organizer")  # type: ignore[attr-defined]

        # Уведомление организатора
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Проект '{project.title}' успешно удален.\n"
            f"Дата регистрации: {project.registration_date.strftime('%d.%m.%Y') if project.registration_date else 'Не указана'}\n"
            f"Дата удаления: {timezone.now().strftime('%d.%m.%Y')}",
            reply_markup=get_org_keyboard()
        )

        # Уведомление волонтеров
        volunteers_data = await get_project_volunteers(project)
        for volunteer, username, telegram_id in volunteers_data:
            if telegram_id:
                try:
                    await context.bot.send_message(
                        chat_id=telegram_id,
                        text=f"Проект '{project.title}', в котором вы участвовали, был удален организатором."
                    )
                    logger.info(f"Notification sent to volunteer {username} (ID: {telegram_id})")
                except Exception as e:
                    logger.error(f"Failed to notify volunteer {username} (ID: {telegram_id}): {e}")
            else:
                logger.warning(f"Volunteer {username} has no telegram_id")

    except Exception as e:
        logger.error(f"Error deleting project: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при удалении проекта.")  # type: ignore[attr-defined]

async def reject_photo(photo: Any, context: Any) -> None:
    logger.info(f"Rejecting photo from {photo.volunteer.username} for project {photo.project.title}")
    try:
        # Используем метод async_reject объекта photo
        await photo.async_reject(context)
    except Exception as e:
        logger.error(f"Error rejecting photo: {e}\n{traceback.format_exc()}")
        raise

async def reject_photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for rejecting photos from Telegram"""
    query = update.callback_query
    if not query:
        return
    await query.answer()
    
    try:
        # Get photo from context or database
        if not context.user_data:
            if query.message:
                await query.message.reply_text("Ошибка: сессия истекла.")  # type: ignore[attr-defined]
            return
        photo = context.user_data.get('selected_photo')
        if not photo:
            if query.message:
                await query.message.reply_text("Фото не найдено")  # type: ignore[attr-defined]
            return
        
        # Reject photo using async method
        await photo.async_reject(context)
        
        # Edit message to show rejection
        await query.edit_message_caption(
            caption=f"Фото отклонено: {photo.volunteer.username} ({photo.project.title})"
        )
        
        # Show next photo or return to menu
        await show_next_photo(update, context)
        
    except Exception as e:
        logger.error(f"Error in reject_photo_handler: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при отклонении фото")  # type: ignore[attr-defined]


async def notify_organizer_status(user: Any, context: Any = None) -> None:
    try:
        if not user or not user.telegram_id:
            logger.warning(f"У пользователя {user.username if user else 'None'} отсутствует telegram_id, уведомление не отправлено")
            return

        message = (
            "Ваш запрос на статус организатора одобрен!" if user.is_organizer
            else "Ваш запрос на статус организатора отклонён."
        )
        await send_telegram_message(user.telegram_id, message, context)
        logger.info(f"Уведомление отправлено пользователю {user.username}: {message}")
    except Exception as e:
        logger.error(f"Ошибка при уведомлении пользователя {user.username}: {e}\n{traceback.format_exc()}")
        
# Функции для создания календаря
def create_year_keyboard() -> InlineKeyboardMarkup:
    current_year = datetime.now().year
    years = list(range(current_year, current_year + 6))
    buttons = [
        [InlineKeyboardButton(str(year), callback_data=f"deadline_date_year_{year}")]
        for year in years
    ]
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
    return InlineKeyboardMarkup(buttons)

def create_month_keyboard(year: int) -> InlineKeyboardMarkup:
    months = [
        ("Янв", 1), ("Фев", 2), ("Мар", 3), ("Апр", 4),
        ("Май", 5), ("Июн", 6), ("Июл", 7), ("Авг", 8),
        ("Сен", 9), ("Окт", 10), ("Ноя", 11), ("Дек", 12)
    ]
    buttons = []
    row = []
    for month_name, month in months:
        if year == datetime.now().year and month < datetime.now().month:
            continue
        row.append(InlineKeyboardButton(month_name, callback_data=f"deadline_date_month_{month}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
    return InlineKeyboardMarkup(buttons)

def create_day_keyboard(year: int, month: int) -> InlineKeyboardMarkup:
    if month in [4, 6, 9, 11]:
        days_in_month = 30
    elif month == 2:
        days_in_month = 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28
    else:
        days_in_month = 31

    buttons = []
    row = []
    for day in range(1, days_in_month + 1):
        if year == datetime.now().year and month == datetime.now().month and day < datetime.now().day:
            continue
        row.append(InlineKeyboardButton(str(day), callback_data=f"deadline_date_day_{day}"))
        if len(row) == 5:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
    return InlineKeyboardMarkup(buttons)

async def notify_project_status(user: Any, project: Any, status: str, context: Any = None) -> None:
    try:
        if not user or not user.telegram_id:
            logger.warning(f"У пользователя {user.username if user else 'None'} отсутствует telegram_id, уведомление не отправлено")
            return

        if status == 'approved':
            message = f"Ваш проект '{project.title}' был одобрен!"
        elif status == 'rejected':
            message = f"Ваш проект '{project.title}' был отклонён."
        else:
            message = f"Статус вашего проекта '{project.title}' изменён на: {status}."

        await send_telegram_message(user.telegram_id, message, context)
        logger.info(f"Уведомление отправлено пользователю {user.username} (telegram_id: {user.telegram_id}): Проект {project.title} {status}")
    except Exception as e:
        logger.error(f"Ошибка в notify_project_status: {e}\n{traceback.format_exc()}")
        
                
def create_time_keyboard(context: Any, is_start: bool = True) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    # Убираем фильтрацию по текущему времени, чтобы позволить выбор любого часа
    for hour in range(24):
        # if (context.user_data.get('deadline_date') and
        #     context.user_data.get('deadline_date') == datetime.now().date() and
        #     hour < datetime.now().hour):
        #     continue  # Убираем эту проверку
        row.append(InlineKeyboardButton(f"{hour:02d}:00", callback_data=f"deadline_{'start' if is_start else 'end'}_time_{hour}"))
        if len(row) == 4:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
    return InlineKeyboardMarkup(buttons)

def get_pagination_keyboard(page: int, total_pages: int) -> InlineKeyboardMarkup:
    buttons = []
    if page > 0:
        buttons.append(InlineKeyboardButton("⬅️ Предыдущая", callback_data=f"photo_prev_{page}"))
    if page < total_pages - 1:
        buttons.append(InlineKeyboardButton("Следующая ➡️", callback_data=f"photo_next_{page}"))
    buttons.append(InlineKeyboardButton("❌ Отмена", callback_data="cancel_moderate"))
    return InlineKeyboardMarkup([buttons])

async def org_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.from_user:
        logger.warning("Received org_menu without message or from_user")
        return
    user = update.message.from_user
    telegram_id = str(user.id)
    logger.info(f"Org menu requested by telegram_id: {telegram_id}")
    
    db_user = await get_user(telegram_id)
    if not db_user:
        if update.message:
            await update.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return
    
    if not db_user.is_organizer:
        logger.warning(f"Access denied for telegram_id: {telegram_id}, not an organizer")
        if db_user.organization_name:
            if update.message:
                await update.message.reply_text("Ваш запрос на статус организатора находится на рассмотрении.")  # type: ignore[attr-defined]
        else:
            if update.message:
                await update.message.reply_text("У вас нет прав организатора. Зарегистрируйтесь как организатор.")  # type: ignore[attr-defined]
        return
    
    if update.message:
        await update.message.reply_text(  # type: ignore[attr-defined]
        "Добро пожаловать в панель организации!\nВыберите действие:",
        reply_markup=get_org_keyboard()
    )


async def create_project_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.from_user:
        return ConversationHandler.END
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        if query.message:
            await query.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        if query.message:
            await query.message.reply_text("Ошибка инициализации.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    context.user_data['telegram_id'] = telegram_id
    if query.message:
        await query.message.reply_text(  # type: ignore[attr-defined]
        "Давайте создадим новый проект.\nВведите название проекта:",
        reply_markup=ReplyKeyboardRemove()
    )
    logger.info(f"Started project creation for telegram_id: {telegram_id}")
    return TITLE



async def create_project_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        return TITLE
    telegram_id = context.user_data.get('telegram_id')
    if not update.message or not update.message.text:
        return TITLE
    context.user_data['title'] = update.message.text.strip()
    if not context.user_data['title']:
        await update.message.reply_text("Название проекта не может быть пустым. Введите название:")  # type: ignore[attr-defined]
        return TITLE
    logger.info(f"Project title set: {context.user_data['title']} for telegram_id: {telegram_id}")
    if update.message:
        await update.message.reply_text("Введите описание проекта:")  # type: ignore[attr-defined]
    return DESCRIPTION

async def create_project_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        return DESCRIPTION
    telegram_id = context.user_data.get('telegram_id')
    if not update.message or not update.message.text:
        return DESCRIPTION
    context.user_data['description'] = update.message.text.strip()
    if not context.user_data['description']:
        await update.message.reply_text("Описание проекта не может быть пустым. Введите описание:")  # type: ignore[attr-defined]
        return DESCRIPTION
    logger.info(f"Project description set: {context.user_data['description']} for telegram_id: {telegram_id}")

    # Показываем выбор типа волонтерства
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton('Социальная помощь', callback_data='vtype_social')],
        [InlineKeyboardButton('Экологические проекты', callback_data='vtype_environmental')],
        [InlineKeyboardButton('Культурные мероприятия', callback_data='vtype_cultural')]
    ])

    if update.message:
        await update.message.reply_text('Выберите тип волонтёрства:', reply_markup=keyboard)  # type: ignore[attr-defined]
    return VOLUNTEER_TYPE


async def handle_volunteer_type_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle volunteer type selection via inline buttons"""
    query = update.callback_query
    if not query:
        return CITY
    await query.answer()

    if not context.user_data:
        return CITY
    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return CITY

    telegram_id = context.user_data.get('telegram_id')
    volunteer_type = query.data.replace('vtype_', '')
    context.user_data['volunteer_type'] = volunteer_type

    type_labels = {
        'social': 'Социальная помощь',
        'environmental': 'Экологические проекты',
        'cultural': 'Культурные мероприятия'
    }

    logger.info(f"Volunteer type set: {volunteer_type} for telegram_id: {telegram_id}")

    label = type_labels.get(volunteer_type, volunteer_type)
    if query.message:
        await query.message.reply_text(f"Выбран тип: {label}\n\nВведите город проекта:")  # type: ignore[attr-defined]
    return CITY





async def create_project_city(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        return CITY
    telegram_id = context.user_data.get('telegram_id')
    if not update.message or not update.message.text:
        return CITY
    context.user_data['city'] = update.message.text.strip()
    if not context.user_data['city']:
        await update.message.reply_text("Город проекта не может быть пустым. Введите город:")  # type: ignore[attr-defined]
        return CITY
    logger.info(f"Project city set: {context.user_data['city']} for telegram_id: {telegram_id}")
    if update.message:
        await update.message.reply_text("Введите теги проекта (через запятую, например: уборка, экология):")  # type: ignore[attr-defined]
    return TAGS

async def create_project_tags(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        return TAGS
    telegram_id = context.user_data.get('telegram_id')
    if not update.message or not update.message.text:
        return TAGS
    tags = update.message.text.strip()
    if not tags:
        await update.message.reply_text("Теги не могут быть пустыми. Введите теги:")  # type: ignore[attr-defined]
        return TAGS
    logger.info(f"Project tags set: {tags} for telegram_id: {telegram_id}")
    context.user_data['tags'] = tags

    keyboard = ReplyKeyboardMarkup([[KeyboardButton("Отправить геолокацию", request_location=True)]], resize_keyboard=True, one_time_keyboard=True)
    if update.message:
        await update.message.reply_text("Отлично! Теперь отправьте геолокацию для проекта, нажав на кнопку ниже.", reply_markup=keyboard)  # type: ignore[attr-defined]
    return LOCATION

async def create_project_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        return LOCATION
    telegram_id = context.user_data.get('telegram_id')
    if not update.message:
        return LOCATION
    location = update.message.location
    if not location:
        await update.message.reply_text("Пожалуйста, используйте кнопку 'Отправить геолокацию'.")  # type: ignore[attr-defined]
        return LOCATION

    if not context.user_data:
        return LOCATION
    
    context.user_data['latitude'] = location.latitude
    context.user_data['longitude'] = location.longitude
    logger.info(f"Project location set: ({location.latitude}, {location.longitude}) for telegram_id: {telegram_id}")

    if not telegram_id:
        if update.message:
            await update.message.reply_text("Ошибка: не удалось получить ID пользователя.")  # type: ignore[attr-defined]
        return LOCATION
    
    db_user = await get_user(telegram_id)
    if not db_user:
        if update.message:
            await update.message.reply_text("Ошибка: пользователь не найден.")  # type: ignore[attr-defined]
        return LOCATION
    
    title = context.user_data.get('title')
    description = context.user_data.get('description')
    city = context.user_data.get('city')
    tags = context.user_data.get('tags')
    latitude = context.user_data.get('latitude')
    longitude = context.user_data.get('longitude')
    volunteer_type = context.user_data.get('volunteer_type', 'environmental')
    
    if not all([title, description, city, tags, latitude is not None, longitude is not None]):
        if update.message:
            await update.message.reply_text("Ошибка: не все данные проекта заполнены.")  # type: ignore[attr-defined]
        return LOCATION

    try:
        if latitude is None or longitude is None:
            if update.message:
                await update.message.reply_text("Ошибка: координаты не заданы.")  # type: ignore[attr-defined]
            return LOCATION
        
        project = await create_project(str(title), str(description), str(city), str(tags), db_user, float(latitude), float(longitude), volunteer_type)
        if update.message:
            await update.message.reply_text(  # type: ignore[attr-defined]
            f"Проект '{project.title}' создан и отправлен на модерацию!",
            reply_markup=ReplyKeyboardRemove()
        )
        if update.message:
            await update.message.reply_text("Меню организатора:", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]

        admin = await get_admin()
        if admin and admin.telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=admin.telegram_id,
                    text=f"Создан новый проект '{project.title}' от {db_user.username}. Проверьте его в админ-панели."
                )
            except Exception as e:
                logger.error(f"Failed to notify admin about new project: {e}")
    except Exception as e:
        logger.error(f"Error in create_project_location (during project creation): {e}")
        if update.message:
            await update.message.reply_text("Ошибка при создании проекта.")  # type: ignore[attr-defined]

    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

async def create_project_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text(  # type: ignore[attr-defined]
        "Создание проекта отменено.",
        reply_markup=get_org_keyboard()
    )
    elif update.callback_query and update.callback_query.message:
        await update.callback_query.message.reply_text(  # type: ignore[attr-defined]
            "Создание проекта отменено.",
            reply_markup=get_org_keyboard()
        )
    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.from_user:
        return ConversationHandler.END
    user = update.message.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    
    if db_user and not db_user.is_organizer:
        if update.message:
            await update.message.reply_text("У вас нет прав для этой команды.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    if update.message:
        await update.message.reply_text("Создание проекта отменено.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

async def manage_volunteers(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()

    if not query.from_user:
        return
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        if query.message:
            await query.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return

    try:
        projects = await get_volunteers_for_project(db_user)
        if not projects:
            if query.message:
                await query.message.reply_text("У вас нет проектов или волонтёров.")  # type: ignore[attr-defined]
            return

        response = ""
        for project_title, volunteers in projects:
            volunteers_text = ", ".join(volunteers) if volunteers else "Нет волонтёров"
            response += f"Проект: {project_title}\nВолонтёры: {volunteers_text}\n\n"
        if query.message:
            await query.message.reply_text(response)  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error in manage_volunteers: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при получении списка волонтёров.")  # type: ignore[attr-defined]

async def select_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания отменена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        logger.info("Task creation cancelled by user")
        return ConversationHandler.END

    try:
        choice = int(query.data.split('_')[2])
        logger.info(f"User selected project choice: {choice}")
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор проекта.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END
    projects = context.user_data.get('projects', [])
    logger.info(f"Available projects count: {len(projects)}")

    if 0 <= choice < len(projects):
        project = projects[choice]
        context.user_data['selected_project'] = project
        logger.info(f"Selected project: {project.title} (ID: {project.id})")  # type: ignore[attr-defined]

        buttons = [
            [InlineKeyboardButton("Всем волонтёрам", callback_data="task_recipients_all"),
             InlineKeyboardButton("Одному волонтёру", callback_data="task_recipients_one")],
            [InlineKeyboardButton("Нескольким волонтёрам", callback_data="task_recipients_multiple"),
             InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")]
        ]
        keyboard = InlineKeyboardMarkup(buttons)
        
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Проект: {project.title}\nКому отправить задание?",
            reply_markup=keyboard
        )
        return SELECT_RECIPIENTS
    else:
        logger.warning(f"Invalid project choice: {choice}, available: {len(projects)}")
        if query.message:
            await query.message.reply_text("Неверный выбор проекта.")  # type: ignore[attr-defined]
        return ConversationHandler.END


async def handle_volunteer_feedback_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.effective_user:
        return ConversationHandler.END
    if not update.message or not update.message.text:
        return ConversationHandler.END
    
    telegram_id = str(update.effective_user.id)
    message_text = update.message.text

    try:
        # Получаем Django User для волонтёра
        volunteer = await sync_to_async(User.objects.get)(telegram_id=telegram_id)
        
        # Ищем активную сессию обратной связи, где пользователь является волонтёром
        session = await sync_to_async(FeedbackSession.objects.filter(
            volunteer=volunteer,
            is_active=True
        ).select_related('organizer', 'project').first)()

        if not session:
            if update.message:
                await update.message.reply_text("У вас нет активной сессии обратной связи.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        # Сохраняем сообщение от волонтёра
        await sync_to_async(FeedbackMessage.objects.create)(  # type: ignore[attr-defined]
            session=session,
            sender=volunteer,
            text=message_text
        )

        # Уведомляем организатора
        if session.organizer.telegram_id:
            await context.bot.send_message(
                chat_id=session.organizer.telegram_id,
                text=f"Сообщение от волонтёра {volunteer.username} (проект: {session.project.title}):\n{message_text}"
            )

        if update.message:
            await update.message.reply_text("Сообщение отправлено организатору. Продолжайте или нажмите /cancel для завершения.")  # type: ignore[attr-defined]
        return VOLUNTEER_FEEDBACK

    except Exception as e:
        logger.error(f"Error handling volunteer feedback message: {e}\n{traceback.format_exc()}")
        if update.message:
            await update.message.reply_text("Ошибка при отправке сообщения.")  # type: ignore[attr-defined]
        return VOLUNTEER_FEEDBACK

async def select_recipients(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания отменена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END
    project = context.user_data.get('selected_project')
    logger.info(f"Selected recipients callback: {query.data}")
    if query.data == "task_recipients_all":
        context.user_data['recipients'] = 'task_recipients_all'
        logger.info("Set recipients to task_recipients_all")
        if query.message:
            await query.message.reply_text("Введите текст задания:")  # type: ignore[attr-defined]
        return TASK_TEXT
    elif query.data in ["task_recipients_one", "task_recipients_multiple"]:
        context.user_data['recipients'] = query.data
        logger.info(f"Set recipients to {query.data}")
        try:
            volunteers = await get_project_volunteers(project)
            if not volunteers:
                if query.message:
                    await query.message.reply_text("В этом проекте нет волонтёров.")  # type: ignore[attr-defined]
                return ConversationHandler.END
            buttons = [
                [InlineKeyboardButton(volunteer[1], callback_data=f"task_volunteer_{i}")]
                for i, volunteer in enumerate(volunteers)
            ]
            buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
            if query.data == "task_recipients_multiple":
                buttons.append([InlineKeyboardButton("✅ Готово", callback_data="task_volunteers_done")])
            keyboard = InlineKeyboardMarkup(buttons)
            if query.message:
                await query.message.reply_text(  # type: ignore[attr-defined]
                "Выберите одного волонтёра:" if query.data == "task_recipients_one" else "Выберите волонтёров (нажмите 'Готово' после выбора):",
                reply_markup=keyboard
            )
            context.user_data['volunteers'] = volunteers
            context.user_data['selected_volunteers'] = []
            return SELECT_VOLUNTEERS
        except Exception as e:
            logger.error(f"Error in select_recipients: {e}\n{traceback.format_exc()}")
            if query and query.message:
                await query.message.reply_text("Ошибка при выборе волонтёров.")  # type: ignore[attr-defined]
            return ConversationHandler.END
    
    # Если callback_data не распознан
    logger.warning(f"Unknown callback_data in select_recipients: {query.data}")
    if query.message:
        await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
    return ConversationHandler.END

async def select_volunteers(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания отменена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    if query.data == "task_volunteers_done":
        selected_volunteers = context.user_data.get('selected_volunteers', [])
        if not selected_volunteers:
            if query.message:
                await query.message.reply_text("Вы не выбрали ни одного волонтёра. Попробуйте снова.")  # type: ignore[attr-defined]
            return SELECT_VOLUNTEERS
        if query.message:
            await query.message.reply_text("Введите текст задания:")  # type: ignore[attr-defined]
        return TASK_TEXT

    try:
        choice = int(query.data.split('_')[2])
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор волонтёра.")  # type: ignore[attr-defined]
        return SELECT_VOLUNTEERS

    volunteers = context.user_data.get('volunteers', [])
    if 0 <= choice < len(volunteers):
        volunteer = volunteers[choice][0]
        recipients = context.user_data.get('recipients')
        if recipients == "task_recipients_one":
            context.user_data['selected_volunteers'] = [volunteer]
            if query.message:
                await query.message.reply_text("Введите текст задания:")  # type: ignore[attr-defined]
            return TASK_TEXT
        else:
            selected_volunteers = context.user_data.get('selected_volunteers', [])
            if volunteer not in selected_volunteers:
                selected_volunteers.append(volunteer)
                context.user_data['selected_volunteers'] = selected_volunteers
                if query.message:
                    await query.message.reply_text(f"Выбран волонтёр: {volunteer.username}. Выберите ещё или нажмите 'Готово'.")  # type: ignore[attr-defined]
            else:
                if query.message:
                    await query.message.reply_text(f"Волонтёр {volunteer.username} уже выбран. Выберите другого или нажмите 'Готово'.")  # type: ignore[attr-defined]
            return SELECT_VOLUNTEERS
    else:
        if query.message:
            await query.message.reply_text("Неверный выбор волонтёра.")  # type: ignore[attr-defined]
        return SELECT_VOLUNTEERS

async def task_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.text:
        return TASK_TEXT
    
    if not context.user_data:
        return TASK_TEXT
        
    if update.message.text.startswith('/'):
        await update.message.reply_text("Пожалуйста, введите текст задания без команд.")  # type: ignore[attr-defined]
        return TASK_TEXT
        
    context.user_data['task_text'] = update.message.text.strip()
    if not context.user_data['task_text']:
        if update.message:
            await update.message.reply_text("Текст задания не может быть пустым. Введите текст:")  # type: ignore[attr-defined]
        return TASK_TEXT
        
    keyboard = await sync_to_async(create_year_keyboard)()
    if update.message:
        await update.message.reply_text("Выберите дату и срок выполнение:", reply_markup=keyboard)  # type: ignore[attr-defined]
    return TASK_DEADLINE_DATE

def get_feedback_keyboard(session_id: int, is_organizer: bool = False) -> InlineKeyboardMarkup:
    buttons = []
    if is_organizer:
        buttons.append([InlineKeyboardButton("Закрыть чат", callback_data=f"close_feedback_{session_id}")])
    return InlineKeyboardMarkup(buttons)

async def task_deadline_date_year(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    try:
        year = int(query.data.split('_')[3])
        context.user_data['deadline_date_year'] = year
        keyboard = await sync_to_async(create_month_keyboard)(year)
        if query.message:
            await query.message.reply_text(f"Вы выбрали год: {year}\nВыберите месяц:", reply_markup=keyboard)  # type: ignore[attr-defined]
        return TASK_DEADLINE_DATE
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid year selection: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор года.")  # type: ignore[attr-defined]
        return TASK_DEADLINE_DATE

async def task_deadline_date_month(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    try:
        month = int(query.data.split('_')[3])
        context.user_data['deadline_date_month'] = month
        year = context.user_data.get('deadline_date_year')
        if year is None:
            if query.message:
                await query.message.reply_text("Ошибка: год не выбран.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        keyboard = await sync_to_async(create_day_keyboard)(year, month)
        if query.message:
            await query.message.reply_text(f"Вы выбрали месяц: {month}\nВыберите день:", reply_markup=keyboard)  # type: ignore[attr-defined]
        return TASK_DEADLINE_DATE
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid month selection: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор месяца.")  # type: ignore[attr-defined]
        return TASK_DEADLINE_DATE

async def task_deadline_date_day(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    try:
        day = int(query.data.split('_')[3])
        year = context.user_data.get('deadline_date_year')
        month = context.user_data.get('deadline_date_month')
        if year is None or month is None:
            if query.message:
                await query.message.reply_text("Ошибка: год или месяц не выбран.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        deadline_date = datetime(year, month, day).date()
        context.user_data['deadline_date'] = deadline_date
        keyboard = await sync_to_async(create_time_keyboard)(context, True)
        if query.message:
            await query.message.reply_text(f"Вы выбрали дату: {deadline_date}\nВыберите начальное время:", reply_markup=keyboard)  # type: ignore[attr-defined]
        return TASK_DEADLINE_START_TIME
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid day selection: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор дня.")  # type: ignore[attr-defined]
        return TASK_DEADLINE_DATE

async def task_deadline_start_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    try:
        hour = int(query.data.split('_')[3])
        start_time = time(hour, 0)
        context.user_data['start_time'] = start_time
        keyboard = await sync_to_async(create_time_keyboard)(context, False)
        if query.message:
            await query.message.reply_text(f"Вы выбрали начальное время: {start_time.strftime('%H:%M')}\nВыберите конечное время:", reply_markup=keyboard)  # type: ignore[attr-defined]
        return TASK_DEADLINE_END_TIME
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid start time selection: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор времени.")  # type: ignore[attr-defined]
        return TASK_DEADLINE_START_TIME

async def task_deadline_end_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    try:
        hour = int(query.data.split('_')[3])
        end_time = time(hour, 0)
        start_time = context.user_data.get('start_time', time(0, 0))
        if end_time <= start_time:
            if query.message:
                await query.message.reply_text("Конечное время должно быть позже начального. Выберите снова.")  # type: ignore[attr-defined]
            return TASK_DEADLINE_END_TIME
        context.user_data['end_time'] = end_time
        buttons = [
            [InlineKeyboardButton("Да", callback_data="task_photo_yes"),
             InlineKeyboardButton("Нет", callback_data="task_photo_no")],
            [InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")]
        ]
        keyboard = InlineKeyboardMarkup(buttons)
        if query.message:
            await query.message.reply_text(f"Вы выбрали конечное время: {end_time.strftime('%H:%M')}\nХотите прикрепить фото к заданию?", reply_markup=keyboard)  # type: ignore[attr-defined]
        return TASK_PHOTO

    except (ValueError, IndexError) as e:
        logger.error(f"Invalid end time selection: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор времени.")  # type: ignore[attr-defined]
        return TASK_DEADLINE_END_TIME

async def task_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания завершена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    if query.data == "task_photo_no":
        context.user_data['task_photo'] = None
        buttons = [
            [InlineKeyboardButton("Отправить", callback_data="task_confirm_send"),
             InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")]
        ]
        keyboard = InlineKeyboardMarkup(buttons)
        deadline_date = context.user_data.get('deadline_date')
        start_time = context.user_data.get('start_time')
        end_time = context.user_data.get('end_time')
        task_text = context.user_data.get('task_text')
        if not all([deadline_date, start_time, end_time, task_text]):
            if query.message:
                await query.message.reply_text("Ошибка: не все данные заполнены.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        
        if not all([deadline_date, start_time, end_time]):
            if query.message:
                await query.message.reply_text("Ошибка: дата или время не заполнены.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        
        # Убеждаемся что значения не None после проверки
        assert deadline_date is not None and start_time is not None and end_time is not None
        deadline_str = deadline_date.strftime('%d-%m-%Y')
        start_str = start_time.strftime('%H:%M')
        end_str = end_time.strftime('%H:%M')
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Текст задания: {task_text}\nСрок: {deadline_str}\nВремя: {start_str} - {end_str}\nПодтвердите отправку:",
            reply_markup=keyboard
        )
        return CONFIRM_TASK

    if query.data == "task_photo_yes":
        if query.message:
            await query.message.reply_text("Пожалуйста, отправьте фото для задания:")  # type: ignore[attr-defined]
        return TASK_PHOTO_UPLOAD
    return ConversationHandler.END

async def task_photo_upload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message:
        return TASK_PHOTO_UPLOAD
    if not update.message.photo:
        await update.message.reply_text("Пожалуйста, отправьте фото.")  # type: ignore[attr-defined]
        return TASK_PHOTO_UPLOAD
    
    if not context.user_data:
        return TASK_PHOTO_UPLOAD
    
    if update.message.photo:
        try:
            photo_file = await update.message.photo[-1].get_file()
            current_date = datetime.now()
            year, month, day = current_date.year, current_date.month, current_date.day
            save_dir = os.path.join("media", f"tasks/{year}/{month}/{day}")
            os.makedirs(save_dir, exist_ok=True)  # Создание директории
            if not update.message.from_user:
                if update.message:
                    await update.message.reply_text("Ошибка: не удалось определить пользователя.")  # type: ignore[attr-defined]
                return TASK_PHOTO_UPLOAD
            telegram_id = str(update.message.from_user.id)
            file_name = f"{telegram_id}_{photo_file.file_id}.jpg"
            file_path = os.path.join(save_dir, file_name)

            # Увеличение тайм-аута и повторные попытки
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    photo_data = await photo_file.download_as_bytearray()  # Тайм-аут 30 секунд
                    if not photo_data:
                        raise ValueError("Downloaded photo data is empty")
                    async with aiofiles.open(file_path, 'wb') as f:
                        await f.write(photo_data)  # type: ignore[arg-type]
                    logger.info(f"Photo saved to {file_path}")
                    break
                except TimedOut as e:  # Используем импортированный TimedOut
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed with timeout: {e}")
                    if attempt == max_retries - 1:
                        raise
                    await asyncio.sleep(2 ** attempt)  # Экспоненциальная задержка между попытками

                try:
                    photo_data = await photo_file.download_as_bytearray()
                except Exception as e:
                    logger.error(f"Error downloading photo: {e}")
                    if update.effective_chat:
                        await context.bot.send_message(chat_id=update.effective_chat.id, text="Ошибка при загрузке фото. Попробуйте снова.")
                return TASK_PHOTO_UPLOAD

            # Сохраняем относительный путь для базы данных
            db_file_path = os.path.join(f"tasks/{year}/{month}/{day}", file_name)
            context.user_data['task_photo'] = db_file_path
            buttons = [
                [InlineKeyboardButton("Отправить", callback_data="task_confirm_send"),
                 InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")]
            ]
            keyboard = InlineKeyboardMarkup(buttons)
            deadline_date = context.user_data.get('deadline_date')
            start_time = context.user_data.get('start_time')
            end_time = context.user_data.get('end_time')
            task_text = context.user_data.get('task_text')
            if not all([deadline_date, start_time, end_time, task_text]):
                if update.message:
                    await update.message.reply_text("Ошибка: не все данные заполнены.")  # type: ignore[attr-defined]
                return TASK_PHOTO_UPLOAD
            
            if not all([deadline_date, start_time, end_time]):
                if update.message:
                    await update.message.reply_text("Ошибка: дата или время не заполнены.")  # type: ignore[attr-defined]
                return TASK_PHOTO_UPLOAD
            
            # Убеждаемся что значения не None после проверки
            assert deadline_date is not None and start_time is not None and end_time is not None
            deadline_str = deadline_date.strftime('%d-%m-%Y')
            start_str = start_time.strftime('%H:%M')
            end_str = end_time.strftime('%H:%M')
            if update.message:
                await update.message.reply_text(  # type: ignore[attr-defined]
                f"Фото загружено.\nТекст задания: {task_text}\nСрок выполнение: {deadline_str}\nВремя: {start_str} - {end_str}\nПодтвердите отправку:",
                reply_markup=keyboard
            )
            return CONFIRM_TASK
        except Exception as e:
            logger.error(f"Error uploading photo for task: {e}\n{traceback.format_exc()}")
            if update.message:
                await update.message.reply_text("Ошибка при загрузке фото. Попробуйте снова.")  # type: ignore[attr-defined]
            return TASK_PHOTO_UPLOAD
    
    # Если нет фото (после всех проверок)
    return TASK_PHOTO_UPLOAD

async def send_task_notifications_to_volunteers(context: Any, project: Any, task: Any, volunteers: list[dict[str, Any]], photo_path: str | None, organizer: Any) -> dict[str, int]:
    """
    Отправляет интерактивные Telegram уведомления волонтёрам с кнопками Принять/Отклонить
    """
    logger.info(f"[TASK_NOTIFY] Sending interactive notifications for task {task.id} to {len(volunteers)} volunteers")  # type: ignore[attr-defined]
    
    # Форматируем сообщение
    deadline_str = task.deadline_date.strftime('%d.%m.%Y') if task.deadline_date else "Не указан"
    time_str = f"{task.start_time.strftime('%H:%M')} - {task.end_time.strftime('%H:%M')}" if task.start_time and task.end_time else "Не указано"
    
    message = (
        f"🎯 <b>Новое задание в проекте</b>\n"
        f"🏷 <b>{project.title}</b>\n\n"
        f"📝 <b>Задание:</b>\n{task.text}\n\n"
        f"⏰ <b>Срок:</b> {deadline_str}\n"
        f"🕐 <b>Время:</b> {time_str}\n"
        f"👤 <b>От:</b> {organizer.name or organizer.username}\n"
    )
    
    # Кнопки (соответствуют существующему обработчику в volunteer_handlers.py)
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Принять", callback_data=f"task_accept_{task.id}"),  # type: ignore[attr-defined]
            InlineKeyboardButton("❌ Отклонить", callback_data=f"task_decline_{task.id}")  # type: ignore[attr-defined]
        ]
    ])
    
    success_count = 0
    failed_count = 0
    
    for volunteer in volunteers:
        try:
            telegram_id = volunteer['telegram_id']
            
            # Если есть фото - отправляем с фото
            if photo_path:
                try:
                    full_photo_path = os.path.join('media', photo_path)
                    if os.path.exists(full_photo_path):
                        async with aiofiles.open(full_photo_path, 'rb') as photo_file:
                            await context.bot.send_photo(
                                chat_id=telegram_id,
                                photo=await photo_file.read(),
                                caption=message,
                                reply_markup=keyboard,
                                parse_mode='HTML'
                            )
                            success_count += 1
                            logger.info(f"[OK] Sent task {task.id} with photo to {volunteer['username']} (telegram_id: {telegram_id})")  # type: ignore[attr-defined]
                    else:
                        # Фото не найдено - отправляем текст
                        await context.bot.send_message(
                            chat_id=telegram_id,
                            text=message,
                            reply_markup=keyboard,
                            parse_mode='HTML'
                        )
                        success_count += 1
                        logger.warning(f"Photo not found at {full_photo_path}, sent text to {volunteer['username']}")
                except Exception as photo_err:
                    logger.error(f"Error sending photo to {volunteer['username']}: {photo_err}")
                    # Отправляем без фото
                    await context.bot.send_message(
                        chat_id=telegram_id,
                        text=message,
                        reply_markup=keyboard,
                        parse_mode='HTML'
                    )
                    success_count += 1
            else:
                # Нет фото - отправляем текст
                await context.bot.send_message(
                    chat_id=telegram_id,
                    text=message,
                    reply_markup=keyboard,
                    parse_mode='HTML'
                )
                success_count += 1
                logger.info(f"[OK] Sent task {task.id} (text) to {volunteer['username']} (telegram_id: {telegram_id})")  # type: ignore[attr-defined]
                
        except Exception as e:
            failed_count += 1
            logger.error(f"[ERROR] Failed to send task {task.id} to {volunteer.get('username', 'Unknown')}: {e}")  # type: ignore[attr-defined]
    
    logger.info(f"[TASK_NOTIFY] Task {task.id} notifications: {success_count} success, {failed_count} failed")  # type: ignore[attr-defined]
    return {'success': success_count, 'failed': failed_count}

async def confirm_task(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if query.data == "cancel_task":
        if query.message:
            await query.message.reply_text("Отправка задания отменена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if query.data != "task_confirm_send":
        logger.error(f"Unexpected callback_data: {query.data}")
        if query.message:
            await query.message.reply_text("Ошибка: неверная команда.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        if query.message:
            await query.message.reply_text("Ошибка: сессия истекла.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    # Проверка наличия всех необходимых данных
    required_keys = ['selected_project', 'organizer', 'task_text', 'deadline_date', 'start_time', 'end_time', 'recipients']
    missing_keys = [key for key in required_keys if key not in context.user_data]
    if missing_keys:
        logger.error(f"Missing context.user_data keys: {missing_keys}")
        if query.message:
            await query.message.reply_text("Ошибка: неполные данные для создания задания. Пожалуйста, начните заново.")  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    project = context.user_data['selected_project']
    organizer = context.user_data['organizer']
    text = context.user_data['task_text']
    deadline_date = context.user_data['deadline_date']
    start_time = context.user_data['start_time']
    end_time = context.user_data['end_time']
    photo_path = context.user_data.get('task_photo')
    recipients = context.user_data['recipients']
    selected_volunteers = context.user_data.get('selected_volunteers', [])

    logger.info(
        f"Processing task confirmation: project_id={project.id}, recipients={recipients}, "  # type: ignore[attr-defined]
        f"volunteers_count={len(selected_volunteers)}, text_length={len(text)}"
    )

    try:
        # Создание задания
        task = await create_task(project, organizer, text, deadline_date, start_time, end_time, photo_path)
        logger.info(f"Task {task.id} created for project_id={project.id}")  # type: ignore[attr-defined]

        # Получение списка волонтёров
        volunteers = []
        if recipients == "task_recipients_all":
            volunteers_data = await sync_to_async(list)(
                VolunteerProject.objects.filter(
                    project=project,
                    is_active=True
                ).select_related('volunteer').values('volunteer__id', 'volunteer__username', 'volunteer__telegram_id', 'volunteer__is_active')
            )
            logger.info(f"Found {len(volunteers_data)} VolunteerProject records for project {project.title}")
            for vp in volunteers_data:
                if vp['volunteer__telegram_id'] and vp['volunteer__is_active']:
                    volunteers.append({
                        'id': vp['volunteer__id'],
                        'username': vp['volunteer__username'],
                        'telegram_id': vp['volunteer__telegram_id']
                    })
                    logger.info(f"Volunteer added: {vp['volunteer__username']} (telegram_id: {vp['volunteer__telegram_id']})")
                else:
                    logger.warning(
                        f"Skipping VolunteerProject: volunteer={vp['volunteer__username']}, "
                        f"telegram_id={vp['volunteer__telegram_id']}, is_active={vp['volunteer__is_active']}"
                    )
        else:
            volunteers = [
                {'id': v.id, 'username': v.username, 'telegram_id': v.telegram_id}
                for v in selected_volunteers if v and v.telegram_id
            ]
            logger.info(f"Selected volunteers: {[v['username'] for v in volunteers]}")

        # Пакетное создание TaskAssignment для волонтеров с Telegram
        if volunteers:
            task_assignments = [
                TaskAssignment(task=task, volunteer_id=v['id'])
                for v in volunteers
            ]
            await sync_to_async(TaskAssignment.objects.bulk_create)(task_assignments)
            logger.info(f"Created {len(task_assignments)} TaskAssignments for task {task.id}")
        else:
            logger.warning(f"No volunteers with telegram_id found for project {project.title}, but will still try FCM notifications")

        # 🔔 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ ВСЕМ ВОЛОНТЕРАМ
        # ✅ Отправляем интерактивные Telegram сообщения с кнопками
        telegram_stats = await send_task_notifications_to_volunteers(context, project, task, volunteers, photo_path, organizer)
        
        # ✅ ИСПРАВЛЕНИЕ: Отправляем ТОЛЬКО FCM (без Telegram) для волонтёров с мобильным приложением
        # Telegram-уведомления уже отправлены выше с кнопками
        from custom_admin.services.notification_service import NotificationService
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        fcm_count = 0
        fcm_success = 0
        
        try:
            # Получаем ВСЕХ волонтёров проекта для FCM
            all_project_volunteers = await sync_to_async(list)(
                User.objects.filter(
                    volunteer_projects__project=project,
                    volunteer_projects__is_active=True
                ).distinct()
            )
            
            fcm_count = len(all_project_volunteers)
            
            # Отправляем ТОЛЬКО Push-уведомления (БЕЗ Telegram)
            for vol in all_project_volunteers:
                device_tokens = await NotificationService.async_get_user_device_tokens(vol)  # type: ignore[arg-type]
                if device_tokens:
                    title = "🎯 Новое задание!"
                    message = f"Проект: {project.title}\n{task.text[:80]}{'...' if len(task.text) > 80 else ''}"
                    push_data = {
                        'task_id': task.id,  # type: ignore[attr-defined]
                        'project_id': project.id,  # type: ignore[attr-defined]
                        'type': 'task_assigned'
                    }
                    result = NotificationService.send_push_notification(device_tokens, title, message, push_data)
                    if result:
                        fcm_success += 1
            
            logger.info(f"[PUSH] FCM notifications sent for task {task.id}: {fcm_success}/{fcm_count}")  # type: ignore[attr-defined]

            # Формирование ответа организатору
            total_volunteers = telegram_stats['success'] + telegram_stats['failed']
            response = (
                f"✅ <b>Задание создано успешно!</b>\n\n"
                f"📊 <b>Статистика доставки:</b>\n"
                f"💬 Telegram (с кнопками): {telegram_stats['success']}/{total_volunteers}\n"
                f"📱 Push-уведомления: {fcm_success}/{fcm_count}\n"
            )
            if telegram_stats['failed'] > 0:
                response += f"\n⚠️ Telegram не доставлено: {telegram_stats['failed']}"

            if query.message:
                await query.message.reply_text(response, reply_markup=get_org_keyboard(), parse_mode='HTML')  # type: ignore[attr-defined]
        except Exception as e:
            logger.error(f"Failed to send universal notifications for task {task.id}: {e}\n{traceback.format_exc()}")
            # Fallback: отправляем только через Telegram (старый способ)
            logger.info(f"Falling back to Telegram-only notifications for task {task.id}")

            # Формирование сообщения для Telegram
            deadline_date_str = deadline_date.strftime('%d-%m-%Y')
            time_range = f"{start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}"
            message_text = (
                f"Новое задание для проекта {project.title}:\n"
                f"{text}\n"
                f"Срок: {deadline_date_str} {time_range}\n"
                "Выберите действие:"
            )
            buttons = [
                [InlineKeyboardButton("Принять", callback_data=f"task_accept_{task.id}")],  # type: ignore[attr-defined]
                [InlineKeyboardButton("Отклонить", callback_data=f"task_decline_{task.id}")]  # type: ignore[attr-defined]
            ]
            keyboard = InlineKeyboardMarkup(buttons)

            # Отправка сообщений волонтёрам только через Telegram
            success_count = 0
            failed_volunteers = []
            for volunteer in volunteers:
                try:
                    if photo_path:
                        photo_full_path = os.path.join("media", photo_path)
                        if not await sync_to_async(os.path.exists)(photo_full_path):
                            raise FileNotFoundError(f"Photo file not found: {photo_full_path}")
                        async with aiofiles.open(photo_full_path, 'rb') as photo_file:
                            await context.bot.send_photo(
                                chat_id=volunteer['telegram_id'],
                                photo=await photo_file.read(),
                                caption=message_text,
                                reply_markup=keyboard
                            )
                    else:
                        await context.bot.send_message(
                            chat_id=volunteer['telegram_id'],
                            text=message_text,
                            reply_markup=keyboard
                        )
                    success_count += 1
                    logger.info(f"Task {task.id} sent to volunteer {volunteer['username']} (telegram_id: {volunteer['telegram_id']})")  # type: ignore[attr-defined]
                except (TelegramError, FileNotFoundError) as e:
                    logger.error(f"Failed to send task {task.id} to {volunteer['username']} (telegram_id: {volunteer['telegram_id']}): {e}")  # type: ignore[attr-defined]
                    failed_volunteers.append(volunteer['username'])
                    continue

            # Формирование ответа организатору
            response = f"Задание отправлено {success_count} волонтёрам из {len(volunteers)}!"
            if failed_volunteers:
                response += f"\nНе удалось отправить: {', '.join(failed_volunteers)}."
            if query.message:
                await query.message.reply_text(response, reply_markup=get_org_keyboard())  # type: ignore[attr-defined]

        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    except Exception as e:
        logger.error(f"Error in confirm_task for task {task.id if 'task' in locals() else 'unknown'}: {e}\n{traceback.format_exc()}")  # type: ignore[attr-defined]
        if query and query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
                f"Ошибка при создании или отправке задания: {str(e)}. Пожалуйста, попробуйте снова.",
                reply_markup=get_org_keyboard()
            )
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END
                
async def check_photos(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query:
        await query.answer()
    logger.info(f"Entering check_photos with callback_data: {getattr(query, 'data', 'No callback data') if query else 'No query'}")
    if context.user_data:
        logger.info(f"context.user_data at start: {await sync_to_async(lambda: str(context.user_data))()}")

    if not context.user_data:
        return ConversationHandler.END

    if query and query.from_user:
        user = query.from_user
    elif update.message and update.message.from_user:
        user = update.message.from_user
    else:
        return ConversationHandler.END
    
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        logger.warning(f"Access denied for telegram_id: {telegram_id}, not an organizer")
        if query and query.message:
            await query.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        elif update.message:
            await update.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    page = context.user_data.get('photos_page', 0)
    try:
        photos, total = await get_pending_photos_for_organizer(db_user, page)
        logger.info(f"Fetched photos: {len(photos)} photos, total: {total}")
        if not photos:
            logger.info("No pending photos found")
            if query and query.message:
                await query.message.reply_text("Нет фото, ожидающих проверки.")  # type: ignore[attr-defined]
            elif update and update.message:
                await update.message.reply_text("Нет фото, ожидающих проверки.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        total_pages = (total + PHOTOS_PER_PAGE - 1) // PHOTOS_PER_PAGE
        context.user_data['pending_photos'] = photos
        context.user_data['photos_page'] = page
        context.user_data['selected_photo'] = photos[0][0]  # Сохраняем первое фото
        logger.info(f"Saved pending_photos: {len(photos)} photos, page: {page}, total_pages: {total_pages}, selected_photo: {photos[0][0].id}")

        photo, volunteer_username, project_title, task = photos[0]
        logger.info(f"Processing photo: id={photo.id}, path={photo.image.path}")  # type: ignore[attr-defined]
        photo_path = photo.image.path if hasattr(photo.image, 'path') else photo.image.url  # type: ignore[attr-defined]
        if not await sync_to_async(os.path.exists)(photo_path):
            logger.error(f"File not found: {photo_path}")
            if query and query.message:
                await query.message.reply_text("Ошибка: файл фото не найден.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        async with aiofiles.open(photo.image.path, 'rb') as photo_file:
            buttons = [
                [InlineKeyboardButton("✅ Подтверждаю выполнение", callback_data=f"mod_photo_action_0_approve"),
                 InlineKeyboardButton("❌ Отклонить", callback_data=f"mod_photo_action_0_reject")]
            ]
            keyboard = InlineKeyboardMarkup(buttons)
            logger.info(f"Sending photo with keyboard: {buttons}")
            
            # ✅ ИСПРАВЛЕНИЕ: Конвертируем строки в datetime если нужно
            from django.utils.dateparse import parse_date, parse_time
            
            deadline_date = "Не указана"
            if task and task.deadline_date:
                if isinstance(task.deadline_date, str):
                    parsed_deadline = parse_date(task.deadline_date)
                    if parsed_deadline:
                        deadline_date = parsed_deadline.strftime('%d-%m-%Y')
                else:
                    deadline_date = task.deadline_date.strftime('%d-%m-%Y')
            
            time_range = "Не указано"
            if task and task.start_time and task.end_time:
                start = parse_time(task.start_time) if isinstance(task.start_time, str) else task.start_time
                end = parse_time(task.end_time) if isinstance(task.end_time, str) else task.end_time
                if start and end:
                    time_range = f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"
            
            if query and query.message:
                await query.message.reply_photo(  # type: ignore[attr-defined]
                    photo=await photo_file.read(),
                    caption=f"Фото от {volunteer_username} (проект: {project_title})\nЗадание: {task.text if task else 'Нет задания'}\nСрок выполнение: {deadline_date}\nВремя: {time_range}",
                    reply_markup=keyboard
                )
            elif update and update.message:
                await update.message.reply_photo(  # type: ignore[attr-defined]
                    photo=await photo_file.read(),
                    caption=f"Фото от {volunteer_username} (проект: {project_title})\nЗадание: {task.text if task else 'Нет задания'}\nСрок выполнение: {deadline_date}\nВремя: {time_range}",
                    reply_markup=keyboard
                )

        keyboard = get_pagination_keyboard(page, total_pages)
        if query and query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
                f"Фото, ожидающие проверки (страница {page + 1} из {total_pages}):",
                reply_markup=keyboard
            )
        elif update.message:
            await update.message.reply_text(  # type: ignore[attr-defined]
                f"Фото, ожидающие проверки (страница {page + 1} из {total_pages}):",
                reply_markup=keyboard
            )
        logger.info(f"Transitioning to MODERATE_PHOTO state")
        return MODERATE_PHOTO
    except Exception as e:
        logger.error(f"Error in check_photos: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text(f"Ошибка при отображении фото: {str(e)}")  # type: ignore[attr-defined]
        elif update.message:
            await update.message.reply_text(f"Ошибка при отображении фото: {str(e)}")  # type: ignore[attr-defined]
        return ConversationHandler.END

async def handle_photo_moderation_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()
    
    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    logger.info(f"Received callback_data in handle_photo_moderation_selection: {query.data}")
    if context.user_data:
        logger.info(f"context.user_data in handle_photo_moderation_selection: {await sync_to_async(lambda: str(context.user_data))()}")

    if query.data == "cancel_moderate":
        logger.info("Canceling photo moderation")
        if query.message:
            await query.message.reply_text("Проверка фото отменена.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    if not query.data.startswith("photo_"):
        logger.warning(f"Unexpected callback_data in handle_photo_moderation_selection: {query.data}")
        if query.message:
            await query.message.reply_text("Ошибка: неверная команда.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

    try:
        action, page = query.data.split('_')[1:3]
        page = int(page)
        logger.info(f"Pagination action: {action}, page: {page}")
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid pagination callback_data: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный формат пагинации.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

    if action == "prev":
        page -= 1
    elif action == "next":
        page += 1
    else:
        logger.error(f"Unknown pagination action: {action}")
        if query.message:
            await query.message.reply_text("Ошибка: неизвестное действие пагинации.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

    if not context.user_data:
        return ConversationHandler.END
    
    if not query.from_user:
        return ConversationHandler.END
    
    context.user_data['photos_page'] = page
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    try:
        context.user_data['photos_page'] = page
        photos, total = await get_pending_photos_for_organizer(db_user, page)
        total_pages = (total + PHOTOS_PER_PAGE - 1) // PHOTOS_PER_PAGE
        context.user_data['pending_photos'] = photos
        context.user_data['selected_photo'] = photos[0][0] if photos else None
        logger.info(f"Updated pending_photos: {len(photos)} photos, page: {page}, total_pages: {total_pages}")

        if not photos:
            logger.info("No photos on this page")
            if query.message:
                await query.message.reply_text("Нет фото на этой странице.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
            if context.user_data:
                context.user_data.clear()
            return ConversationHandler.END

        photo, volunteer_username, project_title, task = photos[0]
        photo_path = photo.image.path if hasattr(photo.image, 'path') else photo.image.url  # type: ignore[attr-defined]
        if not await sync_to_async(os.path.exists)(photo_path):
            logger.error(f"File not found: {photo_path}")
            if query.message:
                await query.message.reply_text(f"Ошибка: файл фото {photo_path} не найден.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        async with aiofiles.open(photo_path, 'rb') as photo_file:
            buttons = [
                [InlineKeyboardButton("✅ Подтверждаю выполнение", callback_data=f"mod_photo_action_0_approve"),
                 InlineKeyboardButton("❌ Отклонить", callback_data=f"mod_photo_action_0_reject")]
            ]
            keyboard = InlineKeyboardMarkup(buttons)
            logger.info(f"Sending photo with keyboard: {buttons}")
            
            # ✅ ИСПРАВЛЕНИЕ: Конвертируем строки в datetime если нужно
            from django.utils.dateparse import parse_date, parse_time
            
            deadline_date = "Не указана"
            if task and task.deadline_date:
                if isinstance(task.deadline_date, str):
                    parsed_deadline = parse_date(task.deadline_date)
                    if parsed_deadline:
                        deadline_date = parsed_deadline.strftime('%d-%m-%Y')
                else:
                    deadline_date = task.deadline_date.strftime('%d-%m-%Y')
            
            time_range = "Не указано"
            if task and task.start_time and task.end_time:
                start = parse_time(task.start_time) if isinstance(task.start_time, str) else task.start_time
                end = parse_time(task.end_time) if isinstance(task.end_time, str) else task.end_time
                if start and end:
                    time_range = f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"
            
            if query.message:
                await query.message.reply_photo(  # type: ignore[attr-defined]
                    photo=await photo_file.read(),
                    caption=f"Фото от {volunteer_username} (проект: {project_title})\npадание: {task.text if task else 'Нет задания'}\nСрок выполнение: {deadline_date}\nВремя: {time_range}",
                    reply_markup=keyboard
                )

        keyboard = get_pagination_keyboard(page, total_pages)
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Фото, ожидающие проверки (страница {page + 1} из {total_pages}):",
            reply_markup=keyboard
        )
        return MODERATE_PHOTO
    except Exception as e:
        logger.error(f"Error in handle_photo_moderation_selection: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text(f"Ошибка при обработке пагинации: {str(e)}")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

async def handle_photo_moderation_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()
    if not query.data:
        logger.warning("Received callback_query without data")
        return ConversationHandler.END
    logger.info(f"Processing photo moderation action with data: {query.data}")

    if not context.user_data:
        logger.error("No context.user_data")
        return ConversationHandler.END
    
    if not context.user_data.get('pending_photos'):
        logger.error("No pending_photos in context.user_data")
        if query.message:
            await query.message.reply_text("Ошибка: список фотографий недоступен.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    try:
        parts = query.data.split('_')
        if len(parts) != 5 or parts[0:3] != ['mod', 'photo', 'action']:
            logger.error(f"Invalid callback_data structure: {query.data}")
            if query.message:
                await query.message.reply_text("Ошибка: неверный формат команды.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        choice = int(parts[3])
        action = parts[4]
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный формат данных.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    photos = context.user_data.get('pending_photos', [])
    if not (0 <= choice < len(photos)):
        logger.error(f"Invalid photo choice: {choice}, available photos: {len(photos)}")
        if query.message:
            await query.message.reply_text("Ошибка: выбранное фото недоступно.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    photo, volunteer_username, project_title, task = photos[choice]
    context.user_data['selected_photo'] = photo

    # ИСПРАВЛЕНО: Проверяем авторизацию - организатор должен быть создателем проекта
    if not update.effective_user:
        return ConversationHandler.END
    organizer = await sync_to_async(User.objects.get)(telegram_id=str(update.effective_user.id))  # type: ignore[attr-defined]

    # Получаем creator через sync_to_async чтобы избежать ошибки
    photo_project = await sync_to_async(lambda: photo.project)()
    project_creator = await sync_to_async(lambda: photo_project.creator)()

    if project_creator != organizer:
        if query.message:
            await query.message.reply_text("❌ Вы не являетесь создателем этого проекта. Вы не можете модерировать это фото.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

    try:
        if action == "approve":
            await approve_photo(photo)
            if task:
                task.status = 'completed'
                await sync_to_async(task.save)()
            rating_keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(str(i), callback_data=f"rating_{i}") for i in range(1, 6)],
                [InlineKeyboardButton("Пропустить", callback_data="rating_skip")]
            ])
            if query.message:
                await query.message.reply_text(  # type: ignore[attr-defined]
                f"Фото от {volunteer_username} одобрено. Оцените работу волонтёра (1–5 звёзд):",
                reply_markup=rating_keyboard
            )
            context.user_data['awaiting_rating_for'] = photo.id  # type: ignore[attr-defined]
            return MODERATE_PHOTO_ACTION
        elif action == "reject":
            await reject_photo(photo, context)
            if task:
                task.status = 'failed'
                await sync_to_async(task.save)()
            deadline_date = task.deadline_date.strftime('%d-%m-%Y') if task and task.deadline_date else "Не указана"
            if task and task.start_time and task.end_time:
                time_range = f"{task.start_time.strftime('%H:%M')} - {task.end_time.strftime('%H:%M')}"
            else:
                time_range = "Не указано"
            if query.message:
                await query.message.edit_caption(  # type: ignore[attr-defined]
                    caption=f"Фото от {volunteer_username} (проект: {project_title})\nЗадание: {task.text if task else 'Нет задания'}\nСрок выполнения: {deadline_date}\nВремя: {time_range}\n[Отклонено]"
                )
            return await show_next_photo(update, context)
        else:
            logger.error(f"Unknown action: {action}")
            if query.message:
                await query.message.reply_text("Ошибка: неизвестное действие.")  # type: ignore[attr-defined]
            return MODERATE_PHOTO
    except Exception as e:
        logger.error(f"Failed to process action '{action}' for photo {photo.id}: {e}")  # type: ignore[attr-defined]
        if query and query.message:
            await query.message.reply_text(f"Ошибка при обработке фото: {str(e)}")  # type: ignore[attr-defined]
        return ConversationHandler.END
    

async def check_expired_tasks(context: Any) -> None:
    tasks = await sync_to_async(Task.objects.filter(status__in=['open', 'in_progress']).all)()
    for task in tasks:
        if await sync_to_async(task.is_expired)():
            await sync_to_async(task.close_if_expired)()

# Обработчик команды /moderate_photos
async def moderate_photos_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.from_user:
        return
    logger.info(f"Received /moderate_photos command from telegram_id: {update.message.from_user.id}")
    user = update.message.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        logger.warning(f"Access denied for telegram_id: {telegram_id}, not an organizer")
        if update.message:
            await update.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return

    # Создание нового объекта Update с callback_query
    from telegram import CallbackQuery
    fake_query = CallbackQuery(
        id='fake',
        from_user=user,
        chat_instance='0'
    )
    # Используем type: ignore для присваивания message и data
    fake_query.message = update.message  # type: ignore[attr-defined]
    fake_query.data = 'check_photos'  # type: ignore[attr-defined]
    fake_query.answer = lambda *args: None  # type: ignore[attr-defined]
    
    new_update = Update(
        update_id=update.update_id,
        message=update.message,
        callback_query=fake_query
    )
    await check_photos(new_update, context)

async def provide_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not context.user_data:
        return ConversationHandler.END
    
    task = context.user_data.get('selected_task')
    if not task:
        if query.message:
            await query.message.reply_text("Задание не найдено.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(str(i), callback_data=f"feedback_{i}") for i in range(1, 6)],
        [InlineKeyboardButton("❌ Отмена", callback_data="cancel_feedback")]
    ])
    if query.message:
        await query.message.reply_text("Оцените работу волонтёра (1-5):", reply_markup=keyboard)  # type: ignore[attr-defined]
    return FEEDBACK

async def handle_rating_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END
    
    if not context.user_data.get('awaiting_rating_for'):
        if query.message:
            await query.message.reply_text("Ошибка: не найдено фото для оценки.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

    if not update.effective_user:
        return ConversationHandler.END

    try:
        photo_id = context.user_data['awaiting_rating_for']
        photo = await sync_to_async(Photo.objects.select_related('volunteer', 'project', 'task').get)(id=photo_id)  # type: ignore[attr-defined]

        # Получаем Django User для организатора
        telegram_id = str(update.effective_user.id)
        organizer = await sync_to_async(User.objects.get)(telegram_id=telegram_id)  # type: ignore[attr-defined]

        if query.data == "rating_skip":
            photo.status = 'approved'
            photo.moderated_at = timezone.now()
            await sync_to_async(photo.save)()
            if query.message:
                await query.message.edit_text("Оценка пропущена. Фото одобрено.")  # type: ignore[attr-defined]
            return await show_next_photo(update, context)
        else:
            rating = int(query.data.split('_')[1])
            # Сохраняем рейтинг сразу
            photo.rating = rating
            photo.status = 'approved'
            photo.moderated_at = timezone.now()
            await sync_to_async(photo.save)()

            # ИСПРАВЛЕНО: Правильный async/await для update_rating
            update_rating_func = sync_to_async(photo.volunteer.update_rating)
            await update_rating_func(rating)

            # Создаем сессию обратной связи
            feedback_session = await sync_to_async(FeedbackSession.objects.create)(
                organizer=organizer,
                volunteer=photo.volunteer,
                project=photo.project,
                task=photo.task,
                photo=photo,
                rating=rating
            )
            
            # Для оценок 1-3 - обязательный комментарий
            if rating <= 3:
                if query.message:
                    await query.message.reply_text(  # type: ignore[attr-defined]
                    f"Вы поставили оценку {rating}★. Пожалуйста, напишите комментарий с объяснением низкой оценки:",
                    reply_markup=ReplyKeyboardRemove()
                )
                context.user_data['feedback_session_id'] = feedback_session.id  # type: ignore[attr-defined]
                return FEEDBACK_SESSION
            
            # Для оценок 4-5 - комментарий по желанию
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("Оставить комментарий", callback_data=f"feedback_session_{feedback_session.id}")],  # type: ignore[attr-defined]
                [InlineKeyboardButton("Пропустить", callback_data="feedback_skip")]
            ])
            
            if query.message:
                await query.message.reply_text(  # type: ignore[attr-defined]
                f"Оценка {rating}★ сохранена. Хотите оставить комментарий к оценке?",
                reply_markup=keyboard
            )
            return MODERATE_PHOTO_ACTION

    except Exception as e:
        logger.error(f"Error handling rating: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при сохранении оценки.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

async def handle_mandatory_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.text:
        return ConversationHandler.END
    
    if not context.user_data:
        return ConversationHandler.END
    
    message_text = update.message.text.strip()
    if not message_text:
        await update.message.reply_text("Комментарий не может быть пустым. Пожалуйста, напишите ваш комментарий:")  # type: ignore[attr-defined]
        return MODERATE_PHOTO_ACTION

    try:
        photo_id = context.user_data.get('awaiting_feedback_for')
        if not photo_id:
            if update.message:
                await update.message.reply_text("Ошибка: фото не найдено.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        
        photo = await sync_to_async(Photo.objects.get)(id=photo_id)  # type: ignore[attr-defined]
        
        # Сохраняем комментарий
        photo.feedback = message_text
        await sync_to_async(photo.save)()
        
        # Создаем сессию обратной связи
        if not update.effective_user:
            logger.warning("Received feedback without effective_user")
            return ConversationHandler.END
        telegram_id = str(update.effective_user.id)
        organizer = await sync_to_async(User.objects.get)(telegram_id=telegram_id)  # type: ignore[attr-defined]
        
        feedback_session = await sync_to_async(FeedbackSession.objects.create)(
            organizer=organizer,
            volunteer=photo.volunteer,
            project=photo.project,
            task=photo.task,
            photo=photo,
            rating=photo.rating
        )
        
        # Создаем сообщение с комментарием
        await sync_to_async(FeedbackMessage.objects.create)(
            session=feedback_session,
            sender=organizer,
            text=message_text
        )
        
        # Уведомляем волонтера
        if photo.volunteer and photo.volunteer.telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=photo.volunteer.telegram_id,
                    text=f"Организатор оставил комментарий к вашей работе в проекте {photo.project.title}:\n{message_text}"
                )
            except Exception as e:
                logger.error(f"Failed to notify volunteer: {e}")

        if update.message:
            await update.message.reply_text("Ваш комментарий сохранён и отправлен волонтёру.")  # type: ignore[attr-defined]
        return await show_next_photo(update, context)
        
    except Exception as e:
        logger.error(f"Error saving mandatory feedback: {e}\n{traceback.format_exc()}")
        if update.message:
            await update.message.reply_text("Ошибка при сохранении комментария. Попробуйте снова.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO_ACTION

async def start_feedback_session(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()
    
    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    if query.data == "feedback_skip":
        if query.message:
            await query.message.edit_text("Обратная связь пропущена.")  # type: ignore[attr-defined]
        return await show_next_photo(update, context)
    
    if not context.user_data:
        return ConversationHandler.END
    
    try:
        session_id = int(query.data.split('_')[2])
        session = await sync_to_async(FeedbackSession.objects.select_related(  # type: ignore[attr-defined]
            'volunteer', 'project', 'organizer'
        ).get)(id=session_id)
        
        context.user_data['feedback_session'] = session
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Сессия обратной связи с {session.volunteer.username} начата. "
            "Отправьте ваше сообщение или /cancel для завершения."
        )
        return FEEDBACK_SESSION

    except Exception as e:
        logger.error(f"Error starting feedback session: {e}")
        if query and query.message:
            await query.message.reply_text("Ошибка начала сессии обратной связи.")  # type: ignore[attr-defined]
        return MODERATE_PHOTO

# УДАЛЕНА ДУБЛИРУЮЩАЯСЯ ФУНКЦИЯ handle_feedback_message (строки 1643-1691)
# Актуальная версия находится ниже (строка 1866)

async def end_feedback_session(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Определяем источник обновления (кнопка или команда)
    query = update.callback_query
    message = update.message or (query.message if query else None)
    
    if not message:
        logger.error("No message or callback_query found in update")
        return ConversationHandler.END
    
    if not update.effective_user:
        return ConversationHandler.END
    
    try:
        # Если это callback_query, отвечаем на него
        if query:
            await query.answer()
        
        # Получаем telegram_id пользователя
        telegram_id = str(update.effective_user.id)
        user = await sync_to_async(User.objects.get)(telegram_id=telegram_id)  # type: ignore[attr-defined]
        
        # Получаем session_id из callback_data или находим активную сессию
        if query and query.data and query.data.startswith("close_feedback_"):
            session_id = int(query.data.split('_')[2])
        else:
            # Ищем активную сессию для этого пользователя
            session = await sync_to_async(
                FeedbackSession.objects.filter(
                    (Q(volunteer=user) | Q(organizer=user)) & Q(is_active=True)
                ).select_related('volunteer', 'organizer', 'project').first
            )()
            
            if not session:
                if message:
                    await message.reply_text("У вас нет активных сессий обратной связи.")  # type: ignore[attr-defined]
                return ConversationHandler.END
            session_id = session.id  # type: ignore[attr-defined]

        # Получаем полные данные сессии
        session = await sync_to_async(  # type: ignore[attr-defined]
            FeedbackSession.objects.select_related('volunteer', 'organizer', 'project').get
        )(id=session_id)
        
        # Проверяем права пользователя на закрытие сессии
        if user not in [session.volunteer, session.organizer]:
            if message:
                await message.reply_text("У вас нет прав для закрытия этого чата.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        # Закрываем сессию
        session.is_active = False
        session.is_completed = True
        session.completed_at = timezone.now()
        await sync_to_async(session.save)()
        logger.info(f"Feedback session {session_id} closed by {user.username}")

        # Уведомляем другого участника
        other_participant = session.organizer if user == session.volunteer else session.volunteer
        if other_participant and other_participant.telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=other_participant.telegram_id,
                    text=f"Чат по проекту '{session.project.title}' был закрыт {user.username}."
                )
            except Exception as e:
                logger.error(f"Failed to notify {other_participant.username if other_participant else 'Unknown'}: {e}")

        # Отправляем подтверждение
        is_organizer = user == session.organizer
        reply_markup = get_org_keyboard() if is_organizer else None
        if message:
            await message.reply_text(  # type: ignore[attr-defined]
            "Чат обратной связи успешно закрыт.",
            reply_markup=reply_markup
        )

    except User.DoesNotExist:  # type: ignore[attr-defined]
        logger.error(f"User with telegram_id {telegram_id} not found")
        if message:
            await message.reply_text("Ошибка: пользователь не найден.")  # type: ignore[attr-defined]
    except FeedbackSession.DoesNotExist:  # type: ignore[attr-defined]
        logger.error(f"Feedback session {session_id if 'session_id' in locals() else 'unknown'} not found")
        if message:
            await message.reply_text("Ошибка: сессия не найдена.")  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error closing feedback session: {e}\n{traceback.format_exc()}")
        if message:
            await message.reply_text("Произошла ошибка при закрытии чата.")  # type: ignore[attr-defined]

    # Очищаем контекст в любом случае
    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

async def show_next_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.from_user:
        return ConversationHandler.END
    
    if not context.user_data:
        return ConversationHandler.END
    
    page = context.user_data.get('photos_page', 0)
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    
    try:
        photos, total = await get_pending_photos_for_organizer(db_user, page)
        total_pages = (total + PHOTOS_PER_PAGE - 1) // PHOTOS_PER_PAGE
        
        if photos:
            photo, volunteer_username, project_title, task = photos[0]
            context.user_data['pending_photos'] = photos
            context.user_data['selected_photo'] = photo
            
            photo_path = photo.image.path if hasattr(photo.image, 'path') else photo.image.url  # type: ignore[attr-defined]
            if not await sync_to_async(os.path.exists)(photo_path):
                logger.error(f"File not found: {photo_path}")
                if query.message:
                    await query.message.reply_text(f"Ошибка: файл фото {photo_path} не найден.")  # type: ignore[attr-defined]
                return ConversationHandler.END

            async with aiofiles.open(photo_path, 'rb') as photo_file:
                buttons = [
                    [InlineKeyboardButton("✅ Подтверждаю выполнение", callback_data=f"mod_photo_action_0_approve"),
                     InlineKeyboardButton("❌ Отклонить", callback_data=f"mod_photo_action_0_reject")]
                ]
                keyboard = InlineKeyboardMarkup(buttons)
                
                deadline_date = task.deadline_date.strftime('%d-%m-%Y') if task and task.deadline_date else "Не указана"
                if task and task.start_time and task.end_time:
                    time_range = f"{task.start_time.strftime('%H:%M')} - {task.end_time.strftime('%H:%M')}"
                else:
                    time_range = "Не указано"
                
                if not query.message:
                    return ConversationHandler.END
                
                await context.bot.send_photo(
                    chat_id=query.message.chat.id,  # type: ignore[attr-defined]
                    photo=await photo_file.read(),
                    caption=f"Фото от {volunteer_username} (проект: {project_title})\nЗадание: {task.text if task else 'Нет задания'}\nСрок выполнение: {deadline_date}\nВремя: {time_range}",
                    reply_markup=keyboard
                )

            keyboard = get_pagination_keyboard(page, total_pages)
            if query.message:
                await context.bot.send_message(
                    chat_id=query.message.chat.id,  # type: ignore[attr-defined]
                    text=f"Фото, ожидающие проверки (страница {page + 1} из {total_pages}):",
                    reply_markup=keyboard
                )
            return MODERATE_PHOTO
        else:
            if query.message:
                await context.bot.send_message(
                    chat_id=query.message.chat.id,  # type: ignore[attr-defined]
                    text="Больше нет фото для проверки.",
                    reply_markup=get_org_keyboard()
                )
            if context.user_data:
                context.user_data.clear()
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error showing next photo: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text(f"Ошибка при загрузке следующего фото: {str(e)}")  # type: ignore[attr-defined]
        return ConversationHandler.END

async def handle_feedback_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.effective_user:
        return ConversationHandler.END
    if not update.message or not update.message.text:
        return ConversationHandler.END
    
    telegram_id = str(update.effective_user.id)
    message_text = update.message.text.strip()
    logger.info(f"Processing feedback message from user {telegram_id}: {message_text[:50]}...")

    try:
        # Проверка на пустое сообщение
        if not message_text:
            await update.message.reply_text("Сообщение не может быть пустым. Пожалуйста, введите текст.")  # type: ignore[attr-defined]
            return FEEDBACK_SESSION

        # Получение активной сессии обратной связи
        session = await sync_to_async(
            lambda: FeedbackSession.objects.filter(
                Q(volunteer__telegram_id=telegram_id) | Q(organizer__telegram_id=telegram_id),
                is_active=True
            ).select_related('volunteer', 'organizer', 'project').first()
        )()

        if not session:
            logger.warning(f"No active feedback session found for user {telegram_id}")
            if update.message:
                await update.message.reply_text(  # type: ignore[attr-defined]
                "У вас нет активной сессии обратной связи. Начните новую через меню.",
                reply_markup=get_org_keyboard() if await sync_to_async(lambda: User.objects.filter(telegram_id=telegram_id, is_organizer=True).exists())() else None  # type: ignore[attr-defined]
            )
            return ConversationHandler.END

        # Получение отправителя
        sender = await sync_to_async(lambda: User.objects.get(telegram_id=telegram_id))()  # type: ignore[attr-defined]
        if not sender.is_active:
            logger.warning(f"User {sender.username} (telegram_id: {telegram_id}) is not active")
            if update.message:
                await update.message.reply_text("Ваш аккаунт неактивен. Обратитесь к администратору.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        # Сохранение сообщения
        feedback_message = await sync_to_async(FeedbackMessage.objects.create)(  # type: ignore[attr-defined]
            session=session,
            sender=sender,
            text=message_text
        )
        logger.info(f"Feedback message {feedback_message.id} created for session {session.id}")  # type: ignore[attr-defined]

        # Определение получателя
        recipient = session.organizer if sender == session.volunteer else session.volunteer
        if not recipient or not recipient.telegram_id:
            logger.error(f"Recipient {recipient.username if recipient else 'None'} (id: {recipient.id if recipient else 'None'}) has no telegram_id")  # type: ignore[attr-defined]
            if update.message:
                await update.message.reply_text(  # type: ignore[attr-defined]
                "Сообщение сохранено, но у получателя отсутствует Telegram ID. Свяжитесь с поддержкой."
            )
            # Уведомление администратора
            admin = await get_admin()
            if admin and admin.telegram_id:
                await context.bot.send_message(
                    chat_id=admin.telegram_id,
                    text=f"Ошибка: у получателя {recipient.username if recipient else 'Unknown'} отсутствует telegram_id в сессии {session.id}"  # type: ignore[attr-defined]
                )
            return FEEDBACK_SESSION

        # Отправка сообщения получателю с повторными попытками
        max_retries = 3
        for attempt in range(max_retries):
            try:
                keyboard = get_feedback_keyboard(session.id) if sender == session.organizer else None  # type: ignore[attr-defined]
                await context.bot.send_message(
                    chat_id=recipient.telegram_id,
                    text=f"Новое сообщение в чате по проекту {session.project.title}:\n{message_text}",
                    reply_markup=keyboard
                )
                logger.info(f"Message sent to recipient {recipient.username} (telegram_id: {recipient.telegram_id})")
                break
            except TelegramError as e:
                if attempt == max_retries - 1:
                    logger.error(
                        f"Failed to send message to {recipient.username} (telegram_id: {recipient.telegram_id}) "
                        f"after {max_retries} attempts: {e}"
                    )
                    if update.message:
                        await update.message.reply_text(
                        "Сообщение сохранено, но не удалось отправить получателю. Свяжитесь с поддержкой."
                    )
                    # Уведомление администратора
                    admin = await get_admin()
                    if admin and admin.telegram_id:
                        await context.bot.send_message(
                            chat_id=admin.telegram_id,
                            text=f"Ошибка отправки сообщения в сессии {session.id} для {recipient.username}: {e}"  # type: ignore[attr-defined]
                        )
                    return FEEDBACK_SESSION
                logger.warning(f"Attempt {attempt + 1}/{max_retries} failed for {recipient.telegram_id}: {e}")
                await asyncio.sleep(2 ** attempt)

        # Ответ пользователю
        reply_keyboard = get_feedback_keyboard(session.id) if sender == session.organizer else None  # type: ignore[attr-defined]
        if update.message:
            await update.message.reply_text(  # type: ignore[attr-defined]
            "Сообщение отправлено. Продолжайте или нажмите /cancel для завершения.",
            reply_markup=reply_keyboard
        )
        return FEEDBACK_SESSION

    except Exception as e:
        logger.error(f"Error handling feedback message for user {telegram_id}: {e}\n{traceback.format_exc()}")
        if update.message:
            await update.message.reply_text(  # type: ignore[attr-defined]
            f"Ошибка при обработке сообщения: {str(e)}. Попробуйте снова или нажмите на кнопку.",
            reply_markup=get_org_keyboard() if await sync_to_async(lambda: User.objects.filter(telegram_id=telegram_id, is_organizer=True).exists())() else None  # type: ignore[attr-defined]
        )
        # Уведомление администратора
        admin = await get_admin()
        if admin and admin.telegram_id:
            telegram_id_str = str(admin.telegram_id)
            await context.bot.send_message(
                chat_id=telegram_id_str,
                text=f"Ошибка в handle_feedback_message для пользователя {telegram_id}: {e}"
            )
        return FEEDBACK_SESSION

async def close_feedback_session(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()
    
    if not query.data:
        logger.warning("Received callback_query without data")
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    logger.info(f"Closing feedback session with callback_data: {query.data}")

    try:
        # Извлечение session_id из callback_data
        session_id = int(query.data.split('_')[2])
        
        # Получение сессии с полной загрузкой связанных объектов
        session_data = await sync_to_async(  # type: ignore[attr-defined]
            lambda: FeedbackSession.objects.select_related('volunteer', 'organizer', 'project').get(id=session_id)
        )()
        
        # Проверка активности сессии
        if not session_data.is_active:
            logger.warning(f"Session {session_id} is already inactive")
            if query.message:
                await query.message.reply_text("Сессия уже закрыта.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
            return ConversationHandler.END

        # Получение telegram_id напрямую из session_data
        volunteer_telegram_id = session_data.volunteer.telegram_id if session_data.volunteer else None
        organizer_telegram_id = session_data.organizer.telegram_id if session_data.organizer else None

        # Деактивация сессии
        session_data.is_active = False
        session_data.is_completed = True
        session_data.completed_at = timezone.now()  # Добавлено для отслеживания времени закрытия
        await sync_to_async(session_data.save)()
        logger.info(f"Feedback session {session_id} closed at {session_data.completed_at}")

        # Уведомление участников с обработкой ошибок
        if volunteer_telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=volunteer_telegram_id,
                    text=f"Сессия обратной связи по проекту {session_data.project.title} завершена."
                )
                logger.info(f"Notification sent to volunteer (telegram_id: {volunteer_telegram_id})")
            except Exception as e:
                logger.error(f"Failed to notify volunteer (telegram_id: {volunteer_telegram_id}): {e}")

        if organizer_telegram_id and organizer_telegram_id != volunteer_telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=organizer_telegram_id,
                    text=f"Сессия обратной связи по проекту {session_data.project.title} завершена."
                )
                logger.info(f"Notification sent to organizer (telegram_id: {organizer_telegram_id})")
            except Exception as e:
                logger.error(f"Failed to notify organizer (telegram_id: {organizer_telegram_id}): {e}")

        # Ответ пользователю (волонтёру или организатору)
        if not query.from_user:
            return ConversationHandler.END
        is_organizer = await sync_to_async(lambda: session_data.organizer.telegram_id == query.from_user.id)()  # type: ignore[attr-defined]
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            "Чат обратной связи закрыт.",
            reply_markup=get_org_keyboard() if is_organizer else None
        )
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    except ValueError as e:
        logger.error(f"Invalid session_id in callback_data {query.data if query.data else 'None'}: {e}")
        if query and query.message:
            await query.message.reply_text("Ошибка: неверный формат данных.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    except Exception as e:
        logger.error(f"Error closing feedback session {session_id if 'session_id' in locals() else 'unknown'}: {e}\n{traceback.format_exc()}")
        if query and query.message and query.from_user:
            is_org = await sync_to_async(lambda: User.objects.filter(telegram_id=str(query.from_user.id), is_organizer=True).exists())()  # type: ignore[attr-defined]
            await query.message.reply_text(  # type: ignore[attr-defined]
            f"Ошибка при закрытии чата: {str(e)}. Попробуйте снова или свяжитесь с поддержкой.",
            reply_markup=get_org_keyboard() if is_org else None
        )
        return ConversationHandler.END

async def send_task_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.from_user:
        return ConversationHandler.END
    await query.answer()
    
    if not context.user_data:
        return ConversationHandler.END
    
    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user or not db_user.is_organizer:
        if query.message:
            await query.message.reply_text("У вас нет прав организатора.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    try:
        projects = await get_organizer_projects(db_user)
        if not projects:
            if query.message:
                await query.message.reply_text("У вас нет активных проектов.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        
        buttons = [
            [InlineKeyboardButton(project.title, callback_data=f"task_project_{i}")]  # type: ignore[attr-defined]
            for i, project in enumerate(projects)
        ]
        buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_task")])
        keyboard = InlineKeyboardMarkup(buttons)
        
        if query.message:
            await query.message.reply_text(  # type: ignore[attr-defined]
            "Выберите проект для задания:",
            reply_markup=keyboard
        )
        context.user_data['organizer'] = db_user
        context.user_data['projects'] = projects
        return SELECT_PROJECT
    except Exception as e:
        logger.error(f"Error in send_task_start: {e}\n{traceback.format_exc()}")
        if query and query.message:
            await query.message.reply_text("Ошибка при получении списка проектов.")  # type: ignore[attr-defined]
        return ConversationHandler.END


async def feedback_rating(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        return ConversationHandler.END

    if query.data == "cancel_feedback":
        if query.message:
            await query.message.reply_text("Отзыв отменён.", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
        context.user_data.clear()
        return ConversationHandler.END

    try:
        rating = int(query.data.split('_')[1])
        context.user_data['feedback_rating'] = rating
        if query.message:
            await query.message.reply_text("Напишите комментарий (или отправьте /skip чтобы пропустить):")  # type: ignore[attr-defined]
        return FEEDBACK
    except Exception as e:
        logger.error(f"Error in feedback_rating: {e}")
        if query and query.message:
            await query.message.reply_text("Ошибка. Попробуйте снова.")  # type: ignore[attr-defined]
        return FEEDBACK

async def feedback_comment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.text:
        return ConversationHandler.END
    
    if not context.user_data:
        return ConversationHandler.END

    if update.message.text == "/skip":
        comment = None
    else:
        comment = update.message.text.strip()

    task = context.user_data.get('selected_task')
    volunteer = context.user_data.get('selected_volunteer')
    rating = context.user_data.get('feedback_rating')

    if not all([task, volunteer, rating]):
        await update.message.reply_text("Ошибка: недостаточно данных для сохранения отзыва.")  # type: ignore[attr-defined]
        context.user_data.clear()
        return ConversationHandler.END

    try:
        # Получаем assignment и обновляем его
        assignment = await sync_to_async(TaskAssignment.objects.get)(task=task, volunteer=volunteer)  # type: ignore[attr-defined]
        assignment.rating = rating  # type: ignore[attr-defined]
        assignment.feedback = comment  # type: ignore[attr-defined]
        await sync_to_async(assignment.save)()  # type: ignore[attr-defined]

        # Обновляем рейтинг волонтера
        if volunteer and hasattr(volunteer, 'rating') and rating:
            volunteer.rating = min(100, (volunteer.rating or 0) + rating * 2)  # type: ignore[attr-defined]
            await sync_to_async(volunteer.save)()  # type: ignore[attr-defined]

        await update.message.reply_text("Отзыв сохранён!", reply_markup=get_org_keyboard())  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error saving feedback: {e}\n{traceback.format_exc()}")
        await update.message.reply_text("Ошибка при сохранении отзыва.")  # type: ignore[attr-defined]

    context.user_data.clear()
    return ConversationHandler.END

async def cancel_task_creation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Получаем сообщение либо из update.message, либо из callback_query.message
    message = update.message or (update.callback_query.message if update.callback_query else None)
    
    if not message:
        return ConversationHandler.END
    
    await message.reply_text(  # type: ignore[attr-defined]
        "Создание задания отменено.",
        reply_markup=get_org_keyboard()
    )
    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

def register_handlers(application: Any) -> None:
    # 1. Обработчик создания проекта
    create_project_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(create_project_start, pattern=r"^create_project$"),
            CommandHandler("org", org_menu)
        ],
        states={
            TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_project_title)],
            DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_project_description)],
            VOLUNTEER_TYPE: [CallbackQueryHandler(handle_volunteer_type_selection, pattern=r'^vtype_(social|environmental|cultural)$')],
            CITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_project_city)],
            TAGS: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_project_tags)],
            LOCATION: [MessageHandler(filters.LOCATION, create_project_location)],
        },
        fallbacks=[
            CommandHandler("cancel", cancel),
            CallbackQueryHandler(create_project_cancel, pattern=r"^cancel$")
        ],
        per_message=False  # Changed to False since we're using MessageHandler
    )
    application.add_handler(create_project_conv)

    # 2. Обработчик отправки задания
    send_task_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(send_task_start, pattern="^send_task$")],
        states={
            SELECT_PROJECT: [CallbackQueryHandler(select_project, pattern=r"^(task_project_\d+|cancel_task)$")],
            SELECT_RECIPIENTS: [CallbackQueryHandler(select_recipients, pattern=r"^(task_recipients_\w+|cancel_task)$")],
            SELECT_VOLUNTEERS: [CallbackQueryHandler(select_volunteers, pattern=r"^(task_volunteer_\d+|task_volunteers_done|cancel_task)$")],
            TASK_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_text)],
            TASK_DEADLINE_DATE: [
                CallbackQueryHandler(task_deadline_date_year, pattern=r"^deadline_date_year_\d+$"),
                CallbackQueryHandler(task_deadline_date_month, pattern=r"^deadline_date_month_\d+$"),
                CallbackQueryHandler(task_deadline_date_day, pattern=r"^deadline_date_day_\d+$")
            ],
            TASK_DEADLINE_START_TIME: [CallbackQueryHandler(task_deadline_start_time, pattern=r"^deadline_start_time_\d+$")],
            TASK_DEADLINE_END_TIME: [CallbackQueryHandler(task_deadline_end_time, pattern=r"^deadline_end_time_\d+$")],
            TASK_PHOTO: [CallbackQueryHandler(task_photo, pattern=r"^(task_photo_\w+|cancel_task)$")],
            TASK_PHOTO_UPLOAD: [MessageHandler(filters.PHOTO, task_photo_upload)],
            CONFIRM_TASK: [CallbackQueryHandler(confirm_task, pattern=r"^(task_confirm_send|cancel_task)$")]
        },
        fallbacks=[
            CommandHandler("cancel", cancel_task_creation),
            CallbackQueryHandler(cancel_task_creation, pattern=r"^cancel_task$")
        ],
        per_message=False  # Changed to False since we're using MessageHandler
    )
    application.add_handler(send_task_conv)

    # 3. Обработчик модерации фото
    moderate_photo_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(check_photos, pattern=r"^check_photos$"),
            CommandHandler("moderate_photos", moderate_photos_command)
        ],
        states={
            MODERATE_PHOTO: [
                CallbackQueryHandler(handle_photo_moderation_selection, pattern=r"^(photo_prev_\d+|photo_next_\d+|cancel_moderate)$"),
                CallbackQueryHandler(handle_photo_moderation_action, pattern=r"^mod_photo_action_\d+_(approve|reject)$")
            ],
            MODERATE_PHOTO_ACTION: [
                CallbackQueryHandler(handle_rating_selection, pattern=r"^rating_(\d+|skip)$"),
                CallbackQueryHandler(start_feedback_session, pattern=r"^(feedback_session_\d+|feedback_skip)$"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_mandatory_feedback),  # Добавлен обработчик для обязательного комментария
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_feedback_message)
            ],
            FEEDBACK_SESSION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_feedback_message),
                CommandHandler("cancel", end_feedback_session),
                CallbackQueryHandler(end_feedback_session, pattern=r"^close_feedback_\d+$")
            ]
        },
        fallbacks=[
            CommandHandler("cancel", end_feedback_session),
            CallbackQueryHandler(end_feedback_session, pattern=r"^cancel_moderate$")
        ],
        per_message=False
)
    application.add_handler(moderate_photo_conv)
    
    # 4. Другие обработчики
    application.add_handler(CallbackQueryHandler(manage_volunteers, pattern=r"^manage_volunteers$"))
    application.add_handler(CallbackQueryHandler(my_projects, pattern=r"^my_projects$"))
    application.add_handler(CallbackQueryHandler(delete_project, pattern=r"^delete_project_\d+$"))
    
    # 5. Планировщик задач
    if application.job_queue:
        application.job_queue.run_repeating(check_expired_tasks, interval=86400)