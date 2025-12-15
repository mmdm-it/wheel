# Changelog

All notable changes to Wheel will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Phase 3: General code cleanup and optimization
- Child Pyramid design completion (blocking 0.9.0 release)

## [0.8.160] - 2025-12-15

### Fixed
- **Parent Button Visibility (ACTUAL FIX)**: Fixed parameter mismatch in updateParentButton call
  - Issue: mobile-renderer.js was calling navigationView.updateParentButton(parentName, skipAnimation)
  - But: navigation-view.js expects updateParentButton({ parentName, currentLevel, ... })
  - Result: parentName was undefined, so button was hidden instead of shown
  - Solution: Pass parameters as named object instead of positional arguments
  - This was the root cause of the disappearing Parent Button after IN migration

## [0.8.159] - 2025-12-15

### Fixed
- **Parent Button Visibility**: Fixed Parent Button disappearing after IN migration animation
  - Issue: Animation cleanup was adding 'hidden' class after updateParentButton() removed it
  - Solution: Let updateParentButton() control visibility instead of animation cleanup
  - Timing: Animation completes at t=600ms, but was hiding button that appeared at t=100-200ms

## [0.8.158] - 2025-12-15

### Changed
- **Phase 2A Complete**: Extracted DataConfigManager module from mobile-data.js (59 lines saved)
- **Mobile-data.js**: 1,017 → 958 lines (5.8% reduction, now under 1,000 lines)
- **Total Phase 2A Savings**: 108 lines (10.1% reduction from original 1,066 lines)

### Added
- `data-config-manager.js`: New module with 8 configuration/metadata methods
  - getDisplayConfig() - root display configuration access
  - getHierarchyLevelConfig() - level-specific configuration
  - getHierarchyLevelNames() - ordered level names array
  - getHierarchyLevelDepth() - level index lookup
  - getTopLevelCollectionName() - plural form of first level
  - getTopLevelCollection() - top-level data object
  - getTopLevelKeys() - top-level item keys
  - resolveDetailPath() - dotted path resolution with array indexing
  - resolveDetailTemplate() - {{placeholder}} interpolation

### Improved
- **Separation of Concerns**: Configuration logic separated from coordination
- **Module Count**: 7 focused modules extracted (ItemUtils, DataCacheManager, DataLazyLoader, DataVirtualLevels, DataHierarchyNavigator, ItemBuilder, DataConfigManager)
- **Testability**: Configuration methods can be unit tested independently

## [0.8.157] - 2025-12-15

### Fixed
- Marked subfamily as virtual/optional hierarchy level (v0.8.156+6)
- Fixed Ford sort_number to be alphabetically correct: 24 between Fiat (23) and FPT (25) (v0.8.156+5)
- Fixed duplicate sort_number: Cummins 15→16 (v0.8.156+4)
- Added missing sort_number to Ford 10-cylinder Modular family (v0.8.156+4)
- Added sort_numbers to 8 Ford engine families (chronological order 1-8) (v0.8.156+3)
- Cleaned unused family metadata from 61 models across 8 manufacturers (v0.8.156+2)
- Added missing sort_numbers to 3 restructured manufacturers (v0.8.156+1)

## [0.8.156] - 2025-12-15

### Changed
- **Catalog Data**: Restructured Ford/MerCruiser/Detroit Diesel to explicit families/subfamilies
- **Ford 8-Cylinder**: Now has explicit family collections (Flathead, Windsor, FE, Cleveland, 385, Boss, Modular, Godzilla)
- **Data Structure**: Changed from `cylinders → models (with rpp_* flags)` to `cylinders → families → subfamilies → models`

### Added
- `scripts/restructure_ford_hierarchy.py`: Automated conversion from pseudo-parent to explicit hierarchy
- `scripts/clean_unused_family_metadata.py`: Remove family metadata from non-family manufacturers

## [0.8.155] - 2025-12-15

### Changed
- (Add changes here)

## [0.8.155] - 2025-12-15

### Removed
- **Pseudo-parent architecture removed** (~300 lines eliminated)
  - Removed 12 pseudo-parent methods from data-virtual-levels.js (735 → 439 lines)
  - Removed pseudo-parent checks from data-hierarchy-navigator.js
  - Removed 12 delegation methods from mobile-data.js (1,066 → 1,018 lines)
  - Removed pseudo-parent fallback logic from data-query-helper.js
- **Rationale**: Pseudo-parents added complexity without storage/performance benefits
  - Original goal: Avoid authoring deep JSON hierarchies for manufacturers like Ford
  - Reality: Added ~300 lines of runtime filtering/cloning logic
  - Better approach: Author explicit hierarchy in JSON, skip empty collections during navigation
- **Impact**: Eliminates entire class of navigation bugs caused by pseudo-parent path mismatches

### Changed
- Virtual level skipping now checks `is_virtual` flag directly instead of `isPseudoLevel()`
- Documentation updated to reflect virtual-levels-only architecture
- Module headers cleaned of pseudo-parent references

