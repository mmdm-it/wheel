# TODO

## Target: bibliacatholica.org Launch (Dec 21, 2025)
Complete Catholic Bible in 9 languages via web browser.
**5 days remaining**

## Critical Path to Launch

### Day 1 (Dec 17): Phase 3 - Single Source of Truth ⚠️ BLOCKING
- [ ] **Phase 3A: CSS-Only Font Sizing** (4 hours)
  - [ ] Audit all `setAttribute('font-size')` calls
  - [ ] Create CSS classes for all text sizes
  - [ ] Replace JS font sizing with class toggles
  - [ ] Impact: Fixes "weeks battling .js vs .css" problem
- [ ] **Phase 3B: CSS Variable Theme System** (3 hours)
  - [ ] Add `theme` section to manifest.json (Bible volume)
  - [ ] Update ThemeManager to apply CSS variables from JSON
  - [ ] Convert hardcoded colors/fonts to CSS variables
  - [ ] Impact: Volume-agnostic styling, ready for MMdM catalog

### Day 2 (Dec 18): Complete Missing Content ⚠️ BLOCKING
- [ ] **Populate 1 Maccabees** (3 hours)
  - [ ] Parse 16 chapters
  - [ ] Add to gutenberg volume
- [ ] **Populate 2 Maccabees** (3 hours)
  - [ ] Parse 15 chapters
  - [ ] Add to gutenberg volume
- [ ] **Test all 73 books load correctly** (1 hour)

### Day 3 (Dec 19): Translation & Testing
- [ ] **Test translation toggle** (2 hours)
  - [ ] Verify all 9 languages switch correctly
  - [ ] Fix any language-specific rendering issues
- [ ] **Full navigation smoke test** (3 hours)
  - [ ] Test all Testament → Section → Book → Chapter → Verse paths
  - [ ] Test rotation, selection, detail sector
  - [ ] Test on mobile device (not just Chrome DevTools)

### Day 4 (Dec 20): Polish & Deploy Prep
- [ ] **Documentation** (2 hours)
  - [ ] Add screenshots to README
  - [ ] Update CHANGELOG with final v1.0.0 entry
- [ ] **Performance check** (2 hours)
  - [ ] Test lazy loading performance
  - [ ] Optimize any slow paths
- [ ] **Domain setup** (2 hours)
  - [ ] Configure bibliacatholica.org DNS
  - [ ] Set up hosting/CDN

### Day 5 (Dec 21): Launch Day 🚀
- [ ] Final testing on production URL
- [ ] Launch announcement
- [ ] Monitor for issues

## Post-Launch (After Dec 21)
- [ ] Phase 3C: Dead Code Removal (catalog_mobile_modular.js, mobile-viewport-modernized.js)
- [ ] Phase 4: JSDoc Documentation
- [ ] Recruiting prep (GitHub Discussions, HN post)
- [ ] Portuguese translation permission

---

## Version Roadmap (UPDATED)
- **v0.8.x** → Clean architecture complete ✅
- **v0.9.x** → Content complete, theme system → **CURRENT FOCUS**
- **v1.0.0** → bibliacatholica.org launch (Dec 21)

## Now (Today - Dec 16)

### Phase 3: Single Source of Truth (CRITICAL FOR LAUNCH)
**Goal**: Eliminate multiple sources of truth, prepare for multi-volume deployment

**Why This Blocks Launch**:
- Bible and MMdM catalog need different fonts/colors
- Current CSS is hardcoded for one volume only
- Font-size battles between .js and .css cause bugs
- Need volume-agnostic system before launch

**Tasks**:
- [ ] **Phase 3A: CSS-Only Font Sizing** (Today)
  - [ ] Find all `setAttribute('font-size')` and `setAttribute('font-weight')` calls
  - [ ] Create CSS classes for each text size variant
  - [ ] Replace JS font sizing with CSS class application only
  - [ ] Test: Focus ring, child pyramid, detail sector text
  - [ ] Commit and version bump
