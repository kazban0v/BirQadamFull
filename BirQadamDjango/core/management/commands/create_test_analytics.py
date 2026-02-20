"""
Django management команда для создания тестовых данных аналитики
Использование: python manage.py create_test_analytics --username almatyad
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import User, Activity, Project


class Command(BaseCommand):
    help = 'Создает тестовые данные для аналитики организатора'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username организатора',
            default='almatyad',
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

    def handle(self, *args, **options):
        username = options['username']
        days = options['days']
        clear = options['clear']

        # Получаем организатора
        try:
            organizer = User.objects.get(username=username, is_organizer=True)
            self.stdout.write(
                self.style.SUCCESS(f'[OK] Найден организатор: {organizer.username} (ID: {organizer.id})')
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"[ERROR] Организатор с username '{username}' не найден!")
            )
            self.stdout.write("Доступные организаторы:")
            for org in User.objects.filter(is_organizer=True):
                self.stdout.write(f"  - {org.username} (ID: {org.id})")
            return

        # Получаем проекты организатора
        projects = Project.objects.filter(creator=organizer, is_deleted=False)[:5]
        if not projects.exists():
            self.stdout.write(
                self.style.WARNING("[WARNING] У организатора нет проектов. Создайте проекты сначала.")
            )
            return

        self.stdout.write(f"[OK] Найдено проектов: {projects.count()}")

        # Удаляем старые тестовые активности (если нужно)
        if clear:
            deleted = Activity.objects.filter(
                user=organizer,
                title__startswith='[TEST]'
            ).delete()
            self.stdout.write(
                self.style.SUCCESS(f"[OK] Удалено старых тестовых активностей: {deleted[0]}")
            )

        # Типы активности
        activity_types = [
            ('task_completed', 'Задача выполнена'),
            ('photo_uploaded', 'Фото загружено'),
            ('project_joined', 'Присоединился к проекту'),
            ('task_assigned', 'Новое задание'),
        ]

        self.stdout.write(f"\n[INFO] Создание тестовых активностей за последние {days} дней...")

        # Создаем активности за указанный период
        now = timezone.now()
        activities_created = 0

        for day_offset in range(days):
            date = now - timedelta(days=day_offset)
            
            # Создаем 1-3 активности в день
            num_activities = (day_offset % 3) + 1  # 1, 2 или 3 активности в день
            
            for i in range(num_activities):
                # Выбираем тип активности
                activity_type, activity_title = activity_types[day_offset % len(activity_types)]
                
                # Выбираем проект
                project = projects[day_offset % projects.count()] if projects.exists() else None
                
                # Создаем активность
                activity = Activity.objects.create(
                    user=organizer,
                    type=activity_type,
                    title=f'[TEST] {activity_title}',
                    description=f'Тестовая активность от {date.strftime("%Y-%m-%d %H:%M")}',
                    project=project,
                    created_at=date - timedelta(hours=i)  # Разные времена в течение дня
                )
                activities_created += 1

        self.stdout.write(
            self.style.SUCCESS(f"[OK] Создано активностей за {days} дней: {activities_created}")
        )

        # Создаем дополнительные активности за последние 7 дней (для графика активности по типам)
        self.stdout.write("\n[INFO] Создание активностей за последние 7 дней...")
        recent_activities = 0

        for day_offset in range(7):
            date = now - timedelta(days=day_offset)
            
            # Создаем активности разных типов
            for activity_type, activity_title in activity_types:
                project = projects[day_offset % projects.count()] if projects.exists() else None
                
                activity = Activity.objects.create(
                    user=organizer,
                    type=activity_type,
                    title=f'[TEST] {activity_title}',
                    description=f'Тестовая активность за последние 7 дней от {date.strftime("%Y-%m-%d")}',
                    project=project,
                    created_at=date
                )
                recent_activities += 1

        self.stdout.write(
            self.style.SUCCESS(f"[OK] Создано активностей за последние 7 дней: {recent_activities}")
        )

        # Показываем статистику
        total_activities = Activity.objects.filter(user=organizer).count()
        self.stdout.write(f"\n[STATS] Общая статистика:")
        self.stdout.write(f"  Всего активностей: {total_activities}")
        self.stdout.write(
            f"  За последние 30 дней: {Activity.objects.filter(user=organizer, created_at__gte=now - timedelta(days=30)).count()}"
        )
        self.stdout.write(
            f"  За последние 7 дней: {Activity.objects.filter(user=organizer, created_at__gte=now - timedelta(days=7)).count()}"
        )

        # Статистика по типам
        self.stdout.write(f"\n[STATS] Статистика по типам (последние 7 дней):")
        for activity_type, activity_title in activity_types:
            count = Activity.objects.filter(
                user=organizer,
                type=activity_type,
                created_at__gte=now - timedelta(days=7)
            ).count()
            self.stdout.write(f"  {activity_title}: {count}")

        self.stdout.write(
            self.style.SUCCESS("\n[OK] Тестовые данные созданы! Обновите страницу аналитики.")
        )