## [0.8.154] - 2025-12-15

### Changed
- (Add changes here)

## [0.8.153] - 2025-12-15

### Changed
- (Add changes here)

## [0.8.148] - 2025-12-15

### Changed
- **Dead code cleanup**: Removed unused DEBUG_VERBOSE flag and addTimestampToCenter() method
- Renderer reduced from 984 → 920 lines (64 lines saved)
- Total reduction: 70.1% from original 3,073 lines

### Added
- **ChildContentCoordinator** (230 lines): Child content display logic
  - Moved showChildContentForFocusItem and helper methods
  - Moved handleLeafFocusSelection
  - Handles lazy loading for split volumes
  - 167 lines saved from renderer

### Changed
- **MILESTONE**: Renderer now under 1,000 lines (920 lines)!
- Total reduction from 3,073 → 920 lines (70.1% reduction)

### Documentation
- Updated ARCHITECTURE.md with new module structure
- Created REFACTOR_COMPLETE.md documenting the full refactoring journey
- Updated README.md version to 0.8.148

## [0.8.147] - 2025-12-15

### Added
- **NavigationCoordinator** (287 lines): Navigation state transition logic
  - Moved handleChildPyramidClick (83 lines)
  - Moved continueChildPyramidClick (174 lines)
  - Encapsulates IN navigation orchestration
  - 237 lines saved from renderer

### Changed
- Renderer: 1,388 → 1,151 lines (17.1% reduction)

## [0.8.146] - 2025-12-15

### Added
- **ParentNameBuilder** (124 lines): Parent button label generation
  - Moved getParentNameForLevel with breadcrumb logic
  - Handles simple vs cumulative styles
  - Context-aware pluralization
  - 89 lines saved from renderer

### Changed
- Renderer: 1,477 → 1,388 lines (6.0% reduction)
- Week 2 target (1,500 lines) exceeded by 112 lines

## [0.8.145] - 2025-12-15

### Added
- **DataQueryHelper** (348 lines): Hierarchical data query methods
  - Moved 8 data query methods including cousin navigation
  - Centralized hierarchy traversal logic
  - 243 lines saved from renderer

### Changed
- Renderer: 1,720 → 1,477 lines (14.1% reduction)

## [0.8.144] - 2025-12-14

### Changed
- **FocusRingManager Phase 3**: Extracted 3 related methods
  - Moved triggerFocusSettlement (52 lines)
  - Moved getSelectedFocusIndex (26 lines)  
  - Moved updateFocusItemText (104 lines)
  - Renderer: 1,866 → 1,720 lines (146 lines saved)

## [0.8.143] - 2025-12-14

### Changed
- **FocusRingManager Phase 2b**: Extracted main method
  - Moved updateFocusRingPositions (309 lines)
  - Renderer: 2,166 → 1,866 lines (300 lines saved)
  - focus-ring-view.js: 799 → 1,108 lines

## [0.8.142] - 2025-12-14

### Changed
- **FocusRingManager Phase 2a**: Migrated rotation state
  - Moved lastRotationOffset and protectedRotationOffset to FocusRingView
  - Updated 9 references in renderer

## [0.8.141] - 2025-12-14

### Changed
- **FocusRingManager Phase 1**: Eliminated state duplication
  - Removed duplicate focusElements, _lastFocusItemsKey, positionCache Maps from renderer
  - Established FocusRingView as single source of truth
  - Updated 11 references throughout codebase

## [0.8.140] - 2025-12-14

### Added
- **Week 2 Planning**: Created WEEK2_PLAN.md and WEEK2_ARCHITECTURE_ANALYSIS.md
- Deep dependency analysis before FocusRingManager extraction

## [0.8.138] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.137] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.136] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.135] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.134] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.133] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.132] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.131] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.130] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.129] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.128] - 2025-12-14

### Changed
- (Add changes here)

## [0.8.127] - 2025-12-13

### Changed
- (Add changes here)

## [0.8.126] - 2025-12-13

### Changed
- (Add changes here)

## [0.8.125] - 2025-12-13

### Changed
- (Add changes here)

## [0.8.124] - 2025-12-13

### Changed
- (Add changes here)

## [0.8.123] - 2025-12-12

### Changed
- (Add changes here)

## [0.8.122] - 2025-12-12

### Changed
- (Add changes here)

## [0.8.121] - 2025-12-12

### Changed
- (Add changes here)

## [0.8.120] - 2025-12-15

### Added
- Complete New Testament (27 books, 260 chapters) with 7 languages: BYZ, VUL, SYN, NEO, NAB, VAT_ES, CEI
- NT Books: Matthew, Mark, Luke, John, Acts, Romans, 1&2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1&2 Thessalonians, 1&2 Timothy, Titus, Philemon, Hebrews, James, 1&2 Peter, 1-3 John, Jude, Revelation
- Create `scripts/populate_nt_json.py` for NT population in JSON format
- Add `parse_byzantine_nt_csv()` parser for Byzantine Greek NT CSV format

