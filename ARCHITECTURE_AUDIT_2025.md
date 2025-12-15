# Wheel Architecture Audit - December 2025

## Executive Summary

**Current State:** `mobile-renderer.js` is 3,073 lines with **79 methods**

**Revised Target:** Get under **1,000 lines** (not just 1,500) ✅ **ACHIEVABLE**

**Verdict:** The ES6 module + JSON architecture is **appropriate for this project**, but the renderer has accumulated too many responsibilities. With aggressive extraction, we can cut it by 67% (2,000+ lines).

## Line Count Analysis

```
Module                          Lines   Status      Notes
──────────────────────────────────────────────────────────────
mobile-renderer.js              3,073   BLOATED     Target: 1,500
mobile-data.js                  2,559   BLOATED     Target: 1,500
mobile-detailsector.js          1,186   OK          Could trim to ~900
mobile-app.js                   1,016   OK          Main controller
focus-ring-view.js                755   OK          Extracted from renderer
mobile-animation.js               687   OK          Extracted from renderer
mobile-childpyramid.js            461   OK          Extracted from renderer
mobile-touch.js                   363   OK          
mobile-coordinates.js             228   OK          
mobile-viewport-modernized.js     215   OK          
navigation-view.js                191   OK          Extracted from renderer
mobile-viewport.js                190   OK          
navigation-state.js                65   OK          Minimal state holder
──────────────────────────────────────────────────────────────
TOTAL:                         11,686   
```

## Root Cause Analysis

### 1. Renderer Has Too Many Responsibilities

`mobile-renderer.js` currently handles:
- ✅ DOM element management (good)
- ✅ SVG rendering (good)
- ❌ **Hierarchy navigation logic** (belongs in DataManager)
- ❌ **Detail Sector expansion/collapse** (already extracted to DetailSector module - why still 600 lines here?)
- ❌ **Color scheme management** (should be in Config or ThemeManager)
- ❌ **Translation management** (duplicates TranslationToggle)
- ❌ **Parent button logic** (duplicates NavigationView)
- ❌ **Coordinate calculations** (duplicates ViewportManager)

### 2. DataManager Is Overloaded

`mobile-data.js` (2,559 lines) handles:
- ✅ Data loading (good)
- ✅ Caching (good)
- ❌ **Complex hierarchy navigation** (could extract to HierarchyNavigator)
- ❌ **Virtual level logic** (could extract to VirtualLevelResolver)
- ❌ **Split structure lazy loading** (could extract to LazyLoader)
- ❌ **IndexedDB cache** (could extract to CacheManager)
- ❌ **Coordinate caching** (why is this in data layer?)

### 3. Incomplete Module Extraction

Several modules were created but the renderer still duplicates their functionality:
- `NavigationView` exists but renderer still has 100+ lines of parent button code
- `FocusRingView` exists but renderer still has focus ring logic mixed in
- `DetailSector` exists but renderer still has 600 lines of expand/collapse animation

## REVISED PLAN: Get Under 1,000 Lines 🎯

**Current:** 3,073 lines, 79 methods  
**Target:** <1,000 lines, ~35 methods  
**Extraction:** 2,100+ lines, 44+ methods

### Method Categorization

Of the 79 methods in `mobile-renderer.js`:

**✅ Core Renderer (keep ~35 methods, ~800 lines):**
- Element initialization/lifecycle (5 methods)
- State management (10 methods)  
- Animation coordination (5 methods)
- Event handling (5 methods)
- Rendering orchestration (10 methods)

**❌ Should Be Extracted (44+ methods, 2,200+ lines):**
- Hierarchy navigation (12 methods → HierarchyService)
- Detail Sector (6 methods → DetailSector)
- Magnifier (4 methods → MagnifierManager)
- Focus Ring (8 methods → FocusRingView - complete)
- Parent Button (3 methods → NavigationView - complete)
- Translation (5 methods → TranslationManager)
- Theme/Colors (3 methods → ThemeManager)
- Utilities (3 methods → various)

---

