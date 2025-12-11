#!/usr/bin/env python3
"""
Populate all 27 New Testament books with translations.

Languages:
- Greek (Byzantine NT): CSV from sources/greek/byzantine-nt/csv-unicode/ccat/no-variants/
- Latin (Clementine Vulgate): sources/latin/clementine/src/utf8/
- Russian (Synodal): sources/russian/synodal-77books/
- French (Neo-Crampon): sources/french/neo-crampon/
- English (NAB): sources/english/nab-vatican/
- Spanish (Libro del Pueblo de Dios): sources/spanish/libro-pueblo-dios/
- Italian (CEI): sources/italian/vatican/

All 27 NT books:
- Gospels: Matthew, Mark, Luke, John
- History: Acts
- Pauline Epistles: Romans, 1 Corinthians, 2 Corinthians, Galatians, Ephesians,
                    Philippians, Colossians, 1 Thessalonians, 2 Thessalonians,
                    1 Timothy, 2 Timothy, Titus, Philemon, Hebrews
- Catholic Epistles: James, 1 Peter, 2 Peter, 1 John, 2 John, 3 John, Jude
- Apocalyptic: Revelation
"""

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

# Base36 character set
B36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def generate_base36_files(start_code: str, num_chapters: int) -> dict:
    """Generate base-36 file mappings starting from a given code."""
    # Parse start code (e.g., "PVA" -> value)
    start_code = start_code.upper()
    if len(start_code) == 1:
        start = B36_CHARS.index(start_code)
    elif len(start_code) == 2:
        start = B36_CHARS.index(start_code[0]) * 36 + B36_CHARS.index(start_code[1])
    else:  # 3+ chars like "12B"
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
            # 3-digit base36
            d2 = offset // (36 * 36)
            d1 = (offset % (36 * 36)) // 36
            d0 = offset % 36
            files[ch] = f"__P{B36_CHARS[d2]}{B36_CHARS[d1]}{B36_CHARS[d0]}.HTM"
    
    return files

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters"
SOURCES_DIR = PROJECT_ROOT / "sources"

# Source directories
GREEK_NT_DIR = SOURCES_DIR / "greek" / "byzantine-nt" / "csv-unicode" / "ccat" / "no-variants"
LATIN_DIR = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8"
RUSSIAN_DIR = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt"
FRENCH_DIR = SOURCES_DIR / "french" / "neo-crampon"
NAB_DIR = SOURCES_DIR / "english" / "nab-vatican"
SPANISH_DIR = SOURCES_DIR / "spanish" / "libro-pueblo-dios"
ITALIAN_DIR = SOURCES_DIR / "italian" / "vatican"

