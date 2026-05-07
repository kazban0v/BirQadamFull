import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.tasks.models import TaskAssignment

def find_active_volunteer():
    volunteers = User.objects.filter(role='volunteer')
    for v in volunteers:
        completed = TaskAssignment.objects.filter(volunteer=v, completed=True).count()
        if v.rating > 0 or completed > 0:
            print(f"FOUND: User: {v.username}, Rating: {v.rating}, Completed: {completed}")
    
    if not volunteers.exists():
        print("No volunteers found.")

if __name__ == "__main__":
    find_active_volunteer()
