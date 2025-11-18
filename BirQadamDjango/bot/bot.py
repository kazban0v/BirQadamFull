# bot.py
import logging
import os
import django
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, filters
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardRemove
from asgiref.sync import sync_to_async
from telegram.ext import ContextTypes, ConversationHandler
from dotenv import load_dotenv
import traceback
from typing import Any

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
import sys
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')  # type: ignore[attr-defined]
    except AttributeError:
        # Python < 3.7 или платформы без reconfigure
        pass
logger = logging.getLogger(__name__)

# Загружаем переменные окружения
load_dotenv()
logger.info(f"Загружен файл .env из {os.getcwd()}")

# Добавляем корневую директорию проекта в sys.path для импорта Django модулей
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
logger.info(f"Добавлен путь к проекту: {project_root}")

# Настройка Django (только если запускается напрямую, не при импорт)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')

from bot.telegram_bot import application

# Состояния для регистрации
USERNAME_REQUEST, PHONE_REQUEST, ROLE_REQUEST, ORGANIZATION_REQUEST = range(4)
# Состояние для привязки через код
LINK_CODE_REQUEST = 10

# Функция отмены регистрации
async def cancel_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.effective_message:
        await update.effective_message.reply_text("Регистрация отменена. Вы можете начать заново с /start.")
    if context.user_data:
        context.user_data.clear()
    return ConversationHandler.END

# Вспомогательные функции
@sync_to_async
def get_user(telegram_id: str) -> Any:
    from core.models import User  # Lazy import
    try:
        user = User.objects.get(telegram_id=telegram_id)
        logger.info(f"Пользователь найден: {user.username} (telegram_id: {telegram_id})")
        return user
    except User.DoesNotExist:  # type: ignore[attr-defined]
        logger.warning(f"Пользователь не найден с telegram_id: {telegram_id}")
        return None

@sync_to_async
def link_telegram_account(code: str, telegram_id: str, telegram_username: str) -> Any:
    """Привязать Telegram аккаунт к пользователю по коду"""
    from core.services.telegram_sync import verify_and_link_telegram
    return verify_and_link_telegram(code, telegram_id, telegram_username)

@sync_to_async
def create_user(telegram_id: str, phone_number: str, username: str, role: str = 'volunteer', organization_name: str | None = None, registration_source: str = 'telegram_bot') -> Any:
    from core.models import User  # Lazy import
    from django.db import transaction, IntegrityError
    try:
        with transaction.atomic():
            # 🔍 ВАРИАНТ 4: Проверяем существующего пользователя по ТЕЛЕФОНУ
            existing_user = User.objects.filter(phone_number=phone_number).first()
            
            if existing_user:
                logger.info(f"[FOUND] Existing user with phone {phone_number}: {existing_user.username}")
                
                # Проверяем, есть ли уже telegram_id (уже зарегистрирован в Telegram)
                if existing_user.telegram_id:
                    logger.warning(f"[WARN] User already registered in Telegram")
                    return None
                
                # ✅ ПРИВЯЗКА: Дополняем существующий App аккаунт данными из Telegram
                logger.info(f"[LINK] Linking Telegram to App account {existing_user.id}")  # type: ignore[attr-defined]
                
                existing_user.telegram_id = telegram_id
                existing_user.registration_source = 'both'  # Теперь доступен в обоих местах
                
                # Обновляем имя если оно не было указано
                if not existing_user.name:
                    existing_user.name = username
                
                # Обновляем роль если не была указана
                if not existing_user.role:
                    existing_user.role = role
                
                # Если это организатор и не было названия организации
                if role == 'organizer' and organization_name and not existing_user.organization_name:
                    existing_user.organization_name = organization_name
                
                existing_user.save()
                logger.info(f"[OK] User updated: telegram_id={existing_user.telegram_id}, registration_source={existing_user.registration_source}")
                
                # 📱 Отправляем уведомление в ПРИЛОЖЕНИЕ (FCM) если есть email
                if existing_user.email:
                    try:
                        from custom_admin.services.notification_service import NotificationService
                        import asyncio
                        
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        result = loop.run_until_complete(
                            NotificationService.notify_user(
                                existing_user,
                                title="Telegram привязан!",
                                message=f"Ваш аккаунт теперь доступен в Telegram боте BirQadam! Рейтинг: {existing_user.rating}",
                                notification_type='telegram_linked',
                                data={
                                    'type': 'telegram_linked',
                                    'telegram_id': str(telegram_id)
                                }
                            )
                        )
                        loop.close()
                        logger.info(f"[BOT] FCM уведомление о привязке Telegram отправлено: {result}")
                    except Exception as e:
                        logger.error(f"[BOT] [ERROR] Ошибка отправки FCM уведомления: {e}")
                
                return existing_user

            # 🆕 Создаем НОВОГО пользователя (только через Telegram)
            logger.info(f"🆕 Создаем нового пользователя через Telegram: {username}")
            
            # Используем get_or_create для атомарной операции
            user, created = User.objects.get_or_create(
                telegram_id=telegram_id,
                defaults={
                    'phone_number': phone_number,
                    'username': username,
                    'name': username,
                    'rating': 0,
                    'role': role,
                    'organization_name': organization_name,
                    'registration_source': 'telegram'  # Только Telegram
                }
            )

            if not created:
                logger.warning(f"[WARN] User with telegram_id {telegram_id} already exists")
                return None

            user.set_unusable_password()
            user.save()
            logger.info(f"[OK] New user created: {username} (telegram_id: {telegram_id}, role: {role})")
            return user
            
    except IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error creating user: {e}")
        if 'telegram_id' in str(e):
            logger.error("[ERROR] Conflict: telegram_id already exists")
        elif 'phone_number' in str(e):
            logger.error("[ERROR] Conflict: phone_number already exists")
        return None
    except Exception as e:
        logger.error(f"[ERROR] Error creating/updating user: {e}\n{traceback.format_exc()}")
        return None

