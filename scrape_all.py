import urllib.request
import ssl
import json
import re
import time
from bs4 import BeautifulSoup

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = "https://dos.community"
headers = {'User-Agent': 'Mozilla/5.0'}

def fetch(url):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        # ignore print errors
        pass
        return ""

def clean_html(html_str):
    if not html_str: return ""
    soup = BeautifulSoup(html_str, "html.parser")
    text = soup.get_text(separator='\n').strip()
    return re.sub(r'\n+', '\n', text)

ngo_links = []
print("Fetching list pages...")
for page in range(1, 6):
    url = f"{base_url}/nko/" if page == 1 else f"{base_url}/nko/page{page}/"
    html = fetch(url)
    match = re.search(r'data-vue="VolunteersListPageContainer" data-params=\'({.*?})\'></div>', html)
    if match:
        try:
            data = json.loads(match.group(1))
            for ngo in data.get('volunteers', []):
                ngo_links.append({
                    'name': ngo.get('name'),
                    'url': ngo.get('url'),
                    'logo_src': ngo.get('photo', {}).get('src', '')
                })
        except Exception:
            pass

print(f"Found {len(ngo_links)} NGOs. Fetching details...")

md_lines = ["# Список НПО с сайта DOS Community\n"]

for i, ngo in enumerate(ngo_links):
    full_url = base_url + ngo['url']
    print(f"[{i+1}/{len(ngo_links)}] Fetching details...") # removed the problem print
    html = fetch(full_url)
    match = re.search(r'data-vue="NKOPageContainer"[^>]*data-params=\'({.*?})\'', html)
    if match:
        try:
            data = json.loads(match.group(1).replace("&quot;", "\""))
            company = data.get('company', {})
            tabs = data.get('tabs', [])
            
            name = company.get('name', ngo['name'])
            city = company.get('city', {}).get('cityValue', 'Не указан')
            
            socials = []
            if company.get('instagram'): socials.append(f"Instagram: {company['instagram']}")
            if company.get('facebook'): socials.append(f"Facebook: {company['facebook']}")
            if company.get('youtube'): socials.append(f"YouTube: {company['youtube']}")
            social_text = ", ".join(socials) if socials else "Нет данных"
            
            desc_html = ""
            for tab in tabs:
                if tab.get('title') == "О компании":
                    desc_html = tab.get('text', '')
                    break
            description = clean_html(desc_html)
            
            logo_url = base_url + company.get('img', {}).get('src', '') if company.get('img', {}).get('src') else (base_url + ngo['logo_src'] if ngo['logo_src'] else '')
            
            md_lines.append(f"## {name}")
            md_lines.append(f"**Город:** {city}")
            md_lines.append(f"**Соцсети/Сайт:** {social_text}")
            if logo_url and logo_url != base_url:
                md_lines.append(f"**Логотип:** ![{name}]({logo_url})")
            md_lines.append(f"\n**Описание деятельности:**\n{description}\n")
            md_lines.append("---\n")
            
        except Exception:
            pass
    time.sleep(0.5)

with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\ngos_data.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(md_lines))

print("Scraping completed.")
