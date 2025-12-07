# Text Sources

Documentation of source materials for the Biblia Catholica multilingual Bible.

## Target Languages (9)

| Code | Language | Status | Source | Notes |
|------|----------|--------|--------|-------|
| hebrew | עברית (Hebrew) | Decided | Westminster Leningrad Codex | 39 protocanonical OT books only; hidden for deuterocanonicals and NT |
| greek | Ελληνικά (Greek) | Partial | TBD | Septuagint (OT) + Byzantine/NA (NT) |
| latin | Latina (Latin) | Complete | Vulgate | Primary text, complete |
| english | English | Partial | KJV/Douay-Rheims | Public domain |
| french | Français | TBD | TBD | |
| spanish | Español | TBD | TBD | |
| italian | Italiano | TBD | TBD | |
| portuguese | Português | TBD | TBD | |
| russian | Русский | TBD | TBD | Synodal Translation? |

## Source Candidates

### Hebrew (Old Testament)
- ✅ **Westminster Leningrad Codex (WLC)** - Public domain, standard Masoretic text
  - 39 protocanonical OT books only
  - Deuterocanonicals (Tobit, Judith, Wisdom, Sirach, Baruch, 1-2 Maccabees) have no Hebrew original
  - NT has no Hebrew original
  - For these books, עברית option is hidden from UI
- ~~Biblia Hebraica Stuttgartensia~~ - Same base text as WLC, licensing complex

### Greek
- **Septuagint (LXX)** - Old Testament, Rahlfs edition (public domain)
- **SBLGNT** - New Testament, Society of Biblical Literature Greek NT (free with attribution)
- **Byzantine Majority Text** - Public domain

### Latin
- ✅ **Clementine Vulgate** - Currently implemented, public domain

### English
- **Douay-Rheims** (1899) - Catholic, public domain
- **KJV** (1611) - Protestant but widely recognized, public domain
- **Challoner revision** - Catholic revision of Douay-Rheims

### French
- **Louis Segond** (1910) - Protestant, public domain
- **Bible de Jérusalem** - Catholic (check licensing)

### Spanish
- **Reina-Valera** (1909) - Public domain
- **Biblia de Navarra** - Catholic (check licensing)

### Italian
- **Riveduta** (1927) - Public domain
- **CEI** - Catholic (modern, likely copyrighted)

### Portuguese
- **Almeida** - Public domain versions available
- **Ave Maria** - Catholic (check licensing)

### Russian
- **Synodal Translation** (1876) - Orthodox, public domain

## Catholic Bible Structure

The Catholic Bible includes 73 books (vs 66 Protestant):

### Deuterocanonical Books (7)
These books are already included in our structure:
- Tobit (TOBI)
- Judith (IUDITH)
- 1 Maccabees (I_MAC) - TBD
- 2 Maccabees (II_MAC) - TBD
- Wisdom (SAPI)
- Sirach/Ecclesiasticus (ECCLU)
- Baruch (BARU)

### Extended Chapters
- Esther (Greek additions)
- Daniel (Greek additions: Susanna, Bel and the Dragon)

## Data Sources

### Online Repositories
- **Sacred-Texts.com** - Various public domain translations
- **Bible Gateway** - Reference (not for scraping)
- **Unbound Bible** - Biola University, various translations
- **CCEL** - Christian Classics Ethereal Library
- **Perseus Digital Library** - Greek texts

### API Sources
- **API.Bible** - Requires registration, check terms
- **Bible.org** - NET Bible API

## Processing Notes

### Data Format
Each verse should have all 9 language properties:
```json
{
  "1": {
    "hebrew": "בְּרֵאשִׁית...",
    "greek": "Ἐν ἀρχῇ...",
    "latin": "In principio...",
    "english": "In the beginning...",
    "french": "Au commencement...",
    "spanish": "En el principio...",
    "italian": "In principio...",
    "portuguese": "No princípio...",
    "russian": "В начале...",
    "sort_number": 1,
    "name": "1",
    "word_count": 10
  }
}
```

### Word Count
- Calculate based on primary display language (latin for now)
- Used for font size tier selection in Detail Sector

## Progress Tracking

| Book | hebrew | greek | latin | english | french | spanish | italian | portuguese | russian |
|------|--------|-------|-------|---------|--------|---------|---------|------------|---------|
| Genesis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exodus | - | - | ✅ | - | - | - | - | - | - |
| ... | | | | | | | | | |

---

*Last updated: December 7, 2025*
