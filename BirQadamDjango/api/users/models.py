"""
Users domain models
Модели домена пользователей
"""
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
import logging
from typing import Any

logger = logging.getLogger(__name__)


class User(AbstractUser):
    """Модель пользователя"""
    
    telegram_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        null=True,
        validators=[RegexValidator(regex=r'^\+?\d{10,15}$', message="Номер телефона должен быть в формате: '+1234567890'.")]
    )
    organization_name = models.CharField(max_length=255, blank=True, null=True)
    rating = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(750)])
    is_organizer = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)
    name = models.CharField(max_length=100, blank=True, null=True, default='')
    role = models.CharField(
        max_length=20,
        choices=(('volunteer', 'Волонтёр'), ('organizer', 'Организатор')),
        default='volunteer',
        blank=True,
        null=True
    )
    is_approved = models.BooleanField(default=False)
    
    ORGANIZER_STATUS_CHOICES = (
        ('pending', 'Ожидает'),
        ('approved', 'Одобрен'),
        ('rejected', 'Отклонен'),
    )
    organizer_status = models.CharField(
        max_length=10,
        choices=ORGANIZER_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    REGISTRATION_SOURCE_CHOICES = (
        ('mobile_app', 'Mobile App'),
        ('telegram_bot', 'Telegram Bot'),
        ('telegram', 'Telegram (legacy)'),
        ('web_portal', 'Web Portal'),
        ('both', 'Mobile + Telegram'),
    )
    registration_source = models.CharField(
        max_length=20,
        choices=REGISTRATION_SOURCE_CHOICES,
        default='mobile_app',
        blank=True,
        null=True
    )
    
    # Портфолио организатора
    age = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(18), MaxValueValidator(100)], verbose_name='Возраст')
    GENDER_CHOICES = (
        ('male', 'Мужской'),
        ('female', 'Женский'),
        ('other', 'Другое'),
    )
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True, verbose_name='Пол')
    bio = models.TextField(blank=True, null=True, verbose_name='О себе')
    work_experience_years = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)], verbose_name='Стаж работы (лет)')
    work_history = models.TextField(blank=True, null=True, verbose_name='Опыт работы')
    portfolio_photo = models.ImageField(upload_to='portfolio_photos/', null=True, blank=True, verbose_name='Фото 3х4')
    
    # TrustFactor система
    trust_factor = models.IntegerField(default=20, validators=[MinValueValidator(0), MaxValueValidator(30)], verbose_name='Trust Factor', db_index=True)
    average_rating = models.FloatField(default=5.0, validators=[MinValueValidator(0), MaxValueValidator(5)], verbose_name='Средний рейтинг')
    initial_rating_counted = models.BooleanField(default=True, verbose_name='Начальный рейтинг учтен')
    consecutive_completed_tasks = models.IntegerField(default=0, verbose_name='Подряд выполненных заданий')
    consecutive_5star_photos = models.IntegerField(default=0, verbose_name='Подряд фотоотчетов на 5 звезд')
    last_task_completion_date = models.DateTimeField(null=True, blank=True, verbose_name='Дата последнего выполненного задания')

    def update_rating(self, points: int) -> None:
        old_rating = self.rating
        self.rating = max(0, min(750, self.rating + points))
        self.save()

        # Проверяем и разблокируем новые достижения
        if self.rating > old_rating:
            self.check_and_unlock_achievements()

    def check_and_unlock_achievements(self) -> None:
        """Проверить и разблокировать достижения на основе рейтинга"""
        # Lazy import для избежания циклических зависимостей
        from api.achievements.models import Achievement, UserAchievement
        from api.users.models import Activity
        
        available_achievements = Achievement.objects.filter(
            required_rating__lte=self.rating
        ).exclude(
            user_achievements__user=self
        )

        for achievement in available_achievements:
            UserAchievement.objects.create(
                user=self,
                achievement=achievement
            )

            Activity.objects.create(
                user=self,
                type='achievement_unlocked',
                title=f'Разблокировано достижение: {achievement.name}',
                description=f'Поздравляем! Вы получили достижение "{achievement.name}" за достижение {achievement.required_rating} рейтинга!'
            )

            logger.info(f"User {self.username} unlocked achievement: {achievement.name}")

    def _change_trust_factor(self, change_amount: int, reason: str, related_object_type: str = '', related_object_id: int = 0) -> int:
        """Изменить TrustFactor и сохранить историю изменений"""
        old_tf = self.trust_factor
        new_tf = max(0, min(30, self.trust_factor + change_amount))
        
        if old_tf != new_tf:
            self.trust_factor = new_tf
            self.save(update_fields=['trust_factor'])
            
            TrustFactorHistory.objects.create(
                user=self,
                change_amount=change_amount,
                reason=reason,
                related_object_type=related_object_type,
                related_object_id=related_object_id,
                old_value=old_tf,
                new_value=new_tf
            )
            
            logger.info(f"User {self.username} TF changed: {old_tf} -> {new_tf} ({change_amount:+d}), reason: {reason}")
        
        return new_tf
    
    def update_trust_factor(self, change_amount: int, reason: str, related_object_type: str | None = None, related_object_id: int | None = None) -> None:
        """Обновить TrustFactor и сохранить историю изменений"""
        self._change_trust_factor(
            change_amount,
            reason,
            related_object_type or '',
            related_object_id or 0
        )

    def update_average_rating(self, new_rating: int | None = None) -> None:
        """Обновить средний рейтинг на основе всех оценок фотоотчетов"""
        # Lazy import для Photo
        from api.tasks.models import Photo
        
        ratings = list(self.photos.filter(
            rating__isnull=False,
            is_deleted=False
        ).values_list('rating', flat=True))
        
        logger.info(f"User {self.username} update_average_rating: found {len(ratings)} ratings in DB: {ratings}")
        
        if self.initial_rating_counted:
            ratings = [5.0] + [float(r) for r in ratings]
        else:
            ratings = [float(r) for r in ratings]
        
        if new_rating is not None:
            new_rating_float = float(new_rating)
            if new_rating_float not in ratings:
                ratings.append(new_rating_float)
                logger.info(f"User {self.username} update_average_rating: added new rating {new_rating} to list")
        
        if ratings:
            new_avg = sum(ratings) / len(ratings)
            self.average_rating = new_avg
            self.save(update_fields=['average_rating'])
            logger.info(f"User {self.username} average rating updated: {self.average_rating:.2f} (based on {len(ratings)} ratings: {ratings})")
        else:
            self.average_rating = 5.0
            self.save(update_fields=['average_rating'])
            logger.warning(f"User {self.username} update_average_rating: no ratings found, keeping 5.0")

    def add_zero_rating_for_missed_task(self) -> None:
        """Добавить 0 к рейтингу за пропущенное задание"""
        # Lazy import для Photo
        from api.tasks.models import Photo
        
        ratings = list(self.photos.filter(
            rating__isnull=False,
            is_deleted=False
        ).values_list('rating', flat=True))
        
        if self.initial_rating_counted:
            ratings = [5.0] + [float(r) for r in ratings]
        else:
            ratings = [float(r) for r in ratings]
        
        ratings.append(0.0)
        
        if ratings:
            self.average_rating = sum(ratings) / len(ratings)
            self.save(update_fields=['average_rating'])
            logger.info(f"User {self.username} average rating updated with 0: {self.average_rating:.2f}")

    def check_and_apply_bonuses(self) -> None:
        """Проверить и применить бонусы за серии выполненных заданий"""
        if self.consecutive_completed_tasks >= 5:
            self._change_trust_factor(1, 'bonus_consecutive_tasks', 'bonus', 0)
            self.consecutive_completed_tasks = 0
            self.save(update_fields=['consecutive_completed_tasks'])
        
        if self.consecutive_5star_photos >= 3:
            self._change_trust_factor(1, 'bonus_consecutive_photos', 'bonus', 0)
            self.consecutive_5star_photos = 0
            self.save(update_fields=['consecutive_5star_photos'])

    def can_join_projects(self) -> bool:
        """Проверить, может ли волонтер присоединяться к проектам"""
        return self.trust_factor > 0

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.phone_number:
            from api.utils.utils import normalize_phone
            self.phone_number = normalize_phone(self.phone_number)
        
        if self.role == 'organizer' and self.is_approved:
            self.is_organizer = True
        else:
            self.is_organizer = False

        should_check_achievements = False
        if self.pk:
            try:
                old_instance = User.objects.filter(pk=self.pk).first()
                if old_instance and old_instance.rating != self.rating:
                    should_check_achievements = True
                    logger.info(f"User {self.username} rating changed: {old_instance.rating} -> {self.rating}")
            except Exception as e:
                logger.error(f"Error checking rating change: {e}")

        super().save(*args, **kwargs)

        if should_check_achievements:
            logger.info(f"Triggering achievement check for {self.username}")
            self.check_and_unlock_achievements()

    def __str__(self) -> str:
        role_display = 'Admin' if self.is_admin else ('Organizer' if self.role == 'organizer' else 'Volunteer')
        return f"{self.username} (ID: {self.telegram_id}, Role: {role_display})"

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['-rating', 'username']
        indexes = [
            models.Index(fields=['role', 'is_approved'], name='user_role_approved_idx'),
            models.Index(fields=['is_organizer'], name='user_is_organizer_idx'),
            models.Index(fields=['organizer_status', 'date_joined'], name='user_org_status_joined_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__gte=0) & models.Q(rating__lte=750),
                name='user_rating_range'
            ),
            models.CheckConstraint(
                check=models.Q(trust_factor__gte=0) & models.Q(trust_factor__lte=30),
                name='user_trust_factor_range'
            ),
            models.CheckConstraint(
                check=models.Q(average_rating__gte=0) & models.Q(average_rating__lte=5),
                name='user_average_rating_range'
            ),
        ]


