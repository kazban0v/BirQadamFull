import requests
import json
import re
import urllib3

urllib3.disable_warnings()

session = requests.Session()
cookies = {
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
}
session.cookies.update(cookies)
session.verify = False

def get_projects():
    projects = []
    # Scrape first few pages of projects
    for page in range(1):
        url = 'https://cleanup.almau.edu.kz/admin/api/project/'
        r = session.get(url)
        # Find project IDs and their names
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, 'html.parser')
        
        table = soup.find('table', {'id': 'result_list'})
        if not table:
            print("No table found")
            return projects
            
        rows = table.find('tbody').find_all('tr')
        for row in rows:
            a = row.find('th', class_='field-title').find('a')
            if a:
                href = a.get('href')
                match = re.search(r'/project/(\d+)/change/', href)
                if match:
                    pid = match.group(1)
                    title = a.text
                    # city is usually in a column
                    city_td = row.find('td', class_='field-city')
                    city = city_td.text if city_td else ''
                    projects.append({'id': pid, 'title': title, 'city': city})
    return projects

projects = get_projects()
print(f"Found {len(projects)} projects.")
for p in projects[:5]:
    print(p)
