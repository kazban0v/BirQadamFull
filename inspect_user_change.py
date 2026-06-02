import requests, re, urllib3
urllib3.disable_warnings()

cookies = {'sessionid': 'kpalz4ckv2thq6gp3zk3jhduizdrqp8o'}
r = requests.get('https://cleanup.almau.edu.kz/admin/api/user/30/change/', verify=False, cookies=cookies)

from html.parser import HTMLParser
class Parser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag in ('input', 'select', 'textarea'):
            d = dict(attrs)
            if 'name' in d: print(tag, d['name'], d.get('type', ''))

Parser().feed(r.text)
