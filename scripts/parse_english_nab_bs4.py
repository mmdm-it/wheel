#!/usr/bin/env python3
"""
Clean NAB Vatican English HTML files using BeautifulSoup and proper verse splitting.
Pattern: verse numbers appear as "N [A-Z]" (number followed by space and capital letter)
"""

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
NAB_DIR = WHEEL_DIR / "sources/english/nab-vatican"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

def extract_book_chapter(soup):
    """Extract book name and chapter number from HTML."""
    text = soup.get_text()
    match = re.search(r'Genesis.*?Chapter\s+(\d+)', text, re.IGNORECASE)
    if match:
        return "Genesis", int(match.group(1))
    return None, None

def parse_nab_with_bs4(html_content):
    """Parse NAB HTML using BeautifulSoup and verse pattern."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Get all text content
    text = soup.get_text(separator=' ')
    
    # Clean up
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    # Remove header/navigation content
    # Find where the actual chapter content starts
    chapter_match = re.search(r'Chapter\s+\d+\s+', text)
    if chapter_match:
        text = text[chapter_match.end():]
    
    # Remove footer content
    copyright_match = re.search(r'Copyright.*?Vaticana', text, re.IGNORECASE)
    if copyright_match:
        text = text[:copyright_match.start()]
    
    # Now split by verse pattern: number followed by space and capital letter
    # But we need to be careful - footnote numbers like "1" after "was light." shouldn't split
    # Real verses: "20 Then God" or "1 In the beginning"
    
    # First, let's identify verse boundaries
    # Pattern: digit(s) followed by space and capital letter, preceded by period/punctuation or start
    verse_pattern = r'(?:^|[.!?"\'\s])(\d+)\s+([A-Z][a-z])'
    
    verses = {}
    
    # Find all potential verse starts
    matches = list(re.finditer(verse_pattern, text))
    
    for i, match in enumerate(matches):
        verse_num = int(match.group(1))
        
        # Skip if verse number seems like a footnote (out of sequence or too high for context)
        if verse_num > 200:  # No chapter has 200 verses
            continue
        
        # Get start position (after the verse number)
        start_pos = match.end() - len(match.group(2))  # Keep the first word
        
        # Get end position (start of next verse or end)
        if i + 1 < len(matches):
            # Find where next verse starts (the punctuation before the number)
            end_pos = matches[i + 1].start() + 1  # Include the period
        else:
            end_pos = len(text)
        
        verse_text = text[start_pos:end_pos].strip()
        
        # Clean up the verse text
        verse_text = re.sub(r'\s+', ' ', verse_text)
        
        # Remove any embedded verse numbers at the end (from next verse leaking in)
        verse_text = re.sub(r'\s+\d+\s*$', '', verse_text)
        
        if verse_text and len(verse_text) > 3:
            # Only keep if we don't already have this verse, or new one is better
            if verse_num not in verses or len(verse_text) > len(verses[verse_num]):
                verses[verse_num] = verse_text
    
    return verses

def find_genesis_files():
    """Find all Genesis chapter files."""
    genesis_files = {}
    
    for htm_file in NAB_DIR.glob("__P*.HTM"):
        try:
            with open(htm_file, 'r', encoding='latin-1') as f:
                content = f.read()
            
            soup = BeautifulSoup(content, 'html.parser')
            book, chapter = extract_book_chapter(soup)
            if book == "Genesis" and chapter:
                genesis_files[chapter] = htm_file
        except Exception as e:
            pass
    
    return genesis_files

def update_chapter_file(chapter_dir, chapter_num, verses):
    """Update a chapter JSON file with English text."""
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
                verse_data['english'] = verses[verse_num]
                updated_count += 1
    
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count

def main():
    import sys
    
    preview_only = '--preview' in sys.argv
    
    print("Finding Genesis files in NAB Vatican...")
    genesis_files = find_genesis_files()
    
    print(f"Found {len(genesis_files)} Genesis chapters")
    
    if preview_only:
        if 1 in genesis_files:
            print("\n--- Preview of Genesis Chapter 1 ---")
            with open(genesis_files[1], 'r', encoding='latin-1') as f:
                content = f.read()
            verses = parse_nab_with_bs4(content)
            for v in sorted(verses.keys()):
                text = verses[v]
                if len(text) > 100:
                    text = text[:100] + "..."
                print(f"  {v}: {text}")
            print(f"\n  Total: {len(verses)} verses")
        return
    
    chapter_dir = CHAPTERS_DIR / "GENE"
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    total_updated = 0
    
    for chapter_num in sorted(genesis_files.keys()):
        htm_file = genesis_files[chapter_num]
        
        with open(htm_file, 'r', encoding='latin-1') as f:
            content = f.read()
        
        verses = parse_nab_with_bs4(content)
        
        if verses:
            updated = update_chapter_file(chapter_dir, chapter_num, verses)
            total_updated += updated
            print(f"  Chapter {chapter_num}: {updated} verses")
        else:
            print(f"  Chapter {chapter_num}: No verses found")
    
    print(f"\nDone! Updated {total_updated} verses total.")

if __name__ == "__main__":
    main()
