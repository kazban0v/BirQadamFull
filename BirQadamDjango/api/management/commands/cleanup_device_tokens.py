"""
Management команда для очистки старых/неактивных FCM токенов

Использование:
    python manage.py cleanup_device_tokens

Рекомендуется запускать еженедельно через cron:
    0 0 * * 0 cd /path/to/project && python manage.py cleanup_device_tokens
"""
from typing import Any
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import DeviceToken
from argparse import ArgumentParser
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Удаляет старые/неактивные device tokens (не использовались > 90 дней)'

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Количество дней неактивности (по умолчанию: 90)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Показать токены для удаления без фактического удаления'
        )

    def handle(self, *args: Any, **options: Any) -> None:
        days = options['days']
        dry_run = options['dry_run']
        
        threshold = timezone.now() - timedelta(days=days)
        
        self.stdout.write(f'🔍 Поиск токенов неактивных более {days} дней...')
        self.stdout.write(f'📅 Дата порога: {threshold}')
        
        # Находим старые токены
        old_tokens = DeviceToken.objects.filter(last_used_at__lt=threshold)
        count = old_tokens.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('✅ Старых токенов не найдено'))
            return
        
        self.stdout.write(f'📊 Найдено токенов для удаления: {count}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('⚠️ DRY RUN режим - токены не будут удалены'))
            for token in old_tokens[:10]:  # Показываем первые 10
                self.stdout.write(
                    f'  - User: {token.user.username}, '
                    f'Last used: {token.last_used_at}, '
                    f'Created: {token.created_at}'
                )
            if count > 10:
                self.stdout.write(f'  ... и еще {count - 10} токенов')
        else:
            # Удаляем токены
            deleted_count, _ = old_tokens.delete()
            self.stdout.write(
                self.style.SUCCESS(f'✅ Удалено {deleted_count} старых токенов')
            )
            logger.info(f'Cleanup: Deleted {deleted_count} old device tokens (>{days} days)')


