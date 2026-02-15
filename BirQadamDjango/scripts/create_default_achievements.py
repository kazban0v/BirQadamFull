#!/usr/bin/env python
"""
Скрипт для создания базовых достижений
"""
import os
import sys
import django

# Настройка Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
django.setup()

from core.models import Achievement

def create_default_achievements() -> None:
    """Создает базовые достижения для системы"""
    
    default_achievements = [
        {
            'name': 'Новичок',
            'description': 'Выполните первое задание и получите благодарность от команды BirQadam.',
            'icon': 'mdi-star-outline',
            'required_rating': 0,
            'xp': 10,
        },
        {
            'name': 'Активный волонтёр',
            'description': 'Выполните 5 заданий и покажите свою активность в проектах.',
            'icon': 'mdi-account-check',
            'required_rating': 50,
            'xp': 25,
        },
        {
            'name': 'Фото эксперт',
            'description': 'Отправьте 10 успешных фотоотчётов и помогите проекту с визуальными материалами.',
            'icon': 'mdi-camera',
            'required_rating': 100,
            'xp': 50,
        },
        {
            'name': 'Командный игрок',
            'description': 'Примите участие в трёх проектах подряд без пропусков и задержек.',
            'icon': 'mdi-account-group',
            'required_rating': 150,
            'xp': 75,
        },
        {
            'name': 'Опытный волонтёр',
            'description': 'Достигните 250 рейтинга и покажите свой опыт в волонтёрской деятельности.',
            'icon': 'mdi-trophy',
            'required_rating': 250,
            'xp': 100,
        },
        {
            'name': 'Профессионал',
            'description': 'Достигните 400 рейтинга и станьте профессионалом в волонтёрской работе.',
            'icon': 'mdi-medal',
            'required_rating': 400,
            'xp': 200,
        },
        {
            'name': 'Мастер',
            'description': 'Достигните максимального уровня мастерства! Вы прошли долгий путь и заслужили этот титул.',
            'icon': 'mdi-trophy-award',
            'required_rating': 750,
            'xp': 500,
        },
    ]
    
    created_count = 0
    skipped_count = 0
    
    for achievement_data in default_achievements:
        # Проверяем, существует ли уже такое достижение
        existing = Achievement.objects.filter(
            required_rating=achievement_data['required_rating']
        ).first()
        
        if existing:
            print(f"[SKIP] Достижение '{achievement_data['name']}' (рейтинг {achievement_data['required_rating']}) уже существует")
            skipped_count += 1
        else:
            achievement = Achievement.objects.create(**achievement_data)
            print(f"[OK] Создано достижение: {achievement.name}")
            print(f"   - Требуемый рейтинг: {achievement.required_rating}")
            print(f"   - Опыт (XP): {achievement.xp}")
            print(f"   - Иконка: {achievement.icon}")
            created_count += 1
    
    print(f"\n[SUMMARY] Создано: {created_count}, Пропущено: {skipped_count}")
    
    # Показываем все достижения
    print("\n[INFO] Все достижения в системе:")
    for ach in Achievement.objects.all().order_by('required_rating'):
        print(f"   {ach.required_rating:>3} рейтинга -> {ach.name} (+{ach.xp} XP)")

if __name__ == '__main__':
    create_default_achievements()

