"""
✅ ИСПРАВЛЕНИЕ КП-5: Валидация входных данных в API через Django REST Framework Serializers
"""
from typing import Any, Dict, Optional
from rest_framework import serializers
from core.models import Photo, Project, Task, User, VolunteerProject
from core.utils.constants import (
    MAX_PHOTO_SIZE_BYTES,
    ALLOWED_IMAGE_EXTENSIONS,
    MIN_PROJECT_DESCRIPTION_LENGTH,
    MAX_PROJECT_DESCRIPTION_LENGTH,
    MAX_PROJECT_TITLE_LENGTH,
    MAX_TASK_TITLE_LENGTH,
    COMMENT_MAX_LENGTH,
    MIN_RATING,
    MAX_RATING,
)
import bleach  # type: ignore[reportMissingModuleSource]


def sanitize_html(text: str) -> str:
    """Очистка HTML от опасных тегов (XSS защита)"""
    if not text:
        return text
    allowed_tags = ['b', 'i', 'u', 'a', 'p', 'br', 'strong', 'em']
    allowed_attrs = {'a': ['href', 'title']}
    return bleach.clean(text, tags=allowed_tags, attributes=allowed_attrs, strip=True)


class PhotoReportSerializer(serializers.ModelSerializer):
    """Сериализатор для загрузки фотоотчётов"""
    image = serializers.ImageField(
        use_url=True,
        required=True,
    )
    volunteer_comment = serializers.CharField(
        max_length=COMMENT_MAX_LENGTH,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Photo
        fields = ['image', 'volunteer_comment']

    def validate_image(self, value: Any) -> Any:
        """Валидация размера и типа файла изображения"""
        # Проверка размера файла
        if value.size > MAX_PHOTO_SIZE_BYTES:
            raise serializers.ValidationError(
                f'Размер изображения не должен превышать {MAX_PHOTO_SIZE_BYTES // (1024 * 1024)} МБ. '
                f'Ваш файл: {value.size // (1024 * 1024)} МБ'
            )
        
        # Проверка расширения файла
        ext = value.name.split('.')[-1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise serializers.ValidationError(
                f'Неподдерживаемый формат файла. '
                f'Разрешённые форматы: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'
            )
        
        return value

    def validate_volunteer_comment(self, value: str) -> str:
        """Валидация комментария волонтёра"""
        if value:
            # Санитизация HTML
            cleaned_value = sanitize_html(value)
            
            # Проверка на спам-слова
            spam_words = ['казино', 'кредит', 'займ', 'ставки', 'casino', 'loan']
            value_lower = cleaned_value.lower()
            if any(word in value_lower for word in spam_words):
                raise serializers.ValidationError('Комментарий содержит недопустимые слова')
            
            return cleaned_value
        return value


class ProjectSerializer(serializers.ModelSerializer):
    """Сериализатор для создания и обновления проектов"""
    title = serializers.CharField(
        max_length=MAX_PROJECT_TITLE_LENGTH,
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )
    description = serializers.CharField(
        max_length=MAX_PROJECT_DESCRIPTION_LENGTH,
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )
    city = serializers.CharField(
        max_length=100,
        required=True,
    )
    volunteer_type = serializers.ChoiceField(
        choices=['individual', 'group'],
        required=True,
    )
    tags = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Project
        fields = ['title', 'description', 'city', 'volunteer_type', 'tags', 'start_date', 'end_date']

    def validate_title(self, value: str) -> str:
        """Валидация заголовка проекта"""
        cleaned_value = sanitize_html(value)
        
        if len(cleaned_value) < 5:
            raise serializers.ValidationError('Заголовок слишком короткий (минимум 5 символов)')
        
        # Проверка на спам
        spam_words = ['казино', 'кредит', 'займ', 'ставки']
        if any(word in cleaned_value.lower() for word in spam_words):
            raise serializers.ValidationError('Заголовок содержит недопустимые слова')
        
        return cleaned_value

    def validate_description(self, value: str) -> str:
        """Валидация описания проекта"""
        cleaned_value = sanitize_html(value)
        
        if len(cleaned_value) < MIN_PROJECT_DESCRIPTION_LENGTH:
            raise serializers.ValidationError(
                f'Описание слишком короткое (минимум {MIN_PROJECT_DESCRIPTION_LENGTH} символов)'
            )
        
        # Проверка на спам
        spam_words = ['казино', 'кредит', 'займ', 'ставки', 'casino']
        if any(word in cleaned_value.lower() for word in spam_words):
            raise serializers.ValidationError('Описание содержит недопустимые слова')
        
        return cleaned_value

    def validate(self, attrs):
        """Валидация на уровне объекта"""
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        if start_date and end_date:
            if end_date < start_date:
                raise serializers.ValidationError({
                    'end_date': 'Дата окончания не может быть раньше даты начала'
                })
        
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    """Сериализатор для создания и обновления задач"""
    title = serializers.CharField(
        max_length=MAX_TASK_TITLE_LENGTH,
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )
    description = serializers.CharField(
        max_length=5000,
        required=True,
        allow_blank=False,
    )

    class Meta:
        model = Task
        fields = ['title', 'description', 'max_volunteers', 'deadline']

    def validate_title(self, value: str) -> str:
        """Валидация заголовка задачи"""
        cleaned_value = sanitize_html(value)
        
        if len(cleaned_value) < 5:
            raise serializers.ValidationError('Заголовок слишком короткий (минимум 5 символов)')
        
        return cleaned_value

    def validate_description(self, value: str) -> str:
        """Валидация описания задачи"""
        cleaned_value = sanitize_html(value)
        
        if len(cleaned_value) < 20:
            raise serializers.ValidationError('Описание слишком короткое (минимум 20 символов)')
        
        return cleaned_value

    def validate_max_volunteers(self, value: Optional[int]) -> Optional[int]:
        """Валидация максимального количества волонтёров"""
        if value is not None and value < 1:
            raise serializers.ValidationError('Количество волонтёров должно быть больше 0')
        
        if value is not None and value > 1000:
            raise serializers.ValidationError('Слишком большое количество волонтёров (максимум 1000)')
        
        return value


class PhotoApprovalSerializer(serializers.Serializer):
    """Сериализатор для одобрения/отклонения фотоотчёта"""
    rating = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=MIN_RATING,
        max_value=MAX_RATING,
    )
    feedback = serializers.CharField(
        max_length=COMMENT_MAX_LENGTH,
        required=False,
        allow_blank=True,
    )
    action = serializers.ChoiceField(
        choices=['approve', 'reject'],
        required=True,
    )

    def validate_feedback(self, value: str) -> str:
        """Валидация комментария"""
        if value:
            return sanitize_html(value)
        return value

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore[override]
        """Валидация на уровне объекта"""
        action = attrs.get('action')
        rating = attrs.get('rating')
        
        # Если одобряем, рейтинг обязателен
        if action == 'approve' and not rating:
            raise serializers.ValidationError({
                'rating': 'Рейтинг обязателен при одобрении фотоотчёта'
            })
        
        # Если отклоняем, комментарий обязателен
        if action == 'reject' and not attrs.get('feedback'):
            raise serializers.ValidationError({
                'feedback': 'Комментарий обязателен при отклонении фотоотчёта'
            })
        
        return attrs


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Сериализатор для регистрации пользователя"""
    email = serializers.EmailField(required=True)
    password1 = serializers.CharField(write_only=True, required=True, min_length=8)
    password2 = serializers.CharField(write_only=True, required=True)
    full_name = serializers.CharField(max_length=255, required=True)
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False)
    role = serializers.ChoiceField(choices=['volunteer', 'organizer'], default='volunteer')

    class Meta:
        model = User
        fields = ['email', 'password1', 'password2', 'full_name', 'phone_number', 'city', 'role']

    def validate_email(self, value: str) -> str:
        """Валидация email"""
        if User.objects.filter(email=value).exists():  # type: ignore[attr-defined]
            raise serializers.ValidationError('Пользователь с таким email уже существует')
        return value.lower()

    def validate_password1(self, value: str) -> str:
        """Валидация пароля"""
        # Проверка сложности пароля
        if not any(char.isdigit() for char in value):
            raise serializers.ValidationError('Пароль должен содержать хотя бы одну цифру')
        
        if not any(char.isalpha() for char in value):
            raise serializers.ValidationError('Пароль должен содержать хотя бы одну букву')
        
        return value

    def validate_full_name(self, value: str) -> str:
        """Валидация имени"""
        cleaned_value = sanitize_html(value)
        
        if len(cleaned_value) < 2:
            raise serializers.ValidationError('Имя слишком короткое')
        
        return cleaned_value

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore[override]
        """Валидация на уровне объекта"""
        if attrs.get('password1') != attrs.get('password2'):
            raise serializers.ValidationError({
                'password2': 'Пароли не совпадают'
            })
        
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления профиля пользователя"""
    full_name = serializers.CharField(max_length=255, required=False)
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['full_name', 'phone_number', 'city', 'bio', 'avatar']

    def validate_full_name(self, value: Optional[str]) -> Optional[str]:
        """Валидация имени"""
        if value:
            return sanitize_html(value)
        return value

    def validate_bio(self, value: Optional[str]) -> Optional[str]:
        """Валидация биографии"""
        if value:
            return sanitize_html(value)
        return value

    def validate_avatar(self, value: Any) -> Any:
        """Валидация аватара"""
        if value:
            # Проверка размера файла (макс 2MB)
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError('Размер аватара не должен превышать 2 МБ')
            
            # Проверка расширения
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                raise serializers.ValidationError('Неподдерживаемый формат. Используйте JPG или PNG')
        
        return value

