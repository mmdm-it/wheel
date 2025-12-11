#!/usr/bin/env python3
"""
Populate Psalms (150 chapters, ~2461 verses) with all 9 languages.
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
CHAPTERS_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters" / "PSAL"

NUM_CHAPTERS = 150


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


# Psalms chapter files (150 chapters)
# NAB: __PFT.HTM (ch1) - FT in base36 = 15*36+29 = 569
# Spanish: __PG6.HTM (ch1) - G6 = 16*36+6 = 582
# Italian: __PF0.HTM (ch1) - F0 = 15*36+0 = 540
NAB_PSALMS = generate_base36_files("FT", NUM_CHAPTERS)
SPANISH_PSALMS = generate_base36_files("G6", NUM_CHAPTERS)
ITALIAN_PSALMS = generate_base36_files("F0", NUM_CHAPTERS)


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
    print("Populating Psalms with 9 Languages")
    print("=" * 60)
    
    all_translations = {}
    
    # Hebrew WLC
    print("\n  Parsing Hebrew (WLC)...")
    all_translations['WLC'] = parse_hebrew_wlc(SOURCES_DIR / "hebrew" / "wlc" / "Ps.xml", "Ps")
    print(f"  ✅ Hebrew WLC: {sum(len(v) for v in all_translations['WLC'].values())} verses" if all_translations['WLC'] else "  ❌ Not found")
    
    # Greek LXX
    print("\n  Parsing Greek (LXX)...")
    all_translations['LXX'] = parse_greek_lxx(SOURCES_DIR / "greek" / "septuagint" / "18.Psa.txt")
    print(f"  ✅ Greek LXX: {sum(len(v) for v in all_translations['LXX'].values())} verses" if all_translations['LXX'] else "  ❌ Not found")
    
    # Latin Vulgate
    print("\n  Parsing Latin (VUL)...")
    all_translations['VUL'] = parse_latin_vulgate(SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / "Ps.lat")
    print(f"  ✅ Latin VUL: {sum(len(v) for v in all_translations['VUL'].values())} verses" if all_translations['VUL'] else "  ❌ Not found")
    
    # Russian Synodal
    print("\n  Parsing Russian (SYN)...")
    all_translations['SYN'] = parse_russian_synodal(SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / "22_ps.txt")
    print(f"  ✅ Russian SYN: {sum(len(v) for v in all_translations['SYN'].values())} verses" if all_translations['SYN'] else "  ❌ Not found")
    
    # French néo-Crampon
    print("\n  Parsing French (NEO)...")
    all_translations['NEO'] = parse_french_usfm(SOURCES_DIR / "french" / "neo-crampon" / "20-PSAfrancl.usfm")
    print(f"  ✅ French NEO: {sum(len(v) for v in all_translations['NEO'].values())} verses" if all_translations['NEO'] else "  ❌ Not found")
    
    # English NAB
    print("\n  Parsing English (NAB)...")
    nab_dir = SOURCES_DIR / "english" / "nab-vatican"
    nab_files = {ch: nab_dir / fname for ch, fname in NAB_PSALMS.items()}
    all_translations['NAB'] = parse_vatican_html_nab(nab_files)
    print(f"  ✅ English NAB: {sum(len(v) for v in all_translations['NAB'].values())} verses" if all_translations['NAB'] else "  ❌ Not found")
    
    # Spanish (Libro del Pueblo de Dios)
    print("\n  Parsing Spanish (VAT_ES)...")
    spanish_dir = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
    spanish_files = {ch: spanish_dir / fname for ch, fname in SPANISH_PSALMS.items()}
    all_translations['VAT_ES'] = parse_vatican_html_spanish(spanish_files)
    print(f"  ✅ Spanish VAT_ES: {sum(len(v) for v in all_translations['VAT_ES'].values())} verses" if all_translations['VAT_ES'] else "  ❌ Not found")
    
    # Italian CEI
    print("\n  Parsing Italian (CEI)...")
    italian_dir = SOURCES_DIR / "italian" / "vatican"
    italian_files = {ch: italian_dir / fname for ch, fname in ITALIAN_PSALMS.items()}
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
    
    print(f"\n✅ Psalms complete! {total_updates} translations added.")


if __name__ == "__main__":
    main()
