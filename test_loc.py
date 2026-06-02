import requests, re
import urllib3
urllib3.disable_warnings()
session = requests.Session()
session.cookies.update({'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'})
session.verify = False

r1 = session.get('https://cleanup.almau.edu.kz/admin/api/user/add/')
csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r1.text).group(1)

r2 = session.post('https://cleanup.almau.edu.kz/admin/api/user/add/', data={
    'csrfmiddlewaretoken': csrf,
    'username': 'test9999',
    'password1': 'Pwd1234!',
    'password2': 'Pwd1234!',
    '_save': 'Save'
}, allow_redirects=False)

print('Location:', r2.headers.get('Location'))
