import logging
import asyncio
from typing import Any, Optional
from datetime import datetime
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes
from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone
import aiofiles
import aiofiles.os as aio_os
import os
import traceback

from core.models import User, Project, Photo, VolunteerProject, Task, TaskAssignment

# Настройка логирования
logger = logging.getLogger(__name__)

# Количество проектов на странице
PROJECTS_PER_PAGE = 5

# Максимальное количество проектов для волонтёра
MAX_PROJECTS_PER_VOLUNTEER = 1

# Состояния для ConversationHandler
TASK_CONFIRM, TASK_COMPLETED, TASK_PHOTO_UPLOAD = range(3)

# Основная клавиатура для волонтёров
def get_volunteer_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Список проектов", callback_data="list_projects"),
         InlineKeyboardButton("➕ Присоединиться к проекту", callback_data="join_project")],
        [InlineKeyboardButton("👤 Мой профиль", callback_data="profile"),
         InlineKeyboardButton("🚪 Выйти из проекта", callback_data="leave_project")]
    ])

# Вспомогательные функции с sync_to_async
@sync_to_async
def get_user(telegram_id: str) -> Optional[User]:  # type: ignore[attr-defined]
    try:
        user = User.objects.get(telegram_id=telegram_id)
        logger.info(f"User found: {user.username} (telegram_id: {telegram_id})")
        return user
    except User.DoesNotExist:  # type: ignore[attr-defined]
        logger.warning(f"User not found with telegram_id: {telegram_id}")
        return None

@sync_to_async
def get_volunteer_project(volunteer: User) -> tuple[Optional[VolunteerProject], Optional[str]]:
    logger.info(f"Fetching volunteer project for {volunteer.username}")
    volunteer_project = VolunteerProject.objects.filter(volunteer=volunteer).select_related('project').first()
    if volunteer_project:
        logger.info(f"Volunteer project found: {volunteer_project.project.title}")
        return volunteer_project, volunteer_project.project.title
    logger.info(f"No volunteer project found for {volunteer.username}")
    return None, None

@sync_to_async
def create_photo(volunteer: User, project: Project, file_path: str, task: Optional[Task] = None) -> Photo:
    logger.info(f"Creating photo for volunteer {volunteer.username} in project {project.title}")
    photo = Photo.objects.create(volunteer=volunteer, project=project, image=file_path, status='pending', task=task)  # type: ignore[attr-defined]
    logger.info(f"Photo created: {photo.id}")  # type: ignore[attr-defined]
    return photo

@sync_to_async
def get_approved_projects(volunteer: User, city: Optional[str] = None, tag: Optional[str] = None) -> list[tuple[Project, str, str, list[str]]]:
    logger.info(f"Fetching approved projects for volunteer {volunteer.username} (city={city}, tag={tag})")
    projects = Project.objects.filter(status='approved')
    if city:
        projects = projects.filter(city__iexact=city)
    if tag:
        projects = projects.filter(tags__name__in=[tag])
    
    joined_project_ids = VolunteerProject.objects.filter(volunteer=volunteer).values_list('project__id', flat=True)
    projects = projects.exclude(id__in=joined_project_ids)
    
    result = [(project, project.title, project.city, [tag.name for tag in project.tags.all()]) for project in projects]
    logger.info(f"Found {len(result)} approved projects for volunteer {volunteer.username}: {[p[1] for p in result]}")
    return result

@sync_to_async
def create_volunteer_project(volunteer: User, project: Project) -> tuple[Optional[VolunteerProject], Optional[str]]:
    logger.info(f"Creating volunteer project for {volunteer.username} in project {project.title}")
    current_projects_count = VolunteerProject.objects.filter(volunteer=volunteer, is_active=True).count()

    # Исправлено: проверяем что текущее количество меньше максимума
    if current_projects_count >= MAX_PROJECTS_PER_VOLUNTEER:
        logger.warning(f"Volunteer {volunteer.username} has reached the maximum number of projects: {MAX_PROJECTS_PER_VOLUNTEER}")
        return None, None

    try:
        with transaction.atomic():
            # Проверяем, не присоединялся ли волонтер к этому проекту ранее
            existing = VolunteerProject.objects.filter(volunteer=volunteer, project=project).first()
            if existing:
                if existing.is_active:
                    logger.warning(f"Volunteer {volunteer.username} already in project {project.title}")
                    return None, None
                else:
                    # Реактивируем участие
                    existing.is_active = True
                    existing.joined_at = timezone.now()
                    existing.save()
                    logger.info(f"Reactivated volunteer project: {existing.id}")  # type: ignore[attr-defined]
                    return existing, project.title

            volunteer_project = VolunteerProject.objects.create(volunteer=volunteer, project=project)  # type: ignore[attr-defined]
            logger.info(f"Volunteer project created: {volunteer_project.id}")  # type: ignore[attr-defined]
        return volunteer_project, project.title
    except Exception as e:
        logger.error(f"Failed to create VolunteerProject: {e}\n{traceback.format_exc()}")
        return None, None

