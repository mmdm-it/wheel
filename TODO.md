# TODO

## Target: bibliacatholica.org Launch (Dec 21, 2025)
Complete Catholic Bible in 9 languages via web browser.

## Version Roadmap
- **v0.8.x** → Child Pyramid redesign
- **v0.9.x** → Complete 9-language JSON population
- **v1.0.0** → bibliacatholica.org launch

## Now (Today)

### Clean Architecture Initiative (v0.8.149+)
**Goal**: Make code clean, elegant, eliminate bugs from redundant logic

**PROGRESS UPDATE (v0.8.186)**:
- ✅ Phase 1: Complete (item-utils.js - 150 lines)
- ✅ Phase 2A: Complete (mobile-data.js split - 52% reduction)
- ✅ Phase 2B: Complete (mobile-detailsector.js split - 87% reduction)
- ❌ Phase 2C: Reverted (focus-ring-view.js too complex/critical to risk)
- ✅ Phase 2: **COMPLETE** - 14 modules extracted successfully
- ⏳ Phase 3: Next (consolidate redundant patterns)

---

### Phase 2 Summary (v0.8.161-186)

**Phase 2A: mobile-data.js** ✅ COMPLETE
- Started: 1,066 lines → Ended: 512 lines
- **Reduction: 52% (554 lines extracted)**
- Modules created: 10 specialized modules
  - DataVolumeLoader (314 lines)
  - DataLazyLoader (300 lines)
  - DataHierarchyNavigator (415 lines)
  - DataVirtualLevels (343 lines)
  - ItemBuilder (254 lines)
  - DataConfigManager (190 lines)
  - DataCacheManager (174 lines)
  - DataCoordinateCache (128 lines)
  - DataDetailSectorManager (152 lines)
  - DataItemTracer (83 lines)

**Phase 2B: mobile-detailsector.js** ✅ COMPLETE
- Started: 1,924 lines → Ended: 246 lines
- **Reduction: 87% (1,678 lines extracted)**
- Modules created: 4 specialized modules
  - DetailSectorGeometry (385 lines) - bounds, line tables
  - DetailSectorAnimation (562 lines) - circle/logo animations
  - DetailSectorViews (547 lines) - 5 view types + audio overlay
  - DetailSectorContent (394 lines) - rendering utilities

**Phase 2C: focus-ring-view.js** ❌ REVERTED (v0.8.186)
- Attempted extraction broke critical functionality:
  - Focus ring nodes displayed incorrectly (positioning/styling broken)
  - Text labels clustered in center instead of on arc
  - Complex coordinate system interactions failed
- **Decision**: Keep focus-ring-view.js intact (1,303 lines)
- **Lesson**: Some files are too complex/interconnected to safely refactor
- **Recovery**: Git reset to v0.8.185-stable tag

**Phase 2 Final Impact**:
- **2,990 lines → 758 lines (75% reduction across 2 files)**
- **2,232 lines extracted into 14 focused modules**
- Bug fixes: v0.8.182-184 (delegation completion)
- Architecture: Facade pattern with proper encapsulation
- **Status: Phase 2 COMPLETE ✅** (focus-ring-view.js excluded by design)

---

- [x] **Phase 1: Extract Utilities** (COMPLETE v0.8.149-150)
  - [x] Created `mobile/item-utils.js` with 11 utility methods (150 lines)
  - [x] Replaced 100+ redundant patterns across 11 files
  - [x] Impact: Eliminated 80-100 lines of redundant code, single source of truth
  - [x] Fixed: Pseudo-parent cousin navigation bug (v0.8.150)
