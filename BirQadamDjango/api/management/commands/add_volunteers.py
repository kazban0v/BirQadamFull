"""
Django management command для добавления волонтеров к проекту
Использование: python manage.py add_volunteers --project "Зеленый двор" --count 25
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random

from api.projects.models import Project, VolunteerProject
from api.users.models import User


class Command(BaseCommand):
    help = 'Добавляет волонтеров к проекту'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project',
            type=str,
            default='зеленый',
            help='Название проекта (поиск по части названия)',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=25,
            help='Количество волонтеров для добавления',
        )

    def handle(self, *args, **options):
        project_name = options['project']
        needed_count = options['count']
        
        # Ищем проект
        project = Project.objects.filter(
            title__icontains=project_name,
            is_deleted=False
        ).first()
        
        if not project:
            # Если не нашли, берем первый одобренный проект
            project = Project.objects.filter(
                status='approved',
                is_deleted=False
            ).first()
            self.stdout.write(
                self.style.WARNING(
                    f"Проект '{project_name}' не найден. Используем проект: {project.title if project else 'НЕТ ПРОЕКТОВ'}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Найден проект: {project.title} (ID: {project.id})")
            )
        
        if not project:
            self.stdout.write(self.style.ERROR("❌ Нет доступных проектов!"))
            return
        
        # Получаем существующих участников
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
        
        current_count = available_users.count()
        
        self.stdout.write(f"Доступно пользователей: {current_count}")
        self.stdout.write(f"Нужно добавить: {needed_count}")
        
        # Если пользователей недостаточно, создаем новых
        if current_count < needed_count:
            to_create = needed_count - current_count
            self.stdout.write(f"Создаем {to_create} новых пользователей...")
            
            for i in range(to_create):
                username = f"volunteer_{project.id}_{random.randint(1000, 9999)}"
                # Проверяем, что username уникален
                while User.objects.filter(username=username).exists():
                    username = f"volunteer_{project.id}_{random.randint(1000, 9999)}"
                
                # Случайные имена для разнообразия
                names = [
                    "Алексей", "Мария", "Дмитрий", "Анна", "Иван", "Елена",
                    "Сергей", "Ольга", "Андрей", "Наталья", "Павел", "Татьяна",
                    "Михаил", "Екатерина", "Николай", "Юлия", "Владимир", "Светлана",
                    "Александр", "Ирина", "Максим", "Марина", "Артем", "Виктория"
                ]
                
                user = User.objects.create_user(
                    username=username,
                    email=f"{username}@example.com",
                    password='volunteer123',
                    name=random.choice(names),
                    is_volunteer=True,
                )
                available_users = available_users | User.objects.filter(id=user.id)
                self.stdout.write(f"  ✓ Создан пользователь: {user.name} ({user.username})")
        
        # Выбираем случайных пользователей
        selected_users = list(available_users[:needed_count])
        
        if len(selected_users) < needed_count:
            self.stdout.write(
                self.style.WARNING(f"⚠️  Доступно только {len(selected_users)} пользователей")
            )
        
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
                self.stdout.write(f"  ✓ Добавлен: {user.name or user.username}")
        
        # Обновляем количество участников
        active_count = VolunteerProject.objects.filter(project=project, is_active=True).count()
        self.stdout.write(
            self.style.SUCCESS(f"\n✅ Успешно добавлено {added_count} участников")
        )
        self.stdout.write(f"📊 Всего активных участников в проекте: {active_count}")

