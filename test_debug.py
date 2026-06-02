import re
import requests
import urllib3
urllib3.disable_warnings()

cookies = {
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
}
headers = {
    'User-Agent': 'Mozilla/5.0',
    'Origin': 'https://cleanup.almau.edu.kz'
}

session = requests.Session()
session.cookies.update(cookies)
session.headers.update(headers)
session.verify = False

name = 'Частный благотворительный фонд "Өркен"'
city = 'Шымкент'
tags = 'помощь'
info_url = 'https://www.instagram.com/centrorken_shymkent/'
logo_url = 'https://dos.community/upload/images/2513/chastnyy-blagotvoritelnyy-fond-rken-350-350.png'

r1 = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/')
csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r1.text).group(1)

user_id = 30 

def get_file_info(url):
    ext = url.split('?')[0].split('.')[-1].lower()
    mime = 'image/png' if ext == 'png' else 'image/jpeg'
    return f"logo.{ext}", mime

img_resp = requests.get(logo_url, verify=False)
fname, mime = get_file_info(logo_url)
files = {'cover_image': (fname, img_resp.content, mime)}

project_data = {
    'csrfmiddlewaretoken': csrf,
    'title': (f"Проект от {name}")[:100],
    'volunteer_type': 'social',
    'description': 'Test description',
    'city': city,
    'start_date_0': '2026-05-31',
    'start_date_1': '09:00:00',
    'end_date_0': '2027-05-31',
    'end_date_1': '18:00:00',
    'creator': user_id,
    'status': 'approved',
    'tags': tags,
    'address': f"Казахстан, г. {city}",
    'contact_person': name,
    'contact_phone': '+77001234567',
    'contact_email': 'test@test.kz',
    'info_url': info_url,
    '_save': 'Сохранить'
}

r2 = session.post('https://cleanup.almau.edu.kz/admin/api/project/add/', data=project_data, files=files)
with open('error_debug.html', 'w', encoding='utf-8') as f:
    f.write(r2.text)
print("Status:", r2.status_code)