- [x] **Phase 2A: Split mobile-data.js** (COMPLETE v0.8.161-177)
  - [x] Extract DataHierarchyNavigator (~415 lines) - v0.8.161
  - [x] Extract DataConfigManager (~59 lines) - v0.8.158
  - [x] Extract DataCoordinateCache (~66 lines) - v0.8.161
  - [x] Extract DataDetailSectorManager (~152 lines) - v0.8.175
  - [x] Extract DataItemTracer (~83 lines) - v0.8.176
  - [x] Extract DataVolumeLoader (~314 lines) - v0.8.177
  - [x] Result: 1,066 → 512 lines (52% reduction, 554 lines extracted)
  - [x] Modules created: 11 focused, testable modules
- [x] **Phase 2B: Split mobile-detailsector.js** (COMPLETE v0.8.179-185)
  - [x] Extract detailsector-geometry.js (385 lines) - v0.8.179 - COMPLETE
  - [x] Extract detailsector-animation.js (562 lines) - v0.8.180 - COMPLETE
  - [x] Extract detailsector-views.js (547 lines) - v0.8.185 - COMPLETE
  - [x] Extract detailsector-content.js (394 lines) - v0.8.185 - COMPLETE
  - [x] Result: 1,924 → 246 lines (87% reduction, 1,678 lines extracted into 4 modules)
  - [x] Status: Phase 2B complete ✅ All 4 modules extracted
- [x] **Phase 2C: Split focus-ring-view.js** (REVERTED v0.8.186)
  - [x] Attempted extraction - broke positioning/styling
  - [x] Reverted to v0.8.185-stable
  - [x] Decision: Keep focus-ring-view.js intact (too complex/critical)
  - [x] Status: Skipped by design - not worth the risk ⚠️ extracted into 3 modules)
  - [x] Status: Phase 2C complete ✅ All 3 modules extracted
- [ ] **Phase 3: Clean Redundancies** (5 days)
  - [ ] Consolidate cousin navigation logic
  - [ ] Consolidate item validation logic
  - [ ] Consolidate gap handling in arrays
  - [ ] Impact: Save 200-300 lines
- [ ] **Phase 4: Document Module Contracts** (3 days)
  - [ ] Add JSDoc type definitions
  - [ ] Document module responsibilities
  - [ ] Create architecture diagrams

### Virtual Levels & Optional Levels (RESOLVED v0.8.171-174)
**Status**: Architecture clarified, pseudo-parents working correctly
- [x] **Root Cause Fix (v0.8.171)**: Removed `is_virtual` from family/subfamily
  - Family/subfamily are **optional structural levels**, not virtual levels
  - Virtual levels are for aggregation patterns (e.g., pseudo-parents for manufacturer)
  - Optional levels can be skipped when empty (natural hierarchy variation)
- [x] **Skip Logic Fix (v0.8.173-174)**: Updated `resolveChildLevel` and `canSkipVirtualLevel`
  - Now checks for both `is_optional` and `is_virtual` flags
  - Allows navigation to skip empty optional levels (Ford 4-cyl → models directly)
- [x] **Validation**: All Ford navigation paths tested and working
  - 4-cyl: cylinder → model (skips family)
  - 6-cyl: cylinder → family → model (Falcon Six)
  - 8-cyl: cylinder → family → subfamily → model (Windsor, Modular)
- [x] **Pseudo-parents**: Manufacturer aggregation across countries working correctly
  - Virtual level handler only used for actual virtual levels (pseudo-parents)
  - Optional levels use normal navigation (not virtual handler)
- **Conclusion**: No further action needed. Architecture is clean and correct.

