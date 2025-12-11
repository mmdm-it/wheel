#!/usr/bin/env python3
"""
Reusable parsers for Bible source files in various formats.

Each parser returns a dict: {chapter_num: {verse_num: text}}

Source Format Summary:
- Hebrew (WLC): XML with OSIS namespace, <verse> elements with osisID="Book.C.V"
- Greek OT (LXX): TXT with 8-digit refs (BBCCCVVV) + word per line
- Greek NT (BYZ): Similar to LXX format
- Latin (VUL): Plain text with "C:V text" format
- Russian (SYN): TXT with "=== C ===" chapter headers, "N text" verses
- French (NEO): USFM format with \c, \v markers and \w word|strong\w* inline
- English (NAB): Vatican HTML with <p class=MsoNormal>N</p> + margin-left text
- Spanish (VAT_ES): Vatican HTML with <p class=MsoNormal>N text inline
- Italian (CEI): Vatican HTML with [N] verse markers inline
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional

# Type alias for verse data
VerseDict = Dict[int, Dict[int, str]]


def parse_hebrew_wlc(xml_path: Path, book_name: str) -> VerseDict:
    """
    Parse Westminster Leningrad Codex XML.
    
    Args:
        xml_path: Path to the XML file (e.g., Ruth.xml, Genesis.xml)
        book_name: OSIS book name (e.g., "Ruth", "Gen", "Ps")
    
    Format: OSIS XML with namespace, <verse osisID="Book.C.V"> containing <w> elements
    """
    if not xml_path.exists():
        return {}
    
    verses: VerseDict = {}
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    ns = {'osis': 'http://www.bibletechnologies.net/2003/OSIS/namespace'}
    
    for verse_elem in root.findall('.//osis:verse', ns):
        osis_id = verse_elem.get('osisID', '')
        # Match Book.Chapter.Verse pattern
        match = re.match(rf'{book_name}\.(\d+)\.(\d+)', osis_id)
        if not match:
            continue
        
        chapter = int(match.group(1))
        verse_num = int(match.group(2))
        
        # Extract Hebrew text from <w> elements
        words = []
        for w in verse_elem.findall('.//osis:w', ns):
            text = w.text
            if text:
                words.append(text.strip())
        
        verse_text = ' '.join(words)
        if verse_text and not verse_text.endswith('׃'):
            verse_text += '׃'
        
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = verse_text
    
    return verses


def parse_greek_lxx(txt_path: Path) -> VerseDict:
    """
    Parse Septuagint (Swete) word-per-line format.
    
    Format: 8-digit reference + word per line
    - Digits 1-2: Book number (08 = Ruth)
    - Digits 3-5: Chapter (001-999)
    - Digits 6-8: Verse (001-999)
    """
    if not txt_path.exists():
        return {}
    
    verses: VerseDict = {}
    current_text: Dict[tuple, list] = {}
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
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
    
    for (chapter, verse_num), words in current_text.items():
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = ' '.join(words)
    
    return verses


def parse_greek_byzantine(txt_path: Path) -> VerseDict:
    """
    Parse Byzantine/Robinson-Pierpont NT Greek.
    Similar format to LXX but for NT books.
    """
    return parse_greek_lxx(txt_path)  # Same format


def parse_latin_vulgate(lat_path: Path) -> VerseDict:
    """
    Parse Clementine Vulgate plain text.
    
    Format: C:V text (chapter:verse followed by Latin text)
    """
    if not lat_path.exists():
        return {}
    
    verses: VerseDict = {}
    
    with open(lat_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Match chapter:verse text pattern
    for match in re.finditer(r'(\d+):(\d+)\s+(.+?)(?=\n\d+:\d+|\Z)', content, re.DOTALL):
        chapter = int(match.group(1))
        verse_num = int(match.group(2))
        text = match.group(3).strip()
        text = re.sub(r'\s+', ' ', text)
        text = text.rstrip('\\').strip()
        
        if chapter not in verses:
            verses[chapter] = {}
        verses[chapter][verse_num] = text
    
    return verses


def parse_russian_synodal(txt_path: Path) -> VerseDict:
    """
    Parse Russian Synodal translation.
    
    Format:
    - Book title: == Book Name ==
    - Chapter header: === N ===
    - Verses: N text (number followed by verse text)
    """
    if not txt_path.exists():
        return {}
    
    verses: VerseDict = {}
    current_chapter = 0
    
    with open(txt_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Chapter header: === N ===
            chapter_match = re.match(r'^===\s*(\d+)\s*===', line)
            if chapter_match:
                current_chapter = int(chapter_match.group(1))
                verses[current_chapter] = {}
                continue
            
            # Skip book title
            if line.startswith('== '):
                continue
            
            # Verse: N text
            verse_match = re.match(r'^(\d+)\s+(.+)', line)
            if verse_match and current_chapter > 0:
                verse_num = int(verse_match.group(1))
                text = verse_match.group(2).strip()
                verses[current_chapter][verse_num] = text
    
    return verses


def parse_french_usfm(usfm_path: Path) -> VerseDict:
    """
    Parse French néo-Crampon USFM format.
    
    Format:
    - \\c N = chapter marker
    - \\v N text = verse marker
    - \\w word|strong="HNNNN"\\w* = word with Strong's number (stripped)
    
    Note: Inline \\w markers are cleaned to extract just the word.
    """
    if not usfm_path.exists():
        return {}
    
    verses: VerseDict = {}
    current_chapter = 0
    current_verse = 0
    current_verse_text: list = []
    
    with open(usfm_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    for line in lines:
        line = line.strip()
        
        # Chapter marker
        if line.startswith('\\c '):
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
            if current_chapter > 0 and current_verse > 0 and current_verse_text:
                if current_chapter not in verses:
                    verses[current_chapter] = {}
                verses[current_chapter][current_verse] = ' '.join(current_verse_text)
            
            current_verse = int(verse_match.group(1))
            current_verse_text = [verse_match.group(2).strip()] if verse_match.group(2).strip() else []
            continue
        
        # Collect text lines
        if line and not line.startswith('\\'):
            current_verse_text.append(line)
        elif line.startswith('\\') and not any(line.startswith(m) for m in 
                ['\\id', '\\h', '\\toc', '\\mt', '\\c ', '\\v ', '\\s', '\\p', '\\q', '\\r']):
            text = re.sub(r'^\\[a-z]+\d*\s*', '', line).strip()
            if text:
                current_verse_text.append(text)
    
    # Save last verse
    if current_chapter > 0 and current_verse > 0 and current_verse_text:
        if current_chapter not in verses:
            verses[current_chapter] = {}
        verses[current_chapter][current_verse] = ' '.join(current_verse_text)
    
    # Clean up USFM inline markers
    for chapter_num in verses:
        for verse_num in verses[chapter_num]:
            text = verses[chapter_num][verse_num]
            # Remove \w word|strong="H1234"\w* patterns
            text = re.sub(r'\\w\s*([^|]+)\|[^*]+\\w\*', r'\1', text)
            text = re.sub(r'\\[a-z]+\d*\s*', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            verses[chapter_num][verse_num] = text
    
    return verses


def _clean_html_entities(text: str) -> str:
    """Clean common HTML entities to Unicode."""
    replacements = {
        '&quot;': '"', '&nbsp;': ' ', '&amp;': '&',
        '&iacute;': 'í', '&aacute;': 'á', '&eacute;': 'é',
        '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ',
        '&egrave;': 'è', '&agrave;': 'à', '&igrave;': 'ì',
        '&ograve;': 'ò', '&ugrave;': 'ù', '&Egrave;': 'È',
        '&laquo;': '«', '&raquo;': '»',
        '&ndash;': '–', '&mdash;': '—',
        '&#8658;': '',  # Arrow symbol
    }
    for entity, char in replacements.items():
        text = text.replace(entity, char)
    return text


def parse_vatican_html_nab(html_files: Dict[int, Path]) -> VerseDict:
    """
    Parse English NAB from Vatican HTML files.
    
    Format:
    - <p class=MsoNormal>N</p> = verse number on its own
    - <p class=MsoNormal style='margin-left:...'>text</p> = verse text
    - Footnote markers in <sup> tags (removed)
    
    Args:
        html_files: Dict mapping chapter number to file path
    """
    verses: VerseDict = {}
    
    for chapter_num, file_path in html_files.items():
        if not file_path.exists():
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # Pattern: verse number paragraph followed by margin-left text paragraph
        pattern = r"<p class=MsoNormal>(\d+)\s*</p>\s*<p class=MsoNormal[^>]*style='margin-left:[^']*'>(.+?)</p>"
        
        for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            text = re.sub(r'<sup>.*?</sup>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', '', text)
            text = _clean_html_entities(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    return verses


def parse_vatican_html_spanish(html_files: Dict[int, Path]) -> VerseDict:
    """
    Parse Spanish Libro del Pueblo de Dios from Vatican HTML.
    
    Format:
    - <p class=MsoNormal...>N text = verse number at start of paragraph text
    """
    verses: VerseDict = {}
    
    for chapter_num, file_path in html_files.items():
        if not file_path.exists():
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # Spanish: verse number at start of paragraph
        pattern = r'<p class=MsoNormal[^>]*>(\d+)\s+([^<]+)'
        
        for match in re.finditer(pattern, content, re.DOTALL):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            text = _clean_html_entities(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    return verses


def parse_vatican_html_cei(html_files: Dict[int, Path]) -> VerseDict:
    """
    Parse Italian CEI from Vatican HTML.
    
    Format:
    - [N] verse text = verse number in brackets followed by text
    """
    verses: VerseDict = {}
    
    for chapter_num, file_path in html_files.items():
        if not file_path.exists():
            continue
        
        with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
            content = f.read()
        
        verses[chapter_num] = {}
        
        # CEI: [N] followed by text until next [N] or end
        pattern = r'\[(\d+)\]\s*([^[\]]+?)(?=\[\d+\]|<center>|$)'
        
        for match in re.finditer(pattern, content, re.DOTALL):
            verse_num = int(match.group(1))
            text = match.group(2)
            
            text = re.sub(r'<[^>]+>', '', text)
            text = _clean_html_entities(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if text:
                verses[chapter_num][verse_num] = text
    
    return verses


# Book file mappings for Vatican HTML sources
# These map chapter numbers to HTML filenames

VATICAN_NAB_BOOKS = {
    'RUTH': {1: '__P6Q.HTM', 2: '__P6R.HTM', 3: '__P6S.HTM', 4: '__P6T.HTM'},
    # Add more books as discovered
}

VATICAN_SPANISH_BOOKS = {
    'RUTH': {1: '__PME.HTM', 2: '__PMF.HTM', 3: '__PMG.HTM', 4: '__PMH.HTM'},
    # Add more books as discovered
}

VATICAN_CEI_BOOKS = {
    'RUTH': {1: '__P6H.HTM', 2: '__P6I.HTM', 3: '__P6J.HTM', 4: '__P6K.HTM'},
    # Add more books as discovered
}


# Source file patterns for each language
# Used by populate_book.py to find source files

SOURCE_PATTERNS = {
    'WLC': {
        'dir': 'hebrew/wlc',
        'pattern': '{book}.xml',  # e.g., Ruth.xml, Genesis.xml
        'parser': 'parse_hebrew_wlc',
    },
    'LXX': {
        'dir': 'greek/septuagint',
        'pattern': '{num:02d}.{abbrev}.txt',  # e.g., 08.Rut.txt
        'parser': 'parse_greek_lxx',
    },
    'VUL': {
        'dir': 'latin/clementine/src/utf8',
        'pattern': '{abbrev}.lat',  # e.g., Rt.lat, Gn.lat
        'parser': 'parse_latin_vulgate',
    },
    'SYN': {
        'dir': 'russian/synodal-77books/Синодальный перевод - 77 книг - txt',
        'pattern': '{num:02d}_{abbrev}.txt',  # e.g., 08_ruf.txt
        'parser': 'parse_russian_synodal',
    },
    'NEO': {
        'dir': 'french/neo-crampon',
        'pattern': '{num:02d}-{abbrev}francl.usfm',  # e.g., 08-RUTfrancl.usfm
        'parser': 'parse_french_usfm',
    },
    'NAB': {
        'dir': 'english/nab-vatican',
        'parser': 'parse_vatican_html_nab',
        'mapping': 'VATICAN_NAB_BOOKS',
    },
    'VAT_ES': {
        'dir': 'spanish/libro-pueblo-dios',
        'parser': 'parse_vatican_html_spanish',
        'mapping': 'VATICAN_SPANISH_BOOKS',
    },
    'CEI': {
        'dir': 'italian/vatican',
        'parser': 'parse_vatican_html_cei',
        'mapping': 'VATICAN_CEI_BOOKS',
    },
}


# Book metadata: number, abbreviations for different sources
BOOK_METADATA = {
    'RUTH': {
        'num': 8,
        'wlc_name': 'Ruth',
        'lxx_abbrev': 'Rut',
        'vul_abbrev': 'Rt',
        'syn_abbrev': 'ruf',
        'neo_abbrev': 'RUT',
        'chapters': 4,
        'testament': 'OT',
    },
    'GENE': {
        'num': 1,
        'wlc_name': 'Gen',
        'lxx_abbrev': 'Gen',
        'vul_abbrev': 'Gn',
        'syn_abbrev': 'gen',
        'neo_abbrev': 'GEN',
        'chapters': 50,
        'testament': 'OT',
    },
    'PSAL': {
        'num': 19,
        'wlc_name': 'Ps',
        'lxx_abbrev': 'Ps',
        'vul_abbrev': 'Ps',
        'syn_abbrev': 'psal',
        'neo_abbrev': 'PSA',
        'chapters': 150,
        'testament': 'OT',
    },
    # Add more books as needed
}
