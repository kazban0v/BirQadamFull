"""
Скрипт для добавления волонтеров к проекту "Зеленый двор"
Запуск: python manage.py shell < add_volunteers_to_project.py
Или скопируйте код в manage.py shell
"""
import random
from datetime import datetime, timedelta

from api.projects.models import Project, VolunteerProject
from api.users.models import User
from django.utils import timezone

def add_volunteers_to_project():
    # Ищем проект "Зеленый двор" (может быть с разными вариантами написания)
    project = Project.objects.filter(
        title__icontains='зеленый',
        is_deleted=False
    ).first()
    
    if not project:
        # Если не нашли, берем первый одобренный проект
        project = Project.objects.filter(
            status='approved',
            is_deleted=False
        ).first()
        print(f"Проект 'Зеленый двор' не найден. Используем проект: {project.title if project else 'НЕТ ПРОЕКТОВ'}")
    else:
        print(f"Найден проект: {project.title} (ID: {project.id})")
    
    if not project:
        print("❌ Нет доступных проектов!")
        return
    
    # Получаем всех пользователей, которые не организаторы (или всех пользователей)
    # Исключаем организатора проекта
    existing_volunteers = VolunteerProject.objects.filter(
        project=project,
        is_active=True
    ).values_list('volunteer_id', flat=True)
    
    # Получаем пользователей, которые еще не участвуют в проекте
    available_users = User.objects.exclude(
        id__in=existing_volunteers
    ).exclude(
        id=project.creator_id
    )
    
    # Если пользователей недостаточно, создаем новых
    needed_count = 25
    current_count = available_users.count()
    
    print(f"Доступно пользователей: {current_count}")
    print(f"Нужно добавить: {needed_count}")
    
    if current_count < needed_count:
        # Создаем недостающих пользователей
        to_create = needed_count - current_count
        print(f"Создаем {to_create} новых пользователей...")
        
        for i in range(to_create):
            username = f"volunteer_{project.id}_{random.randint(1000, 9999)}"
            # Проверяем, что username уникален
            while User.objects.filter(username=username).exists():
                username = f"volunteer_{project.id}_{random.randint(1000, 9999)}"
            
            user = User.objects.create_user(
                username=username,
                email=f"{username}@example.com",
                password='volunteer123',  # Простой пароль для теста
                name=f"Волонтер {i+1}",
                is_volunteer=True,
            )
            available_users = available_users | User.objects.filter(id=user.id)
            print(f"  ✓ Создан пользователь: {user.username}")
    
    # Выбираем случайных пользователей
    selected_users = list(available_users[:needed_count])
    
    if len(selected_users) < needed_count:
        print(f"⚠️  Доступно только {len(selected_users)} пользователей")
    
    # Добавляем участников к проекту
    added_count = 0
    for user in selected_users:
        # Проверяем, не участвует ли уже
        if not VolunteerProject.objects.filter(volunteer=user, project=project).exists():
            # Случайная дата присоединения (от 30 дней назад до сегодня)
            days_ago = random.randint(0, 30)
            joined_date = timezone.now() - timedelta(days=days_ago)
            
            VolunteerProject.objects.create(
                volunteer=user,
                project=project,
                is_active=True,
                joined_at=joined_date
            )
            added_count += 1
            print(f"  ✓ Добавлен: {user.name or user.username}")
    
    # Обновляем количество участников
    active_count = VolunteerProject.objects.filter(project=project, is_active=True).count()
    print(f"\n✅ Успешно добавлено {added_count} участников")
    print(f"📊 Всего активных участников в проекте: {active_count}")
    
    return project, added_count

if __name__ == '__main__':
    add_volunteers_to_project()

