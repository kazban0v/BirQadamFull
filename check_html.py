import sys
try:
    from bs4 import BeautifulSoup
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4"])
    from bs4 import BeautifulSoup

with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\ngo_page.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

print("Title:", soup.title.string if soup.title else "No Title")
for h in soup.find_all(['h1', 'h2', 'h3', 'h4'])[:15]:
    print(h.name, h.text.strip())

# print classes of first few divs
for div in soup.find_all('div', class_=True)[:10]:
    print("div class:", div['class'])