@sync_to_async
def get_volunteer_projects(volunteer: User) -> list[tuple[VolunteerProject, str]]:
    logger.info(f"Fetching projects for volunteer {volunteer.username}")
    volunteer_projects = VolunteerProject.objects.filter(volunteer=volunteer).select_related('project')
    result = [(vp, vp.project.title) for vp in volunteer_projects]
    logger.info(f"Found {len(result)} projects for volunteer {volunteer.username}: {[r[1] for r in result]}")
    return result

@sync_to_async
def delete_volunteer_project(volunteer_project: VolunteerProject) -> None:
    logger.info(f"Deleting volunteer project {volunteer_project.id}")  # type: ignore[attr-defined]
    volunteer_project.delete()
    logger.info(f"Volunteer project {volunteer_project.id} deleted")  # type: ignore[attr-defined]

@sync_to_async
def get_task(task_id: int) -> Optional[Task]:  # type: ignore[attr-defined]
    try:
        task = Task.objects.select_related('project__creator').get(id=task_id)
        logger.info(f"Task {task_id} loaded with project and creator")
        return task
    except Task.DoesNotExist:  # type: ignore[attr-defined]
        logger.warning(f"Task {task_id} not found")
        return None

@sync_to_async
def update_task_assignment(task: Task, volunteer: User, accepted: Optional[bool] = None, completed: Optional[bool] = None) -> Optional[TaskAssignment]:  # type: ignore[attr-defined]
    try:
        assignment = TaskAssignment.objects.get(task=task, volunteer=volunteer)
        if accepted is not None:
            assignment.accepted = accepted
        if completed is not None:
            assignment.completed = completed
            assignment.completed_at = timezone.now()
        assignment.save()
        return assignment
    except TaskAssignment.DoesNotExist:  # type: ignore[attr-defined]
        logger.error(f"TaskAssignment not found for task {task.id} and volunteer {volunteer.username}")  # type: ignore[attr-defined]
        return None

@sync_to_async
def get_current_date() -> datetime:
    return timezone.now()

def get_pagination_keyboard(page: int, total_pages: int) -> InlineKeyboardMarkup:
    buttons = []
    if page > 0:
        buttons.append(InlineKeyboardButton("⬅️ Предыдущая", callback_data=f"prev_{page}"))
    if page < total_pages - 1:
        buttons.append(InlineKeyboardButton("Следующая ➡️", callback_data=f"next_{page}"))
    return InlineKeyboardMarkup([buttons])

async def volunteer_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.from_user:
        return
    user = update.message.from_user
    telegram_id = str(user.id)
    logger.info(f"Volunteer menu requested by telegram_id: {telegram_id}")
    db_user = await get_user(telegram_id)
    if not db_user:
        if update.message:
            await update.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")
        return

    if update.message:
        await update.message.reply_text(
            f"Добро пожаловать, {db_user.username}!\nВыберите действие:",
            reply_markup=get_volunteer_keyboard()
        )

