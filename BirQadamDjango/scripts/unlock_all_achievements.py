import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
django.setup()

from core.models import User, UserAchievement

users = User.objects.all()
print(f'Processing {users.count()} users...')

count = 0
for user in users:
    before = UserAchievement.objects.filter(user=user).count()
    user.check_and_unlock_achievements()
    after = UserAchievement.objects.filter(user=user).count()

    if after > before:
        count += 1
        print(f'  {user.username}: unlocked {after - before} new achievements (rating: {user.rating})')

print(f'\nDone! Updated {count} users')
