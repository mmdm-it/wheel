#!/usr/bin/env python3
"""
Parse Russian Synodal Bible Genesis and update chapter JSON files.
"""

import json
import re
import os
from pathlib import Path

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
RUSSIAN_SOURCE = WHEEL_DIR / "sources/russian/synodal-77books/Синодальный перевод - 77 книг - txt/01_byt.txt"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters/GENE"

def clean_text(text):
    """Clean up the text - remove extra whitespace, normalize."""
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    # Remove underscores used for emphasis markers like _это_
    text = re.sub(r'_([^_]+)_', r'\1', text)
    return text

def parse_russian_genesis():
    """Parse the Russian Genesis file and return verses by chapter."""
    with open(RUSSIAN_SOURCE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # First, normalize the content - join lines and clean up
    # The file has strange fixed-width formatting
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
            # Pattern: number followed by text until next number or end
            verse_pattern = r'(\d+)\s+'
            parts = re.split(verse_pattern, chapter_content)
            
            verses = {}
            for j in range(1, len(parts), 2):
                if j + 1 < len(parts):
                    verse_num = int(parts[j])
                    verse_text = clean_text(parts[j + 1])
                    if verse_text:  # Only add non-empty verses
                        verses[verse_num] = verse_text
            
            result[chapter_num] = verses
    
    return result

def update_chapter_file(chapter_num, verses):
    """Update a chapter JSON file with Russian text."""
    chapter_file = CHAPTERS_DIR / f"{chapter_num:03d}.json"
    
    if not chapter_file.exists():
        print(f"Warning: Chapter file {chapter_file} does not exist")
        return False
    
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

def main():
    print("Parsing Russian Genesis...")
    chapters = parse_russian_genesis()
    
    print(f"Found {len(chapters)} chapters")
    
    total_verses = 0
    for chapter_num, verses in sorted(chapters.items()):
        print(f"  Chapter {chapter_num}: {len(verses)} verses")
        total_verses += len(verses)
    
    print(f"\nTotal verses parsed: {total_verses}")
    
    # Show sample from chapter 1
    print("\n--- Sample verses from Chapter 1 ---")
    if 1 in chapters:
        for v in [1, 2, 3]:
            if v in chapters[1]:
                print(f"  {v}: {chapters[1][v][:80]}...")
    
    # Update chapter files
    print("\n--- Updating chapter files ---")
    for chapter_num in sorted(chapters.keys()):
        updated = update_chapter_file(chapter_num, chapters[chapter_num])
        print(f"  Chapter {chapter_num}: Updated {updated} verses")
    
    print("\nDone!")

if __name__ == "__main__":
    main()