### Multi-language support
  - [x] Rename verse properties to language codes (latin/english/hebrew)
  - [x] Update manifest.json with 9 languages
  - [x] Update translation handling code
  - [ ] Test translation toggle functionality
  - [x] Source Bible texts (see TEXTSOURCES.md)
    - [x] Hebrew: Westminster Leningrad Codex (WLC) - 40 XML files
    - [x] Greek OT: Septuagint (Swete) - 120 txt files
    - [x] Greek NT: Byzantine Robinson-Pierpont - 144 CSV files
    - [x] Latin: Clementine Vulgate - 146 lat files
    - [x] French: néo-Crampon Libre - 73 USFM files
    - [x] Spanish: Libro del Pueblo de Dios (Vatican) - 1,348 HTML files
    - [x] English: NAB (Vatican) - 1,411 HTML files
    - [x] Italian: Vatican Italian - 1,330 HTML files
    - [x] Chinese: Vatican PDFs - 75 PDF files
    - [x] Russian: Synodal 77-book (bible.by) - 77 TXT files with deuterocanonicals
  - [ ] **Portuguese**: Contact Editora Ave-Maria for permission
    - WhatsApp: +55 11 97334-7405
    - Website: avemaria.com.br
  - [x] Parse downloaded sources into JSON format
    - [x] Old Testament: 39 protocanonical books complete
    - [x] New Testament: 27 books complete
    - [x] Deuterocanonical: 4/8 books complete (Tobit, Judith, Wisdom, Sirach, Baruch, Esther additions)
    - [ ] Remaining: 1 Maccabees, 2 Maccabees
- [x] Chapter-level split architecture (v0.8.114)
  - [x] Design chapter split structure (CHAPTER_SPLIT_DESIGN.md)
  - [x] Implement 1,215 chapter files (scripts/split-books-to-chapters.js)
  - [x] Add chapter_id field for unique identification
  - [x] Update mobile-data.js with ensureChapterLoaded()
  - [x] Update mobile-renderer.js for chapter-level lazy loading
  - [ ] Test lazy loading performance

## Next (This Week)
- [ ] Populate remaining books
  - [ ] 1 Maccabees (16 chapters)
  - [ ] 2 Maccabees (15 chapters)
- [ ] Multi-language UI labels
  - [ ] Add translated names for Testaments
  - [ ] Add translated names for Books
  - [ ] Add translated names for Chapters
  - [ ] Add translated names for Verses
- [ ] Documentation updates
  - [x] Update BOOKPOPULATION.md with NT completion
  - [x] Update CHANGELOG.md
  - [ ] Add screenshots to README
  - [ ] Record navigation GIFs
  - [ ] Document translation architecture

## Soon (This Month)
- [ ] Performance profiling after clean architecture
- [ ] Recruiting prep
  - [ ] Enable GitHub Discussions
  - [ ] Draft outreach messages
  - [ ] Post in communities (r/androiddev, Christian dev forum, HN)

## Eventually
- [ ] Android WebView wrapper (after web launch)
- [ ] iOS WebView wrapper (after Android)
- [ ] Bookmarks/annotations

## Removed from Scope
- ~~Search functionality~~ - Intentionally omitted to preserve pure rotational UX

## Done (Archive)

### December 6, 2025
- [x] Version Management Automation (v0.8.106)
## Done (Archive)

### December 15, 2025
- [x] Mobile Renderer Refactoring Complete! (v0.8.141-v0.8.148)
  - [x] Week 1: MagnifierManager, DetailSector, TranslationToggle, ThemeManager (643 lines)
  - [x] Week 2: FocusRingView, DataQueryHelper, ParentNameBuilder (778 lines)
  - [x] Week 3: NavigationCoordinator, ChildContentCoordinator (468 lines)
  - [x] Dead code cleanup (64 lines)
  - [x] Final result: 3,073 → 920 lines (70.1% reduction, 80 lines under goal!)
  - [x] Created 8 new specialized modules
  - [x] Zero regressions, all functionality preserved
  - [x] Updated all documentation (ARCHITECTURE.md, CHANGELOG.md, REFACTOR_COMPLETE.md)
  - [x] Updated ARCHITECTURE_AUDIT_2025.md with completion report

### December 6, 2025ersion numbers to 0.8.106
- [x] Focus Ring Text Centering Bug Fix (v0.8.107-v0.8.108)
  - [x] Fixed "Chapter" prefix movement issue (store/retrieve full item reference)
  - [x] Fixed unselected numbers not centered (text-anchor='middle' for all)
  - [x] Removed radial offset for unselected items (was -15px)
  - [x] Tested on all 4 volumes (Gutenberg, MMdM, Music, Fairhope)
