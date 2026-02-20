# Создание тестовых данных для аналитики

Этот документ описывает, как создать тестовые данные для проверки работы страницы аналитики организатора.

## Способ 1: Django Management команда (Рекомендуется)

Самый простой способ - использовать готовую команду:

```bash
# Базовое использование (создаст данные для пользователя almatyad)
python manage.py create_test_analytics

# Указать другого организатора
python manage.py create_test_analytics --username ваш_username

# Создать данные за больше дней
python manage.py create_test_analytics --username almatyad --days 60

# Удалить старые тестовые данные перед созданием новых
python manage.py create_test_analytics --username almatyad --clear
```

### Параметры команды:

- `--username` - Username организатора (по умолчанию: `almatyad`)
- `--days` - Количество дней для создания данных (по умолчанию: 30)
- `--clear` - Удалить старые тестовые активности перед созданием новых

## Способ 2: Django Shell

Если хотите больше контроля, используйте Django shell:

```bash
# Откройте Django shell
python manage.py shell
```

Затем скопируйте и вставьте код из файла `create_test_analytics_data.py`:

```python
from django.utils import timezone
from datetime import timedelta
from core.models import User, Activity, Project

# Настройки
ORGANIZER_USERNAME = 'almatyad'  # Измените на ваш username
DAYS_TO_CREATE = 30
CLEAR_OLD_TEST_DATA = False

# ... (остальной код из файла)
```

Или откройте файл и скопируйте весь код:

```bash
# В Django shell
exec(open('create_test_analytics_data.py').read())
```

## Что создается:

1. **Активности за последние 30 дней** (или указанное количество дней):
   - 1-3 активности в день
   - Разные типы: задачи, фото, присоединения к проектам
   - Привязаны к проектам организатора

2. **Активности за последние 7 дней**:
   - По несколько активностей каждого типа
   - Для проверки графика "Активность по типам"

3. **Типы активности**:
   - `task_completed` - Задача выполнена
   - `photo_uploaded` - Фото загружено
   - `project_joined` - Присоединился к проекту
   - `task_assigned` - Новое задание

## Проверка результатов:

После создания данных:

1. Откройте страницу аналитики: `/portal/organizer/analytics`
2. Проверьте график "Динамика рейтинга" - должен показать изменения за период
3. Проверьте график "Активность по типам" - должен показать активность по типам
4. Проверьте "Детализацию по проектам" - должна показать статистику по проектам

## Удаление тестовых данных:

Чтобы удалить все тестовые данные:

```python
# В Django shell
from core.models import Activity

# Удалить все тестовые активности
Activity.objects.filter(title__startswith='[TEST]').delete()
```

Или используйте команду с флагом `--clear`:

```bash
python manage.py create_test_analytics --username almatyad --clear
```

## Примечания:

- Тестовые активности помечены префиксом `[TEST]` в названии
- Данные создаются для указанного организатора
- Нужно иметь хотя бы один проект у организатора
- Рейтинг организатора обычно остается 0.0 (для волонтёров рейтинг меняется)

