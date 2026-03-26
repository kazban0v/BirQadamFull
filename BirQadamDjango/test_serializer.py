import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from api.users.models import User
from api.serializers import VolunteerProfileSerializer

def test_serializer():
    user = User.objects.get(username='Beybit')
    serializer = VolunteerProfileSerializer(user)
    print(f"Serialized data for {user.username}:")
    print(serializer.data)

if __name__ == "__main__":
    test_serializer()
