"""
Django management команда для создания тестовой истории рейтинга организатора
Использование: python manage.py create_rating_history --username almatyad
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random
from api.models import User, Activity, Project


class Command(BaseCommand):
    help = 'Создает тестовую историю рейтинга для организатора через Activity'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username организатора',
            required=True,
        )
        parser.add_argument(
            '--days',
            type=int,
            help='Количество дней для создания данных (по умолчанию 30)',
            default=30,
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Удалить старые тестовые активности перед созданием новых',
        )
        parser.add_argument(
            '--min-per-day',
            type=int,
            help='Минимальное количество активностей в день (по умолчанию 1)',
            default=1,
        )
        parser.add_argument(
            '--max-per-day',
            type=int,
            help='Максимальное количество активностей в день (по умолчанию 5)',
            default=5,
        )

    def handle(self, *args, **options):
        username = options['username']
        days = options['days']
        clear = options['clear']
        min_per_day = options['min_per_day']
        max_per_day = options['max_per_day']

        # Получаем организатора
        try:
            organizer = User.objects.get(username=username, is_organizer=True)
            self.stdout.write(
                f'[OK] Найден организатор: {organizer.username} (ID: {organizer.id})'
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"[ERROR] Организатор с username '{username}' не найден!")
            )
            self.stdout.write("Доступные организаторы:")
            for org in User.objects.filter(is_organizer=True):
                self.stdout.write(f"  - {org.username}")
            return

        # Получаем проекты организатора
        projects = Project.objects.filter(
            creator=organizer,
            is_deleted=False
        )[:5]  # Берем первые 5 проектов

        if not projects.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"[WARNING] У организатора {organizer.username} нет проектов. "
                    "Создайте проекты перед генерацией истории рейтинга."
                )
            )
            return

        # Удаляем старые активности, если нужно
        if clear:
            deleted_count = Activity.objects.filter(user=organizer).delete()[0]
            self.stdout.write(
                f'[OK] Удалено {deleted_count} старых активностей'
            )

        # Создаем активности за последние N дней
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        activities_created = 0
        current_date = start_date
        
        # Типы активностей, которые влияют на рейтинг организатора
        activity_types = [
            'task_assigned',
            'task_completed',
            'photo_uploaded',
            'project_joined',
        ]
        
        # Создаем активности для каждого дня
        while current_date <= end_date:
            # Количество активностей в этот день (случайное)
            num_activities = random.randint(min_per_day, max_per_day)
            
            # Распределяем активности в течение дня
            for i in range(num_activities):
                # Случайное время в течение дня
                hours_offset = random.randint(0, 23)
                minutes_offset = random.randint(0, 59)
                activity_time = current_date.replace(
                    hour=hours_offset,
                    minute=minutes_offset,
                    second=random.randint(0, 59),
                    microsecond=0
                )
                
                # Выбираем случайный тип активности
                activity_type = random.choice(activity_types)
                
                # Выбираем случайный проект
                project = random.choice(projects)
                
                # Создаем описание в зависимости от типа
                descriptions = {
                    'task_assigned': f'Назначена новая задача в проекте "{project.title}"',
                    'task_completed': f'Задача выполнена в проекте "{project.title}"',
                    'photo_uploaded': f'Загружено фото в проекте "{project.title}"',
                    'project_joined': f'Новый волонтер присоединился к проекту "{project.title}"',
                }
                
                titles = {
                    'task_assigned': 'Новая задача',
                    'task_completed': 'Задача выполнена',
                    'photo_uploaded': 'Фото загружено',
                    'project_joined': 'Новый участник',
                }
                
                # Создаем активность
                Activity.objects.create(
                    user=organizer,
                    type=activity_type,
                    title=titles[activity_type],
                    description=descriptions[activity_type],
                    project=project,
                    created_at=activity_time
                )
                activities_created += 1
            
            # Переходим к следующему дню
            current_date += timedelta(days=1)
        
        # Обновляем рейтинг организатора на основе созданных активностей
        # Согласно логике в stats.py, каждая активность добавляет 0.5 к рейтингу
        total_activities = Activity.objects.filter(
            user=organizer,
            created_at__gte=start_date
        ).count()
        
        # Устанавливаем базовый рейтинг и добавляем за активности
        # Но ограничиваем максимальный рейтинг для более реалистичной визуализации
        base_rating = 5.0  # Базовый рейтинг
        calculated_rating = base_rating + (total_activities * 0.1)  # Меньший прирост за активность
        # Ограничиваем рейтинг до разумного максимума (например, 50)
        new_rating = min(calculated_rating, 50.0)
        organizer.rating = new_rating
        organizer.save()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'[SUCCESS] Создано {activities_created} активностей за последние {days} дней'
            )
        )
        self.stdout.write(
            f'[INFO] Текущий рейтинг организатора: {organizer.rating}'
        )
        self.stdout.write(
            f'[INFO] Всего активностей у организатора: {total_activities}'
        )
        self.stdout.write(
            f'[INFO] История рейтинга будет доступна в API /custom-admin/api/v1/user/stats/'
        )

