#!/usr/bin/env python3
"""
Populate 1 Chronicles (29 chapters, ~942 verses) with all 9 languages.
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
CHAPTERS_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters" / "I_PAR"

NUM_CHAPTERS = 29


def generate_base36_files(start_code, num_chapters):
    """Generate base-36 file names for Vatican HTML files."""
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if len(start_code) == 1:
        start = chars.index(start_code.upper())
    else:
        start = chars.index(start_code[0].upper()) * 36 + chars.index(start_code[1].upper())
    
    files = {}
    for ch in range(1, num_chapters + 1):
        offset = start + (ch - 1)
        if offset < 36:
            files[ch] = f"__P{chars[offset]}.HTM"
        else:
            high = offset // 36
            low = offset % 36
            files[ch] = f"__P{chars[high]}{chars[low]}.HTM"
    return files


# 1 Chronicles chapter files (29 chapters)
# NAB: __P9R.HTM (ch1) - 9R in base36 = 9*36+27 = 351
# Spanish: __PNT.HTM (ch1) - NT = 23*36+29 = 857
# Italian: __P9F.HTM (ch1) - 9F = 9*36+15 = 339
NAB_1CHR = generate_base36_files("9R", NUM_CHAPTERS)
SPANISH_1CHR = generate_base36_files("NT", NUM_CHAPTERS)
ITALIAN_1CHR = generate_base36_files("9F", NUM_CHAPTERS)


def update_chapter_file(chapter_num, translations_data):
    """Update a single chapter JSON file with translations."""
    chapter_file = CHAPTERS_DIR / f"{chapter_num:03d}.json"
    if not chapter_file.exists():
        print(f"  ❌ Chapter file not found: {chapter_file}")
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


def main():
    print("=" * 60)
    print("Populating 1 Chronicles with 9 Languages")
    print("=" * 60)
    
    all_translations = {}
    
    # Hebrew WLC
    print("\n  Parsing Hebrew (WLC)...")
    all_translations['WLC'] = parse_hebrew_wlc(SOURCES_DIR / "hebrew" / "wlc" / "1Chr.xml", "1Chr")
    print(f"  ✅ Hebrew WLC: {sum(len(v) for v in all_translations['WLC'].values())} verses" if all_translations['WLC'] else "  ❌ Not found")
    
    # Greek LXX
    print("\n  Parsing Greek (LXX)...")
    all_translations['LXX'] = parse_greek_lxx(SOURCES_DIR / "greek" / "septuagint" / "13.1Ch.txt")
    print(f"  ✅ Greek LXX: {sum(len(v) for v in all_translations['LXX'].values())} verses" if all_translations['LXX'] else "  ❌ Not found")
    
    # Latin Vulgate
    print("\n  Parsing Latin (VUL)...")
    all_translations['VUL'] = parse_latin_vulgate(SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / "1Par.lat")
    print(f"  ✅ Latin VUL: {sum(len(v) for v in all_translations['VUL'].values())} verses" if all_translations['VUL'] else "  ❌ Not found")
    
    # Russian Synodal
    print("\n  Parsing Russian (SYN)...")
    all_translations['SYN'] = parse_russian_synodal(SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / "13_1par.txt")
    print(f"  ✅ Russian SYN: {sum(len(v) for v in all_translations['SYN'].values())} verses" if all_translations['SYN'] else "  ❌ Not found")
    
    # French néo-Crampon
    print("\n  Parsing French (NEO)...")
    all_translations['NEO'] = parse_french_usfm(SOURCES_DIR / "french" / "neo-crampon" / "14-1CHfrancl.usfm")
    print(f"  ✅ French NEO: {sum(len(v) for v in all_translations['NEO'].values())} verses" if all_translations['NEO'] else "  ❌ Not found")
    
    # English NAB
    print("\n  Parsing English (NAB)...")
    nab_dir = SOURCES_DIR / "english" / "nab-vatican"
    nab_files = {ch: nab_dir / fname for ch, fname in NAB_1CHR.items()}
    all_translations['NAB'] = parse_vatican_html_nab(nab_files)
    print(f"  ✅ English NAB: {sum(len(v) for v in all_translations['NAB'].values())} verses" if all_translations['NAB'] else "  ❌ Not found")
    
    # Spanish (Libro del Pueblo de Dios)
    print("\n  Parsing Spanish (VAT_ES)...")
    spanish_dir = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
    spanish_files = {ch: spanish_dir / fname for ch, fname in SPANISH_1CHR.items()}
    all_translations['VAT_ES'] = parse_vatican_html_spanish(spanish_files)
    print(f"  ✅ Spanish VAT_ES: {sum(len(v) for v in all_translations['VAT_ES'].values())} verses" if all_translations['VAT_ES'] else "  ❌ Not found")
    
    # Italian CEI
    print("\n  Parsing Italian (CEI)...")
    italian_dir = SOURCES_DIR / "italian" / "vatican"
    italian_files = {ch: italian_dir / fname for ch, fname in ITALIAN_1CHR.items()}
    all_translations['CEI'] = parse_vatican_html_cei(italian_files)
    print(f"  ✅ Italian CEI: {sum(len(v) for v in all_translations['CEI'].values())} verses" if all_translations['CEI'] else "  ❌ Not found")
    
    # Portuguese (pending permission)
    print("\n  Portuguese (POR)... ⏳ Pending permission")
    
    # Update chapter files
    print("\n" + "=" * 60)
    print("Updating chapter files...")
    
    total_updates = 0
    for ch in range(1, NUM_CHAPTERS + 1):
        count = update_chapter_file(ch, all_translations)
        total_updates += count
    
    print(f"\n✅ 1 Chronicles complete! {total_updates} translations added.")


if __name__ == "__main__":
    main()
