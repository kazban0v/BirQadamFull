import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User, Activity
from api.projects.models import VolunteerProject
from api.tasks.models import TaskAssignment, Photo

def deep_check_user():
    username = '77708545810'
    try:
        user = User.objects.get(username=username)
        print(f"DEBUG: User found - ID: {user.id}, Username: {user.username}, Rating: {user.rating}, Trust: {user.trust_factor}")
        
        projects = VolunteerProject.objects.filter(volunteer=user)
        print(f"DEBUG: Joined Projects: {projects.count()}")
        for p in projects:
            print(f"  - Project: {p.project.title}, Joined: {p.joined_at}, Active: {p.is_active}")
            
        assignments = TaskAssignment.objects.filter(volunteer=user)
        print(f"DEBUG: Task Assignments: {assignments.count()}")
        for a in assignments:
            print(f"  - Task ID: {a.task_id}, Accepted: {a.accepted}, Completed: {a.completed}")
            
        photos = Photo.objects.filter(volunteer=user)
        print(f"DEBUG: Photo Reports: {photos.count()}")
        for ph in photos:
            print(f"  - Photo ID: {ph.id}, Status: {ph.status}, Rating: {ph.rating}")
            
        activities = Activity.objects.filter(user=user).order_by('-created_at')[:5]
        print(f"DEBUG: Recent Activities: {activities.count()}")
        for act in activities:
            print(f"  - Activity: {act.type}, Title: {act.title}, Date: {act.created_at}")

    except User.DoesNotExist:
        print(f"ERROR: User {username} not found.")

if __name__ == "__main__":
    deep_check_user()
