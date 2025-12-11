#!/usr/bin/env python3
"""
Populate all 27 New Testament books with translations in JSON format.

Updates existing chapter JSON files with verse translations in the
standard format: verses.{verse_num}.text.{lang_code}

Languages:
- BYZ: Greek (Byzantine NT)
- VUL: Latin (Clementine Vulgate)
- SYN: Russian (Synodal)
- NEO: French (Neo-Crampon)
- NAB: English (NAB)
- VAT_ES: Spanish (Libro del Pueblo de Dios)
- CEI: Italian (CEI)
"""

import json
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from parsers import (
    parse_byzantine_nt_csv,
    parse_latin_vulgate,
    parse_russian_synodal,
    parse_french_usfm,
    parse_vatican_html_nab,
    parse_vatican_html_spanish,
    parse_vatican_html_cei,
    VerseDict
)

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent
CHAPTERS_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters"
SOURCES_DIR = PROJECT_ROOT / "sources"

# Source directories
GREEK_NT_DIR = SOURCES_DIR / "greek" / "byzantine-nt" / "csv-unicode" / "ccat" / "no-variants"
LATIN_DIR = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8"
RUSSIAN_DIR = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt"
FRENCH_DIR = SOURCES_DIR / "french" / "neo-crampon"
NAB_DIR = SOURCES_DIR / "english" / "nab-vatican"
SPANISH_DIR = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
ITALIAN_DIR = SOURCES_DIR / "italian" / "vatican"

# Base36 character set
B36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def generate_base36_files(start_code: str, num_chapters: int) -> dict:
    """Generate base-36 file mappings starting from a given code."""
    start_code = start_code.upper()
    if len(start_code) == 1:
        start = B36_CHARS.index(start_code)
    elif len(start_code) == 2:
        start = B36_CHARS.index(start_code[0]) * 36 + B36_CHARS.index(start_code[1])
    else:
        start = 0
        for i, ch in enumerate(reversed(start_code)):
            start += B36_CHARS.index(ch) * (36 ** i)
    
    files = {}
    for ch in range(1, num_chapters + 1):
        offset = start + (ch - 1)
        if offset < 36:
            files[ch] = f"__P{B36_CHARS[offset]}.HTM"
        elif offset < 36 * 36:
            high = offset // 36
            low = offset % 36
            files[ch] = f"__P{B36_CHARS[high]}{B36_CHARS[low]}.HTM"
        else:
            d2 = offset // (36 * 36)
            d1 = (offset % (36 * 36)) // 36
            d0 = offset % 36
            files[ch] = f"__P{B36_CHARS[d2]}{B36_CHARS[d1]}{B36_CHARS[d0]}.HTM"
    
    return files