- [ ] **Phase 3B: CSS Variable Theme System** (Today/Tomorrow)
  - [ ] Design theme schema for manifest.json
  - [ ] Extend ThemeManager.applyVolumeTheme() to set CSS variables
  - [ ] Convert hardcoded CSS colors/fonts to CSS variables
  - [ ] Add Bible theme config to manifest.json
  - [ ] Test theme application on volume load
  - [ ] Commit and version bump
- [ ] **Phase 3C: Config Consolidation** (If time allows)
  - [ ] Move magic numbers from code to mobile-config.js
  - [ ] Document what should be config vs. what should be theme

### Clean Architecture Initiative (v0.8.149-186) ✅ COMPLETE
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
- [x] **Phase 2C: Split focus-ring-view.js** (REVERTED v0.8.186)
  - [x] Attempted extraction - broke positioning/styling
  - [x] Reverted to v0.8.185-stable
  - [x] Decision: Keep focus-ring-view.js intact (too complex/critical)
  - [x] Status: Skipped by design - not worth the risk ⚠️
- [x] **Dead Code Cleanup** (v0.8.186)
  - [x] Deleted config-test.js, mobile-renderer-demo.js, viewport-bilingual-test.js
  - [x] Created CODEBASE_AUDIT.md documenting issues and action plan
- [ ] **Phase 3: Single Source of Truth** (IN PROGRESS)
  - [ ] Phase 3A: CSS-Only Font Sizing
  - [ ] Phase 3B: CSS Variable Theme System  
  - [ ] Phase 3C: Config Consolidation

---

### Content Population Status (71/73 Books Complete)
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
**Old Testament**: 46 books (39 protocanonical + 7 deuterocanonical) ✅ COMPLETE
**New Testament**: 27 books ✅ COMPLETE
**Remaining**: 2 books (1 Maccabees, 2 Maccabees) ⚠️ BLOCKING LAUNCH

- [ ] **1 Maccabees** (16 chapters) - CRITICAL
- [ ] **2 Maccabees** (15 chapters) - CRITICAL

---

### Virtual Levels & Optional Levels (RESOLVED v0.8.171-174)Module Contracts** (3 days)
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
### Multi-language Support (9 Languages)l (skips family)
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
  - [x] Parse downloaded sources into JSON format
    - [x] Old Testament: 46 books complete (39 + 7 deuterocanonical)
    - [x] New Testament: 27 books complete
    - [x] Partial Deuterocanonical: Tobit, Judith, Wisdom, Sirach completed
    - [ ] Missing: 1 Maccabees, 2 Maccabees ⚠️ BLOCKS LAUNCH
- [x] Chapter-level split architecture (v0.8.114)7 TXT files with deuterocanonicals
  - [ ] **Portuguese**: Contact Editora Ave-Maria for permission
    - WhatsApp: +55 11 97334-7405
    - Website: avemaria.com.br
  - [x] Parse downloaded sources into JSON format
    - [x] Old Testament: 39 protocanonical books complete
    - [x] New Testament: 27 books complete
    - [x] Deuterocanonical: 4/8 books complete (Tobit, Judith, Wisdom, Sirach, Baruch, Esther additions)
## Next (This Week) - LAUNCH PREP
- [ ] **CRITICAL: Complete content** (Day 2 - Dec 18)
  - [ ] Populate 1 Maccabees (16 chapters)
  - [ ] Populate 2 Maccabees (15 chapters)
  - [ ] Test all 73 books load correctly
- [ ] **CRITICAL: Theme system** (Day 1 - Dec 17)
  - [ ] Implement CSS variable theme system
  - [ ] Make fonts/colors volume-specific (not hardcoded)
- [ ] **Important: Testing** (Day 3 - Dec 19)
  - [ ] Test translation toggle functionality
  - [ ] Full navigation smoke test on mobile device
  - [ ] Performance profiling
- [ ] **Launch prep** (Day 4-5 - Dec 20-21)
  - [ ] Documentation (screenshots, README)
  - [ ] Domain setup (bibliacatholica.org)
  - [ ] Deploy and monitor

## Soon (After Launch - Dec 22+)ed names for Chapters
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
