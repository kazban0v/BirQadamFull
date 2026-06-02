import os
import django
from django.conf import settings
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

import re
import random
import string
import requests
from django.core.files.base import ContentFile
from api.models import Project, User
from taggit.models import Tag

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CITY_COORDS = {
    'алматы': (43.2220, 76.8512),
    'астана': (51.1694, 71.4491),
    'нур-султан': (51.1694, 71.4491),
    'шымкент': (42.3417, 69.5901),
    'караганда': (49.8019, 73.1021),
    'актобе': (50.2839, 57.1670),
    'тараз': (42.9000, 71.3667),
    'павлодар': (52.3000, 76.9500),
    'усть-каменогорск': (49.9500, 82.6167),
    'семей': (50.4111, 80.2275),
    'атырау': (47.1167, 51.8833),
    'костанай': (53.2167, 63.6333),
    'кызылорда': (44.8528, 65.5097),
    'уральск': (51.2333, 51.3667),
    'петропавловск': (54.8833, 69.1500),
    'актау': (43.6500, 51.2000),
    'темиртау': (50.0667, 72.9667),
    'туркестан': (43.3000, 68.2500),
    'кокшетау': (53.2833, 69.3833),
    'талдыкорган': (45.0167, 78.3667),
    'жезказган': (47.7833, 67.7000),
    'щучинск': (52.9333, 70.2000)
}

def fix_logo_quality(url):
    if not url: return url
    url = url.replace('/resize_cache', '')
    url = re.sub(r'/\d+_\d+_[a-zA-Z0-9]+/', '/', url)
    return url

def format_social(social):
    social = social.strip()
    if not social: return ""
    urls = re.findall(r'https?://[^\s,]+', social)
    if urls: return urls[0]
    for w in social.split():
        w = w.strip(',')
        if w.startswith('@'): return f"https://instagram.com/{w[1:]}"
        elif w.startswith('www.'): return f"https://{w}"
        elif '.' in w and not w.endswith(':'): return f"https://{w}"
    return ""

def get_type_and_tags(desc):
    desc = desc.lower()
    tags = []
    
    if any(word in desc for word in ['эколог', 'природ', 'дерев', 'мусор']):
        v_type = 'environmental'
        tags.extend(['экология', 'защита природы'])
    elif any(word in desc for word in ['культур', 'искусств', 'музык', 'творч']):
        v_type = 'cultural'
        tags.extend(['культура', 'искусство'])
    else:
        v_type = 'social'
        tags.extend(['социальная помощь'])
        
    if 'дет' in desc or 'ребен' in desc:
        tags.append('дети')
    if any(word in desc for word in ['животн', 'собак', 'кош', 'приют']):
        tags.append('помощь животным')
    if 'спорт' in desc or 'здоров' in desc or 'баскетбол' in desc:
        tags.append('спорт и здоровье')
    if any(word in desc for word in ['инвалид', 'особенн', 'синдром', 'аутизм', 'дцп']):
        tags.append('инклюзия')
        
    if not tags: tags = ['нпо', 'волонтерство']
    return v_type, tags

def populate():
    with open('../ngos_data.md', 'r', encoding='utf-8') as f:
        content = f.read()

    ngos = []
    for block in content.split('---'):
        if '##' not in block: continue
        name_match = re.search(r'## (.*)', block)
        city_match = re.search(r'\*\*Город:\*\* (.*)', block)
        social_match = re.search(r'\*\*Соцсети/Сайт:\*\* (.*)', block)
        logo_match = re.search(r'\*\*Логотип:\*\* !\[.*?\]\((.*?)\)', block)
        desc_match = re.search(r'\*\*Описание деятельности:\*\*\n(.*?)(?=\n##|\Z)', block, re.DOTALL)
        
        if name_match:
            original_logo_url = logo_match.group(1).strip() if logo_match else None
            ngos.append({
                'name': name_match.group(1).strip()[:100],
                'city': city_match.group(1).strip()[:100] if city_match else 'Алматы',
                'social': social_match.group(1).strip()[:200] if social_match else '',
                'highres_logo_url': fix_logo_quality(original_logo_url),
                'original_logo_url': original_logo_url,
                'description': desc_match.group(1).strip() if desc_match else 'Описание НПО'
            })

    print(f"Готово к созданию в локальной БД: {len(ngos)} НПО.")

    for i, ngo in enumerate(ngos):
        username = f"ngo_{random.randint(1000, 9999)}_{i}"
        password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
        email = f"{username}@testngo.kz"
        phone = f"+7700{random.randint(1000000, 9999999)}"
        
        # Determine coordinates
        lat, lng = 43.2220, 76.8512
        city_lower = ngo['city'].lower()
        for c, coords in CITY_COORDS.items():
            if c in city_lower:
                lat, lng = coords
                break
        
        # Offset slightly for spread
        lat += (random.random() - 0.5) * 0.05
        lng += (random.random() - 0.5) * 0.05
        
        # Create user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': ngo['name'][:50],
                'last_name': 'Фонд',
                'name': ngo['name'],
                'phone_number': phone,
                'role': 'organizer',
                'is_organizer': True,
                'is_active': True,
                'organizer_status': 'approved',
                'organization_name': ngo['name']
            }
        )
        if created:
            user.set_password(password)
            user.save()

        v_type, tags = get_type_and_tags(ngo['description'] + " " + ngo['name'])
        info_url = format_social(ngo['social'])
        
        # Create Project
        from datetime import date, timedelta
        start_d = date.today()
        end_d = start_d + timedelta(days=365)
        
        project = Project.objects.create(
            title=f"Проект от {ngo['name']}"[:100],
            volunteer_type=v_type,
            description=ngo['description'],
            city=ngo['city'],
            latitude=lat,
            longitude=lng,
            start_date=start_d,
            end_date=end_d,
            creator=user,
            status='approved',
            address=f"Казахстан, г. {ngo['city']}",
            contact_person=ngo['name'],
            contact_phone=phone,
            contact_email=email,
            info_url=info_url,
        )
        
        # Tags
        project.tags.add(*tags)
        
        # Image
        if ngo['highres_logo_url']:
            try:
                img_resp = requests.get(ngo['highres_logo_url'], verify=False, timeout=5)
                if img_resp.status_code == 200:
                    ext = ngo['highres_logo_url'].split('?')[0].split('.')[-1].lower()
                    if ext not in ['png', 'jpg', 'jpeg', 'webp', 'gif']: ext = 'jpg'
                    fname = f"logo_{project.id}.{ext}"
                    project.cover_image.save(fname, ContentFile(img_resp.content), save=True)
            except Exception as e:
                print(f"Error fetching image for {ngo['name']}: {e}")

        print(f"[{i+1}/{len(ngos)}] Создано: {project.title}")

    print("Все проекты успешно добавлены в локальную базу данных!")

if __name__ == '__main__':
    populate()
