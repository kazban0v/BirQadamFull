import requests
import re
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

cookies = {
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://cleanup.almau.edu.kz'
}

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', p_get.text)
csrf = match.group(1) if match else cookies['csrftoken']

user_id = 30

project_data = {
    'csrfmiddlewaretoken': csrf,
    'title': 'Test Project',
    'volunteer_type': 'social',
    'description': 'Test',
    'city': 'Алматы',
    'latitude': '',
    'longitude': '',
    'start_date_0': '2026-05-31',
    'start_date_1': '09:00:00',
    'end_date_0': '2027-05-31',
    'end_date_1': '18:00:00',
    'creator': user_id,
    'status': 'approved',
    'tags': 'социальная помощь, дети',
    'address': 'Казахстан, г. Алматы',
    'contact_person': 'Test NGO',
    'contact_phone': '+77001234567',
    'contact_email': 'test@testngo.kz',
    'contact_telegram': '',
    'info_url': 'https://instagram.com/test',
    'gis2_url': '',
    '_save': 'Сохранить'
}

p_post = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', data=project_data, allow_redirects=False, headers={'Referer': 'https://cleanup.almau.edu.kz/admin/api/project/add/'})

print("Status:", p_post.status_code)
if p_post.status_code == 200:
    with open('debug_error.html', 'w', encoding='utf-8') as f:
        f.write(p_post.text)
    print("Saved to debug_error.html")
