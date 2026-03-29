from collections import Counter
from fontTools.ttLib import TTFont
from bs4 import BeautifulSoup

def get_font_chars(font_path):
    """OTF/TTFファイルからサポートされている文字コードを取得"""
    font = TTFont(font_path)
    chars = set()
    for table in font['cmap'].tables:
        chars.update(table.cmap.keys())
    font.close()
    return {chr(c) for c in chars if 0x20 <= c <= 0xFFFF}

def get_text_chars(file_path):
    """テキストファイルまたはHTMLファイルから使用されている文字を抽出"""
    with open(file_path, 'r', encoding='utf-8') as f:
        if file_path.endswith('.html'):
            soup = BeautifulSoup(f, 'html.parser')
            text = soup.get_text()
        else:
            text = f.read()
    return text

def find_unsupported_chars(font_path, file_paths, exclude_chars):
    """フォントに含まれない文字を抽出し、除外文字を除く"""
    font_chars = get_font_chars(font_path)
    char_counter = Counter()

    for file_path in file_paths:
        text = get_text_chars(file_path)
        char_counter.update(text)

    # フォントに含まれない文字を抽出
    unsupported_chars = {char for char in char_counter if char not in font_chars}

    # 除外文字を除く
    unsupported_chars = unsupported_chars - set(exclude_chars)

    return sorted(unsupported_chars)

# 除外したい文字
exclude_chars = '▫☃☻゙゚️🍕🍵🐏🐑🐱📞'

# ファイルパス
font_path = 'gojiromanus.otf'
file_paths = ['entry.md', 'fake.md', 'index.html']

# 実行
unsupported_chars = find_unsupported_chars(font_path, file_paths, exclude_chars)

# 結果を出力
print("フォントに含まれない文字（除外文字を除く）:")
print(''.join(unsupported_chars))
