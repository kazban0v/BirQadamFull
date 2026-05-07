import pyautogui
import time
import random
import sys
import os

# --- Настройки ---
# Путь к файлу из твоего контекста
FILE_PATH = r'C:\Users\User\Desktop\BirQadamv1\BirQadamFull\BirQadamDjango\api\api\web_portal.py'
PROGRESS_FILE = 'progress.txt' 
DELAY_BEFORE_START = 10 
CHAR_DELAY = (0.05, 0.15)  # Немного ускорил, чтобы было комфортнее
LINE_DELAY = (0.3, 0.6)

def save_progress(line_index):
    with open(PROGRESS_FILE, 'w') as f:
        f.write(str(line_index))

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            content = f.read().strip()
            return int(content) if content.isdigit() else 0
    return 0

def human_typing(lines, start_from):
    try:
        print(f"--- НАЧИНАЕМ ПЕЧАТЬ С {start_from + 1} СТРОКИ ---")
        
        for i in range(start_from, len(lines)):
            line = lines[i]
            
            # 1. Печатаем символы строки (включая родные пробелы в начале)
            for char in line:
                pyautogui.write(char)
                time.sleep(random.uniform(*CHAR_DELAY))
            
            # 2. Нажимаем Enter для перехода на новую строку
            pyautogui.press('enter')
            
            # 3. ФИКС ОТСТУПОВ: 
            # Редактор мог сам добавить отступы. Очищаем их:
            # Выделяем всё до начала строки и удаляем.
            with pyautogui.hold('shift'):
                pyautogui.press('home')
            pyautogui.press('backspace')
            
            # Сохраняем прогресс
            save_progress(i + 1)
            time.sleep(random.uniform(*LINE_DELAY))

    except KeyboardInterrupt:
        print(f"\n[!] Остановлено вручную. Прогресс сохранен на строке {i + 1}.")
    except Exception as e:
        print(f"\n[!] Ошибка: {e}")

if __name__ == "__main__":
    if not os.path.exists(FILE_PATH):
        print(f"Файл не найден: {FILE_PATH}")
        sys.exit()

    try:
        with open(FILE_PATH, 'r', encoding='utf-8') as f:
            content_lines = [l.rstrip('\n\r') for l in f.readlines()]
    except Exception as e:
        print(f"Не удалось прочитать файл: {e}")
        sys.exit()

    start_line = 0
    saved = load_progress()
    if 0 < saved < len(content_lines):
        choice = input(f"Продолжить со строки {saved}? (y/n): ")
        if choice.lower() == 'y':
            start_line = saved
        else:
            save_progress(0)

    print(f"У вас {DELAY_BEFORE_START} секунд, чтобы поставить курсор в редактор.")
    for i in range(DELAY_BEFORE_START, 0, -1):
        print(f"Запуск через: {i}...", end='\r')
        time.sleep(1)

    human_typing(content_lines, start_line)
    
    if load_progress() >= len(content_lines):
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
        print("\n--- ВСЕ ГОТОВО! ---")