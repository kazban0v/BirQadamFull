import re
import json

with open('sample_ngo.html', 'r', encoding='utf-8') as f:
    html = f.read()

matches = re.findall(r'data-vue="([^"]+)" data-params=\'({.*?})\'', html)
for comp, data in matches:
    if comp in ['NKOPageContainer']:
        try:
            j = json.loads(data)
            with open('ngo_data.json', 'w', encoding='utf-8') as out:
                json.dump(j, out, indent=2, ensure_ascii=False)
            print("Successfully wrote ngo_data.json")
        except Exception as e:
            print("Error parsing json", e)
