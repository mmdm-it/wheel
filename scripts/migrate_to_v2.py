#!/usr/bin/env python3
"""
Migrate Bible chapter JSON files from v1.0 to v2.0 structure.

V2.0 adds:
- chapter_in: versification-specific chapter numbers
- v_in: versification-specific verse numbers  
- text: translations grouped under text object
- exists_in: for tradition-specific content
- Translation codes (WLC, VUL, NAB, etc.) instead of language names
"""

import json
import os
import shutil
from pathlib import Path
from datetime import datetime

# Paths
CHAPTERS_DIR = Path(__file__).parent.parent / "data" / "gutenberg" / "chapters"
BACKUP_DIR = Path(__file__).parent.parent / "data" / "gutenberg" / "chapters_v1_backup"

# Language key to translation code mapping
LANG_TO_CODE = {
    "hebrew": "WLC",
    "latin": "VUL",
    "greek": "LXX",      # OT Greek (Septuagint)
    "english": "NAB",
    "russian": "SYN",
    "french": "NEO",
    "spanish": "VAT_ES",
    "italian": "CEI",
    "portuguese": "POR",
}

# Books and their versification characteristics
# For most books, MT/VUL/LXX have same chapter/verse numbers
# Special cases are handled separately

# Psalms versification mapping
# 
# CRITICAL: Our internal sequence follows MT (Hebrew/Protestant) numbering 1-150.
# We add sequence 151 for LXX-only Psalm 151.
#
# The Vulgate/LXX numbering differs:
# - MT 1-8 = VUL/LXX 1-8 (same)
# - MT 9 + MT 10 = VUL/LXX 9 (combined in Vulgate as one psalm)
# - MT 11-113 = VUL/LXX 10-112 (offset by 1)
# - MT 114 + MT 115 = VUL/LXX 113 (combined)
# - MT 116 = VUL/LXX 114 + 115 (split in Vulgate into two psalms)
# - MT 117-146 = VUL/LXX 116-145 (offset by 1)
# - MT 147 = VUL/LXX 146 + 147 (split in Vulgate into two psalms)
# - MT 148-150 = VUL/LXX 148-150 (same)
# - MT has no 151; LXX has 151; VUL sometimes has 151 as appendix
#
# APPROACH: Since splits/combines make 1:1 mapping impossible for some psalms,
# we note that our files are numbered by internal sequence, and store what
# chapter number each tradition uses. For splits, the verses will be split
# within the chapter file.

def get_psalm_chapter_mapping(sequence):
    """
    Map internal psalm sequence (MT-based) to versification-specific chapter numbers.
    
    Our internal sequence uses MT (Hebrew) numbering 1-150, plus 151 for LXX.
    Returns dict with MT, VUL, LXX chapter numbers.
    
    For combined psalms (MT 9+10 = VUL 9), both internal sequences point
    to the same VUL chapter, but with different verse ranges.
    """
    mt = sequence  # MT is our canonical reference (sequence = MT chapter)
    
    # Calculate Vulgate/LXX chapter number based on MT sequence
    if sequence <= 8:
        # MT 1-8 = VUL 1-8 (identical)
        vul = sequence
    elif sequence == 9:
        # VUL 9:1-21 corresponds to MT 9 (our seq 9)
        vul = 9
    elif sequence == 10:
        # VUL 9:22-39 corresponds to MT 10 (our seq 10)
        # Display as VUL chapter 9, second half
        vul = 9  
    elif 11 <= sequence <= 113:
        # MT 11-113 = VUL 10-112 (offset: VUL = MT - 1)
        vul = sequence - 1
    elif sequence == 114:
        # VUL 113:1-8 corresponds to MT 114 (our seq 114)
        vul = 113
    elif sequence == 115:
        # VUL 113:9-26 corresponds to MT 115 (our seq 115)
        vul = 113
    elif sequence == 116:
        # MT 116 splits into VUL 114 (vv 1-9) and 115 (vv 10-19)
        # We keep it as one chapter internally, but note VUL has two chapters for this content
        # For display, we'll use VUL 114-115
        vul = 114  # Primary reference
    elif 117 <= sequence <= 146:
        # MT 117-146 = VUL 116-145 (offset: VUL = MT - 1)
        vul = sequence - 1
    elif sequence == 147:
        # MT 147 splits into VUL 146 (vv 1-11) and 147 (vv 12-20)
        vul = 146  # Primary reference
    elif 148 <= sequence <= 150:
        # MT 148-150 = VUL 148-150 (back in sync)
        vul = sequence
    elif sequence == 151:
        # Psalm 151 - only in LXX/Orthodox tradition
        vul = None
    else:
        vul = sequence
    
    # LXX follows Vulgate numbering for Psalms 1-150
    # LXX has Psalm 151, Vulgate traditionally does not (though some editions include it)
    if sequence == 151:
        lxx = 151
    else:
        lxx = vul
    
    result = {"MT": mt}
    if vul is not None:
        result["VUL"] = vul
    if lxx is not None:
        result["LXX"] = lxx
    
    return result


