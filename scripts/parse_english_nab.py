#!/usr/bin/env python3
"""
Parse NAB Vatican English HTML files and update chapter JSON files.
The files are named __P*.HTM with complex naming scheme.
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict
from html.parser import HTMLParser

# Paths
WHEEL_DIR = Path("/media/howell/dev_workspace/wheel")
NAB_DIR = WHEEL_DIR / "sources/english/nab-vatican"
CHAPTERS_DIR = WHEEL_DIR / "data/gutenberg/chapters"

class NABParser(HTMLParser):
    """Parse NAB HTML to extract verses."""
    
    def __init__(self):
        super().__init__()
        self.current_verse = None
        self.verse_text = []
        self.verses = {}
        self.in_verse_content = False
        self.book_name = None
        self.chapter_num = None
        self.capture_text = False
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        # Check for verse anchor
        if tag == 'a' and 'name' in attrs_dict:
            name = attrs_dict['name']
            # Verse anchors start with - followed by number or code
            if name.startswith('-'):
                # This might be a verse marker, but we'll use the simpler approach
                pass
        
        if tag == 'p':
            self.capture_text = True
            
    def handle_endtag(self, tag):
        if tag == 'p':
            self.capture_text = False
    
    def handle_data(self, data):
        if self.capture_text:
            self.verse_text.append(data)

def extract_book_chapter(html_content):
    """Extract book name and chapter number from HTML."""
    # Look for pattern like: Genesis > Chapter 1
    # or "Chapter 34" etc
    book_match = re.search(r'<i[^>]*>Genesis</i>', html_content, re.IGNORECASE)
    if book_match:
        book = "Genesis"
    else:
        # Try meta tag
        meta_match = re.search(r'Genesis.*?Chapter\s+(\d+)', html_content)
        if meta_match:
            book = "Genesis"
        else:
            return None, None
    
    chapter_match = re.search(r'Chapter\s+(\d+)', html_content)
    if chapter_match:
        chapter = int(chapter_match.group(1))
        return book, chapter
    
    return None, None

def parse_nab_html(html_content):
    """Parse NAB HTML and return verses."""
    # Clean up HTML - normalize whitespace
    html_content = re.sub(r'\s+', ' ', html_content)
    
    # Remove footnote content (typically in brackets with verse references)
    # Footnotes appear as [number] text or (chapter:verse) text
    
    # Remove HTML tags but keep structure markers
    text = re.sub(r'<[^>]+>', '\n', html_content)
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&#\d+;', '', text)
    
    lines = text.split('\n')
    
    verses = {}
    current_verse = None
    current_text = []
    in_footnote = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Skip header/navigation lines
        if any(skip in line.lower() for skip in ['previous', 'next', 'new american bible', 'intratext', 'click here', 'concordance', 'mso-bidi', 'line-break']):
            continue
        
        # Check if this is a verse number (standalone number)
        if re.match(r'^\d+$', line):
            verse_num = int(line)
            # If this is a small number after the verse number, it's a footnote marker
            if current_verse and verse_num < 20 and verse_num != current_verse + 1:
                # This is likely a footnote reference, skip it
                continue
            
            # Save previous verse
            if current_verse and current_text:
                verse_text = ' '.join(current_text).strip()
                verse_text = re.sub(r'\s+', ' ', verse_text)
                # Remove footnote references like [1] or (cf. Gen 1:2)
                verse_text = re.sub(r'\[\d+\]', '', verse_text)
                verse_text = re.sub(r'\s+', ' ', verse_text).strip()
                if verse_text and not verse_text.startswith('[') and len(verse_text) > 10:
                    verses[current_verse] = verse_text
            
            current_verse = verse_num
            current_text = []
            in_footnote = False
        elif current_verse:
            # Skip obvious footnote text
            if line.startswith('[') and ':' in line:
                in_footnote = True
                continue
            if in_footnote:
                # Check if we're still in footnote
                if re.match(r'^\d+$', line):
                    in_footnote = False
                else:
                    continue
            
            # Skip chapter/book headers
            if 'chapter' in line.lower() and len(line) < 15:
                continue
            if line.lower() == 'genesis':
                continue
            if len(line) < 3:
                continue
            
            current_text.append(line)
    
    # Save last verse
    if current_verse and current_text:
        verse_text = ' '.join(current_text).strip()
        verse_text = re.sub(r'\s+', ' ', verse_text)
        verse_text = re.sub(r'\[\d+\]', '', verse_text)
        verse_text = re.sub(r'\s+', ' ', verse_text).strip()
        if verse_text and not verse_text.startswith('[') and len(verse_text) > 10:
            verses[current_verse] = verse_text
    
    return verses

def find_genesis_files():
    """Find all Genesis chapter files."""
    genesis_files = {}
    
    for htm_file in NAB_DIR.glob("__P*.HTM"):
        try:
            with open(htm_file, 'r', encoding='latin-1') as f:
                content = f.read()
            
            # Check if it's Genesis
            if 'Genesis' in content and 'Chapter' in content:
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
    print("Finding Genesis files in NAB Vatican...")
    genesis_files = find_genesis_files()
    
    print(f"Found {len(genesis_files)} Genesis chapters")
    
    chapter_dir = CHAPTERS_DIR / "GENE"
    if not chapter_dir.exists():
        print(f"Error: Chapter directory {chapter_dir} does not exist")
        return
    
    total_updated = 0
    
    for chapter_num in sorted(genesis_files.keys()):
        htm_file = genesis_files[chapter_num]
        
        with open(htm_file, 'r', encoding='latin-1') as f:
            content = f.read()
        
        verses = parse_nab_html(content)
        
        if verses:
            updated = update_chapter_file(chapter_dir, chapter_num, verses)
            total_updated += updated
            print(f"  Chapter {chapter_num}: {updated} verses from {htm_file.name}")
        else:
            print(f"  Chapter {chapter_num}: No verses found in {htm_file.name}")
    
    print(f"\nDone! Updated {total_updated} verses total.")

if __name__ == "__main__":
    main()