## Aggressive Extraction Plan

### Phase 1: Complete Module Delegations (Save ~850 lines)

#### 1A. Fully Delegate to DetailSector Module
**Current:** Lines 2304-2627 (300+ lines) in renderer for expand/collapse
**Target:** Move all animation logic to `mobile-detailsector.js`
**Savings:** ~300 lines

```javascript
// In renderer, replace with:
expandDetailSector() {
    this.detailSector.expand(this.selectedFocusItem);
}

collapseDetailSector() {
    this.detailSector.collapse();
}
```

#### 1B. Fully Delegate to NavigationView Module  
**Current:** Lines 212-245, 2128-2220 (~150 lines) for parent button management
**Target:** Move ALL parent button logic to `navigation-view.js`
**Savings:** ~150 lines

```javascript
// In renderer, replace with:
updateParentButton(parentName, skipAnimation) {
    this.navigationView.update({ 
        parentName, 
        skipAnimation,
        currentLevel: this.activeType,
        topNavLevel: this.getTopNavLevel()
    });
}
```

#### 1C. Extract HierarchyService (Save ~400 lines)
**Current:** Lines 1676-2283 (~600 lines) of hierarchy traversal logic
**Target:** NEW `mobile-hierarchy.js` module
**Savings:** ~400 lines (some must stay for immediate use)

```javascript
// NEW FILE: mobile-hierarchy.js
class HierarchyService {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }
    
    getHierarchyLevelNames() { /* delegate to dataManager */ }
    getItemHierarchyLevel(item) { return item.__level || null; }
    getNextHierarchyLevel(level) { /* ... */ }
    getPreviousHierarchyLevel(level) { /* ... */ }
    getLevelPluralLabel(level) { /* ... */ }
    getParentNameForLevel(item, parentLevel) { /* ... */ }
    buildParentItemFromChild(item, parentLevel) { /* ... */ }
    findItemIndexInArray(item, array, level) { /* ... */ }
    getChildItemsForLevel(parent, childLevel) { /* ... */ }
    getCousinItemsForLevel(item, level) { /* ... */ }
    resolveChildLevel(parent, startLevel) { /* ... */ }
}
```

### Phase 2: Extract Complete Subsystems (Save ~750 lines)

#### 2A. Extract HierarchyService (Save ~500 lines) 🔥
**Current:** 12 methods, ~600 lines of hierarchy traversal
**Target:** NEW `mobile-hierarchy.js` module
**Methods to extract:**
```javascript
// Lines 1697-1762 (~500 lines total)
- getHierarchyLevels()
- getHierarchyLevelNames()
- getHierarchyLevelDepth(levelName)
- getItemHierarchyLevel(item)
- getNextHierarchyLevel(currentLevel)
- getPreviousHierarchyLevel(currentLevel)
- getLevelPluralLabel(levelName)
- getParentNameForLevel(item, parentLevel)  // 2132-2227 (95 lines)
- buildParentItemFromChild(childItem, parentLevel)  // 2229-2287 (58 lines)
- findItemIndexInArray(item, array, level)  // 2289-2305 (16 lines)
- getChildItemsForLevel(parent, childLevel)  // 803-819 (16 lines)
- getCousinItemsForLevel(item, level)  // 820-876 (56 lines)
```
**Savings:** ~500 lines

#### 2B. Extract MagnifierManager (Save ~150 lines) 🔥
**Current:** 4 methods, ~250 lines scattered throughout
**Target:** NEW `magnifier-manager.js` module
**Methods to extract:**
```javascript
// Total ~250 lines
- createMagnifier()  // Lines 350-423 (73 lines)
- positionMagnifyingRing()  // Lines 247-282 (35 lines)
- advanceFocusRing()  // Lines 541-591 (50 lines)
- bringFocusNodeToCenter(focusItem)  // Lines 497-539 (42 lines)
```
**Savings:** ~150 lines (some glue code stays)