async def list_projects(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    args = context.args if context.args is not None else []
    city = args[0] if len(args) > 0 else None
    tag = args[1] if len(args) > 1 else None

    page = context.user_data.get('projects_page', 0)

    user = query.from_user
    if not user:
        return
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return

    projects = await get_approved_projects(db_user, city=city, tag=tag)
    if not projects:
        if query.message:
            await query.message.reply_text("Нет доступных проектов по вашему запросу.")  # type: ignore[attr-defined]
        return

    total_projects = len(projects)
    total_pages = (total_projects + PROJECTS_PER_PAGE - 1) // PROJECTS_PER_PAGE
    start_idx = page * PROJECTS_PER_PAGE
    end_idx = min(start_idx + PROJECTS_PER_PAGE, total_projects)
    current_projects = projects[start_idx:end_idx]

    project_list = "\n".join([f"{i+1+start_idx}. {project[1]} ({project[2]}) - Теги: {', '.join(project[3])}" for i, project in enumerate(current_projects)])
    reply_text = f"Доступные проекты (страница {page+1} из {total_pages}):\n{project_list}\n\nЧтобы присоединиться, используйте 'Присоединиться к проекту'"

    keyboard = get_pagination_keyboard(page, total_pages)
    if query.message:
        await query.message.reply_text(reply_text, reply_markup=keyboard)  # type: ignore[attr-defined]

async def handle_pagination(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data or not query.message:
        return
    await query.answer()

    try:
        action, page = query.data.split('_')
        page = int(page)
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid pagination data: {query.data}, error: {e}")
        if query.message:
            await query.message.reply_text("Ошибка пагинации. Попробуйте снова.")  # type: ignore[attr-defined]
        return

    if action == "prev":
        page -= 1
    elif action == "next":
        page += 1

    # Исправлено: проверяем границы страниц
    if page < 0:
        page = 0
        logger.warning(f"Pagination page below 0, set to 0")

    # Получаем общее количество проектов для проверки максимума
    user = query.from_user
    if not user:
        return
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if db_user:
        projects = await get_approved_projects(db_user)
        total_pages = (len(projects) + PROJECTS_PER_PAGE - 1) // PROJECTS_PER_PAGE
        if page >= total_pages and total_pages > 0:
            page = total_pages - 1
            logger.warning(f"Pagination page exceeds max, set to {page}")

    if context.user_data:
        context.user_data['projects_page'] = page
    await list_projects(update, context)

async def join_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    user = query.from_user
    if not user:
        return
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return

    projects = await get_approved_projects(db_user)
    if not projects:
        if query.message:
            await query.message.reply_text("Нет доступных проектов для участия.")  # type: ignore[attr-defined]
        return

    buttons = [
        [InlineKeyboardButton(f"{project[1]} ({project[2]})", callback_data=f"join_{i}")]
        for i, project in enumerate(projects)
    ]
    keyboard = InlineKeyboardMarkup(buttons)
    if query.message:
        await query.message.reply_text("Выберите проект для участия:", reply_markup=keyboard)  # type: ignore[attr-defined]

    if context.user_data:
        context.user_data['projects'] = projects
        context.user_data['db_user'] = db_user

async def handle_join_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data or not query.message:
        return
    await query.answer()

    try:
        choice = int(query.data.split('_')[1])
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор проекта.")  # type: ignore[attr-defined]
        return

    if not context.user_data:
        context.user_data = {}
    projects = context.user_data.get('projects', [])
    db_user = context.user_data.get('db_user')
    if not db_user:
        if query.message:
            await query.message.reply_text("Ошибка: пользователь не найден.")  # type: ignore[attr-defined]
        return

    if 0 <= choice < len(projects):
        project = projects[choice][0]
        volunteer_project, project_title = await create_volunteer_project(db_user, project)
        if volunteer_project:
            await asyncio.sleep(1)  # Даём время на фиксацию транзакции
            if query.message:
                await query.message.reply_text(f"Вы успешно зарегистрированы в проекте: {project_title}!")  # type: ignore[attr-defined]
        else:
            if query.message:
                await query.message.reply_text(f"Вы не можете присоединиться к проекту: вы уже участвуете в максимальном количестве проектов ({MAX_PROJECTS_PER_VOLUNTEER}).")  # type: ignore[attr-defined]
    else:
        if query.message:
            await query.message.reply_text("Неверный выбор проекта.")  # type: ignore[attr-defined]

    if context.user_data:
        context.user_data.pop('projects', None)
        context.user_data.pop('db_user', None)

async def leave_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    user = query.from_user
    if not user:
        return
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return

    projects = await get_volunteer_projects(db_user)
    if not projects:
        if query.message:
            await query.message.reply_text("Вы не участвуете в проектах.")  # type: ignore[attr-defined]
        return

    buttons = [
        [InlineKeyboardButton(project[1], callback_data=f"leave_{i}")]
        for i, project in enumerate(projects)
    ]
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="cancel_leave")])
    keyboard = InlineKeyboardMarkup(buttons)
    if query.message:
        await query.message.reply_text("Выберите проект, из которого хотите выйти:", reply_markup=keyboard)  # type: ignore[attr-defined]

    if context.user_data:
        context.user_data['volunteer_projects'] = projects

