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

# Fix printing
sys.stdout.reconfigure(encoding='utf-8')

cookies = {
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://cleanup.almau.edu.kz'
}

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
        ngos.append({
            'name': name_match.group(1).strip()[:100],
            'city': city_match.group(1).strip()[:100] if city_match else 'Алматы',
            'social': social_match.group(1).strip()[:200] if social_match else '',
            'logo_url': logo_match.group(1).strip() if logo_match else None,
            'description': desc_match.group(1).strip() if desc_match else 'Описание НПО'
        })

print(f"Found {len(ngos)} NGOs to create.")

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

results = []

for i, ngo in enumerate(ngos[24:30], start=24):
    time.sleep(2) # Prevent 429 rate limit
    
    username = f"ngo_{random.randint(1000, 9999)}_{i}"
    password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
    email = f"{username}@testngo.kz"
    
    phone = f"+7700{random.randint(1000000, 9999999)}"
    
    try:
        # GET /add/ for CSRF
        resp_get = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/', timeout=10)
        match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', resp_get.text)
        csrf_token = match.group(1) if match else cookies['csrftoken']
        
        user_data = {
            'csrfmiddlewaretoken': csrf_token,
            'username': username,
            'password1': password,
            'password2': password,
            'email': email,
            'first_name': 'Представитель',
            'last_name': 'НПО',
            'name': ngo['name'],
            'phone_number': phone,
            'telegram_id': '',
            'role': 'organizer',
            'is_organizer': 'on',
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
                p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
                p_match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text)
                p_csrf = p_match.group(1) if p_match else csrf_token
                
                desc_with_social = ngo['description'] if ngo['description'] else 'Проект'
                info_url = ngo['social'].split()[0] if ngo['social'].startswith('http') else ''
                if ngo['social'] and not ngo['social'].startswith('http'):
                    desc_with_social += f"\n\nКонтакты: {ngo['social']}"
                
                project_data = {
                    'csrfmiddlewaretoken': p_csrf,
                    'title': (f"Проект от {ngo['name']}")[:100],
                    'volunteer_type': 'social',
                    'description': desc_with_social,
                    'city': ngo['city'],
                    'latitude': '',
                    'longitude': '',
                    'start_date_0': '31.05.2026',
                    'start_date_1': '09:00:00',
                    'end_date_0': '31.05.2027',
                    'end_date_1': '18:00:00',
                    'creator': user_id,
                    'status': 'approved',
                    'tags': 'помощь, нпо',
                    'address': ngo['city'],
                    'contact_person': 'Представитель',
                    'contact_phone': phone,
                    'contact_email': email,
                    'contact_telegram': '',
                    'info_url': info_url,
                    'gis2_url': '',
                    '_save': 'Сохранить'
                }
                
                files = None
                if ngo['logo_url']:
                    try:
                        img_resp = requests.get(ngo['logo_url'], verify=False, timeout=5)
                        if img_resp.status_code == 200:
                            files = {'cover_image': ('logo.jpg', img_resp.content, 'image/jpeg')}
                    except Exception:
                        pass
                
                if files:
                    p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', 
                                          data=project_data, files=files, allow_redirects=False,
                                          headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/project/add/'})
                else:
                    p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', 
                                          data=project_data, allow_redirects=False,
                                          headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/project/add/'})
                
                if p_post.status_code == 302:
                    print(f"[{i+1}/{len(ngos)}] Success: {ngo['name']}")
                    results.append(f"{ngo['name']} | {username} | {password} | {email}")
                else:
                    print(f"[{i+1}/{len(ngos)}] Project failed for {ngo['name']}: {p_post.status_code}")
                    with open(f"error_{i}.html", "w", encoding="utf-8") as err_f:
                        err_f.write(p_post.text)
                    print(f"  -> Error details saved to error_{i}.html")
                    results.append(f"{ngo['name']} | {username} | {password} | {email} (PROJ_ERR)")
            else:
                print(f"[{i+1}/{len(ngos)}] Extracted no user ID for {ngo['name']}")
        else:
            print(f"[{i+1}/{len(ngos)}] User creation failed for {ngo['name']}: {resp_post.status_code}")
            with open(f"user_error_{i}.html", "w", encoding="utf-8") as err_f:
                err_f.write(resp_post.text)
    except Exception as e:
        print(f"[{i+1}/{len(ngos)}] Error on {ngo['name']}: {e}")

with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\created_accounts.txt', 'a', encoding='utf-8') as f:
    f.write("\n".join(results) + "\n")
    
print("All done. Accounts saved to created_accounts.txt")
