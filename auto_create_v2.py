import re
import random
import string
import sys
import subprocess
import os
import time

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "urllib3"])
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

def fix_logo_quality(url):
    if not url: return url
    # Превращаем: /upload/resize_cache/iblock/e70/150_150_1/image.png
    # В: /upload/iblock/e70/image.png (оригинальное качество)
    url = url.replace('/resize_cache', '')
    url = re.sub(r'/\d+_\d+_[a-zA-Z0-9]+/', '/', url)
    return url

def format_social(social):
    social = social.strip()
    if not social: return ""
    import re
    urls = re.findall(r'https?://[^\s,]+', social)
    if urls:
        return urls[0]
    words = social.split()
    for w in words:
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
        
    if not tags:
        tags = ['нпо', 'волонтерство']
        
    return v_type, ", ".join(tags)

with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\ngos_data.md', 'r', encoding='utf-8') as f:
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

print(f"Готово к созданию: {len(ngos)} НПО.")

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

results = ["Название НПО | Логин (Username) | Пароль | Email", "-" * 60]

for i, ngo in enumerate(ngos):
    time.sleep(3) # Пауза против ошибки 429
    
    username = f"ngo_{random.randint(1000, 9999)}_{i}"
    password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
    email = f"{username}@testngo.kz"
    phone = f"+7700{random.randint(1000000, 9999999)}"
    
    v_type, tags = get_type_and_tags(ngo['description'] + " " + ngo['name'])
    info_url = format_social(ngo['social'])
    
    try:
        # GET /add/ User
        resp_get = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/', timeout=10)
        match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', resp_get.text)
        csrf_token = match.group(1) if match else cookies['csrftoken']
        
        user_data = {
            'csrfmiddlewaretoken': csrf_token,
            'username': username,
            'password1': password,
            'password2': password,
            'email': email,
            'first_name': ngo['name'][:50], # Имя как название НПО
            'last_name': 'Фонд',
            'name': ngo['name'],
            'phone_number': phone,
            'telegram_id': '',
            'role': 'organizer',
            'is_organizer': 'on',
            'is_active': 'on',
            'organizer_status': 'approved',
            'organization_name': ngo['name'],
            '_save': 'Сохранить'
        }
        
        resp_post = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', 
                                 data=user_data, allow_redirects=False, 
                                 headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/user/add/'})
        
        if resp_post.status_code == 302:
            loc = resp_post.headers.get('Location', '')
            user_id_match = re.search(r'/user/(\d+)/', loc)
            user_id = user_id_match.group(1) if user_id_match else None
            
            if user_id:
                # Аппрувим юзера через форму редактирования (так как поля нет при создании)
                u_get = session.get(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/')
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(u_get.text, 'html.parser')
                form = soup.find('form', id='user_form')
                if form:
                    data = {}
                    for inp in form.find_all(['input', 'select', 'textarea']):
                        name = inp.get('name')
                        if not name: continue
                        if inp.name == 'select':
                            opt = inp.find('option', selected=True)
                            data[name] = opt.get('value') if opt else ''
                        elif inp.name == 'textarea':
                            data[name] = inp.text
                        elif inp.get('type') == 'checkbox':
                            if inp.has_attr('checked'):
                                data[name] = 'on'
                        elif inp.get('type') != 'file':
                            data[name] = inp.get('value', '')
                            
                    data['is_organizer'] = 'on'
                    data['is_active'] = 'on'
                    data['organizer_status'] = 'approved'
                    data['_continue'] = 'Сохранить и продолжить редактирование'
                    
                    session.post(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/', 
                                 data=data, headers={'Referer': f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/'})
                
                p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
                p_match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text)
                p_csrf = p_match.group(1) if p_match else csrf_token
                
                project_data = {
                    'csrfmiddlewaretoken': p_csrf,
                    'title': (f"Проект от {ngo['name']}")[:100],
                    'volunteer_type': v_type,
                    'description': ngo['description'],
                    'city': ngo['city'],
                    'latitude': '',
                    'longitude': '',
                    # Формат ISO (Год-Месяц-День), чтобы админка точно съела дату
                    'start_date_0': '2026-05-31',
                    'start_date_1': '09:00:00',
                    'end_date_0': '2027-05-31',
                    'end_date_1': '18:00:00',
                    'creator': user_id,
                    'status': 'approved',
                    'tags': tags,
                    'address': f"Казахстан, г. {ngo['city']}", # Красивый адрес
                    'contact_person': ngo['name'], # ФИО как Название Фонда
                    'contact_phone': phone,
                    'contact_email': email,
                    'contact_telegram': '',
                    'info_url': info_url, # Правильная ссылка (https://...)
                    'gis2_url': '',
                    '_save': 'Сохранить'
                }
                
                files = None
                if ngo['highres_logo_url']:
                    try:
                        img_resp = requests.get(ngo['highres_logo_url'], verify=False, timeout=5)
                        
                        def get_file_info(url):
                            ext = url.split('?')[0].split('.')[-1].lower()
                            mime = 'image/jpeg'
                            if ext == 'png': mime = 'image/png'
                            elif ext == 'gif': mime = 'image/gif'
                            elif ext == 'webp': mime = 'image/webp'
                            return f"logo.{ext}", mime
                            
                        def is_valid_image(content):
                            return content.startswith(b'\xff\xd8') or content.startswith(b'\x89PNG') or content.startswith(b'GIF8')
                            
                        if img_resp.status_code == 200 and is_valid_image(img_resp.content):
                            fname, mime = get_file_info(ngo['highres_logo_url'])
                            files = {'cover_image': (fname, img_resp.content, mime)}
                        else:
                            # Fallback to thumbnail
                            img_resp = requests.get(ngo['original_logo_url'], verify=False, timeout=5)
                            if img_resp.status_code == 200 and is_valid_image(img_resp.content):
                                fname, mime = get_file_info(ngo['original_logo_url'])
                                files = {'cover_image': (fname, img_resp.content, mime)}
                    except Exception:
                        pass
                
                p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', 
                                      data=project_data, files=files, allow_redirects=False,
                                      headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/project/add/'})
                
                if p_post.status_code == 302:
                    print(f"[{i+1}/{len(ngos)}] Успех: {ngo['name']} (Теги: {tags})")
                    results.append(f"{ngo['name']} | {username} | {password} | {email}")
                else:
                    print(f"[{i+1}/{len(ngos)}] Ошибка проекта {ngo['name']}: {p_post.status_code}")
            else:
                print(f"[{i+1}/{len(ngos)}] Не удалось получить ID юзера для {ngo['name']}")
        else:
            print(f"[{i+1}/{len(ngos)}] Ошибка юзера {ngo['name']}: {resp_post.status_code}")
    except Exception as e:
        print(f"[{i+1}/{len(ngos)}] Ошибка соединения {ngo['name']}: {e}")

with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\created_accounts_v2.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(results) + "\n")
    
print("Готово! Аккаунты сохранены в created_accounts_v2.txt")
