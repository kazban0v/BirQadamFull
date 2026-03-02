# Generated migration to migrate data from TelegramLinkCode and EmailVerificationCode to VerificationCode

from django.db import migrations


def migrate_telegram_link_codes(apps, schema_editor):
    """Перенос данных из TelegramLinkCode в VerificationCode"""
    TelegramLinkCode = apps.get_model('api', 'TelegramLinkCode')
    VerificationCode = apps.get_model('api', 'VerificationCode')
    
    # Переносим все записи
    for old_code in TelegramLinkCode.objects.all():
        VerificationCode.objects.create(
            verification_type='telegram_link',
            code=old_code.code,
            user_id=old_code.user_id,
            email=None,
            created_at=old_code.created_at,
            expires_at=old_code.expires_at,
            is_used=old_code.is_used,
            used_at=old_code.used_at,
        )
    
    print(f"Перенесено {TelegramLinkCode.objects.count()} записей из TelegramLinkCode")


def migrate_email_verification_codes(apps, schema_editor):
    """Перенос данных из EmailVerificationCode в VerificationCode"""
    EmailVerificationCode = apps.get_model('api', 'EmailVerificationCode')
    VerificationCode = apps.get_model('api', 'VerificationCode')
    
    # Переносим все записи
    for old_code in EmailVerificationCode.objects.all():
        VerificationCode.objects.create(
            verification_type='email_verification',
            code=old_code.code,
            user_id=old_code.user_id,
            email=old_code.email,
            created_at=old_code.created_at,
            expires_at=old_code.expires_at,
            is_used=old_code.is_used,
            used_at=old_code.used_at,
        )
    
    print(f"Перенесено {EmailVerificationCode.objects.count()} записей из EmailVerificationCode")


def migrate_all_codes(apps, schema_editor):
    """Перенос всех кодов верификации"""
    migrate_telegram_link_codes(apps, schema_editor)
    migrate_email_verification_codes(apps, schema_editor)


def reverse_migrate_codes(apps, schema_editor):
    """Обратная миграция - не требуется, так как старые таблицы будут удалены"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0046_create_verification_code'),
    ]

    operations = [
        migrations.RunPython(migrate_all_codes, reverse_migrate_codes),
    ]