### Changed
- Update `scripts/parsers.py` with Byzantine NT CSV parser support
- Update all documentation: BOOKPOPULATION.md, TODO.md, TEXTSOURCES.md, README.md

### Statistics
- **Total translations added this version**: 53,648 (NT)
- **Cumulative total**: ~231,000 verse translations across 66 books
- **Books complete**: 66/73 (39 OT + 27 NT)
- **Remaining**: 1 Maccabees, 2 Maccabees, plus 5 deuterocanonical books

## [0.8.119] - 2025-12-10

### Added
- Complete Ruth (4 chapters, 85 verses) with 8 languages: WLC, LXX, VUL, NAB, SYN, NEO, VAT_ES, CEI
- Complete Genesis (50 chapters, ~1533 verses) with 8 languages: WLC, LXX, VUL, NAB, SYN, NEO, VAT_ES, CEI
- Complete OT Major Prophets: Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel
- Complete OT Minor Prophets: Hosea through Malachi (12 books)
- Complete Deuterocanonical books: Tobit, Judith, Esther additions, Wisdom, Sirach, Baruch
- Create `scripts/parsers.py` reusable parsing library for all source formats
- Create `scripts/populate_genesis.py` with Vatican HTML file mappings
- Create `scripts/populate_minor_prophets.py` for combined Minor Prophets population
- Create `scripts/populate_deuterocanonical.py` for Deuterocanonical books
- Add NT sections to BOOKPOPULATION.md tracking file

### Changed
- Refactor `scripts/populate_ruth.py` with language-specific parsers

### Statistics
- **Total translations added this version**: ~177,000 (OT)
- **Books complete**: 39/73 OT books

## [0.8.118] - 2025-12-10

### Added
- Populate Ruth (4 chapters, 85 verses) with 8 languages for testing
- Add Hebrew (WLC), Greek (LXX), Latin (VUL), English (NAB), Russian (SYN), French (NEO), Spanish (VAT_ES), Italian (CEI) translations
- Create `scripts/populate_ruth.py` multi-language population script
- Create `BOOKPOPULATION.md` to track book population status

### Fixed
- Add `normalizeItemData()` to mobile-data.js for v2.0 compatibility
- Map v2.0 `seq` field to `sort_number` for sorting
- Flatten `text.{CODE}` object to language names for UI compatibility

## [0.8.118] - 2025-12-10

### Changed
- Migrate all 1,215 chapter files to v2.0 schema structure
- Add `chapter_in` field with MT/VUL/LXX versification mappings
- Add `v_in` field for per-verse versification mappings
- Replace language keys (latin, hebrew) with translation codes (VUL, WLC)
- Add `exists_in` field for tradition-specific content (Daniel 13-14, Esther 11-16)
- Create `translations.json` metadata file with versification system definitions

### Added
- Add `scripts/migrate_to_v2.py` migration script with Psalms versification logic
- Create backup at `chapters_v1_backup` before migration

## [0.8.117] - 2025-12-07

### Added
- Add complete Latin Vulgate text for Genesis 1 (all 31 verses)
- Add Hebrew WLC text for Genesis 1 from Westminster Leningrad Codex
- Add `clearWheelCache()` console helper for cache management

### Changed
- Remove obsolete book-level JSON files (replaced by chapter-level split)
- Recalculate word counts for Genesis 1 verses

## [0.8.116] - 2025-12-07

### Fixed
- Fix verse text appearing on Focus Ring nodes instead of verse numbers

## [0.8.115] - 2025-12-07

### Added
- Add unique chapter_id field to all chapter files (e.g., "GENE_001")

## [0.8.114] - 2025-12-07

### Changed
- Implement chapter-level split architecture with 1,215 chapter files

## [0.8.113] - 2025-12-07

### Changed
- Implement chapter-level split architecture with 1,215 chapter files

## [0.8.112] - 2025-12-06

### Changed
- Fix cousin navigation wrap-around and gap selection issues

## [0.8.111] - 2025-12-06

### Changed
- Implement cousin navigation in Focus Ring with visual gaps

## [0.8.110] - 2025-12-06

### Changed
- Add multilingual Chapter/Verse labels with translation updates

## [0.8.109] - 2025-12-06

### Changed
- Refactor to language code properties and 9-language translation support

## [0.8.108] - 2025-12-06

### Changed
- Complete Focus Ring text centering - remove radial offset for all items

## [0.8.107] - 2025-12-06

### Changed
- Fix Focus Ring text centering and prefix attachment bug

## [0.8.106] - 2025-12-06

### Changed
- Updated bump-version.sh to sync versions across mobile-config.js, README.md, and CHANGELOG.md
- Version management now prevents drift between documentation and code

## [0.8.105] - 2025-12-06

### Changed
- Minor bug fixes and optimizations

## [0.8.104] - 2025-12-06

