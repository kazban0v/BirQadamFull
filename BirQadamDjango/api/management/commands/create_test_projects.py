"""
Django management команда для создания тестовых проектов
Использование: python manage.py create_test_projects --username almatyad --count 11
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random
from api.models import User, Project


class Command(BaseCommand):
    help = 'Создает тестовые проекты для организатора'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username организатора',
            default='78454161451',
        )
        parser.add_argument(
            '--count',
            type=int,
            help='Количество проектов для создания (по умолчанию 11)',
            default=11,
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Удалить старые тестовые проекты перед созданием новых',
        )

    def handle(self, *args, **options):
        username = options['username']
        count = options['count']
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

        # Удаляем старые тестовые проекты, если указан флаг --clear
        if clear:
            deleted_count = Project.objects.filter(creator=organizer, is_deleted=False).count()
            Project.objects.filter(creator=organizer, is_deleted=False).update(is_deleted=True)
            self.stdout.write(
                self.style.WARNING(f'[INFO] Удалено {deleted_count} существующих проектов организатора')
            )

        # Данные для создания проектов
        cities = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Усть-Каменогорск', 'Павлодар']
        volunteer_types = ['social', 'environmental', 'cultural']
        
        project_templates = [
            {
                'title': 'Озеленение парков города',
                'description': 'Посадка деревьев и кустарников в городских парках для улучшения экологии и создания комфортной среды для жителей.',
                'volunteer_type': 'environmental',
                'city': 'Алматы',
                'tags': ['экология', 'озеленение', 'парк'],
            },
            {
                'title': 'Помощь пожилым людям',
                'description': 'Волонтерская помощь одиноким пожилым людям: покупка продуктов, уборка квартир, общение и поддержка.',
                'volunteer_type': 'social',
                'city': 'Астана',
                'tags': ['социальная помощь', 'пожилые', 'забота'],
            },
            {
                'title': 'Организация культурных мероприятий',
                'description': 'Проведение концертов, выставок и мастер-классов для развития культурной жизни города.',
                'volunteer_type': 'cultural',
                'city': 'Шымкент',
                'tags': ['культура', 'мероприятия', 'творчество'],
            },
            {
                'title': 'Уборка берегов рек и озер',
                'description': 'Экологическая акция по очистке берегов водоемов от мусора и пластика.',
                'volunteer_type': 'environmental',
                'city': 'Алматы',
                'tags': ['экология', 'уборка', 'водоемы'],
            },
            {
                'title': 'Поддержка детей из детских домов',
                'description': 'Организация досуга, образовательных программ и психологической поддержки для детей-сирот.',
                'volunteer_type': 'social',
                'city': 'Караганда',
                'tags': ['дети', 'сироты', 'образование'],
            },
            {
                'title': 'Фестиваль уличного искусства',
                'description': 'Проведение фестиваля граффити и уличного искусства для развития творческого потенциала молодежи.',
                'volunteer_type': 'cultural',
                'city': 'Астана',
                'tags': ['искусство', 'граффити', 'фестиваль'],
            },
            {
                'title': 'Создание экологических троп',
                'description': 'Разработка и обустройство экологических троп для экотуризма и просвещения населения.',
                'volunteer_type': 'environmental',
                'city': 'Алматы',
                'tags': ['экология', 'туризм', 'образование'],
            },
            {
                'title': 'Помощь бездомным животным',
                'description': 'Уход за животными в приютах, организация акций по стерилизации и поиску новых хозяев.',
                'volunteer_type': 'social',
                'city': 'Актобе',
                'tags': ['животные', 'приют', 'забота'],
            },
            {
                'title': 'Театральный кружок для детей',
                'description': 'Организация театральных занятий и постановок для детей из малообеспеченных семей.',
                'volunteer_type': 'cultural',
                'city': 'Тараз',
                'tags': ['театр', 'дети', 'творчество'],
            },
            {
                'title': 'Сбор и переработка мусора',
                'description': 'Организация пунктов сбора вторсырья и просветительская работа о важности переработки.',
                'volunteer_type': 'environmental',
                'city': 'Усть-Каменогорск',
                'tags': ['переработка', 'экология', 'мусор'],
            },
            {
                'title': 'Центр помощи мигрантам',
                'description': 'Оказание юридической, психологической и материальной помощи мигрантам и беженцам.',
                'volunteer_type': 'social',
                'city': 'Павлодар',
                'tags': ['мигранты', 'помощь', 'поддержка'],
            },
        ]

        created_count = 0
        today = timezone.now().date()

        for i in range(count):
            # Используем шаблон, если есть, иначе генерируем случайный
            if i < len(project_templates):
                template = project_templates[i]
            else:
                template = {
                    'title': f'Тестовый проект {i + 1}',
                    'description': f'Описание тестового проекта номер {i + 1}. Этот проект создан для тестирования системы.',
                    'volunteer_type': random.choice(volunteer_types),
                    'city': random.choice(cities),
                    'tags': ['тест', 'проект'],
                }

            # Генерируем даты (проекты на ближайшие 1-6 месяцев)
            start_date = today + timedelta(days=random.randint(7, 30))
            end_date = start_date + timedelta(days=random.randint(30, 180))

            # Генерируем координаты для города (примерные)
            city_coords = {
                'Алматы': (43.2220, 76.8512),
                'Астана': (51.1694, 71.4491),
                'Шымкент': (42.3419, 69.5901),
                'Караганда': (49.8014, 73.1044),
                'Актобе': (50.2833, 57.1667),
                'Тараз': (42.9000, 71.3667),
                'Усть-Каменогорск': (49.9485, 82.6287),
                'Павлодар': (52.2877, 76.9674),
            }
            
            latitude, longitude = city_coords.get(template['city'], (43.2220, 76.8512))
            # Добавляем небольшую случайность
            latitude += random.uniform(-0.1, 0.1)
            longitude += random.uniform(-0.1, 0.1)

            # Создаем проект
            project = Project.objects.create(
                title=template['title'],
                description=template['description'],
                volunteer_type=template['volunteer_type'],
                city=template['city'],
                latitude=latitude,
                longitude=longitude,
                start_date=start_date,
                end_date=end_date,
                creator=organizer,
                status='approved',  # Сразу одобряем для тестирования
                address=f'{template["city"]}, ул. Тестовая, {random.randint(1, 100)}',
                contact_person=organizer.name or organizer.username,
                contact_phone=f'+7-({random.randint(700, 799)})-{random.randint(100, 999)}-{random.randint(10, 99)}-{random.randint(10, 99)}',
                contact_email=organizer.email or f'contact{i}@example.com',
                contact_telegram=f'@{organizer.username}',
            )

            # Добавляем теги
            for tag in template['tags']:
                project.tags.add(tag)

            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'[OK] Создан проект #{created_count}: "{project.title}" (ID: {project.id})')
            )

        self.stdout.write(
            self.style.SUCCESS(f'\n[SUCCESS] Создано проектов: {created_count}')
        )
        self.stdout.write(f'Организатор: {organizer.username} (ID: {organizer.id})')
        self.stdout.write(f'Все проекты имеют статус "approved" и готовы к использованию.')