# NT Book configurations
# Format: (book_dir, num_chapters, greek_csv, latin_file, russian_file, french_usfm, nab_start, spanish_start, italian_start)
NT_BOOKS = [
    # Gospels
    ("MATHE", 28, "MAT.csv", "Mt.lat", "51_mf.txt", "70-MATfrancl.usfm", "VA", "UB", "TP"),
    ("MARC", 16, "MAR.csv", "Mc.lat", "52_mk.txt", "71-MRKfrancl.usfm", "W3", "V3", "UW"),
    ("LUCA", 24, "LUK.csv", "Lc.lat", "53_lk.txt", "72-LUKfrancl.usfm", "WK", "VJ", "VD"),
    ("IOHA", 21, "JOH.csv", "Jo.lat", "54_in.txt", "73-JHNfrancl.usfm", "X9", "W7", "W2"),
    
    # History
    ("ACTU", 28, "ACT.csv", "Act.lat", "55_deyan.txt", "74-ACTfrancl.usfm", "XV", "WS", "WN"),
    
    # Pauline Epistles
    ("ROM", 16, "ROM.csv", "Rom.lat", "63_rim.txt", "75-ROMfrancl.usfm", "YP", "XK", "XG"),
    ("I_COR", 16, "1CO.csv", "1Cor.lat", "64_1kor.txt", "76-1COfrancl.usfm", "Z6", "Y0", "XX"),
    ("II_COR", 13, "2CO.csv", "2Cor.lat", "65_2kor.txt", "77-2COfrancl.usfm", "ZN", "YG", "YE"),
    ("GALA", 6, "GAL.csv", "Gal.lat", "66_gal.txt", "78-GALfrancl.usfm", "101", "YT", "YR"),
    ("EPHE", 6, "EPH.csv", "Eph.lat", "67_ef.txt", "79-EPHfrancl.usfm", "108", "Z0", "YX"),
    ("PHILI", 4, "PHP.csv", "Phlp.lat", "68_fil.txt", "80-PHPfrancl.usfm", "10F", "Z6", "Z3"),
    ("COLO", 4, "COL.csv", "Col.lat", "69_kol.txt", "81-COLfrancl.usfm", "10K", "ZA", "Z7"),
    ("I_THES", 5, "1TH.csv", "1Thes.lat", "70_1fes.txt", "82-1THfrancl.usfm", "10P", "ZE", "ZB"),
    ("II_THES", 3, "2TH.csv", "2Thes.lat", "71_2fes.txt", "83-2THfrancl.usfm", "10V", "ZJ", "ZG"),
    ("I_TIMO", 6, "1TI.csv", "1Tim.lat", "72_1tim.txt", "84-1TIfrancl.usfm", "10Z", "ZM", "ZJ"),
    ("II_TIMO", 4, "2TI.csv", "2Tim.lat", "73_2tim.txt", "85-2TIfrancl.usfm", "116", "ZS", "ZP"),
    ("TITU", 3, "TIT.csv", "Tit.lat", "74_tit.txt", "86-TITfrancl.usfm", "11B", "ZW", "ZT"),
    ("PHILE", 1, "PHM.csv", "Phlm.lat", "75_filim.txt", "87-PHMfrancl.usfm", "107", "ZZ", "ZW"),
    ("HEBR", 13, "HEB.csv", "Hbr.lat", "76_evr.txt", "88-HEBfrancl.usfm", "11G", "100", "ZX"),
    
    # Catholic Epistles
    ("IACO", 5, "JAM.csv", "Jac.lat", "56_iak.txt", "89-JASfrancl.usfm", "11V", "10D", "10A"),
    ("I_PETR", 5, "1PE.csv", "1Ptr.lat", "57_1petr.txt", "90-1PEfrancl.usfm", "121", "10I", "10F"),
    ("II_PETR", 3, "2PE.csv", "2Ptr.lat", "58_2petr.txt", "91-2PEfrancl.usfm", "127", "10N", "10K"),
    ("I_IOHA", 5, "1JO.csv", "1Jo.lat", "59_1in.txt", "92-1JNfrancl.usfm", "12B", "10Q", "10N"),
    ("II_IOHA", 1, "2JO.csv", "2Jo.lat", "60_2in.txt", "93-2JNfrancl.usfm", "12G", "10V", "10S"),
    ("III_IOHA", 1, "3JO.csv", "3Jo.lat", "61_3in.txt", "94-3JNfrancl.usfm", "12H", "10W", "10T"),
    ("IUDA", 1, "JUD.csv", "Jud.lat", "62_iud.txt", "95-JUDfrancl.usfm", "12I", "10X", "10U"),
    
    # Apocalyptic
    ("APOC", 22, "REV.csv", "Apc.lat", "77_otkr.txt", "96-REVfrancl.usfm", "12K", "10Y", "10V"),
]


