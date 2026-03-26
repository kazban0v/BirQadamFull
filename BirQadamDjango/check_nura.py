import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.tasks.models import TaskAssignment

def check_assignments():
    user = User.objects.get(username='nura')
    assignments = TaskAssignment.objects.filter(volunteer=user)
    print(f"Assignments for {user.username}: {assignments.count()}")
    for a in assignments:
        print(f"Task: {a.task.title}, Completed: {a.completed}")

if __name__ == "__main__":
    check_assignments()
