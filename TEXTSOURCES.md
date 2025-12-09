# Text Sources

Documentation of source materials for the Biblia Catholica multilingual Bible.

## Downloaded Sources (in `/sources/` directory)

All source files are stored locally in the `sources/` directory (gitignored due to size).

### Summary Table

| Language | Source | Files | Size | Format | Status |
|----------|--------|-------|------|--------|--------|
| Hebrew | Westminster Leningrad Codex | 40 | 28 MB | XML | ✅ Downloaded |
| Greek OT | Septuagint (Swete) | 120 | 52 MB | TXT | ✅ Downloaded |
| Greek NT | Byzantine Robinson-Pierpont | 144 | 25 MB | CSV | ✅ Downloaded |
| Latin | Clementine Vulgate | 146 | 11 MB | LAT | ✅ Downloaded |
| French | néo-Crampon Libre | 73 | 21 MB | USFM | ✅ Downloaded |
| Spanish | Libro del Pueblo de Dios (Vatican) | 1,348 | 16 MB | HTML | ✅ Downloaded |
| English | NAB (Vatican) | 1,411 | 19 MB | HTML | ✅ Downloaded |
| Italian | Vatican Italian | 1,330 | 12 MB | HTML | ✅ Downloaded |
| Chinese | Vatican PDFs | 75 | 27 MB | PDF | ✅ Downloaded |
| Russian | Synodal 77-book (bible.by) | 77 | 4.2 MB | TXT | ✅ Downloaded |
| Portuguese | Bíblia Ave-Maria | - | - | - | ⏳ Pending permission |

### Directory Structure

```
sources/
├── hebrew/
│   └── wlc/                    # Westminster Leningrad Codex (40 XML files)
├── greek/
│   ├── septuagint/             # Septuagint Swete edition (120 TXT files)
│   └── byzantine-nt/           # Robinson-Pierpont Byzantine NT (144 CSV files)
├── latin/
│   └── clementine/             # Clementine Vulgate (146 LAT files)
├── french/
│   └── neo-crampon/            # néo-Crampon Libre (73 USFM files)
├── spanish/
│   └── libro-pueblo-dios/      # Vatican's Libro del Pueblo de Dios (1,348 HTML)
├── english/
│   └── nab-vatican/            # NAB from Vatican website (1,411 HTML files)
├── italian/
│   └── vatican/                # Vatican Italian Bible (1,330 HTML files)
├── chinese/
│   └── vatican/                # Vatican Chinese Bible PDFs (75 files)
└── russian/
    ├── synodal/                # eBible.org Synodal (66 books, Protestant)
    └── synodal-77books/        # bible.by Synodal (77 books with deuterocanonicals)
```

## Source Details

### Hebrew - Westminster Leningrad Codex (WLC)
- **URL**: https://tanach.us/
- **License**: Public Domain
- **Coverage**: 39 protocanonical OT books only
- **Format**: XML with cantillation marks
- **Notes**: Deuterocanonicals and NT have no Hebrew original - Hebrew option hidden for these

### Greek - Septuagint (Swete)
- **URL**: https://github.com/sleeptillseven/LXX.swทำte
- **License**: Public Domain
- **Coverage**: Complete OT including deuterocanonicals
- **Format**: Plain text files per chapter

### Greek NT - Byzantine Robinson-Pierpont
- **URL**: https://github.com/byztxt/byzantine-majority-text
- **License**: Public Domain
- **Coverage**: Complete New Testament (27 books)
- **Format**: CSV with Strong's numbers

### Latin - Clementine Vulgate
- **URL**: https://github.com/latinspoken/Clementine-Vulgate
- **License**: Public Domain
- **Coverage**: Complete 73-book Catholic Bible
- **Format**: LAT text files

### French - néo-Crampon Libre
- **URL**: https://github.com/lfrancoi/bible-french-neo-crampon
- **License**: CC0 1.0 (Public Domain)
- **Coverage**: 73 books (Catholic canon)
- **Format**: USFM (Unified Standard Format Markers)
- **Notes**: Based on 1923 Crampon revision

### Spanish - Libro del Pueblo de Dios (Vatican)
- **URL**: https://www.vatican.va/archive/ESL0506/_INDEX.HTM
- **License**: Vatican official translation
- **Coverage**: Complete Catholic Bible (73 books)
- **Format**: HTML (chapter per file)

### English - NAB (Vatican)
- **URL**: https://www.vatican.va/archive/ENG0839/_INDEX.HTM
- **License**: USCCB (New American Bible)
- **Coverage**: Complete Catholic Bible (73 books)
- **Format**: HTML (chapter per file)

### Italian - Vatican Italian
- **URL**: https://www.vatican.va/archive/ITA0001/_INDEX.HTM
- **License**: Vatican official translation
- **Coverage**: Complete Catholic Bible (73 books)
- **Format**: HTML (chapter per file)

### Chinese - Vatican PDFs
- **URL**: https://www.vatican.va/chinese/index.html
- **License**: Vatican official
- **Coverage**: Complete Catholic Bible
- **Format**: PDF (requires OCR/text extraction)
- **Notes**: Need to extract text from PDFs for processing

### Russian - Synodal Translation (77 books)
- **URL**: https://bible.by/download/
- **License**: Public Domain
- **Coverage**: 77 books including all deuterocanonicals
- **Format**: TXT (one file per book)
- **Files include**:
  - All 39 OT canonical books
  - All 11 deuterocanonical books (Tobit, Judith, Wisdom, Sirach, Baruch, Letter of Jeremiah, 1-3 Maccabees, 2-3 Esdras)
  - All 27 NT books

### Portuguese - Pending
- **Candidate**: Bíblia Sagrada Ave-Maria
- **Publisher**: Editora Ave-Maria (Claretian Missionaries)
- **Status**: Contact required for permission
- **Contact**: WhatsApp +55 11 97334-7405, avemaria.com.br

## Catholic Bible Structure

The Catholic Bible includes 73 books (vs 66 Protestant):

### Deuterocanonical Books (7+)
- **Tobit** (TOBI) - Complete story
- **Judith** (IUDITH) - Complete story
- **Wisdom** (SAPI) - 19 chapters
- **Sirach/Ecclesiasticus** (ECCLU) - 51 chapters
- **Baruch** (BARU) - 6 chapters (includes Letter of Jeremiah in some traditions)
- **1 Maccabees** (I_MAC) - 16 chapters
- **2 Maccabees** (II_MAC) - 15 chapters

### Extended Sections
- **Esther** - Greek additions (chapters 10-16 in some numberings)
- **Daniel** - Greek additions:
  - Susanna (Daniel 13)
  - Bel and the Dragon (Daniel 14)
  - Prayer of Azariah and Song of Three Children

## Processing Pipeline (TODO)

1. **Parse** - Convert each format to standardized JSON
2. **Align** - Match verses across translations
3. **Validate** - Verify book/chapter/verse coverage
4. **Merge** - Combine into chapter-level JSON files
5. **Index** - Generate manifest with verse counts

---

*Last updated: December 7, 2025*
