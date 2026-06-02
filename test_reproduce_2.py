import re, requests, urllib3
urllib3.disable_warnings()
session = requests.Session()
cookies = {'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'}
session.cookies.update(cookies)
session.verify = False

name = 'Частный благотворительный фонд "Өркен"'
city = 'Шымкент'
tags = 'помощь'
info_url = 'https://www.instagram.com/centrorken_shymkent/'
logo_url = 'https://dos.community/upload/images/2513/chastnyy-blagotvoritelnyy-fond-rken-350-350.png'

# 1. User Add
r1 = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/')
csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r1.text).group(1)
u_post = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', data={
    'csrfmiddlewaretoken': csrf, 'username': 'test_rep2',
    'password1': 'Pwd1234!', 'password2': 'Pwd1234!', 'email': 'test_rep2@test.kz',
    'first_name': name[:50], 'name': name, 'role': 'organizer', '_save': 'Save'
}, allow_redirects=False)

loc = u_post.headers.get('Location', '')
user_id_match = re.search(r'/user/(\d+)/', loc)
user_id = user_id_match.group(1) if user_id_match else None
print("User ID:", user_id)

# 2. User Change
if user_id:
    u_get = session.get(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/')
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(u_get.text, 'html.parser')
    form = soup.find('form', id='user_form')
    data = {}
    for inp in form.find_all(['input', 'select', 'textarea']):
        n = inp.get('name')
        if not n: continue
        if inp.name == 'select':
            opt = inp.find('option', selected=True)
            data[n] = opt.get('value') if opt else ''
        elif inp.name == 'textarea':
            data[n] = inp.text
        elif inp.get('type') == 'checkbox':
            if inp.has_attr('checked'): data[n] = 'on'
        elif inp.get('type') != 'file':
            data[n] = inp.get('value', '')
            
    data['is_organizer'] = 'on'
    data['is_active'] = 'on'
    data['organizer_status'] = 'approved'
    data['_continue'] = 'Сохранить и продолжить редактирование'
    session.post(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/', data=data)

# 3. Project Add
p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
p_csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text).group(1)

project_data = {
    'csrfmiddlewaretoken': p_csrf, 'title': (f"Проект от {name}")[:100],
    'volunteer_type': 'social', 'description': 'desc', 'city': city,
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
    with open('error_rep2.html', 'w', encoding='utf-8') as f:
        f.write(p_post.text)
