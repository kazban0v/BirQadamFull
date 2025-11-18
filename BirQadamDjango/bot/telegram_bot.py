# telegram_bot.py
import logging
from telegram.ext import Application, PicklePersistence
from dotenv import load_dotenv
import os

logger = logging.getLogger(__name__)

# Загружаем переменные окружения
load_dotenv()
logger.info(f"Загружен файл .env из {os.getcwd()}")

# Загрузка токена
TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
if not TOKEN:
    logger.error("TELEGRAM_BOT_TOKEN не установлен в переменных окружения")
    raise ValueError("TELEGRAM_BOT_TOKEN не установлен в переменных окружения")
logger.info(f"Загружен токен: {TOKEN[:5]}... (частично для безопасности)")

# Создаем persistence для сохранения состояний
persistence = PicklePersistence(filepath='bot_persistence.pickle')

# Инициализация приложения
application = None
try:
    application = Application.builder().token(TOKEN).persistence(persistence).build()
    logger.info("Приложение успешно создано с persistence")
except Exception as e:
    logger.error(f"Не удалось создать приложение: {e}")
    raise