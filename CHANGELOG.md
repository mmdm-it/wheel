# Changelog

All notable changes to Wheel will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Split architecture Phase 2: Dual loader implementation
- Multi-volume validation

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