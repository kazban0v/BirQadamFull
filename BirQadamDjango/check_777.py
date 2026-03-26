import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.tasks.models import TaskAssignment

def check_user_777():
    username = '77708545810'
    try:
        user = User.objects.get(username=username)
        completed = TaskAssignment.objects.filter(volunteer=user, completed=True).count()
        all_assignments = TaskAssignment.objects.filter(volunteer=user).count()
        print(f"User: {user.username}, Rating: {user.rating}, Completed: {completed}, Total Assignments: {all_assignments}")
        
        # Проверим статусы всех заданий
        assignments = TaskAssignment.objects.filter(volunteer=user)
        for a in assignments:
            print(f"  - Task: {a.task.title}, Status: {getattr(a, 'status', 'N/A')}, Completed: {a.completed}")

    except User.DoesNotExist:
        print(f"User {username} not found.")

if __name__ == "__main__":
    check_user_777()
