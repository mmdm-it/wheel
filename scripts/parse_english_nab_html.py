#!/usr/bin/env python3
"""
Parse English NAB Vatican HTML files to extract verse text.
Uses HTML structure (<p class=MsoNormal>N) to identify verse numbers.
"""

import json
import os
import re
import sys
from pathlib import Path

NAB_DIR = Path(__file__).parent.parent / "sources" / "english" / "nab-vatican"
CHAPTERS_DIR = Path(__file__).parent.parent / "data" / "gutenberg" / "chapters"


def parse_nab_html(filepath: Path) -> dict:
    """Parse an NAB Vatican HTML file and extract verses.
    
    Uses split on <p class=MsoNormal>N pattern to extract verses.
    
    Args:
        filepath: Path to the HTML file
        
    Returns:
        Dictionary mapping verse numbers to verse text
    """
    with open(filepath, 'r', encoding='latin-1') as f:
        content = f.read()
    
    # Split content at verse number markers
    # <p class=MsoNormal>N starts each verse
    pattern = r'<p class=MsoNormal>(\d+)'
    parts = re.split(pattern, content)
    
    verses = {}
    # parts: [before_v1, '1', text_after_1, '2', text_after_2, ...]
    i = 1
    while i < len(parts) - 1:
        if parts[i].isdigit():
            verse_num = int(parts[i])
            raw_text = parts[i + 1]
            
            # Clean HTML tags
            text = re.sub(r'<[^>]+>', ' ', raw_text)
            
            # Clean HTML entities
            text = re.sub(r'&quot;', '"', text)
            text = re.sub(r'&nbsp;', ' ', text)
            text = re.sub(r'&amp;', '&', text)
            text = re.sub(r'&lt;', '<', text)
            text = re.sub(r'&gt;', '>', text)
            text = re.sub(r'&#\d+;', '', text)
            
            # Normalize whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            
            # Remove leading footnote numbers (small superscript refs)
            text = re.sub(r'^(\d{1,2}\s+)+', '', text).strip()
            
            if text and len(text) > 3:
                verses[verse_num] = text
        
        i += 2
    
    return verses


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


def get_genesis_file(chapter: int) -> Path:
    """Get the NAB file path for a Genesis chapter.
    
    Genesis files use offset of +2:
    Chapter 1 = __P3.HTM
    Chapter 2 = __P4.HTM
    etc.
    """
    file_num = chapter + 2
    return NAB_DIR / f"__P{file_num}.HTM"


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
        
        verses = parse_nab_html(html_file)
        
        if not verses:
            print(f"  Chapter {chapter}: No verses parsed!")
            continue
        
        expected = GENESIS_VERSE_COUNTS.get(chapter, len(verses))
        updated = update_chapter_file("GENE", chapter, verses)
        total_verses += updated
        total_chapters += 1
        
        status = "✓" if updated == expected else "!"
        print(f"  {status} Chapter {chapter}: {updated} verses (expected {expected})")
    
    print()
    print(f"Completed: {total_chapters} chapters, {total_verses} verses updated")


if __name__ == "__main__":
    main()
