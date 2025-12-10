#!/usr/bin/env python3
"""
Clean NAB Vatican English HTML files and extract verses properly.
Uses the HTML structure: verse numbers appear as <p class=MsoNormal>N
followed by verse text in subsequent paragraph.
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
NAB_DIR = WHEEL_DIR / "sources/english/nab-vatican"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

def clean_html_text(text):
    """Clean HTML entities and normalize whitespace."""
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_book_chapter(html_content):
    """Extract book name and chapter number from HTML."""
    # Look for pattern in meta or navigation
    match = re.search(r'Genesis.*?Chapter\s+(\d+)', html_content, re.IGNORECASE)
    if match:
        return "Genesis", int(match.group(1))
    return None, None

def parse_nab_html_clean(html_content):
    """Parse NAB HTML using the proper structure."""
    verses = {}
    
    # The structure is:
    # <p class=MsoNormal>VERSE_NUMBER\n</p>\n<p class=...>VERSE_TEXT</p>
    
    # Split by paragraph tags
    # Find all occurrences of <p class=MsoNormal>NUMBER followed by content
    
    # First, let's find verse number markers
    # Pattern: <p class=MsoNormal>N\n where N is a number
    verse_marker_pattern = r'<p class=MsoNormal>(\d+)\s*\n</p>'
    
    # Find all verse markers with their positions
    markers = list(re.finditer(verse_marker_pattern, html_content))
    
    for i, match in enumerate(markers):
        verse_num = int(match.group(1))
        start_pos = match.end()
        
        # End position is start of next marker or end of content
        if i + 1 < len(markers):
            end_pos = markers[i + 1].start()
        else:
            end_pos = len(html_content)
        
        # Extract content between this marker and next
        content = html_content[start_pos:end_pos]
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', content)
        text = clean_html_text(text)
        
        # Remove footnote markers like [1] or superscript numbers at start
        text = re.sub(r'^\s*\d+\s+', '', text)  # Remove leading number + space
        text = re.sub(r'\[\d+\]', '', text)  # Remove [N] references
        
        # Skip if text looks like navigation/header
        if any(skip in text.lower() for skip in ['previous', 'next', 'click here', 'concordance', 'copyright']):
            continue
        
        # Clean up extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        if text and len(text) > 5:
            verses[verse_num] = text
    
    return verses

def find_genesis_files():
    """Find all Genesis chapter files."""
    genesis_files = {}
    
    for htm_file in NAB_DIR.glob("__P*.HTM"):
        try:
            with open(htm_file, 'r', encoding='latin-1') as f:
                content = f.read()
            
            book, chapter = extract_book_chapter(content)
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
    
    # Check for --preview flag
    preview_only = '--preview' in sys.argv
    
    print("Finding Genesis files in NAB Vatican...")
    genesis_files = find_genesis_files()
    
    print(f"Found {len(genesis_files)} Genesis chapters")
    
    # Preview mode - just show what we'd extract from chapter 1
    if preview_only:
        if 1 in genesis_files:
            print("\n--- Preview of Chapter 1 ---")
            with open(genesis_files[1], 'r', encoding='latin-1') as f:
                content = f.read()
            verses = parse_nab_html_clean(content)
            for v in sorted(verses.keys())[:10]:
                text = verses[v]
                if len(text) > 80:
                    text = text[:80] + "..."
                print(f"  {v}: {text}")
            print(f"  ... ({len(verses)} verses total)")
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
        
        verses = parse_nab_html_clean(content)
        
        if verses:
            updated = update_chapter_file(chapter_dir, chapter_num, verses)
            total_updated += updated
            print(f"  Chapter {chapter_num}: {updated} verses from {htm_file.name}")
        else:
            print(f"  Chapter {chapter_num}: No verses found in {htm_file.name}")
    
    print(f"\nDone! Updated {total_updated} verses total.")

if __name__ == "__main__":
    main()
