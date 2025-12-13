import re
import os
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET
from xml.dom import minidom

JST = timezone(timedelta(hours=9))

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
            parsed_entries.append({'date': yyyymmdd, 'content': content})
    return parsed_entries

def to_kanji_number(num):
    kanji_numbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    return ''.join(kanji_numbers[int(d)] for d in str(num))

def to_kanji_month(month):
    return ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'][month - 1]

def to_kanji_day(day):
    if day in {10, 20, 30}: return {10:'十日', 20:'二十日', 30:'三十日'}[day]
    if day == 31: return '三十一日'
    if day < 10: return to_kanji_number(day) + '日'
    if day < 20: return '十' + to_kanji_number(day - 10) + '日'
    if day < 30: return '二十' + to_kanji_number(day - 20) + '日'
    return to_kanji_number(day) + '日'

def format_japanese_date_with_day_of_week(yyyymmdd):
    dt = datetime.strptime(yyyymmdd, '%Y%m%d')
    month = int(yyyymmdd[4:6])
    day = int(yyyymmdd[6:8])
    dow = '月火水木金土日'[dt.weekday()]
    return f"{to_kanji_month(month)}{to_kanji_day(day)}（{dow}）"

def parse_existing_pubdates(rss_file):
    pubdates = {}
    if not os.path.exists(rss_file):
        return pubdates
    try:
        tree = ET.parse(rss_file)
        root = tree.getroot()
        channel = root.find('channel')
        if channel is None: return pubdates
        for item in channel.findall('item'):
            guid = item.find('guid')
            pubDate = item.find('pubDate')
            if guid is not None and pubDate is not None and guid.text:
                parts = guid.text.strip().split(':')
                if len(parts) >= 3:
                     date_str = parts[-1]
                     pubdates[date_str] = pubDate.text
    except Exception as e:
        print(f"Warning: Failed to parse existing RSS: {e}")
    return pubdates

def generate_rss(entries, output_file):
    existing_pubdates = parse_existing_pubdates(output_file)
    rss = ET.Element('rss', {
        'version': '2.0',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
        'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'xmlns:media': 'http://search.yahoo.com/mrss/'
    })
    channel = ET.SubElement(rss, 'channel')
    ET.SubElement(channel, 'title').text = '誤字ロマの日記'
    ET.SubElement(channel, 'link').text = 'https://nikki.poet.blue'
    ET.SubElement(channel, 'description').text = '誤字ロマの日記です。'
    ET.SubElement(channel, 'language').text = 'ja'
    now_jst = datetime.now(JST)
    ET.SubElement(channel, 'lastBuildDate').text = now_jst.strftime('%a, %d %b %Y %H:%M:%S +0900')
    ET.SubElement(channel, 'itunes:image', href='https://nikki.poet.blue/cover.png')
    ET.SubElement(channel, 'media:thumbnail', url='https://nikki.poet.blue/cover.png')
    image = ET.SubElement(channel, 'image')
    ET.SubElement(image, 'url').text = 'https://nikki.poet.blue/cover.png'
    ET.SubElement(image, 'title').text = '誤字ロマの日記'
    ET.SubElement(image, 'link').text = 'https://nikki.poet.blue'
    ET.SubElement(channel, 'atom:link', {
        'href': 'https://nikki.poet.blue/rss.xml',
        'rel': 'self',
        'type': 'application/rss+xml'
    })

    today_str = now_jst.strftime('%Y%m%d')

    for entry in sorted(entries, key=lambda x: x['date'], reverse=True):
        item = ET.SubElement(channel, 'item')
        ET.SubElement(item, 'title').text = format_japanese_date_with_day_of_week(entry['date'])
        ET.SubElement(item, 'link').text = f"https://nikki.poet.blue#{entry['date']}"
        
        entry_date = entry['date']
        if entry_date == today_str:
            pub_date_str = now_jst.strftime('%a, %d %b %Y %H:%M:%S +0900')
        elif entry_date in existing_pubdates:
            pub_date_str = existing_pubdates[entry_date]
        else:
            pub_dt = datetime.strptime(entry['date'], '%Y%m%d').replace(tzinfo=JST)
            pub_date_str = pub_dt.strftime('%a, %d %b %Y 00:00:00 +0900')
            
        ET.SubElement(item, 'pubDate').text = pub_date_str
        ET.SubElement(item, 'description').text = entry['content'].replace('\n', '<br />')
        ET.SubElement(item, 'guid', isPermaLink='false').text = f"urn:nikki.poet.blue:{entry['date']}"
        # 画像URLを追加
        ET.SubElement(item, 'media:content', {
            'url': f"https://nc.poet.blue/{entry['date']}",
            'type': 'image/svg+xml',
            'medium': 'image'
        })

    rough = ET.tostring(rss, encoding='utf-8', method='xml')
    reparsed = minidom.parseString(rough)
    pretty = reparsed.toprettyxml(indent='  ')
    lines = [line for line in pretty.splitlines() if line.strip()][1:]
    final_xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + '\n'.join(lines) + '\n'
    with open(output_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(final_xml)

if __name__ == '__main__':
    with open('entry.md', 'r', encoding='utf-8') as f:
        markdown_text = f.read()
    entries = parse_entries(markdown_text)
    generate_rss(entries, 'rss.xml')
    print('rss.xml を生成しました！（サムネイル画像も出るよ）')
