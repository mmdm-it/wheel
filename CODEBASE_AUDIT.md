# Codebase Audit - Dec 16, 2025

## Dead/Unused Modules (Candidates for Deletion)

### Test/Demo Files (Never imported)
1. **config-test.js** - Test file for config loading
2. **mobile-renderer-demo.js** - Demo/test file
3. **viewport-bilingual-test.js** - Bilingual viewport test

### Possibly Obsolete (Check before deleting)
4. **mobile-viewport-modernized.js** - Newer version? Check if mobile-viewport.js is used instead
5. **catalog_mobile_modular.js** - Modular entry point, may be unused if we use mobile-app.js directly

**Recommendation**: Delete test files immediately. Research the other two.

---

## Font Size: Multiple Sources of Truth

### Current Chaos
**Problem**: Font sizes are set in BOTH JavaScript and CSS, causing conflicts.

### Where Font Sizes Are Set

#### In CSS (mobile/catalog_mobile.css):
```css
.focusItem text { font-size: 16px; }
.focusItem.selected text { font-size: 20px; font-weight: bold; }
.childRing text { font-size: 14px; }
/* etc... */
```

#### In JavaScript (scattered):
- `mobile-animation.js` - Sets font-size attributes during animations
- `focus-ring-view.js` - updateFocusItemText() may set font-size
- `mobile-childpyramid.js` - May set text sizes
- `detailsector-content.js` - Sets text sizes (30px/22px)

### The Fix: CSS-Only Font Sizing

**Rule**: JavaScript should NEVER set `font-size` or `font-weight` attributes.

**Implementation**:
1. Move ALL font sizing to CSS classes
2. JavaScript only adds/removes classes
3. CSS handles the visual presentation

```javascript
// BAD
textElement.setAttribute('font-size', '20px');

// GOOD
textElement.classList.add('selected');  // CSS handles the size
```

---

## Configuration: Single Source of Truth

### Current State
- `mobile-config.js` - Main config (VERSION, RADIUS, ANGLES, etc.)
- JSON files (manifest.json, fairhope.json, etc.) - Volume-specific config
- Hardcoded values scattered in JS files

### The Fix: Centralized Config Access

**Rule**: All configuration must come from `mobile-config.js` or DataManager.

**Audit Needed**:
```bash
# Find hardcoded numbers that should be config
grep -r "Math.PI / [0-9]" mobile/*.js
grep -r "radius.*[0-9]" mobile/*.js
```

---

## Module Dependency Map

### Core System (Entry Point)
- **mobile-app.js** → Imports: DataManager, MobileRenderer, ViewportManager, TouchRotationHandler, NavigationState

### Renderer Stack
- **mobile-renderer.js** → Uses 14 modules (documented above)
  - Focus: FocusRingView
  - Child: MobileChildPyramid  
  - Detail: MobileDetailSector
  - Animation: MobileAnimation
  - Navigation: NavigationView, NavigationCoordinator
  - Helpers: MagnifierManager, ThemeManager, TranslationToggle, ParentNameBuilder, etc.

### Data Stack (Phase 2A)
- **mobile-data.js** → Delegates to 10 sub-modules
  - All data* modules are used ✅

### DetailSector Stack (Phase 2B)
- **mobile-detailsector.js** → Delegates to 4 sub-modules
  - All detailsector* modules are used ✅

### Independent Utilities (Used by many)
- **mobile-config.js** - Config constants (35 imports)
- **mobile-logger.js** - Logging (40 imports)
- **item-utils.js** - Item utilities (12 imports)
- **mobile-coordinates.js** - Coordinate system (7 imports)

---

## Action Plan

### Immediate (Today)
1. ✅ Delete dead test files (config-test.js, mobile-renderer-demo.js, viewport-bilingual-test.js)
2. ✅ Research mobile-viewport-modernized.js vs mobile-viewport.js
3. ✅ Document font-size conflict resolution strategy

### Phase 3A: CSS-Only Font Sizing (1-2 days)
1. Audit all `setAttribute('font-size')` calls
2. Create CSS classes for all text sizes
3. Replace JS font sizing with class toggles
4. Test thoroughly
5. Remove JS font-size code

### Phase 3B: Config Consolidation (1 day)
1. Find hardcoded magic numbers
2. Move to mobile-config.js
3. Replace with config references

### Phase 3C: Dead Code Removal (Ongoing)
1. Set up import tracking
2. Mark modules as "used" or "unused"
3. Delete unused modules
4. Update documentation

---

## Success Criteria

**Clean Code = True when:**
- ✅ No test/demo files in production mobile/ directory
- ✅ Font sizes controlled 100% by CSS
- ✅ All magic numbers moved to config
- ✅ Every module is imported somewhere (no orphans)
- ✅ Single source of truth for every value
