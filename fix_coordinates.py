import requests
import urllib3
import re
from bs4 import BeautifulSoup
import json

urllib3.disable_warnings()
session = requests.Session()
session.cookies.update({
    'csrftoken': 'cKnMUivjmStyw2HDHAg4CDco1VuB4iO4',
    'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'
})
session.verify = False

CITY_COORDS = {
    'алматы': (43.2220, 76.8512),
    'астана': (51.1694, 71.4491),
    'нур-султан': (51.1694, 71.4491),
    'шымкент': (42.3417, 69.5901),
    'караганда': (49.8019, 73.1021),
    'актобе': (50.2839, 57.1670),
    'тараз': (42.9000, 71.3667),
    'павлодар': (52.3000, 76.9500),
    'усть-каменогорск': (49.9500, 82.6167),
    'семей': (50.4111, 80.2275),
    'атырау': (47.1167, 51.8833),
    'костанай': (53.2167, 63.6333),
    'кызылорда': (44.8528, 65.5097),
    'уральск': (51.2333, 51.3667),
    'петропавловск': (54.8833, 69.1500),
    'актау': (43.6500, 51.2000),
    'темиртау': (50.0667, 72.9667),
    'туркестан': (43.3000, 68.2500),
    'кокшетау': (53.2833, 69.3833),
    'талдыкорган': (45.0167, 78.3667),
    'жезказган': (47.7833, 67.7000),
    'щучинск': (52.9333, 70.2000)
}

def fix_projects():
    # Fetch projects from API
    projects_api_url = 'https://cleanup.almau.edu.kz/custom-admin/api/v1/projects/?limit=200'
    r = session.get(projects_api_url)
    
    try:
        data = r.json()
        projects = data.get('projects', [])
        if not projects and 'results' in data:
            projects = data['results']
    except Exception as e:
        print("Failed to parse JSON:", e)
        return
        
    print(f"Found {len(projects)} projects.")
    
    updated = 0
    for p in projects:
        pid = p['id']
        city_name = p.get('city', '').lower()
        
        # Get coordinates
        lat, lng = 43.2220, 76.8512 # default to Almaty
        for c, coords in CITY_COORDS.items():
            if c in city_name:
                lat, lng = coords
                break
                
        # Fetch the edit form
        edit_url = f'https://cleanup.almau.edu.kz/admin/api/project/{pid}/change/'
        form_get = session.get(edit_url)
        if form_get.status_code != 200:
            print(f"Failed to load {edit_url} - {form_get.status_code}")
            continue
            
        soup = BeautifulSoup(form_get.text, 'html.parser')
        form = soup.find('form', id='project_form')
        if not form:
            print(f"No project_form found for {pid}")
            continue
            
        # Check current lat/lng
        lat_input = form.find('input', {'name': 'latitude'})
        lng_input = form.find('input', {'name': 'longitude'})
        
        if lat_input and lat_input.get('value') and lat_input.get('value').strip():
            print(f"Project {pid} already has coordinates: {lat_input.get('value')}")
            continue
            
        # Build POST data
        post_data = {}
        for inp in form.find_all(['input', 'select', 'textarea']):
            name = inp.get('name')
            if not name:
                continue
            if inp.name == 'select':
                opt = inp.find('option', selected=True)
                post_data[name] = opt.get('value') if opt else ''
            elif inp.name == 'textarea':
                post_data[name] = inp.text
            elif inp.get('type') == 'checkbox':
                if inp.has_attr('checked'):
                    post_data[name] = 'on'
            elif inp.get('type') not in ['file', 'submit', 'button']:
                post_data[name] = inp.get('value', '')
                
        # Add a tiny random offset to avoid overlapping exactly on the map
        import random
        offset_lat = (random.random() - 0.5) * 0.05
        offset_lng = (random.random() - 0.5) * 0.05
        
        post_data['latitude'] = str(lat + offset_lat)
        post_data['longitude'] = str(lng + offset_lng)
        post_data['_continue'] = 'Сохранить и продолжить редактирование'
        
        # In Django Admin, dates might be blank if there was an issue, ensure they exist
        if not post_data.get('start_date'): post_data['start_date'] = '2026-05-31'
        if not post_data.get('end_date'): post_data['end_date'] = '2027-05-31'
        
        # Extract CSRF token
        csrf_match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', form_get.text)
        if csrf_match:
            post_data['csrfmiddlewaretoken'] = csrf_match.group(1)
            
        resp = session.post(edit_url, data=post_data, headers={'Referer': edit_url}, allow_redirects=False)
        if resp.status_code in [302, 200]:
            print(f"Updated Project {pid} in {city_name} to ({post_data['latitude']}, {post_data['longitude']}) - {resp.status_code}")
            updated += 1
        else:
            print(f"Failed to update Project {pid}: {resp.status_code}")

    print(f"Successfully updated {updated} projects.")

if __name__ == '__main__':
    fix_projects()