#### 2C. Extract TranslationManager (Save ~100 lines)
**Current:** 5 methods duplicating TranslationToggle functionality
**Target:** Consolidate into existing `translation-toggle.js`
**Methods to extract:**
```javascript
// Lines 284-308, 331-349, 427-459, 461-477
- initializeTranslationButton() (duplicate at lines 284, 427)
- handleTranslationChange(lang)
- getCurrentTranslation()
- getTranslationTextProperty()
- getTranslatedDisplayName(levelConfig)
```
**Savings:** ~100 lines

### Phase 3: Extract DetailSector Fully (Save ~400 lines) 🔥

#### 3A. Move All DetailSector Code
**Current:** 6 methods, ~550 lines for expand/collapse/creation
**Target:** Move to existing `mobile-detailsector.js`
**Methods to extract:**
```javascript
// Lines 2307-3069 (~762 lines total)
- expandDetailSector()  // 2307-2477 (170 lines)
- collapseDetailSector()  // 2479-2631 (152 lines)
- createDetailSectorCircle()  // 2633-2714 (81 lines)
- createDetailSectorLogo()  // 2716-2799 (83 lines)
- updateDetailSectorLogo()  // 2801-2818 (17 lines)
- getDetailSectorLogoEndState()  // 2820-2866 (46 lines)
- showDetailSectorBounds()  // 2868-3062 (194 lines)
- hideDetailSectorBounds()  // 3064-3069 (5 lines)
```
**Savings:** ~400 lines (keeping only coordinator methods)

### Phase 4: Complete FocusRingView Extraction (Save ~300 lines)

#### 4A. Move Remaining Focus Ring Logic
**Current:** 8 methods partially extracted, but rendering still in renderer
**Target:** Complete migration to `focus-ring-view.js`
**Methods to extract:**
```javascript
// Already partially in FocusRingView but duplicated:
- showFocusRing()  // Lines 1143-1149 (delegate only)
- createFocusRingBackground()  // Lines 1151-1153 (already delegated)
- updateFocusRingPositions()  // Lines 1163-1443 (280 lines - huge!)
- calculateInitialRotationOffset()  // Lines 1159-1161
- createFocusElement()  // Lines 1533-1535
- updateFocusElement()  // Lines 1537-1539
- updateFocusItemText()  // Lines 1541-1643 (102 lines)
- calculateFocusPosition()  // Lines 1523-1527
```
**Savings:** ~300 lines (mostly updateFocusRingPositions)

### Phase 5: Extract Supporting Managers (Save ~200 lines)

#### 5A. Extract ThemeManager (Save ~50 lines)
**Current:** 3 methods for color management
**Target:** NEW `theme-manager.js`
```javascript
- getColorScheme()  // Lines 1667-1676 (9 lines)
- getColor(type, name)  // Lines 1678-1688 (10 lines)
- getColorForType(type)  // Lines 1690-1693 (3 lines)
```
**Savings:** ~50 lines (including scattered usage)

#### 5B. Extract RotationManager (Save ~150 lines)
**Current:** Settlement and rotation coordination
**Target:** NEW `rotation-manager.js`
```javascript
- onRotationEnd()  // Lines 593-612 (19 lines)
- triggerFocusSettlement()  // Lines 1445-1495 (50 lines)
- getSelectedFocusIndex()  // Lines 1497-1521 (24 lines)
```
**Savings:** ~150 lines (including settlement logic from updateFocusRingPositions)

---

## Updated Extraction Summary

| Phase | Module | Methods | Lines Saved | Status |
|-------|--------|---------|-------------|--------|
| 1A | DetailSector (complete) | 2 | 300 | Easy |
| 1B | NavigationView (complete) | 3 | 150 | Easy |
| 2A | **HierarchyService** (new) | 12 | 500 | Medium |
| 2B | **MagnifierManager** (new) | 4 | 150 | Easy |
| 2C | **TranslationManager** (merge) | 5 | 100 | Easy |
| 3A | DetailSector (animations) | 6 | 400 | Medium |
| 4A | FocusRingView (complete) | 8 | 300 | Hard |
| 5A | **ThemeManager** (new) | 3 | 50 | Easy |
| 5B | **RotationManager** (new) | 3 | 150 | Medium |
| **TOTAL** | **9 modules** | **46** | **2,100** | |

