import requests, re
import urllib3
urllib3.disable_warnings()
session = requests.Session()
session.cookies.update({'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4', 'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'})
r = session.get('https://cleanup.almau.edu.kz/admin/api/project/', verify=False)
matches = re.findall(r'<a href="/admin/api/project/(\d+)/change/">([^<]+)</a>', r.text)
for m in matches[:10]:
    p = session.get(f'https://cleanup.almau.edu.kz/admin/api/project/{m[0]}/change/', verify=False)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(p.text, 'html.parser')
    creator = soup.find('select', {'name': 'creator'}).find('option', selected=True)
    print(f"Project: {m[1]}, Creator: {creator.text if creator else 'Unknown'}")
