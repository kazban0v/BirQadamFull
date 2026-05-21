from __future__ import annotations

from typing import Any
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.contrib.auth import get_user_model

from api.notifications.models import NotificationRecipient
from api.tasks.models import Photo, Task, TaskAssignment
from api.projects.models import VolunteerProject
from api.achievements.models import Achievement
from api.users.services.dashboard import get_volunteer_dashboard_data

User = get_user_model()


class VolunteerRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=32)
    # Email обязателен: иначе register_volunteer не сможет создать пользователя.
    email = serializers.EmailField(required=True, allow_blank=False)
    # Пароль опционален: если не задан — будет сгенерирован временный пароль.
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_password(self, value: str) -> str:
        if value:
            validate_password(value)
        return value


class OrganizerRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    organization_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=32)
    # Email обязателен: иначе register_organizer не сможет создать пользователя/заявку.
    email = serializers.EmailField(required=True, allow_blank=False)
    # Пароль опционален: если не задан — будет сгенерирован временный пароль.
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    website = serializers.URLField(required=False, allow_blank=True)
    contact_person = serializers.CharField(required=False, allow_blank=True, max_length=120)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_password(self, value: str) -> str:
        if value:
            validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)


class VolunteerProfileSerializer(serializers.ModelSerializer):
    trust_factor = serializers.IntegerField(read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    active_tasks = serializers.SerializerMethodField()
    tasks_completed = serializers.SerializerMethodField()
    total_hours = serializers.SerializerMethodField()
    active_projects = serializers.SerializerMethodField()
    total_photos = serializers.SerializerMethodField()
    achievements_count = serializers.SerializerMethodField()
    full_name = serializers.CharField(source='name', read_only=True)
    role = serializers.CharField(read_only=True)
    organizer_status = serializers.CharField(read_only=True)
    is_organizer = serializers.BooleanField(read_only=True)
    is_approved = serializers.BooleanField(read_only=True)
    organization_name = serializers.CharField(read_only=True, allow_null=True)
    
    _dashboard_cache = None

    def _get_dashboard_data(self, obj: User) -> dict:
        if self._dashboard_cache is None:
            self._dashboard_cache = get_volunteer_dashboard_data(obj)
        return self._dashboard_cache
    
    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'name',
            'full_name',
            'phone_number',
            'email',
            'avatar',
            'rating',
            'trust_factor',
            'average_rating',
            'active_tasks',
            'tasks_completed',
            'total_hours',
            'active_projects',
            'total_photos',
            'achievements_count',
            'role',
            'organizer_status',
            'is_organizer',
            'is_approved',
            'organization_name',
        )
        read_only_fields = ('id', 'username', 'rating', 'trust_factor', 'average_rating')

    def get_tasks_completed(self, obj: User) -> int:
        try:
            dashboard_data = self._get_dashboard_data(obj)
            return dashboard_data.get('summary', {}).get('active_tasks', 0)
        except Exception as e:
            return 0

    def get_active_tasks(self, obj: User) -> int:
        return self.get_tasks_completed(obj)

    def get_total_hours(self, obj: User) -> float:
        try:
            dashboard_data = self._get_dashboard_data(obj)
            return dashboard_data.get('summary', {}).get('total_hours', 0.0)
        except Exception as e:
            return 0.0

    def get_active_projects(self, obj: User) -> int:
        try:
            dashboard_data = self._get_dashboard_data(obj)
            return dashboard_data.get('summary', {}).get('active_projects', 0)
        except Exception:
            return 0

    def get_total_photos(self, obj: User) -> int:
        try:
            dashboard_data = self._get_dashboard_data(obj)
            return dashboard_data.get('summary', {}).get('total_photos', 0)
        except Exception:
            return 0

    def get_achievements_count(self, obj: User) -> int:
        try:
            dashboard_data = self._get_dashboard_data(obj)
            return dashboard_data.get('summary', {}).get('achievements_count', 0)
        except Exception:
            return 0

    def update(self, instance: User, validated_data: dict) -> User:
        update_fields = []
        if 'name' in validated_data:
            instance.name = validated_data['name']
            update_fields.append('name')
        if 'phone_number' in validated_data:
            instance.phone_number = validated_data['phone_number']
            update_fields.append('phone_number')
        if 'email' in validated_data:
            instance.email = validated_data['email']
            update_fields.append('email')
        if 'avatar' in validated_data:
            instance.avatar = validated_data['avatar']
            update_fields.append('avatar')
        if update_fields:
            instance.save(update_fields=update_fields)
        return instance


