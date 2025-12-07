# Chapter-Level Split Architecture Design

## Overview
Split Gutenberg Bible data from 67 book files into 1,189 chapter files for optimal lazy loading with 9-language support.

## Structure

```
data/gutenberg/
├── manifest.json                    # Volume metadata + book/chapter index
└── chapters/
    ├── GENE/
    │   ├── 001.json                 # Genesis Chapter 1
    │   ├── 002.json                 # Genesis Chapter 2
    │   └── ...
    ├── EXOD/
    │   ├── 001.json
    │   └── ...
    └── [67 book directories]/
        └── [chapter files]
```

## File Structure

### manifest.json
```json
{
  "Gutenberg_Bible": {
    "display_config": { ... },
    "testaments": {
      "Vetus_Testamentum": {
        "sections": {
          "Pentateuchus": {
            "books": {
              "GENE": {
                "book_number": 1,
                "sort_number": 1,
                "name": "Genesis",
                "name_hebrew": "בראשית",
                "name_greek": "Γένεσις",
                "name_latin": "Genesis",
                "name_english": "Genesis",
                "name_french": "Genèse",
                "name_spanish": "Génesis",
                "name_italian": "Genesi",
                "name_portuguese": "Gênesis",
                "name_russian": "Бытие",
                "chapter_count": 50,
                "chapters": {
                  "1": {
                    "_external_file": "data/gutenberg/chapters/GENE/001.json",
                    "_loaded": false
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Chapter File (GENE/001.json)
```json
{
  "chapter_key": "1",
  "chapter_number": 1,
  "book_key": "GENE",
  "testament": "Vetus_Testamentum",
  "section": "Pentateuchus",
  "verses": {
    "1": {
      "hebrew": "בְּרֵאשִׁית בָּרָא אֱלֹהִים...",
      "greek": "Ἐν ἀρχῇ ἐποίησεν...",
      "latin": "In principio creavit Deus...",
      "english": "In the beginning God created...",
      "french": "Au commencement, Dieu créa...",
      "spanish": "En el principio creó Dios...",
      "italian": "In principio Dio creò...",
      "portuguese": "No princípio criou Deus...",
      "russian": "В начале сотворил Бог...",
      "sort_number": 1,
      "name": "1",
      "word_count": 7
    }
  }
}
```

## Benefits

1. **Faster Loading**: 15-20 KB chapters vs 500 KB books
2. **Better Caching**: IndexedDB stores individual chapters
3. **Instant Navigation**: Chapter-to-chapter without reloading book
4. **Reduced Memory**: Only current chapter in memory
5. **Parallel Loading**: Browser can fetch multiple chapters simultaneously

## Migration Path

1. ✅ Rename `text`/`translation` → `latin`/`english` in existing GENE.json
2. ✅ Update manifest.json with 9 languages
3. ⏭️ Create chapter directory structure
4. ⏭️ Split GENE.json into 50 chapter files
5. ⏭️ Update manifest to reference chapter files
6. ⏭️ Test lazy loading with chapters
7. ⏭️ Expand to all 67 books

## File Naming Convention

- **Format**: `{book_code}/{chapter_number_3_digit}.json`
- **Examples**: 
  - `GENE/001.json` (Genesis 1)
  - `PSAL/119.json` (Psalm 119)
  - `MATT/028.json` (Matthew 28)
  - `APOC/022.json` (Revelation 22)

## Lazy Loading Logic

```javascript
// Already implemented in mobile-data.js
async ensureChapterLoaded(bookKey, chapterKey) {
    const chapter = this.getChapterDataLocation(bookKey, chapterKey);
    if (chapter._loaded) return;
    
    const response = await fetch(chapter._external_file);
    const chapterData = await response.json();
    
    // Merge verses into manifest
    chapter.verses = chapterData.verses;
    chapter._loaded = true;
}
```

## Total Files

- Old: 67 book files
- New: 1,189 chapter files
- Storage: ~50-150 MB total (uncompressed)
- Typical load: 1-3 chapters cached (~30-60 KB)

## Status

Phase 1 (Current): Rename properties, update manifest  
Phase 2 (Next): Create chapter directory and split Genesis  
Phase 3 (Later): Expand to all books, add missing languages