# NT Book configurations
# Format: (book_dir, num_chapters, greek_csv, latin_file, russian_file, french_usfm, nab_start, spanish_start, italian_start)
NT_BOOKS = [
    # Gospels - codes are what comes after __P in filename
    ("MATHE", 28, "MAT.csv", "Mt.lat", "51_mf.txt", "70-MATfrancl.usfm", "VA", "UB", "TP"),
    ("MARC", 16, "MAR.csv", "Mc.lat", "52_mk.txt", "71-MRKfrancl.usfm", "W3", "V3", "UW"),
    ("LUCA", 24, "LUK.csv", "Lc.lat", "53_lk.txt", "72-LUKfrancl.usfm", "WK", "VJ", "VD"),
    ("IOHA", 21, "JOH.csv", "Jo.lat", "54_in.txt", "73-JHNfrancl.usfm", "X9", "W7", "W2"),  # Gospel of John, not 1 John!
    
    # History
    ("ACTU", 28, "ACT.csv", "Act.lat", "55_deyan.txt", "74-ACTfrancl.usfm", "XV", "WS", "WN"),
    
    # Pauline Epistles (NAB codes verified from Vatican HTML)
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
    
    # Catholic Epistles (NAB codes verified)
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

def write_translation(chapter_dir: Path, lang_code: str, verses: dict) -> int:
    """Write verses to a language file, return count of verses written."""
    if not verses:
        return 0
    
    lang_file = chapter_dir / f"{lang_code}.txt"
    count = 0
    
    with open(lang_file, 'w', encoding='utf-8') as f:
        for verse_num in sorted(verses.keys()):
            text = verses[verse_num]
            if text:
                f.write(f"{verse_num}|{text}\n")
                count += 1
    
    return count


def populate_book(book_dir: str, num_chapters: int, greek_file: str, latin_file: str,
                  russian_file: str, french_file: str, nab_start: str, 
                  spanish_start: str, italian_start: str) -> dict:
    """Populate a single NT book with all languages."""
    
    book_path = DATA_DIR / book_dir
    if not book_path.exists():
        print(f"  ⚠ Book directory not found: {book_dir}")
        return {}
    
    stats = {
        'greek': 0, 'latin': 0, 'russian': 0, 'french': 0,
        'english': 0, 'spanish': 0, 'italian': 0
    }
    
    # Parse source files
    greek_data = parse_byzantine_nt_csv(GREEK_NT_DIR / greek_file)
    latin_data = parse_latin_vulgate(LATIN_DIR / latin_file)
    russian_data = parse_russian_synodal(RUSSIAN_DIR / russian_file)
    french_data = parse_french_usfm(FRENCH_DIR / french_file)
    
    # Build Vatican HTML file dicts for all chapters using generate_base36_files
    nab_files_raw = generate_base36_files(nab_start, num_chapters)
    spanish_files_raw = generate_base36_files(spanish_start, num_chapters)
    italian_files_raw = generate_base36_files(italian_start, num_chapters)
    
    nab_files = {ch: NAB_DIR / fname for ch, fname in nab_files_raw.items()}
    spanish_files = {ch: SPANISH_DIR / fname for ch, fname in spanish_files_raw.items()}
    italian_files = {ch: ITALIAN_DIR / fname for ch, fname in italian_files_raw.items()}
    
    # Parse Vatican HTML using dict-based parsers
    nab_data = parse_vatican_html_nab(nab_files)
    spanish_data = parse_vatican_html_spanish(spanish_files)
    italian_data = parse_vatican_html_cei(italian_files)
    
    # Populate each chapter
    for ch in range(1, num_chapters + 1):
        chapter_dir = book_path / str(ch)
        if not chapter_dir.exists():
            chapter_dir.mkdir(parents=True)
        
        # Write each language
        stats['greek'] += write_translation(chapter_dir, 'grk', greek_data.get(ch, {}))
        stats['latin'] += write_translation(chapter_dir, 'lat', latin_data.get(ch, {}))
        stats['russian'] += write_translation(chapter_dir, 'rus', russian_data.get(ch, {}))
        stats['french'] += write_translation(chapter_dir, 'fra', french_data.get(ch, {}))
        stats['english'] += write_translation(chapter_dir, 'eng', nab_data.get(ch, {}))
        stats['spanish'] += write_translation(chapter_dir, 'spa', spanish_data.get(ch, {}))
        stats['italian'] += write_translation(chapter_dir, 'ita', italian_data.get(ch, {}))
    
    return stats


def main():
    print("=" * 60)
    print("POPULATING NEW TESTAMENT - 27 BOOKS")
    print("=" * 60)
    
    total_stats = {
        'greek': 0, 'latin': 0, 'russian': 0, 'french': 0,
        'english': 0, 'spanish': 0, 'italian': 0
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
            print(f"  Greek: {stats['greek']}, Latin: {stats['latin']}, Russian: {stats['russian']}")
            print(f"  French: {stats['french']}, English: {stats['english']}, Spanish: {stats['spanish']}, Italian: {stats['italian']}")
            print(f"  Total: {total} translations")
            
            for lang, count in stats.items():
                total_stats[lang] += count
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    for lang, count in total_stats.items():
        print(f"  {lang.capitalize()}: {count:,} verses")
    
    grand_total = sum(total_stats.values())
    print(f"\n  GRAND TOTAL: {grand_total:,} translations added")
    print("=" * 60)


if __name__ == "__main__":
    main()