### Changed
- Code cleanup and refactoring

## [0.8.103] - 2025-12-05

### Changed
- Performance improvements

## [0.8.102] - 2025-12-05

### Changed
- Bug fixes

## [0.8.101] - 2025-12-04

### Changed
- Minor updates

## [0.8.100] - 2025-12-03

### Added
- **Translation Toggle Button**: New UI control for switching between translations
  - Text-only button at bottom center of viewport (next to Parent Button)
  - Displays current translation name (e.g., "LATIN", "ENGLISH")
  - Cycles through available translations on tap
  - Re-renders detail sector content with selected translation
- **Translations Configuration**: New manifest.json config block
  - `translations.available`: Array of translation codes (e.g., ['lat', 'eng'])
  - `translations.default`: Default translation to use
  - `translations.labels`: Display labels for each translation
  - `translations.text_properties`: Maps translation codes to verse properties

### Changed
- Detail sector now uses `applyTranslationToContext()` for translation-aware rendering
- Verse templates ({{text}}) resolve to selected translation's property

### Technical Notes
- Gutenberg verse data has `text` (Latin) and `translation` (English) properties
- `getTranslationTextProperty()` returns correct property for current translation
- Translation button visibility controlled by translations config presence

## [0.8.99] - 2025-12-03

### Added
- **IndexedDB Caching Layer**: Persistent cache for split volume book files
  - IDB_NAME='WheelVolumeCache' stores external JSON files
  - Survives browser sessions for faster subsequent loads
  - Automatic cache hit/miss logging

### Changed
- Split volume lazy loading now checks IndexedDB before network fetch
- Updated hg_mx.json with sort_number and name fields
- Updated volume_data_version to 2025.12.03

## [0.8.92] - 2025-12-03

### Added
- **Split JSON Architecture (Phase 1)**: Large volumes now support lazy loading
  - Created `data/gutenberg/manifest.json` with display_config and book index
  - Created `data/gutenberg/books/` directory with 67 individual book files
  - Genesis (GENE.json) fully populated with 50 chapters, 1,533 verses
  - Other books have placeholder structure ready for content

### Changed
- **Volume Discovery**: Split manifests now prioritized over monolithic files
  - Discovery checks for `data/{volume}/manifest.json` first
  - Falls back to `{volume}.json` if no split manifest found
  - Console logs show structure type (split/monolithic)
- **Lazy Loading**: Book data loaded on-demand when navigating
  - `ensureBookLoaded()` method fetches external book files
  - `getBookDataLocation()` navigates to book in data structure
  - Async loading path in renderer for book→chapter navigation
  - `_external_file` reference in manifest triggers lazy load

### Technical Notes
- Split structure uses `structure_type: "split"` in display_config
- Books in manifest have `_external_file` path and `_loaded` flag
- Loaded book data merged into manifest structure for seamless navigation
- `isSplitStructure()` helper added to DataManager

## [0.8.88] - 2025-12-03

### Added
- **Genesis Complete**: All 1,533 verses across 50 chapters added to gutenberg.json
- Existing Latin text preserved (Genesis 1:1-5, 2:1-3, 3:1)

### Changed
- Updated volume_data_version to 2025.12.03

## [0.8.87] - 2025-12-03

### Fixed
- **Font Size Override**: Inline style attribute with `!important` now properly overrides CSS
- Detail Sector text finally renders at correct font size for both tiers

### Technical Notes
- Changed from `textElement.style.fontSize` to `textElement.setAttribute('style', ...)`
- CSS `text { font-size: 15px }` was overriding SVG presentation attributes
- Inline style with `!important` has highest specificity

## [0.8.84] - 2025-12-03

### Added
- **Two-Tier Font Sizing**: Detail Sector text size based on verse word count
  - Big Font tier: ≤30 words → 30px font, charWidth ratio 0.45
  - Small Font tier: 31+ words → 22px font, charWidth ratio 0.35
- `word_count` field added to all verse entries in JSON

### Changed
- `renderGutenbergVerse()` now accepts wordCount parameter
- `buildLineTable()` now accepts charWidthRatio parameter
- Removed CSS font-size rule from `.gutenberg-verse-text` (JS controls sizing)

### Technical Notes
- Word count read from `context.word_count` in detail sector rendering
- Console log shows tier selection for debugging

## [0.8.79] - 2025-12-03

### Changed
- **Font Stack Finalized**:
  - Display font: Montserrat (Parent Button, Child Pyramid, Magnifier, UI)
  - Text font: EB Garamond (Gutenberg Bible verses in Detail Sector)
- Added EB Garamond to Google Fonts import (regular, medium, semibold, italic)

## [0.8.76] - 2025-12-03

### Changed
- Detail Sector charWidth reduced to 0.45 for better line filling with EB Garamond
- Left margin padding increased to 3% SSd from arc edge
- Right margin padding at 5% SSd from viewport edge

## [0.8.54] - 2025-12-02

