#!/usr/bin/env python3
"""
Parse English NAB Vatican HTML files to extract verse text.
Uses sequential verse number matching to handle footnote noise.
"""

import json
import os
import re
import sys
from pathlib import Path

# NAB Vatican HTML files for Genesis (hexadecimal-style naming)
# __P3.HTM = Genesis Chapter 1, __P4.HTM = Chapter 2, etc.
# File offset: Chapter N = __P{N+2}.HTM

NAB_DIR = Path(__file__).parent.parent / "sources" / "english" / "nab-vatican"
CHAPTERS_DIR = Path(__file__).parent.parent / "data" / "gutenberg" / "chapters"


def parse_nab_html(filepath: Path, expected_verses: int = None) -> dict:
    """Parse an NAB Vatican HTML file and extract verses.
    
    Args:
        filepath: Path to the HTML file
        expected_verses: Optional expected verse count for validation
        
    Returns:
        Dictionary mapping verse numbers to verse text
    """
    with open(filepath, 'r', encoding='latin-1') as f:
        content = f.read()
    
    # Clean HTML tags
    text = re.sub(r'<[^>]+>', ' ', content)
    
    # Clean HTML entities
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#\d+;', '', text)  # Remove numeric entities
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Find chapter header
    match = re.search(r'Chapter\s+\d+\s+', text)
    if match:
        text = text[match.end():]
    
    # Find end markers (copyright, footnotes section)
    for end_marker in ['Copyright', 'FOOTNOTES', 'Previous Chapter', 'Previous Book']:
        match = re.search(end_marker, text, re.IGNORECASE)
        if match:
            text = text[:match.start()]
    
    # Split on numbers surrounded by whitespace
    parts = re.split(r'\s+(\d+)\s+', ' ' + text + ' ')
    
    verses = {}
    expected_verse = 1
    max_verse = expected_verses or 200  # Safety limit
    
    i = 0
    while i < len(parts):
        if i > 0 and parts[i].isdigit():
            num = int(parts[i])
            # Check if this is our expected verse number
            if num == expected_verse and i + 1 < len(parts):
                verse_text = parts[i + 1].strip()
                if verse_text and len(verse_text) > 2:
                    # Clean: remove leading footnote numbers (1-2 digit numbers at start)
                    verse_text = re.sub(r'^(\d{1,2}\s+)+', '', verse_text)
                    verse_text = verse_text.strip()
                    
                    if verse_text:
                        verses[num] = verse_text
                        expected_verse = num + 1
                        
                        if expected_verse > max_verse:
                            break
                        
                        i += 2
                        continue
        i += 1
    
    return verses


def get_genesis_file(chapter: int) -> Path:
    """Get the NAB file path for a Genesis chapter.
    
    Genesis files use offset of +2:
    Chapter 1 = __P3.HTM
    Chapter 2 = __P4.HTM
    etc.
    """
    file_num = chapter + 2
    return NAB_DIR / f"__P{file_num}.HTM"


def update_chapter_file(book_code: str, chapter_num: int, verses: dict, lang_key: str = "english"):
    """Update a chapter JSON file with English verses.
    
    Args:
        book_code: The book code (e.g., "GENE")
        chapter_num: The chapter number
        verses: Dictionary mapping verse numbers to text
        lang_key: The language key to use
    """
    chapter_dir = CHAPTERS_DIR / book_code
    chapter_file = chapter_dir / f"{chapter_num:03d}.json"
    
    if not chapter_file.exists():
        print(f"  Warning: {chapter_file} does not exist")
        return 0
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        chapter_data = json.load(f)
    
    updated = 0
    # Verses is a dict: {"1": {...}, "2": {...}, ...}
    verses_dict = chapter_data.get("verses", {})
    for verse_num_str, verse_obj in verses_dict.items():
        verse_num = int(verse_num_str)
        if verse_num in verses:
            verse_obj[lang_key] = verses[verse_num]
            updated += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated


# Known verse counts per Genesis chapter
GENESIS_VERSE_COUNTS = {
    1: 31, 2: 25, 3: 24, 4: 26, 5: 32,
    6: 22, 7: 24, 8: 22, 9: 29, 10: 32,
    11: 32, 12: 20, 13: 18, 14: 24, 15: 21,
    16: 16, 17: 27, 18: 33, 19: 38, 20: 18,
    21: 34, 22: 24, 23: 20, 24: 67, 25: 34,
    26: 35, 27: 46, 28: 22, 29: 35, 30: 43,
    31: 55, 32: 33, 33: 20, 34: 31, 35: 29,
    36: 43, 37: 36, 38: 30, 39: 23, 40: 23,
    41: 57, 42: 38, 43: 34, 44: 34, 45: 28,
    46: 34, 47: 31, 48: 22, 49: 33, 50: 26
}


def main():
    """Parse all NAB Genesis chapters and update JSON files."""
    
    if not NAB_DIR.exists():
        print(f"Error: NAB source directory not found: {NAB_DIR}")
        sys.exit(1)
    
    total_verses = 0
    total_chapters = 0
    
    print("Parsing English NAB Vatican Genesis chapters...")
    print()
    
    for chapter in range(1, 51):
        html_file = get_genesis_file(chapter)
        
        if not html_file.exists():
            print(f"  Chapter {chapter}: File not found: {html_file.name}")
            continue
        
        expected = GENESIS_VERSE_COUNTS.get(chapter)
        verses = parse_nab_html(html_file, expected_verses=expected)
        
        if not verses:
            print(f"  Chapter {chapter}: No verses parsed!")
            continue
        
        updated = update_chapter_file("GENE", chapter, verses)
        total_verses += updated
        total_chapters += 1
        
        status = "✓" if updated == expected else "!"
        print(f"  {status} Chapter {chapter}: {updated} verses (expected {expected})")
    
    print()
    print(f"Completed: {total_chapters} chapters, {total_verses} verses updated")


if __name__ == "__main__":
    main()
