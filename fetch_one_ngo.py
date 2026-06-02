import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://dos.community/nko/1633/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        html = response.read().decode('utf-8')
        with open('C:\\Users\\User\\Desktop\\BirQadamFull-feature-updates\\sample_ngo.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Success fetching single NGO")
except Exception as e:
    print(f"Error: {e}")
