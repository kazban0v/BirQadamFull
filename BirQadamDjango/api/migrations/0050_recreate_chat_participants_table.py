# Generated manually to fix missing api_chat_participants table

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0049_remove_unused_tables'),
    ]

    operations = [
        # Drop and recreate the many-to-many table
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS api_chat_participants CASCADE;',
            reverse_sql='',
        ),
        migrations.RunSQL(
            sql='''
                CREATE TABLE api_chat_participants (
                    id BIGSERIAL PRIMARY KEY,
                    chat_id BIGINT NOT NULL REFERENCES api_chat(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
                    user_id BIGINT NOT NULL REFERENCES api_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
                    UNIQUE (chat_id, user_id)
                );
                CREATE INDEX api_chat_participants_chat_id_idx ON api_chat_participants(chat_id);
                CREATE INDEX api_chat_participants_user_id_idx ON api_chat_participants(user_id);
            ''',
            reverse_sql='DROP TABLE IF EXISTS api_chat_participants CASCADE;',
        ),
    ]















