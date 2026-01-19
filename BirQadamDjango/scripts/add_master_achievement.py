#!/usr/bin/env python
"""
Скрипт для добавления достижения "Мастер" (750 рейтинга)
"""
import os
import sys
import django

# Настройка Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
django.setup()

from core.models import Achievement

def add_master_achievement() -> None:
    """Добавляет достижение "Мастер" для 750 рейтинга"""
    
    # Проверяем, существует ли уже такое достижение
    if Achievement.objects.filter(required_rating=750).exists():
        print("[OK] Достижение 'Мастер' (750 рейтинга) уже существует")
        return
    
    # Создаем достижение
    achievement = Achievement.objects.create(
        name='Мастер',
        description='Достигните максимального уровня мастерства! Вы прошли долгий путь и заслужили этот титул.',
        icon='military_tech',  # Иконка медали
        required_rating=750,
        xp=500
    )
    
    print(f"[OK] Создано достижение: {achievement.name}")
    print(f"   - Требуемый рейтинг: {achievement.required_rating}")
    print(f"   - Опыт (XP): {achievement.xp}")
    print(f"   - Иконка: {achievement.icon}")
    
    # Показываем все достижения
    print("\n[INFO] Все достижения в системе:")
    for ach in Achievement.objects.all().order_by('required_rating'):
        print(f"   {ach.required_rating:>3} рейтинга -> {ach.name} (+{ach.xp} XP)")

if __name__ == '__main__':
    add_master_achievement()

