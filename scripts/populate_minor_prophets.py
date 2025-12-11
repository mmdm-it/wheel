#!/usr/bin/env python3
"""
Populate all Minor Prophets (Joel through Malachi) with all 9 languages.
11 books total: Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi
"""

import json
from pathlib import Path

from parsers import (
    parse_hebrew_wlc,
    parse_greek_lxx,
    parse_latin_vulgate,
    parse_russian_synodal,
    parse_french_usfm,
    parse_vatican_html_nab,
    parse_vatican_html_spanish,
    parse_vatican_html_cei,
)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SOURCES_DIR = PROJECT_ROOT / "sources"
CHAPTERS_BASE = PROJECT_ROOT / "data" / "gutenberg" / "chapters"


def generate_base36_files(start_code, num_chapters):
    """Generate base-36 file names for Vatican HTML files."""
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if len(start_code) == 1:
        start = chars.index(start_code.upper())
    elif len(start_code) == 2:
        start = chars.index(start_code[0].upper()) * 36 + chars.index(start_code[1].upper())
    else:
        # 3-char codes
        start = (chars.index(start_code[0].upper()) * 36 * 36 + 
                 chars.index(start_code[1].upper()) * 36 + 
                 chars.index(start_code[2].upper()))
    
    files = {}
    for ch in range(1, num_chapters + 1):
        offset = start + (ch - 1)
        if offset < 36:
            files[ch] = f"__P{chars[offset]}.HTM"
        elif offset < 36 * 36:
            high = offset // 36
            low = offset % 36
            files[ch] = f"__P{chars[high]}{chars[low]}.HTM"
        else:
            h = offset // (36 * 36)
            m = (offset % (36 * 36)) // 36
            l = offset % 36
            files[ch] = f"__P{chars[h]}{chars[m]}{chars[l]}.HTM"
    return files


# Minor Prophets configuration
# Format: (book_name, dir_code, num_chapters, hebrew_file, greek_file, latin_file, russian_file, french_file, nab_start, spanish_start, italian_start)
MINOR_PROPHETS = [
    ("Joel", "IOEL", 4, "Joel.xml", "31.Joe.txt", "Jl.lat", "36_ioil.txt", "30-JOLfrancl.usfm", "TG", "EP", "S8"),
    ("Amos", "AMO", 9, "Amos.xml", "32.Amo.txt", "Am.lat", "37_amos.txt", "31-AMOfrancl.usfm", "TL", "ET", "SC"),
    ("Obadiah", "ABDI", 1, "Obad.xml", "33.Oba.txt", "Abd.lat", "38_avd.txt", "32-OBAfrancl.usfm", "TU", "F2", "SL"),
    ("Jonah", "IONA", 4, "Jonah.xml", "34.Jon.txt", "Jon.lat", "39_iona.txt", "33-JONfrancl.usfm", "TW", "F3", "SM"),
    ("Micah", "MICH", 7, "Mic.xml", "35.Mic.txt", "Mi.lat", "40_mih.txt", "34-MICfrancl.usfm", "U1", "F7", "SQ"),
    ("Nahum", "NAHU", 3, "Nah.xml", "36.Nah.txt", "Na.lat", "41_naum.txt", "35-NAMfrancl.usfm", "U9", "FE", "SX"),
    ("Habakkuk", "HAB", 3, "Hab.xml", "37.Hab.txt", "Hab.lat", "42_avv.txt", "36-HABfrancl.usfm", "UD", "FH", "T0"),
    ("Zephaniah", "SOPH", 3, "Zeph.xml", "38.Zep.txt", "So.lat", "43_sof.txt", "37-ZEPfrancl.usfm", "UH", "FK", "T3"),
    ("Haggai", "AGGE", 2, "Hag.xml", "39.Hag.txt", "Agg.lat", "44_agg.txt", "38-HAGfrancl.usfm", "UL", "FN", "T6"),
    ("Zechariah", "ZACH", 14, "Zech.xml", "40.Zec.txt", "Za.lat", "45_zah.txt", "39-ZECfrancl.usfm", "UO", "FP", "T8"),
    ("Malachi", "MALA", 3, "Mal.xml", "41.Mal.txt", "Mal.lat", "46_mal.txt", "40-MALfrancl.usfm", "V3", "G3", "TM"),
]


def update_chapter_file(chapters_dir, chapter_num, translations_data):
    """Update a single chapter JSON file with translations."""
    chapter_file = chapters_dir / f"{chapter_num:03d}.json"
    if not chapter_file.exists():
        print(f"    ❌ Chapter file not found: {chapter_file}")
        return 0
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        chapter_data = json.load(f)
    
    verses = chapter_data.get('verses', {})
    updated_count = 0
    
    for verse_key, verse_data in verses.items():
        verse_num = int(verse_key)
        if 'text' not in verse_data:
            verse_data['text'] = {}
        
        for trans_code, trans_verses in translations_data.items():
            if chapter_num in trans_verses and verse_num in trans_verses[chapter_num]:
                text = trans_verses[chapter_num][verse_num]
                if text:
                    verse_data['text'][trans_code] = text
                    updated_count += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count


