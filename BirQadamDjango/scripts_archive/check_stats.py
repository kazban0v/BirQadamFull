import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.tasks.models import TaskAssignment

def check_stats():
    volunteers = User.objects.filter(role='volunteer')
    print(f"Total volunteers: {volunteers.count()}")
    for v in volunteers:
        completed = TaskAssignment.objects.filter(volunteer=v, completed=True).count()
        print(f"User: {v.username}, Rating: {v.rating}, Completed Tasks: {completed}")

if __name__ == "__main__":
    check_stats()
