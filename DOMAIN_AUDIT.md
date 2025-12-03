# Domain-Specific Code Audit

## Purpose
Identify and remove all domain-specific language from the Wheel codebase to make it truly volume-agnostic.

## Audit Date: December 3, 2025
## Fixed Date: December 3, 2025 (v0.8.97)

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| manufacturer references | 12 | ✅ Fixed |
| gutenberg references | 8 | ✅ Fixed (2 file patterns remain) |
| engine_model references | 6 | ✅ Fixed (1 compat helper remains) |
| catalog references | 14 | ⚠️ Review (generic name) |
| MMdM/mmdm references | 9 | ✅ Fixed |
| CSS class names | 3 | ✅ Fixed |
| **artist/album/song** | **6** | ✅ **Fixed** |
| fairhope.json hardcoded | 1 | ✅ Fixed (volumes.json support added) |

---

## All Volumes in Workspace

| Volume | Root Key | Hierarchy Levels |
|--------|----------|------------------|
| MMdM Catalog | MMdM | manufacturer → model → spec |
| Gutenberg Bible | Gutenberg_Bible | section → book → chapter → verse |
| HG Music | HG_Music | artist → album → song |
| Fairhope | Fairhope | year → month → day → post |

---

## Detailed Findings

### 1. mobile-data.js

#### manufacturer (tracing system)
- Line 56-57: `item.manufacturer` in trace system
- **Fix**: Rename to generic `item.primaryLabel` or remove manufacturer-specific tracing

#### engine_model (item naming)
- Lines 955, 957, 963: `item.engine_model || item.name`
- Lines 1216, 1218, 1224: Same pattern
- Line 1751: `itemData.engine_model`
- **Fix**: Use `item.name` only, or get display property from config

#### Gutenberg_Bible / MMdM (root key examples)
- Line 19: Comment mentions 'MMdM' or 'Gutenberg_Bible'
- Line 334: Same comment
- **Fix**: Keep as examples in comments, but ensure code doesn't depend on them

#### Volume file discovery (hardcoded filenames)
- Lines 190-191: Hardcoded `mmdm_catalog.json`, `gutenberg.json`
- Line 198: Hardcoded `data/gutenberg/manifest.json`
- Lines 521, 527: Default to `mmdm_catalog.json`
- **Fix**: Make discovery truly dynamic or configurable

### 2. mobile-renderer.js

#### manufacturer (breadcrumb logic)
- Lines 2549-2574: Entire breadcrumb section uses "manufacturer" terminology
- **Fix**: Use generic terms like "topLevelItem", "primaryAncestor"

#### MMdM-specific styling
- Line 933: `displayConfig.volume_name === 'MMdM Catalog'`
- Line 1730: Comment "MMdM blue for volume selector"
- Line 3050: Comment "MMdM blue"
- **Fix**: Remove volume-specific checks, use config-driven colors

#### catalogSvg (element IDs)
- Lines 210, 225: Reference to 'catalogSvg'
- **Fix**: Rename to 'wheelSvg' or keep (low priority)

### 3. mobile-detailsector.js

#### Gutenberg-specific rendering
- Line 235-237: Check for `volume_name === 'Gutenberg Bible'` to skip header
- Line 372-373: Check for `volume_name === 'Gutenberg Bible'` for verse rendering
- **Fix**: Use config flag like `skip_header: true` or `text_display_mode: 'verse'`

#### gutenberg-verse-text CSS class
- Line 838: Hardcoded class name
- **Fix**: Use generic class like `detail-text-body` or `verse-text`

#### manufacturer in spec extraction
- Line 929: Hardcoded field name 'manufacturer'
- **Fix**: Make configurable via display_config

### 4. mobile-touch.js

#### gutenberg-verse-text (touch handling)
- Line 273: Special handling for gutenberg-verse-text class
- **Fix**: Use generic class name

### 5. catalog_mobile.css

#### CSS class names
- Line 65: `.gutenberg-verse-text` selector
- Line 265: `.gutenberg-verse-text` exclusion
- Line 172: Comment mentions "MMdM node"
- **Fix**: Rename to generic `.detail-verse-text` or `.body-text`

---

## HG_Music-Specific References (NEW)

### 6. mobile-data.js