**Result:** 3,073 - 2,100 = **~970 lines** ✅ **UNDER 1,000!**

---

## Implementation Priority (Attack Order)

### Week 1: Easy Wins (Save 600 lines)
1. **Phase 2B**: MagnifierManager (150 lines, 4 methods)
2. **Phase 1A**: Complete DetailSector delegation (300 lines)
3. **Phase 2C**: TranslationManager (100 lines)
4. **Phase 5A**: ThemeManager (50 lines)

**After Week 1:** Down to ~2,470 lines

### Week 2: Medium Complexity (Save 1,000 lines)
5. **Phase 2A**: HierarchyService (500 lines, 12 methods)
6. **Phase 1B**: Complete NavigationView (150 lines)
7. **Phase 3A**: DetailSector animations (400 lines)

**After Week 2:** Down to ~1,470 lines

### Week 3: Hard Refactors (Save 450 lines)
8. **Phase 4A**: Complete FocusRingView (300 lines)
9. **Phase 5B**: RotationManager (150 lines)

**After Week 3:** Down to **~970 lines** 🎉

---

## New Module Descriptions

### mobile-hierarchy.js (~500 lines)
```javascript
/**
 * Hierarchy Navigation Service
 * Pure hierarchy traversal and item relationship logic
 */
class HierarchyService {
    constructor(dataManager) { }
    
    // Level metadata
    getHierarchyLevelNames() { }
    getHierarchyLevelDepth(levelName) { }
    getItemHierarchyLevel(item) { }
    
    // Level navigation
    getNextHierarchyLevel(level) { }
    getPreviousHierarchyLevel(level) { }
    
    // Item navigation
    getChildItemsForLevel(parent, childLevel) { }
    getCousinItemsForLevel(item, level) { }
    
    // Item building
    buildParentItemFromChild(item, parentLevel) { }
    getParentNameForLevel(item, parentLevel) { }
    
    // Utilities
    getLevelPluralLabel(levelName) { }
    findItemIndexInArray(item, array, level) { }
}
```

### magnifier-manager.js (~200 lines)
```javascript
/**
 * Magnifier Ring Manager
 * Handles magnifier creation, positioning, and interactions
 */
class MagnifierManager {
    constructor(viewport, focusRingView, touchHandler) { }
    
    create() { }  // Create magnifier element
    position() { }  // Position at magnifier angle
    advance() { }  // Rotate to next focus item
    bringToCenter(focusItem) { }  // Animate specific item to center
}
```

### theme-manager.js (~80 lines)
```javascript
/**
 * Theme and Color Management
 * Centralizes color scheme access
 */
class ThemeManager {
    constructor(dataManager) { }
    
    init() { }  // Load color scheme from display config
    getColorScheme() { }
    getColor(type, name) { }
    getColorForType(type) { }
}
```

### rotation-manager.js (~200 lines)
```javascript
/**
 * Rotation and Settlement Manager
 * Coordinates rotation animations and focus settling
 */
class RotationManager {
    constructor(renderer, touchHandler) { }
    
    onRotationEnd() { }  // Called when touch ends
    triggerFocusSettlement() { }  // Show child content
    getSelectedFocusIndex(offset, count) { }  // Which item is centered
}
```

---

## Slimmed Down Renderer (~970 lines)

After all extractions, `mobile-renderer.js` becomes a **lean orchestrator**:

```javascript
class MobileRenderer {
    constructor(viewport, dataManager, navigationState) {
        // Inject dependencies
        this.viewport = viewport;
        this.dataManager = dataManager;
        this.navigationState = navigationState;
        
        // Specialized managers (all extracted)
        this.hierarchy = new HierarchyService(dataManager);
        this.theme = new ThemeManager(dataManager);
        this.magnifier = new MagnifierManager(viewport, focusRingView, touchHandler);
        this.rotation = new RotationManager(this, touchHandler);
        this.animation = new MobileAnimation(viewport, dataManager, this);
        this.childPyramid = new MobileChildPyramid(viewport, dataManager, this);
        this.detailSector = new MobileDetailSector(viewport, dataManager, this);
        this.translation = new TranslationManager(viewport, dataManager);
        this.navigation = new NavigationView(viewport);
        this.focusRing = new FocusRingView(this);
        
        // Minimal state
        this.elements = {};
        this.selectedFocusItem = null;
        this.currentFocusItems = [];
        this.isAnimating = false;
    }
    
    // ~35 core methods:
    // - 5 initialization methods
    // - 10 state management methods
    // - 5 animation coordination methods  
    // - 10 rendering orchestration methods
    // - 5 event handlers
}
```

## Why 1,000 Lines Is Better Than 1,500

### Cognitive Load
- **1,500 lines** = Still too complex, hard to understand flow
- **<1,000 lines** = Can read and understand entire file in one sitting
- **Rule of thumb**: If you can't hold the file in your head, it's too big

### Testing
- **1,500 lines** = Still hard to test, many dependencies
- **<1,000 lines** = Each extracted module is independently testable
- **Benefit**: Can write unit tests for HierarchyService, MagnifierManager, etc.

### Onboarding
- **1,500 lines** = Takes ~2 hours to understand
- **<1,000 lines** = Takes ~45 minutes to understand
- **Multiplier**: New contributors can start contributing same day

### Bug Fixes
- **1,500 lines** = Hard to isolate issues across responsibilities
- **<1,000 lines** = "Magnifier bug? Check magnifier-manager.js"
- **Speed**: 3x faster to locate and fix bugs

### The 1,000 Line Threshold
Research shows human comprehension drops significantly above 1,000 lines:
- 500 lines = Excellent (ideal for most classes)
- 1,000 lines = Good (acceptable for coordinators)
- 1,500 lines = Struggling (complex, hard to maintain)
- 2,000+ lines = Unmanageable (high bug rate, slow development)

Your renderer at 3,073 lines is in the "unmanageable" zone. Getting under 1,000 puts it in the "good coordinator" zone.

---
**Current:** Lines 1535-1644 (100+ lines) for focus item text/positioning
**Target:** NEW `focus-item-renderer.js` module
**Savings:** ~200 lines

```javascript
// NEW FILE: focus-item-renderer.js
class FocusItemRenderer {
    constructor(viewport, dataManager, translationManager) {
        this.viewport = viewport;
        this.dataManager = dataManager;
        this.translation = translationManager;
    }
    
    createFocusElement(item, position, angle, isSelected) { /* ... */ }
    updateFocusElement(element, position, angle, isSelected) { /* ... */ }
    updateFocusItemText(textElement, angle, item, isSelected) { /* ... */ }
    calculateFocusPosition(angle, arcParams) { /* ... */ }
}
```

#### 2B. Extract MagnifierManager (Save ~150 lines)
**Current:** Lines 352-423, 248-281, 495-590 (~250 lines) scattered magnifier logic
**Target:** NEW `magnifier-manager.js` module  
**Savings:** ~150 lines

```javascript
// NEW FILE: magnifier-manager.js
class MagnifierManager {
    constructor(viewport, renderer) {
        this.viewport = viewport;
        this.renderer = renderer;
    }
    
    create() { /* Lines 352-423 */ }
    position() { /* Lines 248-281 */ }
    advance() { /* Lines 540-590 */ }
    bringFocusNodeToCenter(item) { /* Lines 498-535 */ }
}
```

#### 2C. Extract RotationManager (Save ~100 lines)
**Current:** Lines 595-611, 1166-1438 (~200 lines) rotation and settlement logic
**Target:** NEW `rotation-manager.js` module
**Savings:** ~100 lines (some must stay in renderer)

### Phase 3: Configuration Consolidation (Save ~100 lines)