- [x] Multi-language Property Refactor (v0.8.109)
  - [x] Renamed verse properties: "text" → "latin", "translation" → "english"
  - [x] Updated manifest.json with 9 languages (hebrew, greek, latin, english, french, spanish, italian, portuguese, russian)
  - [x] Updated getTranslationTextProperty() to return language codes directly
  - [x] Updated applyTranslationToContext() to use language codes
  - [x] Deleted deprecated gutenberg.json (10,313 lines)
  - [x] Created CHAPTER_SPLIT_DESIGN.md architecture plan

### December 3, 2025
- [x] Phase 2: Domain-Specific Code Removal (v0.8.97-v0.8.98)
  - [x] Renamed `gutenberg-verse-text` → `detail-body-text` CSS class
  - [x] Removed all `volume_name ===` checks (use config flags)
  - [x] Generalized `manufacturer` → `topAncestorSegment`
  - [x] Generalized `artist/album` → `ancestor1/ancestor2`
  - [x] Added `getItemDisplayName()` helper for backwards compat
  - [x] Made volume discovery dynamic (supports volumes.json)
  - [x] Added config flags: `detail_sector.skip_header`, `detail_sector.mode`
  - [x] Created `.eslintrc.js` with domain-term detection
  - [x] Created `hooks/pre-commit` for commit-time checks
  - [x] Updated CONTRIBUTING.md with volume-agnostic guidelines
  - [x] Created DOMAIN_AUDIT.md documenting all changes
- [x] Added all 67 book verse structures (~31,200 verses total) (v0.8.96)
- [x] Split JSON Architecture Phase 1 (v0.8.90-v0.8.96)
  - [x] Created data/gutenberg/manifest.json (schema v2.0.0)
  - [x] Created data/gutenberg/books/ directory with 67 book files
  - [x] All books have complete chapter/verse structure
  - [x] Implemented lazy loading in mobile-data.js
  - [x] Volume discovery prioritizes split manifests
  - [x] Async loading in mobile-renderer.js for book→chapter navigation
- [x] Two-tier font sizing for Detail Sector (v0.8.87)
  - [x] Big Font tier: ≤30 words → 30px, charWidth 0.45
  - [x] Small Font tier: 31+ words → 22px, charWidth 0.35
  - [x] Added word_count field to all verses
  - [x] Inline style attribute for CSS override
- [x] Font changes (v0.8.79)
  - [x] Display font: Montserrat (UI elements)
  - [x] Text font: EB Garamond (Gutenberg verses)
- [x] Genesis verses added (v0.8.88)
  - [x] All 1,533 verses across 50 chapters
  - [x] Existing Latin text preserved
- [x] Detail Sector text layout improvements
  - [x] Left margin at 3% SSd padding from arc
  - [x] Right margin at 5% SSd padding
  - [x] charWidth tuned for EB Garamond

### December 2, 2025
- [x] Corner-to-corner arc formula (v0.8.54)
  - [x] New radius: R = SSd/2 + LSd²/(2×SSd)
  - [x] New Hub X: Radius - SSd/2
  - [x] Focus Ring band: 99%-101%
  - [x] Parent Button repositioned to match
- [x] Verse naming simplified to numbers (v0.8.57)
- [x] number_only text transform for chapters/verses (v0.8.58)
- [x] Leaf sorting fixed to use sort_number (v0.8.59)
- [x] Detail Sector circle expands to 99% (v0.8.60)

### Earlier
- [x] Detail Sector Gutenberg rendering (v0.8.39)
- [x] Arc-based left margins for text flow
- [x] Dynamic font sizing (SSd-relative)
- [x] Per-line width calculation
- [x] All nzone migration animations (Stages 1-5)
- [x] Focus Ring visual differentiation
- [x] Documentation cleanup