def populate_book(book_name, dir_code, num_chapters, hebrew_file, greek_file, latin_file, russian_file, french_file, nab_start, spanish_start, italian_start):
    """Populate a single Minor Prophet book."""
    print(f"\n{'='*60}")
    print(f"Populating {book_name} ({num_chapters} chapters)")
    print("="*60)
    
    chapters_dir = CHAPTERS_BASE / dir_code
    all_translations = {}
    
    # Generate Vatican file mappings
    nab_files = generate_base36_files(nab_start, num_chapters)
    spanish_files = generate_base36_files(spanish_start, num_chapters)
    italian_files = generate_base36_files(italian_start, num_chapters)
    
    # Hebrew WLC
    hebrew_path = SOURCES_DIR / "hebrew" / "wlc" / hebrew_file
    if hebrew_path.exists():
        book_code = hebrew_file.replace(".xml", "")
        all_translations['WLC'] = parse_hebrew_wlc(hebrew_path, book_code)
        count = sum(len(v) for v in all_translations['WLC'].values()) if all_translations['WLC'] else 0
        print(f"  ✅ Hebrew WLC: {count} verses")
    
    # Greek LXX
    greek_path = SOURCES_DIR / "greek" / "septuagint" / greek_file
    if greek_path.exists():
        all_translations['LXX'] = parse_greek_lxx(greek_path)
        count = sum(len(v) for v in all_translations['LXX'].values()) if all_translations['LXX'] else 0
        print(f"  ✅ Greek LXX: {count} verses")
    
    # Latin Vulgate
    latin_path = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / latin_file
    if latin_path.exists():
        all_translations['VUL'] = parse_latin_vulgate(latin_path)
        count = sum(len(v) for v in all_translations['VUL'].values()) if all_translations['VUL'] else 0
        print(f"  ✅ Latin VUL: {count} verses")
    
    # Russian Synodal
    russian_path = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / russian_file
    if russian_path.exists():
        all_translations['SYN'] = parse_russian_synodal(russian_path)
        count = sum(len(v) for v in all_translations['SYN'].values()) if all_translations['SYN'] else 0
        print(f"  ✅ Russian SYN: {count} verses")
    
    # French Neo-Crampon
    french_path = SOURCES_DIR / "french" / "neo-crampon" / french_file
    if french_path.exists():
        all_translations['NEO'] = parse_french_usfm(french_path)
        count = sum(len(v) for v in all_translations['NEO'].values()) if all_translations['NEO'] else 0
        print(f"  ✅ French NEO: {count} verses")
    
    # English NAB
    nab_dir = SOURCES_DIR / "english" / "nab-vatican"
    nab_paths = {ch: nab_dir / fname for ch, fname in nab_files.items()}
    all_translations['NAB'] = parse_vatican_html_nab(nab_paths)
    count = sum(len(v) for v in all_translations['NAB'].values()) if all_translations['NAB'] else 0
    print(f"  ✅ English NAB: {count} verses")
    
    # Spanish
    spanish_dir = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
    spanish_paths = {ch: spanish_dir / fname for ch, fname in spanish_files.items()}
    all_translations['VAT_ES'] = parse_vatican_html_spanish(spanish_paths)
    count = sum(len(v) for v in all_translations['VAT_ES'].values()) if all_translations['VAT_ES'] else 0
    print(f"  ✅ Spanish VAT_ES: {count} verses")
    
    # Italian CEI
    italian_dir = SOURCES_DIR / "italian" / "vatican"
    italian_paths = {ch: italian_dir / fname for ch, fname in italian_files.items()}
    all_translations['CEI'] = parse_vatican_html_cei(italian_paths)
    count = sum(len(v) for v in all_translations['CEI'].values()) if all_translations['CEI'] else 0
    print(f"  ✅ Italian CEI: {count} verses")
    
    # Update chapter files
    total_updates = 0
    for ch in range(1, num_chapters + 1):
        count = update_chapter_file(chapters_dir, ch, all_translations)
        total_updates += count
    
    print(f"  ✅ {book_name} complete! {total_updates} translations added.")
    return total_updates


def main():
    print("=" * 60)
    print("POPULATING ALL MINOR PROPHETS (11 books)")
    print("=" * 60)
    
    grand_total = 0
    for config in MINOR_PROPHETS:
        total = populate_book(*config)
        grand_total += total
    
    print("\n" + "=" * 60)
    print(f"ALL MINOR PROPHETS COMPLETE! {grand_total} total translations added.")
    print("=" * 60)


if __name__ == "__main__":
    main()