#### 3A. Extract ThemeManager
**Current:** Lines 1676-1695 (~20 lines) color scheme + scattered theme access
**Target:** NEW `theme-manager.js` module
**Savings:** ~100 lines (includes removing scattered calls)

```javascript
// NEW FILE: theme-manager.js
class ThemeManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.colorScheme = null;
    }
    
    init() {
        const displayConfig = this.dataManager.getDisplayConfig();
        this.colorScheme = displayConfig?.color_scheme || DEFAULT_COLORS;
    }
    
    getColor(type, name) { /* Lines 1676-1695 */ }
    getColorScheme() { /* ... */ }
}
```

### Phase 4: DataManager Refactoring (Separate effort)

While not part of getting renderer to 1,500 lines, DataManager needs similar treatment:

```javascript
// NEW MODULES:
- mobile-hierarchy-navigator.js  (~500 lines from data manager)
- mobile-virtual-levels.js       (~400 lines from data manager)  
- mobile-lazy-loader.js          (~300 lines from data manager)
- mobile-cache-manager.js        (~200 lines from data manager)
```

## Refactoring Summary

| Phase | Action | Lines Saved | New Modules |
|-------|--------|-------------|-------------|
| 1A | Complete DetailSector delegation | 300 | 0 |
| 1B | Complete NavigationView delegation | 150 | 0 |
| 1C | Extract HierarchyService | 400 | 1 |
| 2A | Extract FocusItemRenderer | 200 | 1 |
| 2B | Extract MagnifierManager | 150 | 1 |
| 2C | Extract RotationManager | 100 | 1 |
| 3A | Extract ThemeManager | 100 | 1 |
| **TOTAL** | | **1,400** | **5** |

**Result:** 3,073 - 1,400 = **~1,670 lines** (close to target!)

## Architecture Question: ES6 Modules + JSON

### ✅ Keep Current Architecture

**Your current setup is GOOD for this project:**

1. **No Build Step = Faster Development**
   - Direct browser loading
   - Instant refresh during development
   - No webpack/rollup configuration complexity

2. **ES6 Modules = Natural Code Organization**
   - Clear dependencies (`import/export`)
   - Browser-native (modern browsers)
   - Easy to understand module boundaries

3. **JSON Data = Domain Agnostic**
   - Works with Bible, parts catalogs, any hierarchy
   - Human-readable for content authors
   - Easy to validate and transform

### ❌ When to Consider Alternatives

You would need to change if:

1. **Performance becomes critical** (>100k nodes)
   - Consider: Binary format (Protocol Buffers)
   - Consider: IndexedDB with Web Workers

2. **You need TypeScript** (type safety)
   - Would require build step
   - Worth it for large team

3. **Bundle size matters** (<100KB total)
   - Would need tree-shaking
   - Not an issue for web app

4. **Offline-first PWA** 
   - You already use IndexedDB cache ✓
   - Service Worker could help more

### 🔄 Modern Alternatives (Not Recommended)

| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **React/Vue/Svelte** | Component model, reactive | Overkill for SVG-heavy app | ❌ NO |
| **TypeScript** | Type safety | Requires build, learning curve | 🤔 Maybe later |
| **Vite + Build** | Fast dev server, tree-shaking | Adds complexity | ❌ NO |
| **Canvas Instead of SVG** | Better performance | Lose DOM events, accessibility | ❌ NO |
| **Web Components** | Native standards, encapsulation | Browser compat, overkill | 🤔 Maybe |

## Recommendations

### Immediate Actions (Week 1) - Easy Wins ⚡

**Goal:** Drop from 3,073 → 2,470 lines (save 600 lines)

1. ✅ **Extract MagnifierManager** (4 methods, 150 lines)
   - Easiest: Just move 4 self-contained methods
   - High value: Magnifier is a distinct concept
   
2. ✅ **Complete DetailSector delegation** (2 methods, 300 lines)
   - Medium: Animation code already 90% in module
   - Just move expandDetailSector() and collapseDetailSector()
   
