#!/usr/bin/env python3
"""
Parse Greek Septuagint files and update chapter JSON files.
The Septuagint files have word-by-word format with reference codes.
Format: BBCCCVVV word1 word2 (word is duplicated)
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
SEPTUAGINT_DIR = WHEEL_DIR / "sources/greek/septuagint"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

# Mapping of Septuagint files to chapter directory codes
BOOK_MAPPING = {
    "01.Gen.txt": "GENE",
    "02.Exo.txt": "EXO",
    "03.Lev.txt": "LEVI",
    "04.Num.txt": "NUME",
    "05.Deu.txt": "DEUT",
    "06.Jos.txt": "IOSU",
    "07.Jdg.txt": "IUDI",
    "08.Rut.txt": "RUTH",
    "09.1Sa.txt": "I_SAM",
    "10.2Sa.txt": "II_SAM",
    "11.1Ki.txt": "III_REG",
    "12.2Ki.txt": "IV_REG",
    # Add more as needed
}

def parse_septuagint_file(source_file):
    """Parse a Septuagint file and return verses by chapter."""
    verses_by_chapter = defaultdict(lambda: defaultdict(list))
    
    with open(source_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            parts = line.split()
            if len(parts) < 2:
                continue
            
            ref = parts[0]
            # Reference format: BBCCCVVV (8 digits)
            if len(ref) != 8 or not ref.isdigit():
                continue
            
            # Extract chapter and verse
            # BB = book (01-99), CCC = chapter (001-999), VVV = verse (001-999)
            chapter = int(ref[2:5])
            verse = int(ref[5:8])
            
            # Get the word (first column after reference)
            word = parts[1]
            
            verses_by_chapter[chapter][verse].append(word)
    
    # Convert to verse text
    result = {}
    for chapter, verses in verses_by_chapter.items():
        result[chapter] = {}
        for verse, words in verses.items():
            # Join words with spaces
            verse_text = ' '.join(words)
            # Clean up spacing around punctuation
            verse_text = re.sub(r'\s+([.,;:·])', r'\1', verse_text)
            result[chapter][verse] = verse_text
    
    return result

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
    source_file = SEPTUAGINT_DIR / source_filename
    chapter_dir = CHAPTERS_DIR / book_code
    
    if not source_file.exists():
        print(f"Error: Source file {source_file} does not exist")
        return
    
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    print(f"Parsing {source_filename} -> {book_code}...")
    chapters = parse_septuagint_file(source_file)
    
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
        print("Usage: python parse_greek_septuagint.py <source_filename>")
        print("       python parse_greek_septuagint.py <source_filename> <book_code>")
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