#### song-level context (artist/album)
- Line 631: `if (item.__level === 'song' && ...)`
- Line 634: Logger mentions `artist: context.artist, album: context.album`
- **Fix**: Use generic level detection from hierarchy_levels config

### 7. mobile-detailsector.js

#### Audio overlay metadata
- Lines 1102-1106: Hardcoded `context.album` and `context.artist`
- Uses `album || artist` pattern for metadata display
- **Fix**: Use generic ancestry labels or config-driven display

---

## Fairhope-Specific References

### 8. mobile-data.js

#### Hardcoded filename
- Line 193: `'fairhope.json'` in volume discovery list
- **Fix**: Make discovery truly dynamic

---

## Proposed Generic Replacements

| Domain-Specific | Generic Replacement |
|-----------------|---------------------|
| manufacturer | primaryItem, topLevelItem, ancestorLabel |
| engine_model | itemName, displayName |
| gutenberg-verse-text | detail-body-text |
| isGutenberg | hasVerseDisplay, textDisplayMode |
| MMdM Catalog | (remove check, use config) |
| artist/album/song | (use hierarchy_levels from config) |
| catalogSvg | wheelSvg (optional) |
| mmdm_catalog.json | (dynamic discovery) |
| fairhope.json | (dynamic discovery) |

---

## Implementation Plan

### Phase 2A: Code Audit & Rename ✅ COMPLETE (v0.8.97)
1. Create this audit document ✅
2. Rename CSS classes ✅ (`gutenberg-verse-text` → `detail-body-text`)
3. Remove volume-specific conditionals ✅ (use config flags)
4. Generalize manufacturer references ✅ (`topAncestorSegment`)
5. Remove engine_model fallbacks ✅ (`getItemDisplayName()` helper)

### Phase 2B: Config-Driven Features ✅ COMPLETE
1. Move text styling to display_config ✅ (`detail_sector.mode: "text_display"`)
2. Add `detail_sector.text_display_mode` option ✅ (uses mode field)
3. Add `detail_sector.skip_header` option ✅
4. Make font choices config-driven ✅ (via CSS class)

### Phase 2C: Add Safeguards ✅ COMPLETE (v0.8.98)
1. Add ESLint rule for domain-specific terms ✅ (`.eslintrc.js`)
2. Pre-commit hook to check for violations ✅ (`hooks/pre-commit`)
3. Document abstraction guidelines ✅ (added to `CONTRIBUTING.md`)

---

## Changes Made (v0.8.97)

### CSS
- Renamed `.gutenberg-verse-text` → `.detail-body-text`
- Removed "MMdM" from CSS comments

### mobile-data.js
- Renamed `traceManufacturer()` → `traceItem()`
- Renamed `shouldTraceManufacturer()` → `shouldTraceItem()`
- Added `getItemDisplayName()` helper for backwards compatibility
- Made volume discovery dynamic (supports `volumes.json` index)
- Generic ancestor context (`ancestor1`, `ancestor2`, etc.)

### mobile-renderer.js
- Removed unused `isMMDM` variable
- Renamed `manufacturerSegment` → `topAncestorSegment`
- Updated comments to use generic terminology

### mobile-detailsector.js
- Replaced `volume_name === 'Gutenberg Bible'` with `detail_sector.skip_header` config
- Replaced Gutenberg check with `detail_sector.mode === 'text_display'` config
- Generic ancestor breadcrumb for audio overlay

### mobile-touch.js
- Updated class reference to `detail-body-text`

### mobile-app.js
- Fixed "manufacturers" log message

### JSON Config
- Added `skip_header: true` to verse level in gutenberg.json and manifest.json

---

## Verification Results (v0.8.97)

```
manufacturer refs: 0 ✅
gutenberg refs: 2 (file patterns only) ✅
engine_model refs: 1 (compat helper only) ✅  
volume_name === refs: 0 ✅
artist/album refs: 0 ✅
```

---

## Domain Leakage by Volume

| Volume | Leakage Found | Status |
|--------|---------------|--------|
| MMdM | manufacturer (12), engine_model (6), mmdm (9) | ✅ Fixed |
| Gutenberg | gutenberg (8), verse-text CSS (3) | ✅ Fixed |
| HG_Music | artist/album/song (6) | ✅ Fixed |
| Fairhope | fairhope.json (1) | ✅ Fixed |
