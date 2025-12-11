#!/usr/bin/env python3
"""
Populate Exodus (40 chapters, ~1213 verses) with all 9 languages.
"""

import json
import re
from pathlib import Path

# Import parsers
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

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SOURCES_DIR = PROJECT_ROOT / "sources"
CHAPTERS_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters" / "EXO"

# Exodus has 40 chapters
NUM_CHAPTERS = 40


def generate_base36_files(start_code, num_chapters):
    """Generate base-36 file mappings starting from a given code."""
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    
    # Parse start code (e.g., "1I" -> 1*36 + 18 = 54)
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


# Vatican HTML file mappings for Exodus
# English NAB: starts at __P1I.HTM (ch1)
NAB_EXODUS = generate_base36_files("1I", NUM_CHAPTERS)

# Spanish: starts at __P1H.HTM (ch1)
SPANISH_EXODUS = generate_base36_files("1H", NUM_CHAPTERS)

# Italian: starts at __P1F.HTM (ch1)
ITALIAN_EXODUS = generate_base36_files("1F", NUM_CHAPTERS)


def update_chapter_file(chapter_num, translations_data):
    """Update a chapter JSON file with translation data."""
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
    print("Populating Exodus with 9 Languages")
    print("=" * 60)
    
    print("\n📖 Parsing source files...")
    
    all_translations = {}
    
    # Hebrew WLC
    print("\n  Parsing Hebrew (WLC)...")
    wlc_path = SOURCES_DIR / "hebrew" / "wlc" / "Exod.xml"
    all_translations['WLC'] = parse_hebrew_wlc(wlc_path, "Exod")
    if all_translations['WLC']:
        print(f"  ✅ Hebrew WLC: {sum(len(v) for v in all_translations['WLC'].values())} verses")
    else:
        print(f"  ❌ Hebrew WLC: Not found")
    
    # Greek LXX
    print("\n  Parsing Greek (LXX)...")
    lxx_path = SOURCES_DIR / "greek" / "septuagint" / "02.Exo.txt"
    all_translations['LXX'] = parse_greek_lxx(lxx_path)
    if all_translations['LXX']:
        print(f"  ✅ Greek LXX: {sum(len(v) for v in all_translations['LXX'].values())} verses")
    else:
        print(f"  ❌ Greek LXX: Not found")
    
    # Latin Vulgate
    print("\n  Parsing Latin (VUL)...")
    vul_path = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / "Ex.lat"
    all_translations['VUL'] = parse_latin_vulgate(vul_path)
    if all_translations['VUL']:
        print(f"  ✅ Latin VUL: {sum(len(v) for v in all_translations['VUL'].values())} verses")
    else:
        print(f"  ❌ Latin VUL: Not found")
    
    # Russian Synodal
    print("\n  Parsing Russian (SYN)...")
    syn_path = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / "02_ish.txt"
    all_translations['SYN'] = parse_russian_synodal(syn_path)
    if all_translations['SYN']:
        print(f"  ✅ Russian SYN: {sum(len(v) for v in all_translations['SYN'].values())} verses")
    else:
        print(f"  ❌ Russian SYN: Not found")
    
    # French néo-Crampon
    print("\n  Parsing French (NEO)...")
    neo_path = SOURCES_DIR / "french" / "neo-crampon" / "03-EXOfrancl.usfm"
    all_translations['NEO'] = parse_french_usfm(neo_path)
    if all_translations['NEO']:
        print(f"  ✅ French NEO: {sum(len(v) for v in all_translations['NEO'].values())} verses")
    else:
        print(f"  ❌ French NEO: Not found")
    
    # English NAB
    print("\n  Parsing English (NAB)...")
    nab_dir = SOURCES_DIR / "english" / "nab-vatican"
    nab_files = {ch: nab_dir / f for ch, f in NAB_EXODUS.items()}
    all_translations['NAB'] = parse_vatican_html_nab(nab_files)
    if all_translations['NAB']:
        print(f"  ✅ English NAB: {sum(len(v) for v in all_translations['NAB'].values())} verses")
    else:
        print(f"  ❌ English NAB: Not found")
    
    # Spanish
    print("\n  Parsing Spanish (VAT_ES)...")
    spanish_dir = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
    spanish_files = {ch: spanish_dir / f for ch, f in SPANISH_EXODUS.items()}
    all_translations['VAT_ES'] = parse_vatican_html_spanish(spanish_files)
    if all_translations['VAT_ES']:
        print(f"  ✅ Spanish VAT_ES: {sum(len(v) for v in all_translations['VAT_ES'].values())} verses")
    else:
        print(f"  ❌ Spanish VAT_ES: Not found")
    
    # Italian CEI
    print("\n  Parsing Italian (CEI)...")
    italian_dir = SOURCES_DIR / "italian" / "vatican"
    italian_files = {ch: italian_dir / f for ch, f in ITALIAN_EXODUS.items()}
    all_translations['CEI'] = parse_vatican_html_cei(italian_files)
    if all_translations['CEI']:
        print(f"  ✅ Italian CEI: {sum(len(v) for v in all_translations['CEI'].values())} verses")
    else:
        print(f"  ❌ Italian CEI: Not found")
    
    # Portuguese - pending permission
    print("\n  Portuguese (POR)...")
    print("  ⏳ Pending: Awaiting permission from Editora Ave-Maria")
    all_translations['POR'] = {}
    
    # Summary
    print("\n" + "=" * 60)
    print("Translation Summary:")
    for code, verses in all_translations.items():
        if verses:
            total = sum(len(v) for v in verses.values())
            chapters = len(verses)
            print(f"  {code}: {total} verses across {chapters} chapters")
        else:
            print(f"  {code}: Not available")
    
    # Update chapter files
    print("\n📝 Updating chapter files...")
    
    total_updates = 0
    for chapter_num in range(1, NUM_CHAPTERS + 1):
        count = update_chapter_file(chapter_num, all_translations)
        total_updates += count
        if chapter_num % 10 == 0 or chapter_num == NUM_CHAPTERS:
            print(f"  Processed chapters 1-{chapter_num}...")
    
    print(f"\n✅ Exodus population complete! {total_updates} translations added.")


if __name__ == "__main__":
    main()
