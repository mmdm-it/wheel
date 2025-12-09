#!/usr/bin/env python3
"""
Parse Russian Synodal Bible book and update chapter JSON files.
Generic parser that can be used for any book.
"""

import json
import re
import os
from pathlib import Path

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
RUSSIAN_SOURCE_DIR = WHEEL_DIR / "sources/russian/synodal-77books/Синодальный перевод - 77 книг - txt"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

# Mapping of Russian source files to chapter directory codes
BOOK_MAPPING = {
    "01_byt.txt": "GENE",       # Genesis / Бытие
    "51_mf.txt": "MATHE",       # Matthew / От Матфея
    "52_mk.txt": "MARC",        # Mark / От Марка
    "53_lk.txt": "LUCA",        # Luke / От Луки
    "54_in.txt": "IOHA",        # John / От Иоанна
}

def clean_text(text):
    """Clean up the text - remove extra whitespace, normalize."""
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    # Remove underscores used for emphasis markers like _это_
    text = re.sub(r'_([^_]+)_', r'\1', text)
    return text

def parse_russian_book(source_file):
    """Parse a Russian Bible book file and return verses by chapter."""
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Normalize the content - join lines and clean up
    lines = content.split('\n')
    normalized = ' '.join(lines)
    
    # Split by chapter markers
    chapter_pattern = r'=== (\d+) ==='
    chapters = re.split(chapter_pattern, normalized)
    
    # First element is the book header, then alternating chapter numbers and content
    result = {}
    
    for i in range(1, len(chapters), 2):
        if i + 1 < len(chapters):
            chapter_num = int(chapters[i])
            chapter_content = chapters[i + 1]
            
            # Parse verses - they start with a number
            verse_pattern = r'(\d+)\s+'
            parts = re.split(verse_pattern, chapter_content)
            
            verses = {}
            for j in range(1, len(parts), 2):
                if j + 1 < len(parts):
                    verse_num = int(parts[j])
                    verse_text = clean_text(parts[j + 1])
                    if verse_text:
                        verses[verse_num] = verse_text
            
            result[chapter_num] = verses
    
    return result

def update_chapter_file(chapter_dir, chapter_num, verses):
    """Update a chapter JSON file with Russian text."""
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
                verse_data['russian'] = verses[verse_num]
                updated_count += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count

def process_book(source_filename, book_code):
    """Process a single book."""
    source_file = RUSSIAN_SOURCE_DIR / source_filename
    chapter_dir = CHAPTERS_DIR / book_code
    
    if not source_file.exists():
        print(f"Error: Source file {source_file} does not exist")
        return
    
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    print(f"Parsing {source_filename} -> {book_code}...")
    chapters = parse_russian_book(source_file)
    
    print(f"Found {len(chapters)} chapters")
    
    total_verses = 0
    for chapter_num, verses in sorted(chapters.items()):
        count = len(verses)
        total_verses += count
    
    print(f"Total verses parsed: {total_verses}")
    
    # Show sample from chapter 1
    print("\n--- Sample verses from Chapter 1 ---")
    if 1 in chapters:
        for v in [1, 2, 3]:
            if v in chapters[1]:
                text = chapters[1][v]
                if len(text) > 80:
                    text = text[:80] + "..."
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
        print("Usage: python parse_russian_book.py <source_filename>")
        print("       python parse_russian_book.py <source_filename> <book_code>")
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
