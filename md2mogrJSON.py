import re
import json
from datetime import datetime

def parse_entries(markdown_content):
    entries = []
    for entry_block in re.findall(r'^\s*---\s*$\n(.*?)(?=\n\s*---\s*$|\Z)', markdown_content, re.DOTALL | re.MULTILINE):
        entry = {}
        date_match = re.search(r'^date:\s*(\d{4})(\d{2})(\d{2})', entry_block, re.MULTILINE)
        content_match = re.search(r'content:\s*\|\s*\n(.*?)(?=\n\s*---\s*$|\Z)', entry_block, re.DOTALL)
        if date_match and content_match:
            year, month, day = date_match.groups()
            date_str = f"{year}/{int(month)}/{int(day)}"
            dt = datetime.strptime(f"{year}{month}{day}", "%Y%m%d")
            dow = "月火水木金土日"[dt.weekday()]
            title = f"{date_str} ({dow}) B日記"
            content = content_match.group(1).strip()
            content = re.sub(r'^\s*\|?\s*', '', content, flags=re.MULTILINE)
            entry[title] = {
                "content": content.replace('\n', ' ').strip(),
                "meta": {
                    "updatedAt": int(dt.timestamp() * 1000)
                }
            }
            entries.append(entry)
    return entries

def markdown_to_json(file_path, output_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        markdown_content = f.read()
    entries = parse_entries(markdown_content)
    result = {}
    for entry in entries:
        result.update(entry)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

markdown_to_json('fake.md', 'output.json')