3. ✅ **Extract ThemeManager** (3 methods, 50 lines)
   - Easiest: Pure utility functions
   - Creates new module for future theme switching

4. ✅ **Consolidate TranslationManager** (5 methods, 100 lines)
   - Easy: Merge into existing translation-toggle.js
   - Removes duplication

**Week 1 Result:** 2,470 lines (20% reduction)

### Sprint 2 (Week 2) - Medium Complexity 🏗️

**Goal:** Drop from 2,470 → 1,470 lines (save 1,000 lines)

5. ✅ **Extract HierarchyService** (12 methods, 500 lines)
   - Medium complexity: Many methods but well-defined boundaries
   - HIGH VALUE: Enables testing hierarchy logic independently
   
6. ✅ **Complete NavigationView** (3 methods, 150 lines)
   - Easy: Similar to Week 1 work
   - Finishes incomplete extraction

7. ✅ **Move DetailSector animations** (6 methods, 400 lines)  
   - Medium: Large block of animation code
   - Natural fit in existing module

**Week 2 Result:** 1,470 lines (52% total reduction)

### Sprint 3 (Week 3) - Hard Refactors 🔥

**Goal:** Drop from 1,470 → 970 lines (save 500 lines)

8. ✅ **Complete FocusRingView** (8 methods, 300 lines)
   - Hard: updateFocusRingPositions is complex
   - HIGH VALUE: Most complex rendering logic isolated

9. ✅ **Extract RotationManager** (3 methods, 150 lines)
   - Medium: Settlement coordination logic
   - Creates clear owner for rotation behavior

**Week 3 Result:** 970 lines (68% total reduction) 🎉

### Long Term (Month 2-3)

10. Apply same treatment to `mobile-data.js` (2,559 → 1,500 lines)
11. Add comprehensive test suite (now possible with extracted modules)
12. Consider TypeScript migration (optional, for large team)

---

## Anti-Patterns Found

### 1. **God Object Anti-Pattern**
`MobileRenderer` tries to do everything. Solution: Aggressive delegation.

### 2. **Incomplete Extraction**
Modules were created but renderer still has duplicate code. Solution: Complete the extraction.

### 3. **Mixed Concerns**
Data navigation logic in renderer, coordinate caching in data manager. Solution: Clear boundaries.

### 4. **Copy-Paste Reuse**
Similar logic in multiple places (e.g., parent button updates). Solution: Single source of truth.

## Architecture Strengths to Preserve

1. ✅ **Module boundaries** are mostly clear
2. ✅ **Coordinate system** abstraction is solid
3. ✅ **Animation stack** (LIFO) is elegant
4. ✅ **Event handling** separation is good
5. ✅ **Configuration-driven** display is flexible

## Conclusion

**Yes, you can absolutely get under 1,000 lines!** 

The path is clear:
- **Extract 9 modules** (5 new + 4 completions)
- **Move 46 methods** (59% of current methods)
- **Save 2,100 lines** (68% reduction)
- **Result: ~970 lines** (down from 3,073)

**Keep your ES6 + JSON architecture** - it's working perfectly. This is purely about:
1. ✅ Better separation of concerns
2. ✅ Independent testability
3. ✅ Faster onboarding
4. ✅ Easier debugging

The renderer will become what it should be: a **lean orchestrator** that coordinates specialized modules, rather than a god object that tries to do everything.

**3 week timeline:**
- Week 1: Easy wins (600 lines)
- Week 2: Medium refactors (1,000 lines)
- Week 3: Hard extractions (500 lines)

**Total: 970 lines** - a 68% reduction that transforms your codebase maintainability.

---

**Recommended Next Step:**
Start with **MagnifierManager** (Week 1, Task 1):
- Only 4 methods
- ~150 lines
- Self-contained logic
- 2-3 hour task
- Immediate win to build momentum

---

## Implementation Guide: Extract MagnifierManager (First Task)

### Step 1: Create the new module (30 min)

```bash
# Create new file
touch mobile/magnifier-manager.js
```