### Changed
- **Corner-to-Corner Arc Formula**: Major geometry update for Focus Ring
  - Arc now enters viewport at upper-left corner, exits at lower-right corner
  - New radius formula: R = SSd/2 + LSd²/(2×SSd) (from chord/sagitta geometry)
  - New Hub X formula: Radius - SSd/2 (Hub Y unchanged at -LSd/2)
  - Focus Ring band narrowed: 99%-101% of radius (was 98%-102%)
  - Text margin arc at 98% of radius (1% inside Focus Ring)
  - Parent Button angle: 180° - arctan(LSd/R)
  - Parent Button distance: 0.9 × sqrt(LSd² + R²)

### Technical Notes
- iPhone SE (375×667): Radius = 780.69px, Hub = (593.19, -333.5)
- Arc passes through exact corners: (-SSd/2, -LSd/2) to (+SSd/2, +LSd/2)
- All arc-dependent code uses `getArcParameters()` as single source of truth
- Updated: mobile-viewport.js, mobile-renderer.js, mobile-animation.js, mobile-detailsector.js

## [0.8.39] - 2025-12-02

### Added
- **Detail Sector Gutenberg Rendering**: Stable baseline for Bible verse text display
  - Dynamic font sizing: 5% of SSd (shorter side dimension), clamped 16-42px
  - Arc-based left margins via `buildLineTable()` - text flows along Focus Ring arc boundary
  - Per-line width calculation respects curved edge for natural text wrapping
  - Works correctly for short verses (Genesis 1:1) and long verses (Esther 8:9)
  - Latin text only (Vulgate 1455)

### Technical Notes
- `renderGutenbergVerse()` uses `buildLineTable()` + `wrapTextWithLineTable()` for arc-aware layout
- Each line's left margin calculated from arc intersection at that Y position
- SSd-relative sizing ensures consistent appearance across viewport sizes
- Right-aligned text with Palatino serif font family
- **STABLE BASELINE** - User-approved version for verse rendering

## [0.8.32] - 2025-12-01

### Added
- Dynamic line positioning with per-line arc-based left margins
- `buildLineTable()` function for computing line positions and widths
- `wrapTextWithLineTable()` for variable-width text wrapping
- Detail Sector bounds diagnostic toggle (click copyright to show/hide)

### Changed
- Gutenberg verse rendering uses arc-aware text layout
- Line widths vary based on arc intersection at each Y position

## [0.8.12] - 2025-11-25

### Changed
- **Focus Ring Selection Method**: Changed how focus nodes are selected
  - Magnifier clicks now do nothing (previously advanced ring by one node clockwise)
  - Clicking any unselected focus node brings that node to the magnifier position
  - Swiping behavior unchanged - still rotates ring smoothly in either direction
  - Unselected nodes show pointer cursor for visual feedback
  - Only unselected nodes are clickable; selected/magnified node at center is not clickable

### Technical Notes
- Removed `advanceFocusRing()` call from magnifier click handler
- Added `bringFocusNodeToCenter(focusItem)` method for direct node selection
- Focus node groups now include `data-focus-key` attribute for identification
- Click handlers added only to unselected nodes during `createFocusElement()`
- Selected node has no click handler since it's already centered

## [0.8.11] - 2025-11-25

### Added
- **Stage 4 Animation**: Parent Button → Magnifier OUT migration animation
  - Animates Parent Button content to Magnifier position when navigating back to parent level
  - Reverses Stage 3 transformations: 16px/weight 600 → 20px/bold text, 315° → Magnifier angle rotation
  - Text and circle move from Parent Button (135°, 0.9 × LSd × √2) to Magnifier (viewport center angle, focus ring radius)
  - 600ms ease-in-out animation with smooth position, size, weight, and rotation interpolation
  - Integrated into all three Parent Button click paths: simple top level, top nav level, and general parent navigation

### Changed
- Parent Button click now triggers Stage 4 animation before Stage 2 (Focus Ring → Child Pyramid)
- OUT migration now executes both Stage 4 (Parent Button → Magnifier) and Stage 2 (Focus Ring → Child Pyramid) simultaneously

### Technical Notes
- Stage 4 function: `animateParentButtonToMagnifier(parentItem)` in mobile-animation.js
- Called via `this.renderer.animation.animateParentButtonToMagnifier()` in mobile-app.js
- Three integration points: line ~665 (simple path), ~777 (top nav path), ~896 (general path)
- Both Stage 2 and Stage 4 animations run in parallel during 600ms OUT migration
- Hides actual Parent Button group during animation, restores after completion

## [0.8.10] - 2025-11-25

### Changed
- **Text Positioning Simplification**: Magnifier and Parent Button text now both centered over their circles with zero offset
  - Magnifier selected text: `text-anchor='middle'`, positioned at circle center (no offset)
  - Parent Button text: `text-anchor='middle'`, positioned at circle center (0.9 × LSd × √2 from hub at 135°)
  - Eliminates previous 72px and 47px offsets for cleaner, more maintainable positioning
