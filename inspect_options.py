import urllib.request
import ssl
from bs4 import BeautifulSoup

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://cleanup.almau.edu.kz/admin/api/project/add/')
req.add_header('Cookie', 'csrftoken=cKnMUivjmStyw2HDHAg4CDco1VuB4iO4; sessionid=kpalz4ckv2thq6gp3zk3jhduizdrqp8o')
req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        html = response.read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        
        status_select = soup.find('select', {'name': 'status'})
        if status_select:
            print("Status Options:")
            for opt in status_select.find_all('option'):
                print(f"  {opt.get('value')}: {opt.text}")
                
        type_select = soup.find('select', {'name': 'volunteer_type'})
        if type_select:
            print("Volunteer Type Options:")
            for opt in type_select.find_all('option'):
                print(f"  {opt.get('value')}: {opt.text}")
except Exception as e:
    print("Error:", e)
