import re
import math
from midiutil import MIDIFile
import os
from datetime import datetime

def freq_to_midi_note(freq: float) -> int:
    """周波数 → MIDIノート番号 (A4=440Hz基準)"""
    if freq <= 0:
        return 60
    return round(69 + 12 * math.log2(freq / 440.0))

def parse_entry_md():
    """entry.mdから日付、contentの文字数、体調・天気・活動の種類を抽出"""
    md_file = "entry.md"
    if not os.path.exists(md_file):
        print(f"エラー: {md_file} が見つかりません")
        return []

    with open(md_file, "r", encoding="utf-8") as f:
        text = f.read()

    # --- で区切られたブロックをパース
    pattern = r'---\s*\ndate:\s*(\d{8})\s*\ncontent:\s*\|\s*\n(.*?)(?=\n---|\Z)'
    matches = re.findall(pattern, text, re.DOTALL | re.MULTILINE)

    entries = []
    for date, content_block in matches:
        clean_content = content_block.strip()
        char_count = len(clean_content)
        if char_count > 0:
            # 体調・天気・活動の種類を抽出（例: コンディション: 5、天気: 晴れ、活動: 散歩）
            condition = 3  # デフォルト
            weather = "unknown"
            activity = "unknown"

            # 体調の抽出
            condition_match = re.search(r'コンディション:\s*(\d+)', content_block)
            if condition_match:
                condition = int(condition_match.group(1))

            # 天気の抽出
            weather_match = re.search(r'天気:\s*(\S+)', content_block)
            if weather_match:
                weather = weather_match.group(1)

            # 活動の抽出
            activity_match = re.search(r'活動:\s*(\S+)', content_block)
            if activity_match:
                activity = activity_match.group(1)

            entries.append((date, char_count, condition, weather, activity))

    # 最新のエントリが最初になるように逆順にソート
    entries.sort(key=lambda x: x[0], reverse=True)
    return entries

def create_all_in_one_midi(entries, filename="96days_diary_tones.mid"):
    """全エントリの音を1つのMIDIファイルにまとめる"""
    if not entries:
        print("エントリがありません")
        return

    track    = 0
    channel  = 0
    tempo    = 180          # BPM
    volume   = 100          # 0-127
    duration = 0.3          # 各音の長さ（秒）
    gap_base = 0.1          # 基本のギャップ（秒）

    MyMIDI = MIDIFile(1)
    MyMIDI.addTempo(track, 0, tempo)

    current_time = 0.0
    last_note = None

    print("生成中...")
    for i, (date, char_count, condition, weather, activity) in enumerate(entries, 1):
        # 文字数に応じた周波数
        min_freq = 320.0
        max_freq = 3200.0
        freq = max(min_freq, min(max_freq, min_freq + char_count * 0.5))
        midi_note = freq_to_midi_note(freq)

        # 体調・天気・活動に応じた音色の調整
        instrument = 88  # マレット
        if condition >= 4:
            instrument = 73  # フルート（体調が良い）
        elif condition <= 2:
            instrument = 48  # ストリングス（体調が悪い）
        if "雨" in weather:
            instrument = 52  # チョイリング（雨の日）
        if "散歩" in activity:
            instrument = 33  # ベース（散歩）

        MyMIDI.addProgramChange(track, channel, 0, instrument)

        # 文字数に応じてギャップを調整
        gap = gap_base + (char_count / 3000)

        MyMIDI.addNote(track, channel, midi_note, current_time, duration, volume)

        # 進捗表示（10個ごとに）
        if i % 10 == 0 or i == len(entries):
            print(f"  {i:3d}/{len(entries)}  {date} ({char_count}文字, 体調: {condition}, 天気: {weather}, 活動: {activity}) → MIDI {midi_note}")

        current_time += duration + gap
        last_note = midi_note

    # 保存
    with open(filename, "wb") as f:
        MyMIDI.writeFile(f)

    total_sec = current_time
    minutes = int(total_sec // 60)
    seconds = int(total_sec % 60)

    print("\n完了！")
    print(f"ファイル: {filename}")
    print(f"エントリ数: {len(entries)}")
    print(f"合計長さ: 約 {minutes}分 {seconds}秒")
    print(f"最後の音: MIDIノート {last_note}")
    print("MIDIプレーヤー / DAW で開いて聴いてみてください")

if __name__ == "__main__":
    entries = parse_entry_md()
    if entries:
        print(f"解析したエントリ数: {len(entries)}")
        create_all_in_one_midi(entries)
    else:
        print("エントリが見つかりませんでした")