async def handle_leave_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data or not query.message:
        return
    await query.answer()

    if query.data == "cancel_leave":
        if query.message:
            await query.message.reply_text("Выход из проекта отменён.", reply_markup=get_volunteer_keyboard())  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return

    try:
        choice = int(query.data.split('_')[1])
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный выбор проекта.")  # type: ignore[attr-defined]
        return

    if not context.user_data:
        context.user_data = {}
    projects = context.user_data.get('volunteer_projects', [])
    if 0 <= choice < len(projects):
        volunteer_project = projects[choice][0]
        project_title = projects[choice][1]
        await delete_volunteer_project(volunteer_project)
        if query.message:
            await query.message.reply_text(f"Вы успешно вышли из проекта: {project_title}!")  # type: ignore[attr-defined]
    else:
        if query.message:
            await query.message.reply_text("Неверный выбор проекта.")  # type: ignore[attr-defined]

    if context.user_data:
        context.user_data.pop('volunteer_projects', None)

async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    user = query.from_user
    if not user:
        return
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return

    volunteer_projects = await sync_to_async(list)(VolunteerProject.objects.filter(volunteer=db_user).select_related('project'))  # type: ignore[attr-defined]
    project_titles = [vp.project.title for vp in volunteer_projects]
    projects_text = "\n".join(project_titles) if project_titles else "Вы не участвуете в проектах."

    if query.message:
        await query.message.reply_text(  # type: ignore[attr-defined]
            f"Ваш профиль:\nИмя: {db_user.username}\nРейтинг: {db_user.rating}\nПроекты:\n{projects_text}"
        )

