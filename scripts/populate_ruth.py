#!/usr/bin/env python3
"""
Populate Ruth (4 chapters, 85 verses) with all 9 languages.
This is a test book to validate the v2.0 schema and multi-language rendering.
"""

import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SOURCES_DIR = PROJECT_ROOT / "sources"
CHAPTERS_DIR = PROJECT_ROOT / "data" / "gutenberg" / "chapters" / "RUTH"

# Translation code mapping
TRANSLATIONS = {
    'WLC': 'hebrew',
    'LXX': 'greek', 
    'VUL': 'latin',
    'NAB': 'english',
    'SYN': 'russian',
    'NEO': 'french',
    'VAT_ES': 'spanish',
    'CEI': 'italian',
    'POR': 'portuguese'
}


def parse_hebrew_wlc():
    """Parse Westminster Leningrad Codex XML for Ruth."""
    xml_path = SOURCES_DIR / "hebrew" / "wlc" / "Ruth.xml"
    if not xml_path.exists():
        print(f"  ❌ Hebrew source not found: {xml_path}")
        return {}
    
    verses = {}
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Define namespace
    ns = {'osis': 'http://www.bibletechnologies.net/2003/OSIS/namespace'}
    
    for verse_elem in root.findall('.//osis:verse', ns):
        osis_id = verse_elem.get('osisID', '')
        match = re.match(r'Ruth\.(\d+)\.(\d+)', osis_id)
        if not match:
            continue
        
        chapter = int(match.group(1))
        verse_num = int(match.group(2))
        
        # Extract Hebrew text from <w> elements
        words = []
        for w in verse_elem.findall('.//osis:w', ns):
            text = w.text
            if text:
                # Remove morphological markers, keep Hebrew text
                words.append(text.strip())
        
        verse_text = ' '.join(words)
        # Add sof pasuq (׃) if not present
        if verse_text and not verse_text.endswith('׃'):
            verse_text += '׃'
        
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = verse_text
    
    print(f"  ✅ Hebrew WLC: {sum(len(v) for v in verses.values())} verses")
    return verses


def parse_greek_lxx():
    """Parse Septuagint (Swete) for Ruth."""
    txt_path = SOURCES_DIR / "greek" / "septuagint" / "08.Rut.txt"
    if not txt_path.exists():
        print(f"  ❌ Greek LXX source not found: {txt_path}")
        return {}
    
    verses = {}
    current_text = {}
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Format: 08001001 word1 word2
            # First 8 chars: BBCCCVVV (book, chapter, verse)
            match = re.match(r'^(\d{8})\s+(\S+)', line)
            if match:
                ref = match.group(1)
                word = match.group(2)
                
                chapter = int(ref[2:5])
                verse_num = int(ref[5:8])
                
                key = (chapter, verse_num)
                if key not in current_text:
                    current_text[key] = []
                current_text[key].append(word)
    
    # Combine words into verses
    for (chapter, verse_num), words in current_text.items():
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = ' '.join(words)
    
    print(f"  ✅ Greek LXX: {sum(len(v) for v in verses.values())} verses")
    return verses


