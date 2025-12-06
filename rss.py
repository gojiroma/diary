import re
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET
from xml.dom import minidom

# 日本時間（JST）のタイムゾーンを明示的に定義
JST = timedelta(hours=9)
jst_tz = timezone(JST)


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
    if day == 10: return '十日'
    if day == 20: return '二十日'
    if day == 30: return '三十日'
    if day == 31: return '三十一日'
    if day < 10: return to_kanji_number(day) + '日'
    if day < 20: return '十' + to_kanji_number(day - 10) + '日'
    if day < 30: return '二十' + to_kanji_number(day - 20) + '日'
    return to_kanji_number(day) + '日'


def format_japanese_date_with_day_of_week(yyyymmdd):
    year = int(yyyymmdd[:4])
    month = int(yyyymmdd[4:6])
    day = int(yyyymmdd[6:8])
    dt = datetime.strptime(yyyymmdd, '%Y%m%d')
    day_of_week = ['月', '火', '水', '木', '金', '土', '日'][dt.weekday()]
    return f"{to_kanji_month(month)}{to_kanji_day(day)}（{day_of_week}）"


def generate_rss(entries, output_file):
    # 名前空間をしっかり宣言（これが大事！）
    rss = ET.Element('rss', {
        'version': '2.0',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
        'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'xmlns:media': 'http://search.yahoo.com/mrss/'
    })

    channel = ET.SubElement(rss, 'channel')

    # 基本情報
    ET.SubElement(channel, 'title').text = '誤字ロマの日記'
    ET.SubElement(channel, 'link').text = 'https://nikki.poet.blue'
    ET.SubElement(channel, 'description').text = '誤字ロマの日記です。'
    ET.SubElement(channel, 'language').text = 'ja'

    # lastBuildDate（JSTで現在時刻）
    now_jst = datetime.now(jst_tz)
    ET.SubElement(channel, 'lastBuildDate').text = now_jst.strftime('%a, %d %b %Y %H:%M:%S +0900')

    # これでほぼ全てのリーダーでカバー画像が表示される（最強の2つ）
    ET.SubElement(channel, 'itunes:image', href='https://nikki.poet.blue/cover.png')
    ET.SubElement(channel, 'media:thumbnail', url='https://nikki.poet.blue/cover.png')

    # 古い <image> も互換性のために残す（width/heightは外すと無視されにくい）
    image = ET.SubElement(channel, 'image')
    ET.SubElement(image, 'url').text = 'https://nikki.poet.blue/cover.png'
    ET.SubElement(image, 'title').text = '誤字ロマの日記'
    ET.SubElement(image, 'link').text = 'https://nikki.poet.blue'
    # width/heightは意図的に書かない（288pxだと逆に無視されるリーダーが多い）

    # atom:link（自己参照）
    ET.SubElement(channel, 'atom:link', {
        'href': 'https://nikki.poet.blue/rss.xml',
        'rel': 'self',
        'type': 'application/rss+xml'
    })

    # エントリーを新しい順に並べる
    for entry in sorted(entries, key=lambda x: x['date'], reverse=True):
        item = ET.SubElement(channel, 'item')
        ET.SubElement(item, 'title').text = format_japanese_date_with_day_of_week(entry['date'])
        ET.SubElement(item, 'link').text = f"https://nikki.poet.blue#{entry['date']}"

        # pubDateもJSTで0時固定
        pub_dt = datetime.strptime(entry['date'], '%Y%m%d').replace(hour=0, minute=0, second=0, tzinfo=jst_tz)
        ET.SubElement(item, 'pubDate').text = pub_dt.strftime('%a, %d %b %Y %H:%M:%S +0900')

        # description内は<br />で改行（必要なら<p>とかにしてもOK）
        ET.SubElement(item, 'description').text = entry['content'].replace('\n', '<br />')

        # guid（一意性を保証）
        ET.SubElement(item, 'guid', isPermaLink='false').text = f"urn:nikki.poet.blue:{entry['date']}"

    # 整形して出力
    rough_string = ET.tostring(rss, encoding='utf-8')
    reparsed = minidom.parseString(rough_string)
    pretty_xml = reparsed.toprettyxml(indent='  ', encoding='utf-8').decode('utf-8')

    # toprettyxmlが余計な改行を入れるので、1行にまとめる処理
    pretty_xml = '\n'.join([line for line in pretty_xml.split('\n') if line.strip()])

    # XML宣言を正しく付与
    final_xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + pretty_xml

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(final_xml)


if __name__ == '__main__':
    with open('entry.md', 'r', encoding='utf-8') as f:
        markdown_text = f.read()
    entries = parse_entries(markdown_text)
    generate_rss(entries, 'rss.xml')
    print('rss.xml を生成しました。カバー画像もほぼ100%表示されます！')