async def task_accept_decline(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.data or not query.message or not query.from_user:
        return ConversationHandler.END
    await query.answer()

    logger.info(f"Processing task_accept_decline with callback_data: {query.data}")
    user = await get_user(str(query.from_user.id))
    if not user:
        if query.message:
            await query.message.reply_text("Пользователь не найден.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    try:
        task_id = int(query.data.split('_')[2])
        task = await get_task(task_id)
        if not task:
            if query.message:
                await query.message.reply_text("Задание не найдено.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        project = await sync_to_async(lambda: task.project)()
        project_title = project.title

        # Проверяем существование назначения (ИСПРАВЛЕНО: использовать filter().first())
        assignment = await sync_to_async(
            lambda: TaskAssignment.objects.filter(task=task, volunteer=user).first()  # type: ignore[attr-defined]
        )()

        if not assignment:
            if query.message:
                await query.message.reply_text("❌ Это задание вам не назначено.")  # type: ignore[attr-defined]
            return ConversationHandler.END

        if query.data.startswith("task_accept"):
            assignment.accepted = True
            task.status = 'in_progress'  # Обновляем статус задачи
            await sync_to_async(assignment.save)()
            await sync_to_async(task.save)()
            deadline_date_str = task.deadline_date.strftime('%Y-%m-%d') if task.deadline_date else "Не указана"
            time_range = f"{task.start_time.strftime('%H:%M') if task.start_time else '00:00'} - {task.end_time.strftime('%H:%M') if task.end_time else '23:59'}"
            if query.message:
                await query.message.reply_text(f"Вы приняли задание для проекта {project_title}. Выполните его до {deadline_date_str} {time_range} и отправьте фото для проверки.")  # type: ignore[attr-defined]
            if context.user_data:
                context.user_data['task'] = task
            if query.message:
                await query.message.reply_text("Пожалуйста, прикрепите фото, подтверждающее выполнение задания:")  # type: ignore[attr-defined]
            return TASK_PHOTO_UPLOAD
        elif query.data.startswith("task_decline"):
            assignment.accepted = False
            await sync_to_async(assignment.save)()
            if query.message:
                await query.message.reply_text(f"Вы отказались от задания для проекта {project_title}.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error in task_accept_decline: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка при обработке задания.")  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

async def task_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.data or not query.message or not query.from_user:
        return ConversationHandler.END
    await query.answer()
    logger.info(f"Processing task_confirm with callback_data: {query.data}")

    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    try:
        task_id = int(query.data.split('_')[2])
    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback_data format: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный формат данных.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    task = await get_task(task_id)
    if not task:
        if query.message:
            await query.message.reply_text("Задание не найдено.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    # Исправлено: используем task.is_expired() вместо несуществующего task.deadline
    if await sync_to_async(task.is_expired)():
        if query.message:
            await query.message.reply_text("Дедлайн для этого задания истёк.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    buttons = [
        [InlineKeyboardButton("Да", callback_data=f"task_completed_yes_{task.id}"),  # type: ignore[attr-defined]
         InlineKeyboardButton("Нет", callback_data=f"task_completed_no_{task.id}")]  # type: ignore[attr-defined]
    ]
    keyboard = InlineKeyboardMarkup(buttons)
    if query.message:
        await query.message.reply_text("Вы выполнили задание?", reply_markup=keyboard)  # type: ignore[attr-defined]
    return TASK_COMPLETED

async def task_completed(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.data or not query.message or not query.from_user:
        return ConversationHandler.END
    await query.answer()
    logger.info(f"Processing task_completed with callback_data: {query.data}")

    user = query.from_user
    telegram_id = str(user.id)
    db_user = await get_user(telegram_id)
    if not db_user:
        if query.message:
            await query.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    parts = query.data.split('_')
    if len(parts) != 4 or parts[0] != "task" or parts[1] != "completed":
        logger.error(f"Invalid callback_data format: {query.data}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный формат данных.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    action = parts[2]
    try:
        task_id = int(parts[3])
    except ValueError as e:
        logger.error(f"Invalid task_id in callback_data: {query.data}, error: {e}\n{traceback.format_exc()}")
        if query.message:
            await query.message.reply_text("Ошибка: неверный формат данных.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    task = await get_task(task_id)
    if not task:
        if query.message:
            await query.message.reply_text("Задание не найдено.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    # Исправлено: используем task.is_expired() вместо несуществующего task.deadline
    if await sync_to_async(task.is_expired)():
        if query.message:
            await query.message.reply_text("Дедлайн для этого задания истёк.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if action == "yes":
        assignment = await update_task_assignment(task, db_user, completed=True)
        if not assignment:
            if query.message:
                await query.message.reply_text("Ошибка: задание не назначено вам.")  # type: ignore[attr-defined]
            return ConversationHandler.END
        if query.message:
            await query.message.reply_text("Пожалуйста, прикрепите фото, подтверждающее выполнение задания:")  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data['task'] = task
        return TASK_PHOTO_UPLOAD
    else:
        await update_task_assignment(task, db_user, completed=False)
        if query.message:
            await query.message.reply_text("Спасибо за информацию. Если вы выполните задание позже, дайте знать.")  # type: ignore[attr-defined]
        return ConversationHandler.END

async def task_photo_upload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.from_user:
        return ConversationHandler.END
    user = update.message.from_user
    telegram_id = str(user.id)
    logger.info(f"Processing photo upload for user {telegram_id}")
    db_user = await get_user(telegram_id)
    if not db_user:
        if update.message:
            await update.message.reply_text("Вы не зарегистрированы. Создайте аккаунт.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not context.user_data:
        context.user_data = {}
    task = context.user_data.get('task')
    if not task:
        if update.message:
            await update.message.reply_text("Задание не найдено.")  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    logger.info("Checking task deadline")
    if await sync_to_async(task.is_expired)():
        task.status = 'closed'
        await sync_to_async(task.save)()
        if update.message:
            await update.message.reply_text("Дедлайн для этого задания истёк.")  # type: ignore[attr-defined]
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END

    project = await sync_to_async(lambda: task.project)()
    logger.info("Project accessed successfully")

    if update.message and update.message.photo:
        # Обратная связь: показываем, что загрузка началась
        status_message = await update.message.reply_text("⏳ Загружаю фото...")  # type: ignore[attr-defined]

        try:
            photo_file = await update.message.photo[-1].get_file()  # type: ignore[index]

            # Проверка размера файла (максимум 10 МБ)
            MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
            if photo_file.file_size and photo_file.file_size > MAX_FILE_SIZE:  # type: ignore[operator]
                await status_message.edit_text("❌ Файл слишком большой. Максимальный размер: 10 МБ.")
                return TASK_PHOTO_UPLOAD

            current_date = await get_current_date()
            year, month, day = current_date.year, current_date.month, current_date.day

            # УЛУЧШЕНО: Усиленная защита от path traversal с использованием pathlib
            import re
            from pathlib import Path

            # Валидируем telegram_id и file_id для предотвращения path traversal
            safe_telegram_id = re.sub(r'[^a-zA-Z0-9_-]', '', str(telegram_id))
            safe_file_id = re.sub(r'[^a-zA-Z0-9_-]', '', photo_file.file_id)

            # Проверяем что после санитизации остались данные
            if not safe_telegram_id or not safe_file_id:
                logger.error(f"Invalid telegram_id or file_id after sanitization")
                await status_message.edit_text("❌ Ошибка валидации данных.")
                return ConversationHandler.END

            # Используем pathlib для безопасной работы с путями
            # ✅ ИСПРАВЛЕНИЕ: Используем путь к проекту (родительская директория от bot/)
            from django.conf import settings
            base_dir = Path(settings.MEDIA_ROOT).resolve()
            save_dir = base_dir / "photos" / str(year) / str(month) / str(day)

            # Создаём директорию
            await aio_os.makedirs(str(save_dir), exist_ok=True)

            # ✅ ИСПРАВЛЕНИЕ: Используем короткий хеш вместо полного file_id для имени файла
            import hashlib
            from datetime import datetime
            file_hash = hashlib.md5(safe_file_id.encode()).hexdigest()[:8]  # Первые 8 символов MD5
            timestamp = datetime.now().strftime("%H%M%S")  # Время для уникальности
            file_name = f"{safe_telegram_id}_{timestamp}_{file_hash}.jpg"
            full_path = save_dir / file_name

            # КРИТИЧНО: Проверяем что resolved путь внутри базовой директории
            # resolve() разрешает символические ссылки и относительные пути
            try:
                full_path_resolved = full_path.resolve()
                full_path_resolved.relative_to(base_dir)
            except (ValueError, RuntimeError) as e:
                logger.error(f"Path traversal attempt detected: {full_path} -> {e}")
                await status_message.edit_text("❌ Ошибка безопасности. Обратитесь к администратору.")
                return ConversationHandler.END

            # Преобразуем обратно в строку для совместимости
            full_path = str(full_path_resolved)

            try:
                photo_data = await photo_file.download_as_bytearray()
            except Exception as e:
                logger.error(f"Failed to download photo: {e}")
                await status_message.edit_text("❌ Ошибка при загрузке фото. Попробуйте снова.")
                raise ValueError("Failed to download photo data")

            if len(photo_data) == 0:
                await status_message.edit_text("❌ Загруженное фото пустое. Попробуйте снова.")
                raise ValueError("Downloaded photo data is empty")

            # НОВОЕ: Валидация что это действительно изображение
            from PIL import Image
            import io

            try:
                # Пытаемся открыть как изображение
                image = Image.open(io.BytesIO(photo_data))
                # Проверяем формат
                if image.format not in ['JPEG', 'JPG', 'PNG', 'WEBP']:
                    await status_message.edit_text(f"❌ Неподдерживаемый формат изображения: {image.format}. Используйте JPEG, PNG или WEBP.")
                    return TASK_PHOTO_UPLOAD

                # Проверяем что изображение не повреждено
                image.verify()
                logger.info(f"Image validated: format={image.format}, size={image.size}")
            except Exception as e:
                logger.error(f"Invalid image file: {e}")
                await status_message.edit_text("❌ Это не изображение или файл повреждён. Отправьте корректное фото.")
                return TASK_PHOTO_UPLOAD

            # Сохраняем проверенное изображение
            async with aiofiles.open(full_path, 'wb') as f:
                await f.write(photo_data)
            logger.info(f"Photo saved to {full_path}")

            db_file_path = os.path.join(f"photos/{year}/{month}/{day}", file_name)
            photo = await create_photo(db_user, project, db_file_path, task)
            logger.info(f"Photo saved with path: {photo.image.path if hasattr(photo.image, 'path') else photo.image}")  # type: ignore[attr-defined]

            # Обновляем статусное сообщение
            await status_message.edit_text("✅ Фото загружено! Отправляю организатору...")

            # Создаем или получаем feedback сессию для этого фото
            from bot.telegram_feedback_helpers import (
                create_feedback_session_for_photo,
                create_photo_feedback_message
            )

            feedback_session = await create_feedback_session_for_photo(photo)
            if feedback_session:
                # Создаем сообщение о фотоотчете в feedback
                await create_photo_feedback_message(
                    session=feedback_session,
                    photo=photo,
                    sender=db_user
                )
                logger.info(f"Создана feedback сессия {feedback_session.id} для фото {photo.id}")  # type: ignore[attr-defined]

            organizer = await sync_to_async(lambda: project.creator)()

            # Отправляем красивое уведомление организатору через новую систему
            from core.services.notification_utils import notify_organizer_new_photo
            try:
                await notify_organizer_new_photo(
                    organizer=organizer,
                    photo_report=photo,
                    volunteer=db_user,
                    project=project,
                    task=task
                )
                await status_message.edit_text("✅ Фото отправлено на проверку организатору!")
                logger.info(f"[OK] Notified organizer {organizer.username} about new photo from {db_user.username}")
            except Exception as e:
                logger.error(f"Failed to notify organizer about new photo: {e}\n{traceback.format_exc()}")
                await status_message.edit_text("✅ Фото загружено, но не удалось уведомить организатора. Свяжитесь с поддержкой.")

            if context.user_data:
                context.user_data.clear()
            return ConversationHandler.END
        except Exception as e:
            logger.error(f"Unexpected error uploading photo: {e}\n{traceback.format_exc()}")
            if update.message:
                await update.message.reply_text("Ошибка при загрузке фото. Попробуйте снова.")  # type: ignore[attr-defined]
            return TASK_PHOTO_UPLOAD
    else:
        if update.message:
            await update.message.reply_text("Пожалуйста, отправьте фото.")  # type: ignore[attr-defined]
        return TASK_PHOTO_UPLOAD

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    from telegram import Update
    if isinstance(update, Update):
        logger.error(f"Update {update} caused error {context.error}\n{traceback.format_exc()}")
        if update.effective_message and context.error:
            await update.effective_message.reply_text("Произошла ошибка при обработке вашего сообщения. Попробуйте снова.")
    else:
        logger.error(f"Error handler called with non-Update object: {update}, error: {context.error}\n{traceback.format_exc()}")

def register_handlers(application: Any) -> None:
    application.add_error_handler(error_handler)
    application.add_handler(CommandHandler("projects", list_projects))
    application.add_handler(CommandHandler("join_project", join_project))
    application.add_handler(CallbackQueryHandler(list_projects, pattern=r"^list_projects"))
    application.add_handler(CallbackQueryHandler(join_project, pattern=r"^join_project"))
    application.add_handler(CallbackQueryHandler(profile, pattern=r"^profile"))
    application.add_handler(CallbackQueryHandler(handle_pagination, pattern=r"^(prev|next)_"))
    application.add_handler(CallbackQueryHandler(handle_join_selection, pattern=r"^join_"))
    application.add_handler(CallbackQueryHandler(leave_project, pattern=r"^leave_project"))
    application.add_handler(CallbackQueryHandler(handle_leave_selection, pattern=r"^(leave_|cancel_leave)"))

    task_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(task_accept_decline, pattern=r"^(task_accept_|task_decline_)")
        ],
        states={
            TASK_CONFIRM: [CallbackQueryHandler(task_confirm, pattern=r"^task_confirm_")],
            TASK_COMPLETED: [CallbackQueryHandler(task_completed, pattern=r"^task_completed_(yes|no)_")],
            TASK_PHOTO_UPLOAD: [MessageHandler(filters.PHOTO, task_photo_upload)]
        },
        fallbacks=[
            CallbackQueryHandler(task_completed, pattern=r"^task_completed_no_")
        ]
    )
    application.add_handler(task_conv)