def parse_latin_vulgate():
    """Parse Clementine Vulgate for Ruth."""
    # Direct path to Ruth
    lat_path = SOURCES_DIR / "latin" / "clementine" / "src" / "utf8" / "Rt.lat"
    
    if not lat_path.exists():
        print(f"  ❌ Latin Vulgate Ruth not found: {lat_path}")
        return {}
    
    verses = {}
    
    with open(lat_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Format: chapter:verse text
    # Use lookahead to properly capture text up to next verse
    for match in re.finditer(r'(\d+):(\d+)\s+(.+?)(?=\n\d+:\d+|\Z)', content, re.DOTALL):
        chapter = int(match.group(1))
        verse_num = int(match.group(2))
        text = match.group(3).strip()
        # Clean up line breaks and extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove trailing backslash (some verses have this)
        text = text.rstrip('\\').strip()
        
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = text
    
    if verses:
        print(f"  ✅ Latin VUL: {sum(len(v) for v in verses.values())} verses")
    else:
        print(f"  ⚠️ Latin VUL: Could not parse {lat_path.name}")
    
    return verses


def parse_russian_synodal():
    """Parse Russian Synodal translation for Ruth."""
    txt_path = SOURCES_DIR / "russian" / "synodal-77books" / "Синодальный перевод - 77 книг - txt" / "08_ruf.txt"
    if not txt_path.exists():
        print(f"  ❌ Russian source not found: {txt_path}")
        return {}
    
    verses = {}
    current_chapter = 0
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Chapter header: === 1 ===
            chapter_match = re.match(r'^===\s*(\d+)\s*===', line)
            if chapter_match:
                current_chapter = int(chapter_match.group(1))
                verses[current_chapter] = {}
                continue
            
            # Skip book title
            if line.startswith('== '):
                continue
            
            # Verse: starts with number
            verse_match = re.match(r'^(\d+)\s+(.+)', line)
            if verse_match and current_chapter > 0:
                verse_num = int(verse_match.group(1))
                text = verse_match.group(2).strip()
                verses[current_chapter][verse_num] = text
    
    print(f"  ✅ Russian SYN: {sum(len(v) for v in verses.values())} verses")
    return verses


def parse_vatican_html(lang_code, lang_name, subdir, ruth_files):
    """Parse Vatican website HTML files for Ruth.
    
    Args:
        lang_code: Translation code (NAB, VAT_ES, CEI)
        lang_name: Language directory name (english, spanish, italian)
        subdir: Subdirectory name (nab-vatican, libro-pueblo-dios, vatican)
        ruth_files: Dict mapping chapter number to filename
    """
    html_dir = SOURCES_DIR / lang_name / subdir
    if not html_dir.exists():
        print(f"  ❌ {lang_code} source dir not found: {html_dir}")
        return {}
    
    verses = {}
    
    for chapter_num, filename in ruth_files.items():
        file_path = html_dir / filename
        if not file_path.exists():
            print(f"    ⚠️ Chapter {chapter_num} not found: {filename}")
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # Parse verses: verse number in <p class=MsoNormal>N, text in following margin-left paragraph
        # Pattern: <p class=MsoNormal>N</p> followed by <p class=MsoNormal style='margin-left:...'>text</p>
        
        # First, extract all verse blocks
        verse_pattern = r"<p class=MsoNormal>(\d+)\s*</p>\s*<p class=MsoNormal[^>]*style='margin-left:[^']*'>(.+?)</p>"
        
        for match in re.finditer(verse_pattern, content, re.DOTALL | re.IGNORECASE):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            # Clean HTML tags and entities
            text = re.sub(r'<sup>.*?</sup>', '', text, flags=re.DOTALL)  # Remove footnote markers
            text = re.sub(r'<[^>]+>', '', text)  # Remove all other HTML tags
            text = text.replace('&quot;', '"')
            text = text.replace('&nbsp;', ' ')
            text = text.replace('&amp;', '&')
            text = text.replace('&#8658;', '')  # Arrow symbol
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            text = text.strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    total = sum(len(v) for v in verses.values())
    if total > 0:
        print(f"  ✅ {lang_code}: {total} verses")
    else:
        print(f"  ⚠️ {lang_code}: Could not parse Vatican HTML")
    
    return verses


def parse_vatican_html_spanish(lang_code, lang_name, subdir, ruth_files):
    """Parse Spanish Vatican HTML files for Ruth.
    
    Spanish format: <p class=MsoNormal...>N text where N is verse number at start of text
    Text may continue across multiple paragraphs until next verse number.
    """
    html_dir = SOURCES_DIR / lang_name / subdir
    if not html_dir.exists():
        print(f"  ❌ {lang_code} source dir not found: {html_dir}")
        return {}
    
    verses = {}
    
    for chapter_num, filename in ruth_files.items():
        file_path = html_dir / filename
        if not file_path.exists():
            print(f"    ⚠️ Chapter {chapter_num} not found: {filename}")
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # Spanish format: verse number at start of paragraph
        # Pattern: <p class=MsoNormal...>N text
        verse_pattern = r'<p class=MsoNormal[^>]*>(\d+)\s+([^<]+)'
        
        for match in re.finditer(verse_pattern, content, re.DOTALL):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            # Clean HTML entities
            text = text.replace('&quot;', '"')
            text = text.replace('&nbsp;', ' ')
            text = text.replace('&amp;', '&')
            text = text.replace('&iacute;', 'í')
            text = text.replace('&aacute;', 'á')
            text = text.replace('&eacute;', 'é')
            text = text.replace('&oacute;', 'ó')
            text = text.replace('&uacute;', 'ú')
            text = text.replace('&ntilde;', 'ñ')
            text = text.replace('&laquo;', '«')
            text = text.replace('&raquo;', '»')
            text = text.replace('&ndash;', '–')
            text = text.replace('&mdash;', '—')
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            text = text.strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    total = sum(len(v) for v in verses.values())
    if total > 0:
        print(f"  ✅ {lang_code}: {total} verses")
    else:
        print(f"  ⚠️ {lang_code}: Could not parse Spanish HTML")
    
    return verses


def parse_vatican_html_cei(lang_code, lang_name, subdir, ruth_files):
    """Parse Vatican CEI (Italian) HTML files for Ruth.
    
    Italian CEI uses a different format: [1] verse text, [2] verse text...
    """
    html_dir = SOURCES_DIR / lang_name / subdir
    if not html_dir.exists():
        print(f"  ❌ {lang_code} source dir not found: {html_dir}")
        return {}
    
    verses = {}
    
    for chapter_num, filename in ruth_files.items():
        file_path = html_dir / filename
        if not file_path.exists():
            print(f"    ⚠️ Chapter {chapter_num} not found: {filename}")
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # CEI format: [verse_num] text
        # Pattern finds [N] followed by text until next [N] or end
        verse_pattern = r'\[(\d+)\]\s*([^[\]]+?)(?=\[\d+\]|<center>|$)'
        
        for match in re.finditer(verse_pattern, content, re.DOTALL):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            # Clean HTML tags and entities
            text = re.sub(r'<[^>]+>', '', text)  # Remove all HTML tags
            text = text.replace('&quot;', '"')
            text = text.replace('&nbsp;', ' ')
            text = text.replace('&amp;', '&')
            text = text.replace('&egrave;', 'è')
            text = text.replace('&agrave;', 'à')
            text = text.replace('&igrave;', 'ì')
            text = text.replace('&ograve;', 'ò')
            text = text.replace('&ugrave;', 'ù')
            text = text.replace('&eacute;', 'é')
            text = text.replace('&oacute;', 'ó')
            text = text.replace('&Egrave;', 'È')
            text = text.replace("'", "'")
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            text = text.strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    total = sum(len(v) for v in verses.values())
    if total > 0:
        print(f"  ✅ {lang_code}: {total} verses")
    else:
        print(f"  ⚠️ {lang_code}: Could not parse CEI HTML")
    
    return verses


def parse_french_usfm():
    """Parse French néo-Crampon USFM for Ruth."""
    # Find Ruth file
    french_dir = SOURCES_DIR / "french" / "neo-crampon"
    ruth_files = list(french_dir.glob("*[Rr]uth*")) + list(french_dir.glob("*RUT*"))
    
    if not ruth_files:
        # Ruth is book 8 in OT
        ruth_files = list(french_dir.glob("08-*.usfm")) + list(french_dir.glob("*08*.usfm"))
    
    if not ruth_files:
        print(f"  ❌ French Ruth not found in {french_dir}")
        return {}
    
    usfm_path = ruth_files[0]
    verses = {}
    current_chapter = 0
    
    with open(usfm_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # USFM format: \c 1 (chapter), \v 1 text (verse)
    lines = content.split('\n')
    current_verse_text = []
    current_verse = 0
    
    for line in lines:
        line = line.strip()
        
        # Chapter marker
        if line.startswith('\\c '):
            # Save previous verse if any
            if current_chapter > 0 and current_verse > 0 and current_verse_text:
                if current_chapter not in verses:
                    verses[current_chapter] = {}
                verses[current_chapter][current_verse] = ' '.join(current_verse_text)
            
            current_chapter = int(line[3:].strip().split()[0])
            current_verse = 0
            current_verse_text = []
            continue
        
        # Verse marker
        verse_match = re.match(r'^\\v\s+(\d+)\s*(.*)', line)
        if verse_match:
            # Save previous verse
            if current_chapter > 0 and current_verse > 0 and current_verse_text:
                if current_chapter not in verses:
                    verses[current_chapter] = {}
                verses[current_chapter][current_verse] = ' '.join(current_verse_text)
            
            current_verse = int(verse_match.group(1))
            current_verse_text = [verse_match.group(2).strip()] if verse_match.group(2).strip() else []
            continue
        
        # Skip USFM markers, keep text
        if line and not line.startswith('\\'):
            current_verse_text.append(line)
        elif line.startswith('\\') and not any(line.startswith(m) for m in ['\\id', '\\h', '\\toc', '\\mt', '\\c ', '\\v ', '\\s', '\\p', '\\q', '\\r']):
            # Remove marker but keep text
            text = re.sub(r'^\\[a-z]+\d*\s*', '', line).strip()
            if text:
                current_verse_text.append(text)
    
    # Save last verse
    if current_chapter > 0 and current_verse > 0 and current_verse_text:
        if current_chapter not in verses:
            verses[current_chapter] = {}
        verses[current_chapter][current_verse] = ' '.join(current_verse_text)
    
    # Clean up USFM inline markers from all verses
    for chapter_num in verses:
        for verse_num in verses[chapter_num]:
            text = verses[chapter_num][verse_num]
            # Remove \w word|strong="H1234"\w* patterns, keeping just the word
            text = re.sub(r'\\w\s*([^|]+)\|[^*]+\\w\*', r'\1', text)
            # Remove any remaining USFM markers
            text = re.sub(r'\\[a-z]+\d*\s*', '', text)
            # Normalize whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            verses[chapter_num][verse_num] = text
    
    if verses:
        print(f"  ✅ French NEO: {sum(len(v) for v in verses.values())} verses")
    else:
        print(f"  ⚠️ French NEO: Could not parse {usfm_path.name}")
    
    return verses


def update_chapter_file(chapter_num, translations_data):
    """Update a chapter JSON file with translation data."""
    chapter_file = CHAPTERS_DIR / f"{chapter_num:03d}.json"
    
    if not chapter_file.exists():
        print(f"  ❌ Chapter file not found: {chapter_file}")
        return False
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        chapter_data = json.load(f)
    
    verses = chapter_data.get('verses', {})
    updated_count = 0
    
    for verse_key, verse_data in verses.items():
        verse_num = int(verse_key)
        
        # Get or create text object
        if 'text' not in verse_data:
            verse_data['text'] = {}
        
        # Add each translation
        for trans_code, trans_verses in translations_data.items():
            if chapter_num in trans_verses and verse_num in trans_verses[chapter_num]:
                text = trans_verses[chapter_num][verse_num]
                if text:
                    verse_data['text'][trans_code] = text
                    updated_count += 1
    
    # Write back
    with open(chapter_file, 'w', encoding='utf-8') as f:
        json.dump(chapter_data, f, ensure_ascii=False, indent=2)
    
    return updated_count


def main():
    print("=" * 60)
    print("Populating Ruth with 9 Languages")
    print("=" * 60)
    
    print("\n📖 Parsing source files...")
    
    # Parse each language
    all_translations = {}
    
    # Hebrew
    print("\n  Parsing Hebrew (WLC)...")
    all_translations['WLC'] = parse_hebrew_wlc()
    
    # Greek
    print("\n  Parsing Greek (LXX)...")
    all_translations['LXX'] = parse_greek_lxx()
    
    # Latin
    print("\n  Parsing Latin (VUL)...")
    all_translations['VUL'] = parse_latin_vulgate()
    
    # Russian
    print("\n  Parsing Russian (SYN)...")
    all_translations['SYN'] = parse_russian_synodal()
    
    # French
    print("\n  Parsing French (NEO)...")
    all_translations['NEO'] = parse_french_usfm()
    
    # English - Vatican HTML (NAB)
    # Ruth files: __P6Q.HTM (ch1), __P6R.HTM (ch2), __P6S.HTM (ch3), __P6T.HTM (ch4)
    print("\n  Parsing English (NAB)...")
    nab_ruth_files = {1: '__P6Q.HTM', 2: '__P6R.HTM', 3: '__P6S.HTM', 4: '__P6T.HTM'}
    all_translations['NAB'] = parse_vatican_html('NAB', 'english', 'nab-vatican', nab_ruth_files)
    
    # Spanish - Vatican HTML (Libro del Pueblo de Dios)
    # Ruth files: __PME.HTM (ch1), __PMF.HTM (ch2), __PMG.HTM (ch3), __PMH.HTM (ch4)
    print("\n  Parsing Spanish (VAT_ES)...")
    spanish_ruth_files = {1: '__PME.HTM', 2: '__PMF.HTM', 3: '__PMG.HTM', 4: '__PMH.HTM'}
    all_translations['VAT_ES'] = parse_vatican_html_spanish('VAT_ES', 'spanish', 'libro-pueblo-dios', spanish_ruth_files)
    
    # Italian - Vatican HTML (CEI)
    # Ruth files: __P6H.HTM (ch1), __P6I.HTM (ch2), __P6J.HTM (ch3), __P6K.HTM (ch4)
    print("\n  Parsing Italian (CEI)...")
    italian_ruth_files = {1: '__P6H.HTM', 2: '__P6I.HTM', 3: '__P6J.HTM', 4: '__P6K.HTM'}
    all_translations['CEI'] = parse_vatican_html_cei('CEI', 'italian', 'vatican', italian_ruth_files)
    
    # Portuguese - pending permission
    print("\n  Portuguese (POR)...")
    print("  ⏳ Pending: Awaiting permission from Editora Ave-Maria")
    all_translations['POR'] = {}
    
    # Summary
    print("\n" + "=" * 60)
    print("Translation Summary:")
    for code, verses in all_translations.items():
        if verses:
            total = sum(len(v) for v in verses.values())
            print(f"  {code}: {total} verses")
        else:
            print(f"  {code}: Not available")
    
    # Update chapter files
    print("\n📝 Updating chapter files...")
    
    for chapter_num in range(1, 5):  # Ruth has 4 chapters
        count = update_chapter_file(chapter_num, all_translations)
        print(f"  Chapter {chapter_num}: {count} translations added")
    
    print("\n✅ Ruth population complete!")


if __name__ == "__main__":
    main()