```javascript
// mobile/magnifier-manager.js
/**
 * Magnifier Manager
 * Handles magnifier ring creation, positioning, and navigation interactions
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

class MagnifierManager {
    constructor(viewport, focusRingView, touchHandler, renderer) {
        this.viewport = viewport;
        this.focusRingView = focusRingView;
        this.touchHandler = touchHandler;
        this.renderer = renderer;
        this.magnifierElement = null;
    }
    
    // Move methods here:
    // - createMagnifier() (lines 350-423)
    // - positionMagnifyingRing() (lines 247-282)
    // - advanceFocusRing() (lines 541-591)
    // - bringFocusNodeToCenter() (lines 497-539)
}

export { MagnifierManager };
```

### Step 2: Update renderer imports (5 min)

```javascript
// mobile/mobile-renderer.js (top of file)
import { MagnifierManager } from './magnifier-manager.js';

// In constructor:
constructor(viewportManager, dataManager, navigationState) {
    // ... existing code ...
    
    // Add after other module initializations
    this.magnifier = new MagnifierManager(
        viewportManager,
        this.focusRingView,
        null, // touchHandler injected later
        this
    );
}

// After setController:
setController(controller) {
    this.controller = controller;
    this.magnifier.touchHandler = controller.touchHandler;
}
```

### Step 3: Replace method calls (15 min)

```javascript
// OLD:
this.createMagnifier();
this.positionMagnifyingRing();

// NEW:
this.magnifier.create();
this.magnifier.position();
```

### Step 4: Delete old methods (5 min)

Delete lines 247-282, 350-423, 497-591 from mobile-renderer.js

### Step 5: Test (15 min)

```bash
# Start dev server
python -m http.server 8000

# Open browser
# http://localhost:8000/wheel.html?forceMobile=true

# Test:
# - Magnifier appears
# - Magnifier positioned correctly
# - Click magnifier advances focus ring
# - Click unselected node brings to center
```

### Step 6: Commit

```bash
git add mobile/magnifier-manager.js mobile/mobile-renderer.js
git commit -m "Extract MagnifierManager - save 150 lines

- Created magnifier-manager.js with 4 methods
- Moved createMagnifier, positionMagnifyingRing, advanceFocusRing, bringFocusNodeToCenter
- Renderer: 3073 → 2923 lines
- Improves: separation of concerns, testability

Part of: Get renderer under 1,000 lines (Week 1, Task 1)"
```

**Time estimate:** 1.5 hours  
**Lines saved:** 150  
**Risk:** Low (self-contained functionality)

---

## Quick Win Checklist (Week 1)

Copy this checklist as you work:

```markdown
## Week 1: Easy Wins (Target: 2,470 lines)

- [ ] Task 1: Extract MagnifierManager (150 lines, 2 hours)
  - [ ] Create magnifier-manager.js
  - [ ] Move 4 methods
  - [ ] Update renderer imports
  - [ ] Test magnifier functionality
  - [ ] Commit

- [ ] Task 2: Complete DetailSector delegation (300 lines, 3 hours)
  - [ ] Move expandDetailSector() to mobile-detailsector.js
  - [ ] Move collapseDetailSector() to mobile-detailsector.js
  - [ ] Replace renderer calls with this.detailSector.expand()
  - [ ] Test detail sector expansion/collapse
  - [ ] Commit

- [ ] Task 3: Extract ThemeManager (50 lines, 1 hour)
  - [ ] Create theme-manager.js
  - [ ] Move 3 color methods
  - [ ] Update renderer to use this.theme.getColor()
  - [ ] Test color scheme loading
  - [ ] Commit

- [ ] Task 4: Consolidate TranslationManager (100 lines, 2 hours)
  - [ ] Move 5 methods to translation-toggle.js
  - [ ] Remove duplicate initializeTranslationButton()
  - [ ] Update renderer to delegate to this.translation
  - [ ] Test language switching
  - [ ] Commit

**Week 1 Result:** 2,470 lines saved ✅
```