@sync_to_async
def get_admin() -> Any:
    from core.models import User  # Lazy import
    try:
        admin = User.objects.filter(is_staff=True).first()
        if admin:
            logger.info(f"Админ найден: {admin.username}")
            return admin
        else:
            logger.warning("Админ не найден")
            return None
    except Exception as e:
        logger.error(f"Ошибка при получении админа: {e}\n{traceback.format_exc()}")
        return None

# Обработчик команды /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    from bot.organization_handlers import org_menu  # Lazy import
    from bot.volunteer_handlers import volunteer_menu as volunteer_start  # Lazy import
    
    if not update.message or not update.message.from_user:
        logger.warning("Received /start without message or from_user")
        return ConversationHandler.END
    
    user = update.message.from_user
    telegram_id = str(user.id)
    logger.info(f"Получена команда /start от telegram_id: {telegram_id}")
    db_user = await get_user(telegram_id)

    if db_user:
        if db_user.is_staff:
            logger.info(f"Пользователь {db_user.username} является админом, перенаправление в меню админа")
            # await admin_menu(update, context)
        elif db_user.is_organizer and db_user.is_approved:
            logger.info(f"Пользователь {db_user.username} является одобренным организатором, перенаправление в меню организатора")
            await org_menu(update, context)
        elif db_user.is_organizer and not db_user.is_approved:
            logger.info(f"Пользователь {db_user.username} является организатором, но не одобрен")
            if update.effective_message:
                await update.effective_message.reply_text("Ваш запрос на статус организатора находится на рассмотрении.")
        else:
            logger.info(f"Пользователь {db_user.username} является волонтёром, перенаправление в меню волонтёра")
            await volunteer_start(update, context)
        return ConversationHandler.END

    # Убеждаемся, что user_data инициализировано
    if context.user_data is None:
        context.user_data = {}  # type: ignore[assignment]
    else:
        context.user_data.clear()
    
    context.user_data['telegram_id'] = telegram_id
    if update.effective_message:
        await update.effective_message.reply_text(
            "Добро пожаловать! Введите ваше имя:",
            reply_markup=ReplyKeyboardRemove()
        )
    return USERNAME_REQUEST

# Обработчик имени пользователя
async def receive_username(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not context.user_data:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END
    
    telegram_id = context.user_data.get('telegram_id')
    if not telegram_id:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END

    if not update.effective_message or not update.effective_message.text:
        return ConversationHandler.END
    
    username = update.effective_message.text.strip()
    if not username:
        await update.effective_message.reply_text("Имя не может быть пустым. Введите имя:")
        return USERNAME_REQUEST

    if context.user_data:
        context.user_data['username'] = username
    keyboard = [[KeyboardButton("Отправить номер телефона", request_contact=True)]]
    reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)
    await update.effective_message.reply_text(
        "Спасибо! Отправьте ваш номер телефона:",
        reply_markup=reply_markup
    )
    return PHONE_REQUEST

