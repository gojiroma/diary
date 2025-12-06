import re
from datetime import datetime
from xml.etree import ElementTree as ET
from xml.dom import minidom

def parse_entries(markdown_text):
    entries = markdown_text.strip().split('---')
    parsed_entries = []
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        date_match = re.search(r'^date:\s*(\d{8})', entry, re.MULTILINE)
        content_match = re.search(r'content:\s*\|\n([\s\S]*?)(?=\n---|\n$|\Z)', entry, re.MULTILINE)
        if date_match and content_match:
            yyyymmdd = date_match.group(1)
            content = content_match.group(1).strip()
            content = re.sub(r'^\s*\|\s*', '', content, flags=re.MULTILINE)
            parsed_entries.append({
                'date': yyyymmdd,
                'content': content
            })
    return parsed_entries

def to_kanji_number(num):
    kanji_numbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    return ''.join([kanji_numbers[int(digit)] for digit in str(num)])

def to_kanji_month(month):
    kanji_months = [
        '一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'
    ]
    return kanji_months[month - 1]

def to_kanji_day(day):
    if day == 10:
        return '十日'
    if day == 20:
        return '二十日'
    if day == 30:
        return '三十日'
    if day == 31:
        return '三十一日'
    if day < 10:
        return to_kanji_number(day) + '日'
    if day < 20:
        return '十' + to_kanji_number(day - 10) + '日'
    if day < 30:
        return '二十' + to_kanji_number(day - 20) + '日'
    return to_kanji_number(day) + '日'

def format_japanese_date_with_day_of_week(yyyymmdd):
    year = int(yyyymmdd[:4])
    month = int(yyyymmdd[4:6])
    day = int(yyyymmdd[6:8])
    dt = datetime.strptime(yyyymmdd, '%Y%m%d')
    day_of_week = ['月', '火', '水', '木', '金', '土', '日'][dt.weekday()]
    return f"{to_kanji_month(month)}{to_kanji_day(day)}（{day_of_week}）"

def generate_rss(entries, output_file):
    rss = ET.Element('rss', version='2.0')
    channel = ET.SubElement(rss, 'channel')
    ET.SubElement(channel, 'title').text = '誤字ロマの日記'
    ET.SubElement(channel, 'link').text = 'https://nikki.poet.blue'
    ET.SubElement(channel, 'description').text = '誤字ロマの日記です。'
    ET.SubElement(channel, 'language').text = 'ja'
    ET.SubElement(channel, 'lastBuildDate').text = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')

    image = ET.SubElement(channel, 'image')
    ET.SubElement(image, 'url').text = 'https://nikki.poet.blue/cover.png'  # 画像のURLを指定
    ET.SubElement(image, 'title').text = '誤字ロマの日記'
    ET.SubElement(image, 'link').text = 'https://nikki.poet.blue'
    ET.SubElement(image, 'width').text = '288'
    ET.SubElement(image, 'height').text = '288'

    for entry in sorted(entries, key=lambda x: x['date'], reverse=True):
        item = ET.SubElement(channel, 'item')
        ET.SubElement(item, 'title').text = format_japanese_date_with_day_of_week(entry['date'])
        ET.SubElement(item, 'link').text = f"https://nikki.poet.blue#{entry['date']}"
        ET.SubElement(item, 'pubDate').text = datetime.strptime(entry['date'], '%Y%m%d').strftime('%a, %d %b %Y 00:00:00 +0900')
        ET.SubElement(item, 'description').text = entry['content'].replace('\n', '<br />')

    xml_str = ET.tostring(rss, encoding='utf-8')
    xml_pretty = minidom.parseString(xml_str).toprettyxml(indent='  ')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(xml_pretty)


if __name__ == '__main__':
    with open('entry.md', 'r', encoding='utf-8') as f:
        markdown_text = f.read()
    entries = parse_entries(markdown_text)
    generate_rss(entries, 'rss.xml')
    print('rss.xml を生成しました。')