class VolunteerTaskSummarySerializer(serializers.ModelSerializer):
    task_id = serializers.IntegerField(source='id')
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_city = serializers.CharField(source='project.city', read_only=True)
    project_status = serializers.CharField(source='project.status', read_only=True)
    accepted = serializers.SerializerMethodField()
    completed = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    has_photo_report = serializers.SerializerMethodField()
    photo_status = serializers.SerializerMethodField()
    can_upload_photo = serializers.SerializerMethodField()
    
    # Новые поля для Expo приложения
    location = serializers.SerializerMethodField()
    start_date = serializers.DateField(read_only=True)
    end_date = serializers.DateField(source='deadline_date', read_only=True)
    accepted_at = serializers.SerializerMethodField()
    photo_uploaded_at = serializers.SerializerMethodField()
    creator_name = serializers.SerializerMethodField()
    creator_avatar = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    task_image_url = serializers.SerializerMethodField()
    project_cover_image_url = serializers.SerializerMethodField()
    
    # Маппинг для фронтенда (текст в заголовок и описание)
    title = serializers.CharField(source='text', read_only=True)
    description = serializers.CharField(source='text', read_only=True)

    class Meta:
        model = Task
        fields = (
            'id', 'task_id', 'text', 'status', 'deadline_date',
            'start_time', 'end_time', 'project_id', 'project_title',
            'project_city', 'project_status', 'accepted', 'completed',
            'is_expired', 'has_photo_report', 'photo_status', 'can_upload_photo',
            # Дополнительные поля
            'location', 'start_date', 'end_date', 'created_at',
            'accepted_at', 'photo_uploaded_at', 'creator_name', 'creator_avatar',
            'title', 'description', 'image', 'task_image_url', 'project_cover_image_url'
        )

    def _build_media_url(self, media_field) -> str | None:  # type: ignore[no-untyped-def]
        if not media_field:
            return None

        request = self.context.get('request')
        try:
            return request.build_absolute_uri(media_field.url) if request else media_field.url
        except Exception:
            return getattr(media_field, 'url', None)

    def get_accepted(self, obj) -> bool:
        user = self.context['request'].user
        assignment = TaskAssignment.objects.filter(task=obj, volunteer=user).first()
        return bool(assignment and assignment.accepted)

    def get_completed(self, obj) -> bool:
        user = self.context['request'].user
        assignment = TaskAssignment.objects.filter(task=obj, volunteer=user).first()
        return bool(assignment and assignment.completed)

    def get_is_expired(self, obj) -> bool:
        return obj.is_expired()

    def get_has_photo_report(self, obj) -> bool:
        user = self.context['request'].user
        return Photo.objects.filter(task=obj, volunteer=user, is_deleted=False).exists()

    def get_photo_status(self, obj) -> str | None:
        user = self.context['request'].user
        photo = Photo.objects.filter(task=obj, volunteer=user, is_deleted=False).order_by('-uploaded_at').first()
        return photo.status if photo else None

    def get_can_upload_photo(self, obj) -> bool:
        if obj.is_expired():
            return False

        if obj.status in ['completed', 'under_review', 'archived', 'failed', 'closed']:
            return False

        accepted = self.get_accepted(obj)
        photo_status = self.get_photo_status(obj)
        return accepted and (not self.get_has_photo_report(obj) or photo_status == 'rejected')

    def get_location(self, obj) -> str | None:
        if obj.project:
            return obj.project.address if obj.project.address else obj.project.city
        return None

    def get_accepted_at(self, obj) -> Any:
        user = self.context['request'].user
        assignment = TaskAssignment.objects.filter(task=obj, volunteer=user).first()
        return assignment.accepted_at if assignment else None

    def get_photo_uploaded_at(self, obj) -> Any:
        user = self.context['request'].user
        photo = Photo.objects.filter(task=obj, volunteer=user, is_deleted=False).order_by('-uploaded_at').first()
        return photo.uploaded_at if photo else None

    def get_creator_name(self, obj) -> str | None:
        if obj.creator:
            return obj.creator.name or obj.creator.username
        return None

    def get_creator_avatar(self, obj) -> str | None:
        if obj.creator and obj.creator.avatar:
            return self._build_media_url(obj.creator.avatar)
        return None

    def get_task_image_url(self, obj) -> str | None:
        return self._build_media_url(getattr(obj, 'task_image', None))

    def get_project_cover_image_url(self, obj) -> str | None:
        project = getattr(obj, 'project', None)
        return self._build_media_url(getattr(project, 'cover_image', None))

    def get_image(self, obj) -> str | None:
        return self.get_task_image_url(obj) or self.get_project_cover_image_url(obj)

    def get_status(self, obj) -> str:
        # Если дедлайн прошел и задача не завершена/закрыта
        if obj.is_expired() and obj.status not in ['completed', 'failed', 'closed', 'archived', 'revision']:
            return 'expired'
            
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            assignment = TaskAssignment.objects.filter(task=obj, volunteer=request.user).first()
            if assignment:
                # Если волонтер явно отклонил задачу — для него она в архиве
                if assignment.accepted is False:
                    return 'archived'
                # Если волонтер принял задачу — для него она "в работе"
                if assignment.accepted is True and obj.status in ['open', 'pending']:
                    return 'in_progress'
        
        return obj.status


class VolunteerProjectSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source='project.id')
    title = serializers.CharField(source='project.title')
    city = serializers.CharField(source='project.city', allow_null=True)
    status = serializers.CharField(source='project.status')
    volunteer_type = serializers.CharField(source='project.volunteer_type')
    start_date = serializers.DateField(source='project.start_date', allow_null=True)
    end_date = serializers.DateField(source='project.end_date', allow_null=True)
    organizer_name = serializers.SerializerMethodField()
    active_members = serializers.SerializerMethodField()

    class Meta:
        model = VolunteerProject
        fields = (
            'id',
            'project_id',
            'title',
            'city',
            'status',
            'volunteer_type',
            'start_date',
            'end_date',
            'joined_at',
            'organizer_name',
            'active_members',
        )

    def get_organizer_name(self, obj: VolunteerProject) -> str:
        creator = getattr(obj.project, 'creator', None)
        if not creator:
            return ''
        return creator.name or creator.username

    def get_active_members(self, obj: VolunteerProject) -> int:
        annotated_value = getattr(obj, 'active_members', None)
        if annotated_value is not None:
            return annotated_value
        return obj.project.volunteer_projects.filter(is_active=True).count()


class VolunteerPhotoSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source='project.id')
    project_title = serializers.CharField(source='project.title')
    task_id = serializers.IntegerField(source='task.id', allow_null=True)
    task_text = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = (
            'id',
            'project_id',
            'project_title',
            'task_id',
            'task_text',
            'status',
            'image',
            'image_url',
            'uploaded_at',
            'moderated_at',
            'rating',
            'volunteer_comment',
            'organizer_comment',
            'rejection_reason',
        )

    def get_image_url(self, obj: Photo) -> str | None:
        request = self.context.get('request') if hasattr(self, 'context') else None
        if obj.image:
            if request:
                # photo.image.url уже возвращает путь вида /media/photos/..., так что просто используем его
                url = request.build_absolute_uri(obj.image.url)
                # Заменяем http на https только для production (не для localhost)
                if url.startswith('http://') and 'localhost' not in url and '127.0.0.1' not in url:
                    url = url.replace('http://', 'https://')
                return url
            return obj.image.url
        return None

    def get_task_text(self, obj: Photo) -> str | None:
        if obj.task:
            return obj.task.text
        return None