# Обработчик номера телефона
async def receive_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    from core.utils.utils import normalize_phone  # Lazy import
    
    if not context.user_data:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END
    
    telegram_id = context.user_data.get('telegram_id')
    if not telegram_id:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END

    if update.effective_message and update.effective_message.contact:
        phone_number = update.effective_message.contact.phone_number
        # ✅ Нормализуем номер телефона
        phone_number = normalize_phone(phone_number)
        if context.user_data:
            context.user_data['phone_number'] = phone_number
        logger.info(f"[PHONE] Received and normalized phone: {phone_number}")
        buttons = [
            [InlineKeyboardButton("Волонтёр", callback_data="role_volunteer"),
             InlineKeyboardButton("Организатор", callback_data="role_organizer")]
        ]
        keyboard = InlineKeyboardMarkup(buttons)
        await update.effective_message.reply_text(
            "Кем вы являетесь?",
            reply_markup=keyboard
        )
        return ROLE_REQUEST
    elif update.effective_message:
        await update.effective_message.reply_text("Пожалуйста, отправьте номер телефона, используя кнопку.")
        return PHONE_REQUEST
    return ConversationHandler.END

# Обработчик выбора роли
async def receive_role(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()

    if not context.user_data:
        if query.message:
            await query.message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    telegram_id = context.user_data.get('telegram_id')
    username = context.user_data.get('username')
    phone_number = context.user_data.get('phone_number')
    if not telegram_id or not username or not phone_number:
        if query.message:
            await query.message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")  # type: ignore[attr-defined]
        return ConversationHandler.END

    if not query.data:
        if query.message:
            await query.message.reply_text("Ошибка: неверный запрос.")  # type: ignore[attr-defined]
        return ConversationHandler.END
    
    role = query.data
    if role == "role_volunteer":
        from bot.volunteer_handlers import get_volunteer_keyboard  # Lazy import
        
        db_user = await create_user(telegram_id, phone_number, username, role='volunteer')
        if db_user and query.message:
            # Проверяем был ли аккаунт привязан (registration_source == 'both')
            if db_user.registration_source == 'both' and db_user.email:
                # Аккаунт был привязан к существующему из приложения
                await query.message.reply_text(  # type: ignore[attr-defined]
                    f"✅ Аккаунт привязан!\n\n"
                    f"Ваш аккаунт из приложения BirQadam теперь доступен в Telegram боте!\n\n"
                    f"📧 Email: {db_user.email}\n"
                    f"⭐ Рейтинг: {db_user.rating}\n\n"
                    f"Добро пожаловать, {username}!",
                    reply_markup=get_volunteer_keyboard()
                )
            else:
                # Новый аккаунт через Telegram
                await query.message.reply_text(  # type: ignore[attr-defined]
                    f"Регистрация завершена, {username}! Добро пожаловать, волонтёр!",
                    reply_markup=get_volunteer_keyboard()
                )
            if context.user_data:
                context.user_data.clear()
            return ConversationHandler.END
        elif query.message:
            await query.message.reply_text("Ошибка при регистрации. Попробуйте снова.")  # type: ignore[attr-defined]
            return ConversationHandler.END
    elif role == "role_organizer" and query.message:
        await query.message.reply_text(  # type: ignore[attr-defined]
            "Введите название вашей организации:",
            reply_markup=ReplyKeyboardRemove()
        )
        return ORGANIZATION_REQUEST
    elif query.message:
        await query.message.reply_text("Ошибка: неверный выбор роли.")  # type: ignore[attr-defined]
        return ROLE_REQUEST
    return ConversationHandler.END

# Обработчик названия организации
async def receive_organization(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    from bot.volunteer_handlers import get_volunteer_keyboard  # Lazy import (используется для новых организаторов)
    
    if not context.user_data:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END
    
    telegram_id = context.user_data.get('telegram_id')
    username = context.user_data.get('username')
    phone_number = context.user_data.get('phone_number')
    if not telegram_id or not username or not phone_number:
        if update.effective_message:
            await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /start.")
        return ConversationHandler.END

    if not update.effective_message or not update.effective_message.text:
        return ConversationHandler.END
    
    organization_name = update.effective_message.text.strip()
    if not organization_name:
        await update.effective_message.reply_text("Название организации не может быть пустым. Введите название:")
        return ORGANIZATION_REQUEST

    db_user = await create_user(telegram_id, phone_number, username, role='organizer', organization_name=organization_name)
    if db_user and update.effective_message:
        # Проверяем был ли аккаунт привязан (registration_source == 'both')
        if db_user.registration_source == 'both' and db_user.email:
            # Аккаунт был привязан к существующему из приложения
            await update.effective_message.reply_text(
                f"✅ Аккаунт привязан!\n\n"
                f"Ваш аккаунт из приложения BirQadam теперь доступен в Telegram боте!\n\n"
                f"📧 Email: {db_user.email}\n"
                f"🏢 Организация: {organization_name}\n"
                f"⭐ Рейтинг: {db_user.rating}\n\n"
                f"Добро пожаловать, {username}!",
                reply_markup=get_volunteer_keyboard()
            )
        else:
            # Новый аккаунт через Telegram
            await update.effective_message.reply_text(
                f"Регистрация завершена, {username}! Ваш запрос на статус организатора отправлен на рассмотрение.",
                reply_markup=get_volunteer_keyboard()
            )
        
        admin = await get_admin()
        if admin and admin.telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=admin.telegram_id,
                    text=f"Новый запрос на статус организатора от {username} (организация: {organization_name}). Проверьте в админ-панели."
                )
                logger.info(f"Админ {admin.username} уведомлён о новом запросе организатора от {username}")
            except Exception as e:
                logger.error(f"Не удалось уведомить админа о запросе организатора: {e}\n{traceback.format_exc()}")
        if context.user_data:
            context.user_data.clear()
        return ConversationHandler.END
    elif update.effective_message:
        await update.effective_message.reply_text("Ошибка при регистрации. Попробуйте снова.")
        return ConversationHandler.END
    return ConversationHandler.END

# Глобальный обработчик ошибок
# Обработчик команды /link для привязки аккаунта через код
async def link_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик команды /link для привязки веб-аккаунта к Telegram"""
    if not update.message or not update.message.from_user:
        return ConversationHandler.END
    
    user = update.message.from_user
    telegram_id = str(user.id)
    telegram_username = user.username or user.first_name or "Пользователь"
    
    # Проверяем, не привязан ли уже аккаунт
    db_user = await get_user(telegram_id)
    if db_user:
        await update.message.reply_text(
            f"✅ Ваш Telegram аккаунт уже привязан к аккаунту {db_user.username}.\n\n"
            f"📧 Email: {db_user.email or 'не указан'}\n"
            f"⭐ Рейтинг: {db_user.rating}\n"
            f"📱 Телефон: {db_user.phone_number or 'не указан'}"
        )
        return ConversationHandler.END
    
    # Инициализируем user_data (нельзя присваивать новое значение, только изменять содержимое)
    # Очищаем если нужно, или просто добавляем ключи
    if context.user_data:
        context.user_data.clear()
    context.user_data['telegram_id'] = telegram_id
    context.user_data['telegram_username'] = telegram_username
    
    # Проверяем, есть ли код в команде (например, /link 150919)
    command_text = update.message.text or ""
    parts = command_text.split()
    if len(parts) > 1:
        # Есть код в команде, обрабатываем сразу
        code = parts[1].strip()
        if code.isdigit() and len(code) == 6:
            # Обрабатываем код напрямую здесь
            user = await link_telegram_account(code, telegram_id, telegram_username)
            
            if user:
                # Успешная привязка
                from bot.volunteer_handlers import get_volunteer_keyboard
                from bot.organization_handlers import org_menu
                
                # Определяем роль для сообщения
                role_text = "организатор" if user.is_organizer else "волонтёр"
                
                await update.message.reply_text(
                    f"✅ Аккаунт успешно привязан!\n\n"
                    f"🔗 Ваш Telegram аккаунт теперь связан с аккаунтом из веб-портала:\n\n"
                    f"👤 Имя: {user.name or user.username}\n"
                    f"📧 Email: {user.email or 'не указан'}\n"
                    f"⭐ Рейтинг: {user.rating}\n"
                    f"📱 Телефон: {user.phone_number or 'не указан'}\n"
                    f"👥 Роль: {role_text}\n\n"
                    f"Теперь ваш прогресс синхронизирован между веб-порталом и Telegram ботом!",
                    reply_markup=get_volunteer_keyboard() if user.role == 'volunteer' else None
                )
                
                # Если это организатор, показываем меню организатора
                if user.is_organizer and user.is_approved:
                    await org_menu(update, context)
                elif user.role == 'volunteer':
                    from bot.volunteer_handlers import volunteer_menu
                    await volunteer_menu(update, context)
                
                if context.user_data:
                    context.user_data.clear()
                
                return ConversationHandler.END
            else:
                # Ошибка привязки
                await update.message.reply_text(
                    "❌ Не удалось привязать аккаунт.\n\n"
                    "Возможные причины:\n"
                    "• Код неверный или истёк (действителен 10 минут)\n"
                    "• Этот Telegram аккаунт уже привязан к другому пользователю\n"
                    "• Код уже был использован\n\n"
                    "Попробуйте получить новый код на веб-портале и повторите попытку."
                )
                return ConversationHandler.END
    
    # Просим ввести код
    await update.message.reply_text(
        "🔗 Привязка аккаунта к веб-порталу\n\n"
        "Введите 6-значный код, который вы получили на веб-портале.\n"
        "Код действителен в течение 10 минут.\n\n"
        "Для отмены используйте /cancel",
        reply_markup=ReplyKeyboardRemove()
    )
    
    return LINK_CODE_REQUEST


async def receive_link_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик ввода кода привязки"""
    if not update.effective_message:
        return ConversationHandler.END
    
    # Инициализируем user_data (нельзя присваивать новое значение, только изменять содержимое)
    # user_data всегда существует, просто проверяем и добавляем ключи
    
    # Получаем код из сообщения
    if not update.effective_message.text:
        return ConversationHandler.END
    
    code = update.effective_message.text.strip()
    
    # Если код пришел в команде /link CODE, извлекаем его
    if code.startswith('/link'):
        parts = code.split()
        if len(parts) > 1:
            code = parts[1].strip()
    
    # Получаем telegram_id из user_data или из update
    telegram_id = context.user_data.get('telegram_id')
    if not telegram_id and update.effective_message.from_user:
        telegram_id = str(update.effective_message.from_user.id)
        context.user_data['telegram_id'] = telegram_id
    
    telegram_username = context.user_data.get('telegram_username')
    if not telegram_username and update.effective_message.from_user:
        user = update.effective_message.from_user
        telegram_username = user.username or user.first_name or "Пользователь"
        context.user_data['telegram_username'] = telegram_username
    
    if not telegram_id:
        await update.effective_message.reply_text("Ошибка: сессия истекла. Попробуйте снова с /link.")
        return ConversationHandler.END
    
    # Проверяем формат кода (6 цифр)
    if not code.isdigit() or len(code) != 6:
        await update.effective_message.reply_text(
            "❌ Неверный формат кода. Код должен состоять из 6 цифр.\n"
            "Попробуйте снова или используйте /cancel для отмены."
        )
        return LINK_CODE_REQUEST
    
    # Пытаемся привязать аккаунт
    user = await link_telegram_account(code, telegram_id, telegram_username)
    
    if user:
        # Успешная привязка
        from bot.volunteer_handlers import get_volunteer_keyboard
        from bot.organization_handlers import org_menu
        
        # Определяем роль для сообщения
        role_text = "организатор" if user.is_organizer else "волонтёр"
        
        await update.effective_message.reply_text(
            f"✅ Аккаунт успешно привязан!\n\n"
            f"🔗 Ваш Telegram аккаунт теперь связан с аккаунтом из веб-портала:\n\n"
            f"👤 Имя: {user.name or user.username}\n"
            f"📧 Email: {user.email or 'не указан'}\n"
            f"⭐ Рейтинг: {user.rating}\n"
            f"📱 Телефон: {user.phone_number or 'не указан'}\n"
            f"👥 Роль: {role_text}\n\n"
            f"Теперь ваш прогресс синхронизирован между веб-порталом и Telegram ботом!",
            reply_markup=get_volunteer_keyboard() if user.role == 'volunteer' else None
        )
        
        # Если это организатор, показываем меню организатора
        if user.is_organizer and user.is_approved:
            await org_menu(update, context)
        elif user.role == 'volunteer':
            from bot.volunteer_handlers import volunteer_menu
            await volunteer_menu(update, context)
        
        if context.user_data:
            context.user_data.clear()
        
        return ConversationHandler.END
    else:
        # Ошибка привязки
        await update.effective_message.reply_text(
            "❌ Не удалось привязать аккаунт.\n\n"
            "Возможные причины:\n"
            "• Код неверный или истёк (действителен 10 минут)\n"
            "• Этот Telegram аккаунт уже привязан к другому пользователю\n"
            "• Код уже был использован\n\n"
            "Попробуйте получить новый код на веб-портале и повторите попытку.\n"
            "Для отмены используйте /cancel"
        )
        return LINK_CODE_REQUEST


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """✅ ИСПРАВЛЕНИЕ: Отправка критичных ошибок админу"""
    # Обработчик ошибок может получить None вместо Update
    error_msg = f"Обновление {update} вызвало ошибку {context.error}\n{traceback.format_exc()}"
    logger.error(error_msg)
    
    # Уведомляем пользователя
    if isinstance(update, Update) and update.effective_message:
        await update.effective_message.reply_text("Произошла ошибка. Пожалуйста, попробуйте снова.")
    
    # ✅ Отправляем критичные ошибки админу
    try:
        from core.models import User
        from asgiref.sync import sync_to_async
        
        # Находим первого админа
        admin = await sync_to_async(User.objects.filter(is_staff=True).first)()
        
        if admin and admin.telegram_id:
            # Формируем короткое сообщение об ошибке
            error_type = type(context.error).__name__ if context.error else 'Unknown'
            error_details = str(context.error)[:200] if context.error else 'No error details'  # Ограничиваем длину
            
            user_id = 'Unknown'
            if isinstance(update, Update) and update.effective_user:
                user_id = update.effective_user.id
            
            admin_message = (
                f"⚠️ <b>Bot Error</b>\n\n"
                f"<b>Type:</b> {error_type}\n"
                f"<b>Details:</b> {error_details}\n"
                f"<b>User:</b> {user_id}\n\n"
                f"<i>Полная информация в логах</i>"
            )
            
            telegram_id_str = str(admin.telegram_id)
            await context.bot.send_message(
                chat_id=telegram_id_str,
                text=admin_message,
                parse_mode='HTML'
            )
            logger.info(f"Отправлено уведомление об ошибке админу {admin.username}")
    except Exception as e:
        logger.error(f"Не удалось отправить уведомление админу: {e}")

if __name__ == '__main__':
    # ✅ Инициализируем Django только при прямом запуске
    try:
        django.setup()
        logger.info("Django успешно настроен")
    except Exception as e:
        logger.error(f"Не удалось настроить Django: {e}\n{traceback.format_exc()}")
        raise
    
    # Импорты обработчиков (только при запуске бота)
    from bot.volunteer_handlers import register_handlers as register_volunteer_handlers
    from bot.organization_handlers import register_handlers as register_organization_handlers
    
    # Регистрируем обработчики
    registration_conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            USERNAME_REQUEST: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_username)],
            PHONE_REQUEST: [MessageHandler(filters.CONTACT, receive_phone)],
            ROLE_REQUEST: [CallbackQueryHandler(receive_role, pattern=r"^role_")],
            ORGANIZATION_REQUEST: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_organization)],
        },
        fallbacks=[
            CommandHandler("start", start),
            CommandHandler("cancel", cancel_registration)
        ],
        per_message=False,
        conversation_timeout=600  # Исправлено: добавлен тайм-аут 10 минут для предотвращения утечки памяти
    )
    application.add_handler(registration_conv)
    
    # Обработчик команды /link для привязки аккаунта
    link_conv = ConversationHandler(
        entry_points=[CommandHandler("link", link_command)],
        states={
            LINK_CODE_REQUEST: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_link_code)],
        },
        fallbacks=[
            CommandHandler("cancel", cancel_registration),
            CommandHandler("link", link_command),
        ],
        per_message=False,
        conversation_timeout=600
    )
    application.add_handler(link_conv)

    logger.info("Регистрация обработчиков волонтёров...")
    register_volunteer_handlers(application)
    logger.info("Обработчики волонтёров успешно зарегистрированы")

    logger.info("Регистрация обработчиков организаторов...")
    register_organization_handlers(application)
    logger.info("Обработчики организаторов успешно зарегистрированы")

    # Удалён дублированный обработчик debug_update, который ловил все сообщения

    application.add_error_handler(error_handler)

    # Запуск бота
    logger.info("Запуск бота...")
    try:
        application.run_polling(allowed_updates=Update.ALL_TYPES)
    except Exception as e:
        logger.error(f"Не удалось запустить бота: {e}\n{traceback.format_exc()}")
        raise
    logger.info("Бот остановлен.")