import requests, re, urllib3
urllib3.disable_warnings()
session = requests.Session()
cookies = {'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'}
session.cookies.update(cookies)
session.verify = False

p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text).group(1)

project_data = {
    'csrfmiddlewaretoken': csrf,
    'title': 'Test No Image',
    'volunteer_type': 'social',
    'description': 'Test',
    'city': 'Алматы',
    'start_date_0': '2026-05-31', 'start_date_1': '09:00:00',
    'end_date_0': '2027-05-31', 'end_date_1': '18:00:00',
    'creator': 30, 'status': 'approved', 'tags': 'помощь',
    'address': 'Казахстан, г. Алматы', 'contact_person': 'Test',
    'contact_phone': '+77001234567', 'contact_email': 'test@test.kz',
    'info_url': '', '_save': 'Сохранить'
}

r = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', data=project_data, allow_redirects=False)
print('Status without image:', r.status_code)
if r.status_code == 200:
    with open('error_no_image.html', 'w', encoding='utf-8') as f: f.write(r.text)