def populate_book(book_dir: str, num_chapters: int, greek_file: str, latin_file: str,
                  russian_file: str, french_file: str, nab_start: str, 
                  spanish_start: str, italian_start: str) -> dict:
    """Populate a single NT book with all languages into JSON files."""
    
    book_path = CHAPTERS_DIR / book_dir
    if not book_path.exists():
        print(f"  ⚠ Book directory not found: {book_dir}")
        return {}
    
    stats = {
        'BYZ': 0, 'VUL': 0, 'SYN': 0, 'NEO': 0,
        'NAB': 0, 'VAT_ES': 0, 'CEI': 0
    }
    
    # Parse source files
    greek_data = parse_byzantine_nt_csv(GREEK_NT_DIR / greek_file)
    latin_data = parse_latin_vulgate(LATIN_DIR / latin_file)
    russian_data = parse_russian_synodal(RUSSIAN_DIR / russian_file)
    french_data = parse_french_usfm(FRENCH_DIR / french_file)
    
    # Build Vatican HTML file dicts
    nab_files_raw = generate_base36_files(nab_start, num_chapters)
    spanish_files_raw = generate_base36_files(spanish_start, num_chapters)
    italian_files_raw = generate_base36_files(italian_start, num_chapters)
    
    nab_files = {ch: NAB_DIR / fname for ch, fname in nab_files_raw.items()}
    spanish_files = {ch: SPANISH_DIR / fname for ch, fname in spanish_files_raw.items()}
    italian_files = {ch: ITALIAN_DIR / fname for ch, fname in italian_files_raw.items()}
    
    # Parse Vatican HTML
    nab_data = parse_vatican_html_nab(nab_files)
    spanish_data = parse_vatican_html_spanish(spanish_files)
    italian_data = parse_vatican_html_cei(italian_files)
    
    # Update each chapter JSON file
    for ch in range(1, num_chapters + 1):
        chapter_file = book_path / f"{ch:03d}.json"
        
        if not chapter_file.exists():
            print(f"    ⚠ Chapter file not found: {chapter_file.name}")
            continue
        
        # Load existing JSON
        with open(chapter_file, 'r', encoding='utf-8') as f:
            chapter_data = json.load(f)
        
        verses = chapter_data.get('verses', {})
        
        # Add translations to each verse
        for verse_num_str, verse_data in verses.items():
            verse_num = int(verse_num_str)
            
            # Initialize text dict if needed
            if 'text' not in verse_data:
                verse_data['text'] = {}
            
            text = verse_data['text']
            
            # Greek (Byzantine)
            if ch in greek_data and verse_num in greek_data[ch]:
                text['BYZ'] = greek_data[ch][verse_num]
                stats['BYZ'] += 1
            
            # Latin (Vulgate)
            if ch in latin_data and verse_num in latin_data[ch]:
                text['VUL'] = latin_data[ch][verse_num]
                stats['VUL'] += 1
            
            # Russian (Synodal)
            if ch in russian_data and verse_num in russian_data[ch]:
                text['SYN'] = russian_data[ch][verse_num]
                stats['SYN'] += 1
            
            # French (Neo-Crampon)
            if ch in french_data and verse_num in french_data[ch]:
                text['NEO'] = french_data[ch][verse_num]
                stats['NEO'] += 1
            
            # English (NAB)
            if ch in nab_data and verse_num in nab_data[ch]:
                text['NAB'] = nab_data[ch][verse_num]
                stats['NAB'] += 1
            
            # Spanish (Vatican)
            if ch in spanish_data and verse_num in spanish_data[ch]:
                text['VAT_ES'] = spanish_data[ch][verse_num]
                stats['VAT_ES'] += 1
            
            # Italian (CEI)
            if ch in italian_data and verse_num in italian_data[ch]:
                text['CEI'] = italian_data[ch][verse_num]
                stats['CEI'] += 1
        
        # Write updated JSON
        with open(chapter_file, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return stats


def main():
    print("=" * 60)
    print("POPULATING NEW TESTAMENT - 27 BOOKS (JSON FORMAT)")
    print("=" * 60)
    
    total_stats = {
        'BYZ': 0, 'VUL': 0, 'SYN': 0, 'NEO': 0,
        'NAB': 0, 'VAT_ES': 0, 'CEI': 0
    }
    
    for book_config in NT_BOOKS:
        book_dir, num_chapters = book_config[0], book_config[1]
        greek_file, latin_file = book_config[2], book_config[3]
        russian_file, french_file = book_config[4], book_config[5]
        nab_start, spanish_start, italian_start = book_config[6], book_config[7], book_config[8]
        
        print(f"\n{book_dir} ({num_chapters} chapters):")
        
        stats = populate_book(
            book_dir, num_chapters, greek_file, latin_file,
            russian_file, french_file, nab_start, spanish_start, italian_start
        )
        
        if stats:
            total = sum(stats.values())
            print(f"  BYZ: {stats['BYZ']}, VUL: {stats['VUL']}, SYN: {stats['SYN']}, NEO: {stats['NEO']}")
            print(f"  NAB: {stats['NAB']}, VAT_ES: {stats['VAT_ES']}, CEI: {stats['CEI']}")
            print(f"  Total: {total} translations")
            
            for lang, count in stats.items():
                total_stats[lang] += count
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    for lang, count in total_stats.items():
        print(f"  {lang}: {count:,} verses")
    
    grand_total = sum(total_stats.values())
    print(f"\n  GRAND TOTAL: {grand_total:,} translations added")
    print("=" * 60)


if __name__ == "__main__":
    main()