- **Stage 3 Animation Refactor**: Simplified Magnifier → Parent Button animation
  - Text and circle both start at Magnifier position, end at Parent Button position
  - Smooth interpolation of position, size (20→16px), weight (bold→600), and rotation
  - No group transforms or complex offset calculations needed
  - Text stays centered over circle throughout entire animation

### Technical Notes
- Focus ring selected item text now uses `offset = 0` instead of `-(radius + 50)`
- Parent Button text calculation simplified from dual-radius approach to single position with zero offset
- Animation creates single group with circle and text, both animating from start to end coordinates
- Text anchor consistency: both Magnifier and Parent Button use 'middle' for selected/active text

## [0.8.9] - 2025-11-25

### Fixed
- Parent Button text now shows only when button is active (clickable), hidden when disabled at top level
- Parent Button line to Magnifier only visible when button circle is visible
- OUT animation visual cleanup: Focus Ring nodes and Magnifier stroke now hidden during animation (gray band remains visible)

### Changed
- Parent Button displays parent name text when navigating to sub-levels
- Parent Button line drawing includes visibility guard to prevent line when circle hidden

### Technical Notes
- Parent Button text positioned at radius 0.95 × LSd × √2, rotated to align with 135° angle
- Text visibility controlled by `display: none` when button disabled (at top level)
- OUT animation now hides Focus Ring node elements (opacity: 0) while preserving background band (#focusRingBackground)
- Magnifier stroke hidden via `style.opacity = '0'` during OUT animation, restored by `positionMagnifyingRing()`
- Unified visual pattern: clean transition with only animated clones visible during migration

## [0.8.8] - 2025-11-24

### Fixed
- Hide existing Child Pyramid before OUT animation (top nav path)
- Prevents "TEST ENGINE 10" family node from appearing alongside animated cylinder nodes
- Now both navigation paths use same pattern: hide old Child Pyramid → OUT animation → show new Child Pyramid

### Technical Notes
- Issue: Child Pyramid at family level ("TEST ENGINE 10") remained visible during OUT animation back to manufacturer level
- This created duplicate display: family-level Child Pyramid + animating cylinder nodes → manufacturer cylinders
- Solution: Call `hideChildPyramid()` before starting OUT animation
- Unified pattern ensures clean visual transition without overlap

## [0.8.7] - 2025-11-24

### Fixed
- Eliminated duplicate Child Pyramid display after Parent Button OUT animation (top nav path)
- Removed redundant `showChildPyramid()` call - now handled exclusively by `updateFocusRingPositions()`

### Technical Notes
- Issue: Child Pyramid displayed twice - once manually after OUT animation, once by `updateFocusRingPositions()`
- Solution: Rely solely on `updateFocusRingPositions()` with `forceImmediateFocusSettlement` flag
- Unified Child Pyramid display pattern: OUT animation cleanup → `updateFocusRingPositions()` → automatic Child Pyramid rendering
- Eliminates visual flicker and duplicate nodes during navigation

## [0.8.6] - 2025-11-24

### Fixed
- OUT animation now works correctly at all hierarchy levels
- Replaced single `lastAnimatedNodes` with `animatedNodesStack` to maintain animation state per level
- Stack-based (LIFO) architecture properly handles multi-level navigation IN→IN→OUT→OUT

### Technical Notes
- Issue: Single `lastAnimatedNodes` reference was overwritten on each IN animation
- Solution: Stack of `{level, nodes}` objects - push on IN, pop on OUT
- Each hierarchy level now maintains its own animated nodes for proper reversal
- Enables correct OUT animations regardless of how deep you've navigated

## [0.8.5] - 2025-11-24

### Fixed
- Child Pyramid no longer flashes/disappears during Parent Button OUT animation
- Fixed rotation detection preventing Child Pyramid display after OUT animation completes
- Set `forceImmediateFocusSettlement` flag to bypass rotation delay during Parent Button navigation

### Technical Notes
- Issue: `updateFocusRingPositions` was treating Parent Button navigation as user rotation
- Solution: Set `lastRotationOffset` and `forceImmediateFocusSettlement` before calling `updateFocusRingPositions`
- Child Pyramid now remains continuously visible during OUT animation → Focus Ring update sequence

## [0.8.4] - 2025-11-24

### Fixed
- OUT animation now removes animated nodes after completion
- Child Pyramid properly updates when rotating Focus Ring after OUT migration
- Fixed animated nodes blocking clicks and obscuring fresh Child Pyramid content
- Child Pyramid now renders correctly for newly selected Focus Ring items after navigation

### Technical Notes
- Animated nodes from OUT animation are now cleaned up after serving their visual purpose
- Allows normal Child Pyramid rendering system to take over with fresh content
- Resolves issue where old Child Pyramid nodes persisted and blocked new content

## [0.8.3] - 2025-11-24

### Changed
- Refactored OUT animation to match IN animation architecture
- OUT animation now reuses saved `lastAnimatedNodes` from IN animation
- Simplified animation logic: resets CSS transform to `translate(0, 0) rotate(0deg)` instead of calculating reverse deltas
- Animation now follows working reference implementation pattern from howellgibbens.com

### Technical Notes
- IN animation: applies CSS transforms to nodes at Child Pyramid positions
- OUT animation: resets CSS transforms to return nodes to original positions
- Nodes persist between animations with `opacity: 0` for seamless reversal
- Known issue: OUT animation still has positioning bugs requiring further investigation

## [0.8.2] - 2025-11-24

### Fixed
- Detail Sector now expands during Child Pyramid animation for all leaf items
- Fixed leaf item detection for hierarchies with object-type leaf data (e.g., Bible verses)
- `__isLeaf` property now correctly set based on hierarchy depth, not just data type
- Removed incorrect assumption that only array-type data can be leaves

## [0.8.1] - 2025-11-24

### Fixed
- Parent Button OUT migration now correctly positions parent item in Magnifier
- Fixed extraction of parent name from `__path` array using hierarchy depth
- Parent lookup now searches by `item.name` instead of `item.key` for correct matching
- Diagnostic logging added to track OUT migration parent selection

## [0.8.0] - 2025-11-23

### Added
- Animated nzone migration: Child Pyramid nodes smoothly animate to Focus Ring positions
- Magnifier node animates to Parent Button position during outward navigation
- Parent Button fades off-screen during nzone migration
- Focus Ring background band (wallpaper) remains visible during animation
- Error overlay removal on Focus Ring rotation (auto-dismiss on user interaction)
- Animation state blocking prevents race conditions with touch events

### Changed
- Child Pyramid click now triggers full animation sequence before state updates
- All sibling nodes animate simultaneously with individual radius transitions
- Clicked node enlarges to magnified size during animation
- Reduced console logging in getParentNameForLevel (~50 logs removed)
- Error divs in mobile-data.js now use 'sort-number-error' class for removal
- Animation duration: 600ms ease-in-out for smooth visual transitions

### Fixed
- Sort number error messages now properly dismissed when rotating Focus Ring
- Error div removal logs show context snippet for verification
- Animation prevents duplicate Child Pyramid rendering during transitions

## [0.7.1] - 2025-11-23

### Changed
- Parent Button text positioning now dynamically calculated from Hub polar coordinates
- Parent Button text starts at radius 0.95 × LSd × √2 (vs circle at 0.9 × LSd × √2)
- Text rotation calculated using same logic as Focus Ring text (radial orientation)
- Text offset calculated as difference between text start position and circle center

### Fixed
- Text migration animation now fully opaque throughout (no opacity transitions)
- Animation rotation correctly interpolates from Magnifier radial angle to horizontal
- Animation end position aligned with real Parent Button text position
- Coordinate system consistency: debug X marker now correctly drawn at Nuc origin (0,0)

## [0.7.0] - 2025-11-21

### Added
- Magnifier click advances Focus Ring by one item clockwise
- Touch detection distinguishes taps from swipes (< 10px movement, < 300ms)
- Gutenberg Bible verse display with 36px font size
- Debug logging control (DEBUG_VERBOSE flag)

### Changed
- Detail Sector pointer-events set to 'none' to allow magnifier clicks
- Touch handler exclusions for Detail Sector elements
- Reduced console log spam (3000+ to ~10 messages)

## [0.6.9] - 2025-11-21

### Added
- Parent Button contextual breadcrumb showing hierarchical context
- Volume selector displays JSON schema and data versions

### Changed
- Parent Button breadcrumb logic uses actual path position
- Handles hierarchies with skipped levels

### Fixed
- Parent Button opacity now stays at 1.0 when disabled
- Uses pointer-events: none instead of opacity reduction

## [0.6.8] - 2025-11-21

### Changed
- Parent Button migrated from HTML/CSS to SVG coordinate system
- Parent Button line now ends at text center

### Fixed
- Coordinate system consistency (pathLinesGroup ID mismatch)
- Parent Button visibility (display: none persisting)
- Off-screen rendering issues
- **hideParentButton Reference Error**: Fixed null pointer exception
  - Updated `hideParentButton()` to reference `parentButtonGroup` instead of deleted `parentButton`
  - Added null checking to prevent crashes during rotation
  - Prevents Focus Ring rotation limit errors

## [0.6.7] - 2025-11-20

### Added
- **Visual Affordance System**: Consistent 1px black stroke indicates interactivity
  - **Clickable elements** (with stroke): Child Pyramid nodes, Magnifier, Parent Button circle
  - **Reference elements** (no stroke): Focus Ring nodes outside magnifier
  - Clear visual logic: stroke = interactive, no stroke = informational only
  - Unified interaction language across all navigation components

### Changed
- Removed opacity from Magnifier (was 0.8, now fully opaque)
- Removed opacity from copyright text (was 0.85, now fully opaque)
- Logo remains at 0.3 opacity as designed

## [0.6.6] - 2025-11-20

### Added
- **Parent Button Visual Enhancement**: Yellow node indicator behind text
  - 20px yellow circle positioned behind parent button text
  - Matches visual language of Focus Ring and Child Pyramid nodes (all navigation = yellow circles)
  - Shows/hides in sync with parent button state
  - Provides unified navigation affordance across UI
- **Granular Logging System**: 6-level log control (NONE, ERROR, WARN, INFO, DEBUG, VERBOSE)
  - Default level: WARN (quiet - only errors/warnings)
  - URL control: `?loglevel=3` for info, `?loglevel=4` for debug, `?loglevel=5` for verbose loops
  - Reduced console noise from 110+ messages to ~10 at default level
  - Legacy `?debug=1` flag disabled (use `?loglevel=4` instead)
- **Defensive Publication**: Established prior art for innovations
  - Created DEFENSIVE_PUBLICATION.md (8,600+ words documenting Hub/Nuc system, pseudo parents, etc.)
  - Repository made public: github.com/mmdm-it/wheel
  - Zenodo integration configured for DOI assignment
  - Repository description: "Catalogo ricambi marini e molto altro" (generic Italian description for discretion; innovation details disclosed in formal defensive publication document)
- **JSON Schema Versioning System**: Formal versioning for JSON volume structure
  - Added `volume_schema_version` (semantic versioning for structure)
  - Added `volume_data_version` (date-based versioning for content)
  - Added `structure_type` field ("monolithic" or "split")
  - All three volumes now explicitly versioned as 1.0.0 (monolithic)
  - Created SCHEMA_CHANGELOG.md documenting migration path to v2.0.0 (split architecture)
  - Created SPLIT_ARCHITECTURE_PLAN.md with 6-phase implementation roadmap
  - DataManager now logs schema/data/structure info on volume load
  - Preparation for Phase 2: split JSON architecture (manufacturer/book/artist files)

### Changed
- Archived obsolete documentation to archive/ folder
  - AUDIT_REPORT.md (historical v0.6.4 snapshot)
## [0.6.7] - 2025-11-20

### Added
- Visual affordance system: 1px black stroke indicates clickable elements
- Clickable: Child Pyramid nodes, Magnifier, Parent Button
- Non-clickable: Focus Ring nodes (informational only)

### Changed
- Removed opacity from Magnifier and copyright text
- Logo remains at 0.3 opacity

## [0.6.6] - 2025-11-20

### Added
- Parent Button yellow node indicator (20px circle)
- Granular logging system (6 levels: NONE to VERBOSE)
- JSON schema versioning system (volume_schema_version, volume_data_version)
- SCHEMA_CHANGELOG.md and SPLIT_ARCHITECTURE_PLAN.md

### Changed
- Default log level: WARN (reduced from verbose)
- URL control: ?loglevel=4 for debug (legacy ?debug=1 disabled)
- Repository renamed from 'catalog' to 'wheel'
- Archived AUDIT_REPORT.md and REFACTOR_SUMMARY.md

### Fixed
- Console logging reduced from 110+ to ~10 messages

## [0.6.5] - 2025-11-20

### Fixed
- Volume selector version display now working
- Background changed to gray, text to black for visibility
- Copyright now visible on start page

### Changed
- Volume selector UI translated to Italian

## [0.6.4] - 2025-11-19

### Fixed
- Child Pyramid click detection (inverted rotation offset)
- Detail Sector expansion (blue circle now 98% of focus ring radius)
- Clicked items now correctly migrate to Focus Ring center

### Changed
- Child Pyramid sorting aligned with DataManager (ascending sort_number)

### Added
- sort_number property to Lockwood-Ash test models

## [0.6.3] - 2025-11-18

### Added
- Comprehensive sort_number validation for navigation items
- Context-aware leaf sorting (tracks, verses, alphabetical fallback)
- CONTRIBUTING.md

### Changed
- Enforced sort_number for all navigation levels
- Completed manufacturer cylinder count restructuring

### Fixed
- Silent sorting failures eliminated
- Parent button navigation to top level
- Structural inconsistencies in cylinder data

## [0.5.20] - 2025-11-15

### Fixed
- Focus ring angle assignment (higher angles for earlier sort_number)
- Touch snapping and rotation offsets updated

## [0.5.19] - 2025-11-15

### Added
- Initial hierarchical navigation system
- Multi-catalog support with volume selector
- Audio playback for music catalog
- Touch-optimized controls with momentum physics

### Technical
- ES6 native modules (zero build process)
- SVG-based rendering
- Hub/Nuc coordinate system
- Performance optimized for 2000+ items

---

## Versioning

- **MAJOR** version: Incompatible API changes
- **MINOR** version: New features, backwards-compatible
- **PATCH** version: Bug fixes, backwards-compatible
