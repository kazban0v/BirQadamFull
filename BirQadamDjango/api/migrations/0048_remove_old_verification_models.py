# Generated migration to remove old verification models

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0047_migrate_verification_codes'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TelegramLinkCode',
        ),
        migrations.DeleteModel(
            name='EmailVerificationCode',
        ),
    ]



