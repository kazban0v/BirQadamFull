import urllib.request
import ssl
from bs4 import BeautifulSoup
import json

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
        form = soup.find('form', id='project_form')
        if form:
            fields = []
            for input_tag in form.find_all(['input', 'select', 'textarea']):
                name = input_tag.get('name')
                if name and name not in fields:
                    fields.append(name)
            print("Project Form Fields:")
            print(fields)
        else:
            print("Form not found. Check if session is valid.")
            print(html[:500])
except Exception as e:
    print("Error:", e)
