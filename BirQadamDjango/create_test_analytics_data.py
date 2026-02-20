"""
Скрипт для создания тестовых данных аналитики через Django shell

ИСПОЛЬЗОВАНИЕ:
1. Откройте Django shell: python manage.py shell
2. Скопируйте и вставьте весь код ниже
3. Или запустите: python manage.py create_test_analytics --username almatyad
"""

from django.utils import timezone
from datetime import timedelta
from core.models import User, Activity, Project

# ============================================
# НАСТРОЙКИ (измените при необходимости)
# ============================================
ORGANIZER_USERNAME = 'almatyad'  # Измените на ваш username
DAYS_TO_CREATE = 30  # Количество дней для создания данных
CLEAR_OLD_TEST_DATA = False  # Удалить старые тестовые данные?

# ============================================
# КОД (скопируйте в Django shell)
# ============================================

# Получаем организатора
try:
    organizer = User.objects.get(username=ORGANIZER_USERNAME, is_organizer=True)
    print(f"✅ Найден организатор: {organizer.username} (ID: {organizer.id})")
except User.DoesNotExist:
    print(f"❌ Организатор с username '{ORGANIZER_USERNAME}' не найден!")
    print("Доступные организаторы:")
    for org in User.objects.filter(is_organizer=True):
        print(f"  - {org.username} (ID: {org.id})")
    raise

# Получаем проекты организатора
projects = list(Project.objects.filter(creator=organizer, is_deleted=False)[:5])
if not projects:
    print("⚠️ У организатора нет проектов. Создайте проекты сначала.")
    raise Exception("Нет проектов")

print(f"✅ Найдено проектов: {len(projects)}")

# Удаляем старые тестовые активности (если нужно)
if CLEAR_OLD_TEST_DATA:
    deleted = Activity.objects.filter(user=organizer, title__startswith='[TEST]').delete()
    print(f"🗑️ Удалено старых тестовых активностей: {deleted[0]}")

# Типы активности
activity_types = [
    ('task_completed', 'Задача выполнена'),
    ('photo_uploaded', 'Фото загружено'),
    ('project_joined', 'Присоединился к проекту'),
    ('task_assigned', 'Новое задание'),
]

print(f"\n📊 Создание тестовых активностей за последние {DAYS_TO_CREATE} дней...")

# Создаем активности за указанный период
now = timezone.now()
activities_created = 0

for day_offset in range(DAYS_TO_CREATE):
    date = now - timedelta(days=day_offset)
    
    # Создаем 1-3 активности в день
    num_activities = (day_offset % 3) + 1
    
    for i in range(num_activities):
        # Выбираем тип активности
        activity_type, activity_title = activity_types[day_offset % len(activity_types)]
        
        # Выбираем проект
        project = projects[day_offset % len(projects)] if projects else None
        
        # Создаем активность
        Activity.objects.create(
            user=organizer,
            type=activity_type,
            title=f'[TEST] {activity_title}',
            description=f'Тестовая активность от {date.strftime("%Y-%m-%d %H:%M")}',
            project=project,
            created_at=date - timedelta(hours=i)
        )
        activities_created += 1

print(f"✅ Создано активностей за {DAYS_TO_CREATE} дней: {activities_created}")

# Создаем дополнительные активности за последние 7 дней
print("\n📊 Создание активностей за последние 7 дней...")
recent_activities = 0

for day_offset in range(7):
    date = now - timedelta(days=day_offset)
    
    # Создаем активности разных типов
    for activity_type, activity_title in activity_types:
        project = projects[day_offset % len(projects)] if projects else None
        
        Activity.objects.create(
            user=organizer,
            type=activity_type,
            title=f'[TEST] {activity_title}',
            description=f'Тестовая активность за последние 7 дней от {date.strftime("%Y-%m-%d")}',
            project=project,
            created_at=date
        )
        recent_activities += 1

print(f"✅ Создано активностей за последние 7 дней: {recent_activities}")

# Показываем статистику
total_activities = Activity.objects.filter(user=organizer).count()
print(f"\n📊 Общая статистика:")
print(f"  Всего активностей: {total_activities}")
print(f"  За последние 30 дней: {Activity.objects.filter(user=organizer, created_at__gte=now - timedelta(days=30)).count()}")
print(f"  За последние 7 дней: {Activity.objects.filter(user=organizer, created_at__gte=now - timedelta(days=7)).count()}")

# Статистика по типам
print(f"\n📊 Статистика по типам (последние 7 дней):")
for activity_type, activity_title in activity_types:
    count = Activity.objects.filter(
        user=organizer,
        type=activity_type,
        created_at__gte=now - timedelta(days=7)
    ).count()
    print(f"  {activity_title}: {count}")

print("\n✅ Тестовые данные созданы! Обновите страницу аналитики.")

