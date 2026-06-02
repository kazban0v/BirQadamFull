import re, requests, urllib3
urllib3.disable_warnings()
session = requests.Session()
cookies = {'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'}
session.cookies.update(cookies)
session.verify = False

r1 = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/')
csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r1.text).group(1)

# 1. Create user
u_post = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', data={
    'csrfmiddlewaretoken': csrf, 'username': 'testuser1234',
    'password1': 'Pwd12345!', 'password2': 'Pwd12345!',
    'email': 'test123456@test.kz', 'first_name': 'Test', '_save': 'Save'
}, allow_redirects=False)

loc = u_post.headers.get('Location', '')
user_id_match = re.search(r'/user/(\d+)/', loc)
user_id = user_id_match.group(1) if user_id_match else None

print("User created:", user_id)

# 2. Change user
if user_id:
    u_get = session.get(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/')
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(u_get.text, 'html.parser')
    form = soup.find('form', id='user_form')
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
            if inp.has_attr('checked'): data[name] = 'on'
        elif inp.get('type') != 'file':
            data[name] = inp.get('value', '')
            
    data['is_organizer'] = 'on'
    data['is_active'] = 'on'
    data['organizer_status'] = 'approved'
    data['_continue'] = 'Сохранить и продолжить редактирование'
    
    session.post(f'https://cleanup.almau.edu.kz/admin/api/user/{user_id}/change/', data=data)

# 3. Create project
p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
csrf2 = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text).group(1)

project_data = {
    'csrfmiddlewaretoken': csrf2, 'title': 'Test Proj', 'volunteer_type': 'social',
    'description': 'Test', 'city': 'Алматы', 'start_date_0': '2026-05-31', 'start_date_1': '09:00:00',
    'end_date_0': '2027-05-31', 'end_date_1': '18:00:00', 'creator': user_id,
    'status': 'approved', 'tags': 'помощь', 'address': 'Казахстан, г. Алматы',
    'contact_person': 'Test', 'contact_phone': '+77001234567', 'contact_email': 'test@test.kz',
    'info_url': '', '_save': 'Сохранить'
}

r2 = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', data=project_data, allow_redirects=False)
print("Project creation status:", r2.status_code)
if r2.status_code == 200:
    with open('error_flow.html', 'w', encoding='utf-8') as f: f.write(r2.text)