class VolunteerNotificationSerializer(serializers.ModelSerializer):
    subject = serializers.CharField(source='notification.subject')
    message = serializers.CharField(source='notification.message')
    notification_type = serializers.CharField(source='notification.notification_type')
    sent_at = serializers.DateTimeField(allow_null=True)
    delivered_at = serializers.DateTimeField(allow_null=True)
    opened_at = serializers.DateTimeField(allow_null=True)

    class Meta:
        model = NotificationRecipient
        fields = (
            'id',
            'subject',
            'message',
            'notification_type',
            'status',
            'sent_at',
            'delivered_at',
            'opened_at',
            'created_at',
        )


class VolunteerAchievementSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    icon = serializers.CharField()
    required_rating = serializers.IntegerField()
    xp = serializers.IntegerField()
    unlocked = serializers.BooleanField()
    unlocked_at = serializers.DateTimeField(allow_null=True)


class VolunteerStatsSerializer(serializers.Serializer):
    rating = serializers.IntegerField()
    level = serializers.IntegerField()
    previous_level_rating = serializers.IntegerField()
    next_level_rating = serializers.IntegerField()
    progress = serializers.FloatField()
    unlocked_achievements = serializers.IntegerField()
    total_achievements = serializers.IntegerField()
    achievements = VolunteerAchievementSerializer(many=True, required=False, allow_null=True)
    
    def to_representation(self, instance):
        """Переопределяем для гарантии, что achievements всегда список"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f'to_representation called with instance type: {type(instance)}')
        logger.info(f'Instance achievements count: {len(instance.get("achievements", [])) if isinstance(instance, dict) else 0}')
        
        try:
            data = super().to_representation(instance)
            logger.info(f'After super().to_representation, achievements count: {len(data.get("achievements", []))}')
        except Exception as e:
            # Если сериализация не удалась, возвращаем данные напрямую
            logger.error(f'Error in to_representation: {e}')
            import traceback
            logger.error(traceback.format_exc())
            data = dict(instance) if isinstance(instance, dict) else {}
        
        if 'achievements' not in data or data['achievements'] is None:
            logger.warning('Achievements missing or None in serialized data, setting to empty list')
            data['achievements'] = []
        else:
            logger.info(f'Final achievements count in data: {len(data.get("achievements", []))}')
        
        return data


class VolunteerActivitySeriesSerializer(serializers.Serializer):
    months = serializers.ListField(child=serializers.CharField())
    series = serializers.DictField(child=serializers.ListField(child=serializers.IntegerField()))
    totals = serializers.DictField(child=serializers.IntegerField())


class VolunteerProjectCatalogSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    city = serializers.CharField(allow_null=True)
    volunteer_type = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    status = serializers.CharField()
    joined = serializers.BooleanField()
    active_members = serializers.IntegerField()
    tasks_count = serializers.IntegerField()
    organizer_name = serializers.CharField()
    joined_at = serializers.DateTimeField(allow_null=True)
    address = serializers.CharField(allow_null=True, allow_blank=True)
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)
    contact_person = serializers.CharField(allow_null=True, allow_blank=True)
    contact_phone = serializers.CharField(allow_null=True, allow_blank=True)
    contact_email = serializers.EmailField(allow_null=True, allow_blank=True)
    contact_telegram = serializers.CharField(allow_null=True, allow_blank=True)
    info_url = serializers.URLField(allow_null=True, allow_blank=True)
    gis2_url = serializers.URLField(allow_null=True, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    cover_image_url = serializers.URLField(allow_null=True, allow_blank=True, read_only=True)
    created_at = serializers.DateTimeField(allow_null=True)


from api.support.models import Block, Report

class BlockSerializer(serializers.ModelSerializer):
    blocked_user_id = serializers.IntegerField(source='blocked.id', read_only=True)
    blocked_username = serializers.CharField(source='blocked.username', read_only=True)
    blocked_name = serializers.CharField(source='blocked.name', read_only=True)
    
    class Meta:
        model = Block
        fields = ['id', 'blocked_user_id', 'blocked_username', 'blocked_name', 'created_at']


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'reported_user', 'content_type', 'content_id', 'reason', 'details', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

