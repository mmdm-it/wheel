#!/usr/bin/env python3
"""
Populate Deuterocanonical/Apocryphal books with available languages.
Books: Tobit, Judith, Esther, Wisdom, Sirach, Baruch
"""

import json
from pathlib import Path

from parsers import (
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


# Deuterocanonical books configuration
# Format: (book_name, dir_code, num_chapters, greek_file, latin_file, russian_file, french_file, nab_start, spanish_start, italian_start)
# Note: No Hebrew for these (Greek origin), Italian Tobit not available
DEUTEROCANONICAL = [
    ("Tobit", "TOBI", 14, "28.Tob.txt", "Tob.lat", "18_tov.txt", "41-TOBfrancl.usfm", "CB", "QV", None),
    ("Judith", "IUDITH", 16, "27.Jdt.txt", "Jdt.lat", "19_iudif.txt", "42-JDTfrancl.usfm", "CQ", "QF", "C9"),
    ("Esther", "ESTH", 16, None, "Est.lat", "20_esf.txt", "18-ESTfrancl.usfm", "D8", "N7", "CP"),
    ("Wisdom", "SAPI", 19, "23.Wis.txt", "Sap.lat", "26_premsol.txt", "45-WISfrancl.usfm", "LI", "S4", "KL"),
    ("Sirach", "ECCLU", 51, "25.Sir.txt", "Sir.lat", "27_sirah.txt", "46-SIRfrancl.usfm", "M3", "SN", "L4"),
    ("Baruch", "BARU", 6, "44.Bar.txt", "Bar.lat", "32_var.txt", "47-BARfrancl.usfm", "R2", "U2", "PY"),
]


def update_chapter_file(chapters_dir, chapter_num, translations_data):
    """Update a single chapter JSON file with translations."""
    chapter_file = chapters_dir / f"{chapter_num:03d}.json"
    if not chapter_file.exists():
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


def populate_book(book_name, dir_code, num_chapters, greek_file, latin_file, russian_file, french_file, nab_start, spanish_start, italian_start):
    """Populate a single Deuterocanonical book."""
    print(f"\n{'='*60}")
    print(f"Populating {book_name} ({num_chapters} chapters)")
    print("="*60)
    
    chapters_dir = CHAPTERS_BASE / dir_code
    if not chapters_dir.exists():
        print(f"  ❌ Directory not found: {chapters_dir}")
        return 0
    
    all_translations = {}
    
    # Generate Vatican file mappings
    nab_files = generate_base36_files(nab_start, num_chapters)
    spanish_files = generate_base36_files(spanish_start, num_chapters)
    italian_files = generate_base36_files(italian_start, num_chapters) if italian_start else {}
    
    # Greek LXX
    if greek_file:
        greek_path = SOURCES_DIR / "greek" / "septuagint" / greek_file
        if greek_path.exists():
            all_translations['LXX'] = parse_greek_lxx(greek_path)
            count = sum(len(v) for v in all_translations['LXX'].values()) if all_translations['LXX'] else 0
            print(f"  ✅ Greek LXX: {count} verses")
    
    # Latin Vulgate
    if latin_file:
        latin_path = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / latin_file
        if latin_path.exists():
            all_translations['VUL'] = parse_latin_vulgate(latin_path)
            count = sum(len(v) for v in all_translations['VUL'].values()) if all_translations['VUL'] else 0
            print(f"  ✅ Latin VUL: {count} verses")
    
    # Russian Synodal
    if russian_file:
        russian_path = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / russian_file
        if russian_path.exists():
            all_translations['SYN'] = parse_russian_synodal(russian_path)
            count = sum(len(v) for v in all_translations['SYN'].values()) if all_translations['SYN'] else 0
            print(f"  ✅ Russian SYN: {count} verses")
    
    # French Neo-Crampon
    if french_file:
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
    
    # Italian CEI (if available)
    if italian_start:
        italian_dir = SOURCES_DIR / "italian" / "vatican"
        italian_paths = {ch: italian_dir / fname for ch, fname in italian_files.items()}
        all_translations['CEI'] = parse_vatican_html_cei(italian_paths)
        count = sum(len(v) for v in all_translations['CEI'].values()) if all_translations['CEI'] else 0
        print(f"  ✅ Italian CEI: {count} verses")
    else:
        print(f"  ⏳ Italian CEI: Not available")
    
    # Update chapter files
    total_updates = 0
    for ch in range(1, num_chapters + 1):
        count = update_chapter_file(chapters_dir, ch, all_translations)
        total_updates += count
    
    print(f"  ✅ {book_name} complete! {total_updates} translations added.")
    return total_updates


def main():
    print("=" * 60)
    print("POPULATING DEUTEROCANONICAL BOOKS (6 books)")
    print("=" * 60)
    
    grand_total = 0
    for config in DEUTEROCANONICAL:
        total = populate_book(*config)
        grand_total += total
    
    print("\n" + "=" * 60)
    print(f"ALL DEUTEROCANONICAL COMPLETE! {grand_total} total translations added.")
    print("=" * 60)


if __name__ == "__main__":
    main()
