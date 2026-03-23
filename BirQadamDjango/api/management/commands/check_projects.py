from django.core.management.base import BaseCommand
from api.models import Project


class Command(BaseCommand):
    help = 'Проверяет все проекты в БД'

    def handle(self, *args, **options):
        projects = Project.objects.filter(is_deleted=False).order_by('-created_at')
        
        self.stdout.write(self.style.SUCCESS(f'\n📊 Всего проектов в БД: {projects.count()}\n'))
        
        for p in projects:
            self.stdout.write('─' * 80)
            self.stdout.write(f'ID: {p.id}')
            self.stdout.write(f'Название: {p.title}')
            self.stdout.write(f'Статус: {p.status}')
            self.stdout.write(f'Город: {p.city}')
            self.stdout.write(f'Тип: {p.volunteer_type}')
            self.stdout.write(f'Создатель: {p.creator.username if p.creator else "Нет"}')
            self.stdout.write(f'Изображение: {"✅ Да" if p.cover_image else "❌ Нет"}')
            if p.cover_image:
                self.stdout.write(f'  Путь к изображению: {p.cover_image.url}')
            self.stdout.write(f'Описание: {p.description[:100]}...')
            self.stdout.write(f'Даты: {p.start_date} - {p.end_date}')
            self.stdout.write(f'Создан: {p.created_at}')
        
        self.stdout.write('─' * 80)
        
        # Статистика по статусам
        approved = projects.filter(status='approved').count()
        pending = projects.filter(status='pending').count()
        rejected = projects.filter(status='rejected').count()
        
        self.stdout.write(self.style.SUCCESS(f'\n📈 Статистика:'))
        self.stdout.write(f'  Одобренные (approved): {approved}')
        self.stdout.write(f'  Ожидают (pending): {pending}')
        self.stdout.write(f'  Отклонённые (rejected): {rejected}')









