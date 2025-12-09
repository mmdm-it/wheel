#!/usr/bin/env python3
"""
Parse Clementine Vulgate Latin files and update chapter JSON files.
Format: chapter:verse text (with line wrapping)
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
LATIN_DIR = WHEEL_DIR / "sources/latin/clementine/src/utf8"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

# Mapping of Latin files to chapter directory codes
BOOK_MAPPING = {
    "Gn.lat": "GENE",
    "Ex.lat": "EXO",
    "Lv.lat": "LEVI",
    "Nm.lat": "NUME",
    "Dt.lat": "DEUT",
    "Jos.lat": "IOSU",
    "Jdc.lat": "IUDI",
    "Rt.lat": "RUTH",
    "1Rg.lat": "I_SAM",
    "2Rg.lat": "II_SAM",
    "3Rg.lat": "III_REG",
    "4Rg.lat": "IV_REG",
    "1Par.lat": "I_PAR",
    "2Par.lat": "II_PAR",
    "Esr.lat": "ESDR",
    "Neh.lat": "NEH",
    "Tob.lat": "TOBI",
    "Jdt.lat": "IUDITH",
    "Est.lat": "ESTH",
    "Job.lat": "IOB",
    "Ps.lat": "PSAL",
    "Pr.lat": "PROV",
    "Ecl.lat": "ECCLE",
    "Ct.lat": "CANT",
    "Sap.lat": "SAPI",
    "Sir.lat": "ECCLU",
    "Is.lat": "ISA",
    "Jr.lat": "IERE",
    "Lam.lat": "LAME",
    "Bar.lat": "BARU",
    "Ez.lat": "EZE",
    "Dn.lat": "DAN",
    "Os.lat": "OSE",
    "Joel.lat": "IOEL",
    "Am.lat": "AMO",
    "Abd.lat": "ABDI",
    "Jon.lat": "IONA",
    "Mch.lat": "MICH",
    "Nah.lat": "NAHU",
    "Hab.lat": "HAB",
    "Soph.lat": "SOPH",
    "Agg.lat": "AGGE",
    "Zach.lat": "ZACH",
    "Mal.lat": "MALA",
    "1Mcc.lat": "I_MACC",
    "2Mcc.lat": "II_MACC",
    "Mt.lat": "MATHE",
    "Mc.lat": "MARC",
    "Lc.lat": "LUCA",
    "Jo.lat": "IOHA",
    "Act.lat": "ACTU",
    "Rom.lat": "ROM",
    "1Cor.lat": "I_COR",
    "2Cor.lat": "II_COR",
    "Gal.lat": "GALA",
    "Eph.lat": "EPHE",
    "Phlp.lat": "PHILI",
    "Col.lat": "COLO",
    "1Thes.lat": "I_THES",
    "2Thes.lat": "II_THES",
    "1Tim.lat": "I_TIMO",
    "2Tim.lat": "II_TIMO",
    "Tit.lat": "TITU",
    "Phlm.lat": "PHILE",
    "Hbr.lat": "HEBR",
    "Jac.lat": "IACO",
    "1Ptr.lat": "I_PETR",
    "2Ptr.lat": "II_PETR",
    "1Jo.lat": "I_IOHA",
    "2Jo.lat": "II_IOHA",
    "3Jo.lat": "III_IOHA",
    "Jud.lat": "IUDA",
    "Apc.lat": "APOC",
}

def clean_text(text):
    """Clean up the text."""
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    # Remove backslashes used for line continuation
    text = text.replace('\\', '')
    # Clean up spacing around colons
    text = re.sub(r'\s+:', ':', text)
    text = re.sub(r':\s+', ': ', text)
    return text.strip()

def parse_latin_file(source_file):
    """Parse a Latin Clementine file and return verses by chapter."""
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Normalize - join all lines
    lines = content.split('\n')
    normalized = ' '.join(lines)
    
    # Split by verse references (chapter:verse pattern at start or after space)
    # Pattern: digits:digits followed by space and text
    verse_pattern = r'(\d+):(\d+)\s+'
    
    # Find all matches
    matches = list(re.finditer(verse_pattern, normalized))
    
    verses_by_chapter = defaultdict(dict)
    
    for i, match in enumerate(matches):
        chapter = int(match.group(1))
        verse = int(match.group(2))
        
        # Get text from end of this match to start of next match (or end)
        start = match.end()
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            end = len(normalized)
        
        text = clean_text(normalized[start:end])
        if text:
            verses_by_chapter[chapter][verse] = text
    
    return dict(verses_by_chapter)

def update_chapter_file(chapter_dir, chapter_num, verses):
    """Update a chapter JSON file with Latin text."""
    chapter_file = chapter_dir / f"{chapter_num:03d}.json"
    
    if not chapter_file.exists():
        print(f"Warning: Chapter file {chapter_file} does not exist")
        return 0
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        chapter_data = json.load(f)
    
    updated_count = 0
    
    if 'verses' in chapter_data:
        for verse_num_str, verse_data in chapter_data['verses'].items():
            verse_num = int(verse_num_str)
            if verse_num in verses:
                verse_data['latin'] = verses[verse_num]
                updated_count += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count

def process_book(source_filename, book_code):
    """Process a single book."""
    source_file = LATIN_DIR / source_filename
    chapter_dir = CHAPTERS_DIR / book_code
    
    if not source_file.exists():
        print(f"Error: Source file {source_file} does not exist")
        return
    
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    print(f"Parsing {source_filename} -> {book_code}...")
    chapters = parse_latin_file(source_file)
    
    print(f"Found {len(chapters)} chapters")
    
    total_verses = 0
    for chapter_num, verses in sorted(chapters.items()):
        total_verses += len(verses)
    
    print(f"Total verses parsed: {total_verses}")
    
    # Show sample from chapter 1
    print("\n--- Sample verses from Chapter 1 ---")
    if 1 in chapters:
        for v in [1, 2, 3]:
            if v in chapters[1]:
                text = chapters[1][v]
                if len(text) > 100:
                    text = text[:100] + "..."
                print(f"  {v}: {text}")
    
    # Update chapter files
    print("\n--- Updating chapter files ---")
    total_updated = 0
    for chapter_num in sorted(chapters.keys()):
        updated = update_chapter_file(chapter_dir, chapter_num, chapters[chapter_num])
        total_updated += updated
        print(f"  Chapter {chapter_num}: {updated} verses")
    
    print(f"\nDone! Updated {total_updated} verses in {len(chapters)} chapters.")

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python parse_latin_clementine.py <source_filename>")
        print("       python parse_latin_clementine.py <source_filename> <book_code>")
        print("\nAvailable mappings:")
        for src, code in sorted(BOOK_MAPPING.items()):
            print(f"  {src} -> {code}")
        return
    
    source_filename = sys.argv[1]
    
    if len(sys.argv) >= 3:
        book_code = sys.argv[2]
    elif source_filename in BOOK_MAPPING:
        book_code = BOOK_MAPPING[source_filename]
    else:
        print(f"Error: No mapping found for {source_filename}")
        print("Please provide book_code as second argument")
        return
    
    process_book(source_filename, book_code)

if __name__ == "__main__":
    main()