class TrustFactorHistory(models.Model):
    """История изменений TrustFactor"""
    REASON_CHOICES = (
        ('project_leave', 'Выход из проекта'),
        ('task_decline', 'Отклонение задачи'),
        ('photo_rating_5', 'Оценка фотоотчета: 5 звезд'),
        ('photo_rating_4', 'Оценка фотоотчета: 4 звезды'),
        ('photo_rating_3', 'Оценка фотоотчета: 3 звезды'),
        ('photo_rating_1_2', 'Оценка фотоотчета: 1-2 звезды'),
        ('photo_rejected', 'Отклонение фотоотчета организатором'),
        ('daily_penalty', 'Штраф за пропуск задания'),
        ('bonus_consecutive_tasks', 'Бонус: 5 заданий подряд'),
        ('bonus_consecutive_photos', 'Бонус: 3 фотоотчета на 5 звезд'),
        ('manual', 'Ручное изменение'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trust_factor_history')
    change_amount = models.IntegerField(verbose_name='Изменение TF')
    reason = models.CharField(max_length=100, choices=REASON_CHOICES, verbose_name='Причина')
    related_object_type = models.CharField(max_length=50, blank=True, default='', verbose_name='Тип объекта')
    related_object_id = models.IntegerField(default=0, verbose_name='ID объекта')
    old_value = models.IntegerField(verbose_name='Старое значение TF')
    new_value = models.IntegerField(verbose_name='Новое значение TF')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Дата изменения')
    
    class Meta:
        verbose_name = 'История TrustFactor'
        verbose_name_plural = 'История TrustFactor'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='tf_history_user_created_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.user.username}: {self.old_value} -> {self.new_value} ({self.change_amount:+d}) - {self.get_reason_display()}"


class OrganizerApplication(models.Model):
    """Заявка на роль организатора"""
    STATUS_CHOICES = (
        ('pending', 'Ожидает'),
        ('approved', 'Одобрено'),
        ('rejected', 'Отклонено'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='organizer_application')
    organization_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.organization_name} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Заявка организатора'
        verbose_name_plural = 'Заявки организаторов'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'], name='org_app_status_idx'),
            models.Index(fields=['created_at'], name='org_app_created_idx'),
        ]


class Activity(models.Model):
    """Модель для отслеживания активности волонтеров"""
    ACTIVITY_TYPE_CHOICES = (
        ('project_joined', 'Присоединился к проекту'),
        ('project_left', 'Покинул проект'),
        ('task_assigned', 'Новое задание'),
        ('task_completed', 'Задача выполнена'),
        ('photo_uploaded', 'Фото загружено'),
        ('achievement_unlocked', 'Достижение разблокировано'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    # Lazy import для Project
    project = models.ForeignKey('api.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Активность'
        verbose_name_plural = 'Активности'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='activity_user_created_idx'),
            models.Index(fields=['type', 'created_at'], name='activity_type_created_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.get_type_display()} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class VerificationCode(models.Model):
    """Универсальная модель для кодов верификации (Telegram и Email)"""
    VERIFICATION_TYPE_CHOICES = (
        ('telegram_link', 'Привязка Telegram'),
        ('email_verification', 'Подтверждение Email'),
    )
    
    verification_type = models.CharField(
        max_length=20,
        choices=VERIFICATION_TYPE_CHOICES,
        db_index=True,
        verbose_name='Тип верификации'
    )
    code = models.CharField(max_length=6, db_index=True, verbose_name='Код')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_codes', verbose_name='Пользователь')
    email = models.EmailField(null=True, blank=True, db_index=True, verbose_name='Email', help_text='Только для email_verification')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    expires_at = models.DateTimeField(db_index=True, verbose_name='Истекает')
    is_used = models.BooleanField(default=False, db_index=True, verbose_name='Использован')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Использован в')
    
    class Meta:
        verbose_name = 'Код верификации'
        verbose_name_plural = 'Коды верификации'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['verification_type', 'code', 'is_used'], name='verify_type_code_used_idx'),
            models.Index(fields=['user', 'verification_type', 'is_used'], name='verify_user_type_used_idx'),
            models.Index(fields=['email', 'is_used'], name='verify_email_used_idx'),
            models.Index(fields=['expires_at'], name='verify_expires_idx'),
        ]
    
    def __str__(self) -> str:
        type_display = 'Telegram' if self.verification_type == 'telegram_link' else 'Email'
        identifier = self.email if self.email else self.user.username
        return f"{type_display} code {self.code} for {identifier} ({'used' if self.is_used else 'active'})"
    
    def is_expired(self) -> bool:
        """Проверка, истек ли код"""
        return timezone.now() > self.expires_at
    
    def is_valid(self) -> bool:
        """Проверка, действителен ли код"""
        return not self.is_used and not self.is_expired()
    
    def clean(self) -> None:
        """Валидация модели"""
        from django.core.exceptions import ValidationError
        
        # Для email_verification обязательно должен быть email
        if self.verification_type == 'email_verification' and not self.email:
            raise ValidationError({'email': 'Email обязателен для типа email_verification'})
        
        # Для telegram_link email не нужен
        if self.verification_type == 'telegram_link' and self.email:
            raise ValidationError({'email': 'Email не должен быть указан для типа telegram_link'})
        
        # Для telegram_link код должен быть уникальным среди неиспользованных
        if self.verification_type == 'telegram_link' and not self.is_used:
            existing = VerificationCode.objects.filter(
                code=self.code,
                verification_type='telegram_link',
                is_used=False
            ).exclude(pk=self.pk if self.pk else None)
            if existing.exists():
                raise ValidationError({'code': 'Этот код уже используется для привязки Telegram'})
    
    def save(self, *args: Any, **kwargs: Any) -> None:
        """Переопределяем save для валидации"""
        self.full_clean()
        super().save(*args, **kwargs)


class TelegramLinkCode(models.Model):
    """Временные коды для привязки Telegram аккаунта к веб-порталу
    
    DEPRECATED: Используйте VerificationCode с verification_type='telegram_link'
    Будет удалено в будущих версиях.
    """
    code = models.CharField(max_length=6, unique=True, db_index=True, verbose_name='Код')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_link_codes', verbose_name='Пользователь')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    expires_at = models.DateTimeField(db_index=True, verbose_name='Истекает')
    is_used = models.BooleanField(default=False, db_index=True, verbose_name='Использован')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Использован в')
    
    class Meta:
        verbose_name = 'Код привязки Telegram'
        verbose_name_plural = 'Коды привязки Telegram'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['code', 'is_used'], name='tg_link_code_code_used_idx'),
            models.Index(fields=['user', 'is_used'], name='tg_link_code_user_used_idx'),
            models.Index(fields=['expires_at'], name='tg_link_code_expires_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Code {self.code} for user {self.user.username} ({'used' if self.is_used else 'active'})"
    
    def is_expired(self) -> bool:
        """Проверка, истек ли код"""
        return timezone.now() > self.expires_at
    
    def is_valid(self) -> bool:
        """Проверка, действителен ли код"""
        return not self.is_used and not self.is_expired()


class EmailVerificationCode(models.Model):
    """Коды подтверждения email при регистрации
    
    DEPRECATED: Используйте VerificationCode с verification_type='email_verification'
    Будет удалено в будущих версиях.
    """
    code = models.CharField(max_length=6, db_index=True, verbose_name='Код')
    email = models.EmailField(db_index=True, verbose_name='Email')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verification_codes', verbose_name='Пользователь')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    expires_at = models.DateTimeField(db_index=True, verbose_name='Истекает')
    is_used = models.BooleanField(default=False, db_index=True, verbose_name='Использован')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Использован в')
    
    class Meta:
        verbose_name = 'Код подтверждения email'
        verbose_name_plural = 'Коды подтверждения email'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'is_used'], name='email_verify_email_used_idx'),
            models.Index(fields=['user', 'is_used'], name='email_verify_user_used_idx'),
            models.Index(fields=['expires_at'], name='email_verify_expires_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Code {self.code} for {self.email} ({'used' if self.is_used else 'active'})"
    
    def is_expired(self) -> bool:
        """Проверка, истек ли код"""
        return timezone.now() > self.expires_at
    
    def is_valid(self) -> bool:
        """Проверка, действителен ли код"""
        return not self.is_used and not self.is_expired()

