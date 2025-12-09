#!/usr/bin/env python3
"""
Parse Byzantine NT Greek CSV files and update chapter JSON files.
Format: CSV with columns: chapter,verse,text
"""

import csv
import json
import re
from pathlib import Path
from collections import defaultdict

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
BYZANTINE_DIR = WHEEL_DIR / "sources/greek/byzantine-nt/csv-unicode/ccat/no-variants"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

# Mapping of Byzantine NT files to chapter directory codes
BOOK_MAPPING = {
    "MAT.csv": "MATHE",
    "MAR.csv": "MARC",
    "LUK.csv": "LUCA",
    "JOH.csv": "IOHA",
    "ACT.csv": "ACTU",
    "ROM.csv": "ROM",
    "1CO.csv": "I_COR",
    "2CO.csv": "II_COR",
    "GAL.csv": "GALA",
    "EPH.csv": "EPHE",
    "PHP.csv": "PHILI",
    "COL.csv": "COLO",
    "1TH.csv": "I_THES",
    "2TH.csv": "II_THES",
    "1TI.csv": "I_TIMO",
    "2TI.csv": "II_TIMO",
    "TIT.csv": "TITU",
    "PHM.csv": "PHILE",
    "HEB.csv": "HEBR",
    "JAM.csv": "IACO",
    "1PE.csv": "I_PETR",
    "2PE.csv": "II_PETR",
    "1JO.csv": "I_IOHA",
    "2JO.csv": "II_IOHA",
    "3JO.csv": "III_IOHA",
    "JUD.csv": "IUDA",
    "REV.csv": "APOC",
}

def clean_text(text):
    """Clean up the text."""
    # Remove paragraph markers
    text = text.replace('¶', '').strip()
    return text

def parse_byzantine_file(source_file):
    """Parse a Byzantine NT CSV file and return verses by chapter."""
    verses_by_chapter = defaultdict(dict)
    
    with open(source_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            chapter = int(row['chapter'])
            verse = int(row['verse'])
            text = clean_text(row['text'])
            verses_by_chapter[chapter][verse] = text
    
    return dict(verses_by_chapter)

def update_chapter_file(chapter_dir, chapter_num, verses):
    """Update a chapter JSON file with Greek text."""
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
                verse_data['greek'] = verses[verse_num]
                updated_count += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count

def process_book(source_filename, book_code):
    """Process a single book."""
    source_file = BYZANTINE_DIR / source_filename
    chapter_dir = CHAPTERS_DIR / book_code
    
    if not source_file.exists():
        print(f"Error: Source file {source_file} does not exist")
        return
    
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    print(f"Parsing {source_filename} -> {book_code}...")
    chapters = parse_byzantine_file(source_file)
    
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
        print("Usage: python parse_greek_byzantine.py <source_filename>")
        print("       python parse_greek_byzantine.py <source_filename> <book_code>")
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
