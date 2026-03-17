from django.core.management.base import BaseCommand
from api.models import Project, User
from datetime import date, timedelta


class Command(BaseCommand):
    help = 'Создаёт тестовые проекты для отладки'

    def handle(self, *args, **options):
        try:
            # Находим или создаём пользователя-создателя
            creator = User.objects.filter(role='organizer').first()
            if not creator:
                creator = User.objects.first()
            
            if not creator:
                self.stdout.write(self.style.ERROR('❌ Нет пользователей в БД!'))
                return
            
            self.stdout.write(self.style.SUCCESS(f'✅ Используем создателя: {creator.username} (ID: {creator.id})'))
            
            # Создаём тестовые проекты
            projects_data = [
                {
                    'title': 'Уборка парка Горького',
                    'volunteer_type': 'environmental',
                    'description': '''Приглашаем всех желающих принять участие в уборке парка Горького! 

Мы соберём мусор, приведём в порядок клумбы и сделаем наш любимый парк ещё красивее.

Что нужно взять с собой:
- Перчатки
- Удобную одежду
- Хорошее настроение!

Мешки для мусора и инвентарь предоставляем мы.''',
                    'city': 'Алматы',
                    'latitude': 43.2220,
                    'longitude': 76.8512,
                    'start_date': date.today() + timedelta(days=7),
                    'end_date': date.today() + timedelta(days=30),
                },
                {
                    'title': 'Помощь детскому дому',
                    'volunteer_type': 'social',
                    'description': 'Организуем праздник для детей из детского дома. Нужны волонтёры для проведения игр, мастер-классов и раздачи подарков.',
                    'city': 'Алматы',
                    'latitude': 43.2380,
                    'longitude': 76.9450,
                    'start_date': date.today() + timedelta(days=14),
                    'end_date': date.today() + timedelta(days=45),
                },
                {
                    'title': 'Фестиваль культуры',
                    'volunteer_type': 'cultural',
                    'description': 'Ищем волонтёров для помощи в организации городского фестиваля культуры. Работа с посетителями, помощь артистам, координация мероприятий.',
                    'city': 'Алматы',
                    'latitude': 43.2567,
                    'longitude': 76.9286,
                    'start_date': date.today() + timedelta(days=21),
                    'end_date': date.today() + timedelta(days=60),
                },
            ]
            
            created_count = 0
            for data in projects_data:
                # Проверяем, не существует ли уже такой проект
                if Project.objects.filter(title=data['title'], is_deleted=False).exists():
                    self.stdout.write(self.style.WARNING(f'⚠️  Проект "{data["title"]}" уже существует, пропускаем'))
                    continue
                
                project = Project.objects.create(
                    creator=creator,
                    status='approved',  # ✅ Важно!
                    is_deleted=False,
                    **data
                )
                created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f'✅ Создан проект: {project.title} (ID: {project.id}, даты: {project.start_date} - {project.end_date})'
                ))
            
            total_projects = Project.objects.filter(status='approved', is_deleted=False).count()
            self.stdout.write(self.style.SUCCESS(f'\n🎉 Создано новых проектов: {created_count}'))
            self.stdout.write(self.style.SUCCESS(f'📊 Всего одобренных проектов в БД: {total_projects}'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Ошибка: {e}'))
            import traceback
            traceback.print_exc()
