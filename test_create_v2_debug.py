import re
import random
import string
import sys
import os
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
sys.stdout.reconfigure(encoding='utf-8')

cookies = {
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://cleanup.almau.edu.kz'
}

def format_social(social):
    social = social.strip()
    if not social: return ""
    social = social.split()[0]
    if social.startswith('@'):
        return f"https://instagram.com/{social[1:]}"
    elif social.startswith('www.'):
        return f"https://{social}"
    elif not social.startswith('http'):
        return f"https://{social}"
    return social

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
    if not tags:
        tags = ['нпо', 'волонтерство']
    return v_type, ", ".join(tags)

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

name = 'Частный благотворительный фонд "Өркен"'
desc = 'Работа с социально уязвимыми слоями общества...'
city = 'Шымкент'
social = 'https://www.instagram.com/centrorken_shymkent/'
logo_url = 'https://dos.community/upload/images/2513/chastnyy-blagotvoritelnyy-fond-rken-350-350.png'

v_type, tags = get_type_and_tags(desc + " " + name)
info_url = format_social(social)

username = "ngo_test_123"
password = "Password123!"
email = "ngo_test@testngo.kz"
phone = "+77001234567"

resp_get = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/', timeout=10)
match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', resp_get.text)
csrf_token = match.group(1) if match else cookies['csrftoken']

user_data = {
    'csrfmiddlewaretoken': csrf_token,
    'username': username,
    'password1': password,
    'password2': password,
    'email': email,
    'first_name': name[:50],
    'last_name': 'Фонд',
    'name': name,
    'phone_number': phone,
    'telegram_id': '',
    'role': 'organizer',
    'is_organizer': 'on',
    'is_active': 'on',
    'organizer_status': 'approved',
    'organization_name': name,
    '_save': 'Сохранить'
}

resp_post = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', 
                         data=user_data, allow_redirects=False, 
                         headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/user/add/'})

loc = resp_post.headers.get('Location', '')
user_id_match = re.search(r'/user/(\d+)/', loc)
user_id = user_id_match.group(1) if user_id_match else 30

p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
p_match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text)
p_csrf = p_match.group(1) if p_match else csrf_token

project_data = {
    'csrfmiddlewaretoken': p_csrf,
    'title': (f"Проект от {name}")[:100],
    'volunteer_type': v_type,
    'description': desc,
    'city': city,
    'latitude': '',
    'longitude': '',
    'start_date_0': '2026-05-31',
    'start_date_1': '09:00:00',
    'end_date_0': '2027-05-31',
    'end_date_1': '18:00:00',
    'creator': user_id,
    'status': 'approved',
    'tags': tags,
    'address': f"Казахстан, г. {city}",
    'contact_person': name,
    'contact_phone': phone,
    'contact_email': email,
    'contact_telegram': '',
    'info_url': info_url,
    'gis2_url': '',
    '_save': 'Сохранить'
}

def get_file_info(url):
    ext = url.split('?')[0].split('.')[-1].lower()
    mime = 'image/jpeg'
    if ext == 'png': mime = 'image/png'
    elif ext == 'gif': mime = 'image/gif'
    elif ext == 'webp': mime = 'image/webp'
    return f"logo.{ext}", mime

files = None
try:
    img_resp = requests.get(logo_url, verify=False, timeout=5)
    if img_resp.status_code == 200:
        fname, mime = get_file_info(logo_url)
        files = {'cover_image': (fname, img_resp.content, mime)}
except Exception:
    pass

p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', 
                      data=project_data, files=files, allow_redirects=False,
                      headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/project/add/'})

print(f"Project Status: {p_post.status_code}")
if p_post.status_code == 200:
    with open('debug_error_v2.html', 'w', encoding='utf-8') as f:
        f.write(p_post.text)
    print("Saved to debug_error_v2.html")
