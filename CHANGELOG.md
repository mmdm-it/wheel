# Changelog

All notable changes to **Wheel** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Split architecture Phase 2: Dual loader implementation (v0.7.0)
- Child Pyramid IN navigation completion
- Multi-domain validation across all three volumes

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
  - REFACTOR_SUMMARY.md (completed refactoring narrative)
- Updated all version references across documentation to 0.6.6
- Repository renamed from `catalog` to `wheel` on GitHub
- Consolidated documentation to essential files only

### Fixed
- Console logging excessive output (110+ messages reduced to ~10)

## [0.6.5] - 2025-11-20

### Fixed
- **Volume Selector Version Display**: Fixed version not displaying on start page
  - Corrected import to include VERSION from mobile-config.js
  - Changed background to gray (#868686) matching body
  - Changed text colors to black for visibility
  - Removed "x volumes detected" redundant text
  - Removed tip about bookmarking
  - Copyright now visible on start page (was being hidden)

### Changed
- **Italian Translation**: Volume selector UI now in Italian
  - "Wheel Volume Loader (Dev Only)" → "Caricatore di Volumi Wheel (Solo Dev)"
  - "Select Volume:" → "Seleziona Volume:"
  - "Version:" → "Versione:"
  - Volume names remain in English

## [0.6.4] - 2025-11-19

### Fixed
- **Child Pyramid Click Detection**: Corrected inverted rotation offset calculation that caused wrong items to appear in magnifier
  - Clicking on cylinder "15" now correctly brings "15 Cylinders" to magnifier (previously brought "5 Cylinders")
- **Detail Sector Expansion**: Dynamic blue circle expansion to 98% of focus ring radius for leaf item selection
  - Fixed centerOffset formula sign to match `(middleIndex - index)` angle calculation in updateFocusRingPositions
  - Changed from `-(clickedIndex - middleIndex)` to `(clickedIndex - middleIndex)` for proper coordination
  - Items clicked in Child Pyramid now correctly migrate to Focus Ring center position

### Changed
- **Child Pyramid Sorting**: Aligned with DataManager sorting to ensure consistent item order
  - Child Pyramid now sorts by sort_number ascending (matching Focus Ring siblings array)
  - Removed sort_type config interpretation (numeric_desc) that caused descending sort mismatch
  - Visual Child Pyramid order now matches array indices used for click detection

### Added
- **Lockwood-Ash Model Sort Numbers**: Added sort_number: 1 to all 19 Lockwood-Ash test engine models
  - Leaf-level models now have required sort_numbers for navigation consistency
  - Each cylinder count (1-19) has single model with sort_number: 1

### Technical Details
- Child Pyramid click detection now uses matching sort order with Focus Ring array
- Rotation offset calculation coordinates properly with angle positioning formula
- Diagnostic logging added to trace click detection and item selection process

## [0.6.3] - 2025-11-18

### Added
- **Data Consistency Validation**: Comprehensive sort_number validation for all navigation items
  - User-facing error messages for missing sort_numbers at navigation levels
  - Validation passes in DataManager, MobileRenderer, and MobileChildPyramid
  - Prevents rendering of items without required sort metadata
- **Context-Aware Leaf Sorting**: Intelligent leaf-level sorting based on context
  - Track numbers for songs in album context
  - Verse numbers for Bible verses in chapter context
  - Alphabetical fallback for aggregated views

### Changed
- **Sort Number System**: Enforces sort_number requirement for all navigation levels
  - Navigation items (non-leaf): Mandatory sort_number validation with user error display
  - Leaf items (models, songs, verses): Context-aware sorting with multiple strategies
  - Improved data quality through strict validation at multiple checkpoints
- **Data Structure Updates**: Completed manufacturer cylinder count restructuring
  - Admiral, Allison, Caterpillar: Cylinder counts now use standard {sort_number, models: []} format
  - ~70 additional manufacturers: Empty cylinders converted to {sort_number} format
  - Consistent data structure across all 106 manufacturers in MMdM catalog

### Fixed
- Eliminated silent sorting failures for items missing sort_numbers
- Prevented display of unsorted navigation items that could break user experience
- Resolved structural inconsistencies in cylinder count data across manufacturers

### Technical Details
- Sort validation occurs in three layers: data loading, rendering, and display
- Error messages appear as prominent red overlays with affected item details
- Leaf-level sorting intelligently adapts to available metadata (track_number, verse_number, name)

### Added
- CONTRIBUTING.md with comprehensive developer guidelines
- Expanded README.md with setup instructions and architecture overview
- JSDoc documentation framework for API methods

### Changed
- Reorganized DESIGNSPEC.md into Part I (Code) and Part II (JSON Configuration)
- Updated README.md with modern documentation structure

### Fixed
- Parent button navigation now correctly returns to top level
- Improved touch interaction responsiveness

## [0.5.20] - 2025-11-15

### Fixed
- Focus ring hub-angle math now assigns higher angles to earlier sort_number entries while keeping the magnifier anchored
- Touch snapping, rotation offsets, and volume selector alignment updated to reflect the corrected angle orientation

### Documentation
- STATUS and README now reference v0.5.20 with notes on the magnifier fix

## [0.5.19] - 2025-11-15

### Added
- **Critical Architecture Gap Identified**: Nested pseudo parent system required for marine catalog Family → Sub-Family hierarchies
- **Real-World Requirements Documented**: Ford Modular→Triton/Coyote, MerCruiser Small Block→Gen IV, Detroit Diesel Series 71 examples
- **Implementation Priority Elevated**: Pseudo parent system moved to Priority 2 (was lower priority)

### Changed
- Updated STATUS.md with marine catalog pseudo parent requirements
- Added nested pseudo parent examples and real-world data structures

### Removed
- **1.0.0 release** - POSTPONED to allow completion of split architecture system (Phase 6, target Jan 2026). Pseudo parent system gap has since been resolved in v0.6.0.

### Added
- **Universal hierarchical data navigation system**
- **2D navigation interface** with rotational and radial movement
- **Mobile-first ES6 module architecture**
- **SVG-based rendering** with dynamic viewport calculations
- **Touch-optimized controls** with momentum physics
- **Multi-catalog support** with volume selector
- **Audio playback integration** for music catalog
- **Responsive design** (portrait/landscape detection)
- **Comprehensive logging system** for debugging

### Supported Catalogs
- **Marine Engine Catalog** (`mmdm_catalog.json`) - 2000+ marine diesel models
- **Music Library** (`hg_mx.json`) - Artist/Album/Track with audio
- **Gutenberg Bible** (`gutenberg.json`) - Complete Latin Vulgate text

### Technical Features
- **Zero build process** - Direct ES6 module loading
- **Universal data architecture** - Works with any JSON hierarchy
- **Pseudo-parent level system** for dynamic hierarchies
- **Detail sector templating** with metadata-driven content
- **Child pyramid navigation** with configurable sorting
- **Coordinate system mathematics** (Hub/Nuc polar/Cartesian)
- **Performance optimized** for 2000+ items

### Documentation
- **DESIGNSPEC.md** - Complete technical specification
- **STATUS** - Development roadmap and current status
- **REFACTOR_SUMMARY.md** - Architecture evolution documentation

---

## Types of Changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Versioning
This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

---

**Legend:**
- 🚀 New feature
- 🐛 Bug fix
- 📚 Documentation
- 🔧 Maintenance
- 💥 Breaking change