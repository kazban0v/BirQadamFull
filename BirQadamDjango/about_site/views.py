from django.shortcuts import render
from django.http import HttpRequest, HttpResponse

def home(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/index.html')

def services(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/services.html')

def instruction(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/instruction.html')

def admin_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/admin_guide.html')

def volunteer_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/volunteer_guide.html')

def organizer_guide(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/organizer_guide.html')

def register_volunteer(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/register_volunteer.html')

def register_organizer(request: HttpRequest) -> HttpResponse:
    return render(request, 'about_site/register_organizer.html')
