import re, requests, urllib3
urllib3.disable_warnings()
session = requests.Session()
cookies = {'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'}
session.cookies.update(cookies)
session.verify = False

user_id = 238
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

# Check if user is still in dropdown
p_get = session.get('https://cleanup.almau.edu.kz/admin/api/project/add/')
if f'value="{user_id}"' in p_get.text:
    print("User is in dropdown!")
else:
    print("User NOT in dropdown!")
