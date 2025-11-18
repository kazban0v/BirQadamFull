from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.contrib.auth import get_user_model

from core.models import NotificationRecipient, Photo, VolunteerProject, Achievement

User = get_user_model()


class VolunteerRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_password(self, value: str) -> str:
        if value:
            validate_password(value)
        return value


class OrganizerRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    organization_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
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
    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'name',
            'phone_number',
            'email',
        )
        read_only_fields = ('id', 'username')

    def update(self, instance: User, validated_data: dict) -> User:
        instance.name = validated_data.get('name', instance.name)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.email = validated_data.get('email', instance.email)
        instance.save(update_fields=['name', 'phone_number', 'email'])
        return instance


class VolunteerTaskSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(source='task_id')
    task_id = serializers.IntegerField()
    text = serializers.CharField()
    status = serializers.CharField()
    deadline_date = serializers.DateField(allow_null=True)
    start_time = serializers.TimeField(allow_null=True)
    end_time = serializers.TimeField(allow_null=True)
    project_id = serializers.IntegerField()
    project_title = serializers.CharField()
    project_city = serializers.CharField(allow_null=True)
    project_status = serializers.CharField()
    accepted = serializers.BooleanField()
    completed = serializers.BooleanField()
    is_expired = serializers.BooleanField()
    has_photo_report = serializers.BooleanField()
    photo_status = serializers.CharField(allow_null=True)
    can_upload_photo = serializers.BooleanField()


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
                return request.build_absolute_uri(obj.image.url)
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
    achievements = VolunteerAchievementSerializer(many=True)


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