def get_chapter_mapping(book_key, sequence):
    """
    Get versification mapping for a chapter.
    
    Returns:
        dict with chapter_in mapping
        optional exists_in list if not universal
    """
    # Special handling for Psalms
    if book_key == "PSAL":
        mapping = get_psalm_chapter_mapping(sequence)
        exists_in = None
        if sequence == 151:
            exists_in = ["LXX"]  # Only Orthodox
        return mapping, exists_in
    
    # For most books, all three systems use same numbering
    # Special cases for books with different chapter counts:
    
    if book_key == "DAN" and sequence > 12:
        # Daniel 13-14 only exist in VUL/LXX (Susanna, Bel and Dragon)
        return {"VUL": sequence, "LXX": sequence}, ["VUL", "LXX"]
    
    if book_key == "ESTH" and sequence > 10:
        # Esther 11-16 are Greek additions (VUL/LXX only)
        return {"VUL": sequence, "LXX": sequence}, ["VUL", "LXX"]
    
    # Default: same in all systems
    return {"MT": sequence, "VUL": sequence, "LXX": sequence}, None


def get_verse_mapping(book_key, chapter_seq, verse_num):
    """
    Get versification mapping for a verse.
    
    For most verses, the number is the same in all systems.
    Returns dict with v_in mapping.
    """
    # For now, assume same verse numbers in all systems
    # TODO: Add special handling for Psalm superscriptions, Daniel 3 insertion, etc.
    return {"MT": verse_num, "VUL": verse_num, "LXX": verse_num}


def migrate_chapter(old_data):
    """
    Migrate a single chapter from v1 to v2 structure.
    """
    book_key = old_data.get("book_key", "UNKN")
    chapter_num = old_data.get("chapter_number", 1)
    
    # Get chapter mapping
    chapter_in, exists_in = get_chapter_mapping(book_key, chapter_num)
    
    # Build new structure
    new_data = {
        "_schema_version": "2.0",
        "chapter_id": old_data.get("chapter_id", f"{book_key}_{chapter_num:03d}"),
        "book_key": book_key,
        "sequence": chapter_num,
        "chapter_in": chapter_in,
        "testament": old_data.get("testament", ""),
        "section": old_data.get("section", ""),
    }
    
    if exists_in:
        new_data["exists_in"] = exists_in
    
    # Migrate verses
    new_verses = {}
    old_verses = old_data.get("verses", {})
    
    for verse_key, old_verse in old_verses.items():
        verse_num = int(verse_key)
        v_in = get_verse_mapping(book_key, chapter_num, verse_num)
        
        new_verse = {
            "seq": verse_num,
            "v_in": v_in,
            "text": {}
        }
        
        # Migrate translations
        for old_key, new_code in LANG_TO_CODE.items():
            if old_key in old_verse and old_verse[old_key]:
                new_verse["text"][new_code] = old_verse[old_key]
        
        # Handle Greek specially - check if it's OT (LXX) or NT (BYZ)
        if "greek" in old_verse and old_verse["greek"]:
            testament = old_data.get("testament", "")
            if "Novum" in testament or testament == "NT":
                new_verse["text"]["BYZ"] = old_verse["greek"]
            else:
                new_verse["text"]["LXX"] = old_verse["greek"]
        
        new_verses[verse_key] = new_verse
    
    new_data["verses"] = new_verses
    
    return new_data


def migrate_all_chapters(dry_run=False):
    """
    Migrate all chapter files to v2 structure.
    """
    if not CHAPTERS_DIR.exists():
        print(f"Error: Chapters directory not found: {CHAPTERS_DIR}")
        return
    
    # Create backup
    if not dry_run:
        if BACKUP_DIR.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = BACKUP_DIR.parent / f"chapters_v1_backup_{timestamp}"
            print(f"Backup directory exists, creating timestamped backup: {backup_path}")
        else:
            backup_path = BACKUP_DIR
        
        print(f"Creating backup at: {backup_path}")
        shutil.copytree(CHAPTERS_DIR, backup_path)
    
    # Get all book directories
    books = sorted([d for d in CHAPTERS_DIR.iterdir() if d.is_dir()])
    
    total_chapters = 0
    total_verses = 0
    errors = []
    
    print(f"\nMigrating {len(books)} books...")
    
    for book_dir in books:
        book_key = book_dir.name
        chapter_files = sorted(book_dir.glob("*.json"))
        
        # Skip test files
        chapter_files = [f for f in chapter_files if "_v2_test" not in f.name]
        
        book_verses = 0
        
        for chapter_file in chapter_files:
            try:
                # Read old structure
                with open(chapter_file, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                
                # Skip if already v2
                if old_data.get("_schema_version") == "2.0":
                    continue
                
                # Migrate
                new_data = migrate_chapter(old_data)
                
                if not dry_run:
                    # Write new structure
                    with open(chapter_file, 'w', encoding='utf-8') as f:
                        json.dump(new_data, f, ensure_ascii=False, indent=2)
                
                total_chapters += 1
                book_verses += len(new_data.get("verses", {}))
                
            except Exception as e:
                errors.append(f"{chapter_file}: {str(e)}")
        
        total_verses += book_verses
        print(f"  {book_key}: {len(chapter_files)} chapters, {book_verses} verses")
    
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Migration complete!")
    print(f"  Total chapters: {total_chapters}")
    print(f"  Total verses: {total_verses}")
    
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for err in errors[:10]:
            print(f"  {err}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
    
    return total_chapters, total_verses, errors


if __name__ == "__main__":
    import sys
    
    dry_run = "--dry-run" in sys.argv
    
    if dry_run:
        print("DRY RUN MODE - No files will be modified")
    else:
        print("MIGRATION MODE - Files will be modified")
        print("A backup will be created first.")
        response = input("Continue? (y/n): ")
        if response.lower() != 'y':
            print("Aborted.")
            sys.exit(0)
    
    migrate_all_chapters(dry_run=dry_run)
