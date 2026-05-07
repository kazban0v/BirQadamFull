import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.users.services.dashboard import get_volunteer_dashboard_data

def check_dashboard_result():
    username = '77708545810'
    try:
        user = User.objects.get(username=username)
        data = get_volunteer_dashboard_data(user)
        summary = data.get('summary', {})
        print(f"DEBUG Dashboard for {username}:")
        print(f"  Summary: {summary}")
        
    except User.DoesNotExist:
        print(f"ERROR: User {username} not found.")

if __name__ == "__main__":
    check_dashboard_result()
