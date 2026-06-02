import sys, json, time, random, string, re, os, requests
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
    if social.startswith('@'): return f"https://instagram.com/{social[1:]}"
    elif social.startswith('www.'): return f"https://{social}"
    elif not social.startswith('http'): return f"https://{social}"
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
    if 'дет' in desc or 'ребен' in desc: tags.append('дети')
    if any(word in desc for word in ['животн', 'собак', 'кош', 'приют']): tags.append('помощь животным')
    if 'спорт' in desc or 'здоров' in desc or 'баскетбол' in desc: tags.append('спорт и здоровье')
    if any(word in desc for word in ['инвалид', 'особенн', 'синдром', 'аутизм', 'дцп']): tags.append('инклюзия')
    if not tags: tags = ['нпо', 'волонтерство']
    return v_type, ", ".join(tags)

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

name = 'Частный благотворительный фонд "Өркен"'
city = 'Шымкент'
social = 'https://www.instagram.com/centrorken_shymkent/'
desc = 'Работа с социально уязвимыми слоями общества'
logo_url = 'https://dos.community/upload/images/2513/chastnyy-blagotvoritelnyy-fond-rken-350-350.png'

v_type, tags = get_type_and_tags(desc + " " + name)
info_url = format_social(social)

r_u = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/')
csrf_token = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r_u.text).group(1)

user_data = {
    'csrfmiddlewaretoken': csrf_token, 'username': 'test_1234',
    'password1': 'Pwd1234!', 'password2': 'Pwd1234!', 'email': 'test@test.kz',
    'first_name': name[:50], 'name': name, 'phone_number': '+77001234567',
    'role': 'organizer', 'is_organizer': 'on', 'is_active': 'on',
    'organizer_status': 'approved', '_save': 'Сохранить'
}

resp_post = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', data=user_data, allow_redirects=False)
loc = resp_post.headers.get('Location', '')
user_id_match = re.search(r'/user/(\d+)/', loc)
user_id = user_id_match.group(1) if user_id_match else None

print("User created:", user_id)

if user_id:
    p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
    p_csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text).group(1)
    
    project_data = {
        'csrfmiddlewaretoken': p_csrf, 'title': (f"Проект от {name}")[:100],
        'volunteer_type': v_type, 'description': desc, 'city': city,
        'start_date_0': '2026-05-31', 'start_date_1': '09:00:00',
        'end_date_0': '2027-05-31', 'end_date_1': '18:00:00',
        'creator': user_id, 'status': 'approved', 'tags': tags,
        'address': f"Казахстан, г. {city}", 'contact_person': name,
        'contact_phone': '+77001234567', 'contact_email': 'test@test.kz',
        'info_url': info_url, '_save': 'Сохранить'
    }
    
    files = None
    try:
        img_resp = requests.get(logo_url, verify=False, timeout=5)
        def is_valid_image(content):
            return content.startswith(b'\xff\xd8') or content.startswith(b'\x89PNG') or content.startswith(b'GIF8')
        if img_resp.status_code == 200 and is_valid_image(img_resp.content):
            ext = logo_url.split('.')[-1].lower()
            mime = 'image/png' if ext == 'png' else 'image/jpeg'
            files = {'cover_image': (f"logo.{ext}", img_resp.content, mime)}
    except:
        pass
        
    p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', data=project_data, files=files, allow_redirects=False)
    print("Project status:", p_post.status_code)
    if p_post.status_code == 200:
        with open('error_debug_real.html', 'w', encoding='utf-8') as f:
            f.write(p_post.text)
