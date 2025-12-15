# Week 2 Architecture Analysis

## Current State Assessment

**Renderer:** 2,164 lines  
**FocusRingView:** 796 lines (already extracted)  
**Target:** Move ~400 more lines to FocusRingView

## State Management Analysis

### Renderer State (Constructor, lines 29-72)

#### Critical Focus Ring State
```javascript
// DOM/state caches
this.elements = {};                          // ← Shared DOM elements
this.focusElements = new Map();              // ← Focus Ring element cache (DUPLICATE!)
this.positionCache = new Map();              // ← Not used in Focus Ring
this.leafStateCache = new Map();             // ← Not Focus Ring related

// Selection state
this.selectedFocusItem = null;               // ← Current selected item
this.currentFocusItems = [];                 // ← Items to display
this.activePath = [];                        // ← Breadcrumb path
this.activeType = null;                      // ← Not Focus Ring related

// Rotation/settling state
this.isRotating = false;                     // ← Touch rotation flag
this.settleTimeout = null;                   // ← Delay before showing children
this.allFocusItems = [];                     // ← Full item list (sprocket chain)
this.chainPosition = 0;                      // ← Not used
this.visibleStartIndex = 0;                  // ← Not used
this.visibleEndIndex = 0;                    // ← Not used
this.forceImmediateFocusSettlement = false;  // ← Navigation flag
this._lastFocusItemsKey = null;              // ← Change detection (DUPLICATE!)
```

#### FocusRingView State (Constructor, lines 10-16)
```javascript
this.renderer = renderer;                    // ← Back-reference
this.focusElements = new Map();              // ← DUPLICATE of renderer.focusElements!
this.positionCache = new Map();              // ← DUPLICATE of renderer.positionCache!
this.focusRingDebugAttached = false;         // ← FocusRingView-only
this._lastFocusItemsKey = null;              // ← DUPLICATE of renderer._lastFocusItemsKey!
this.lastRotationOffset = undefined;         // ← FocusRingView-only
```

## Critical Discovery: STATE DUPLICATION!

**Problem:** Renderer and FocusRingView BOTH maintain `focusElements` Maps!

**Evidence:**
1. Renderer constructor (line 47): `this.focusElements = new Map();`
2. FocusRingView constructor (line 11): `this.focusElements = new Map();`
3. Renderer uses: `this.focusElements` (lines 1013, 1119, 1141, etc.)
4. FocusRingView has its own but never uses renderer's!

**Impact:**
- Two separate Maps tracking the same elements
- Potential sync issues
- Memory waste
- Confusion about source of truth

## Dependency Analysis: updateFocusRingPositions()

### Method Location
- **Current:** `mobile-renderer.js` lines 951-1259 (309 lines)
- **Target:** Move to `FocusRingView` class

### Dependencies Breakdown

#### Read-Only Renderer State (Pass as parameters or keep reference)
```javascript
✓ this.elements.focusRingGroup          // DOM reference (via this.renderer)
✓ this.elements.childRingGroup          // For hiding during rotation
✓ this.elements.detailItemsGroup        // For hiding during rotation
✓ this.currentFocusItems                // Current items list
✓ this.allFocusItems                    // Full sprocket chain
✓ this.viewport                         // Viewport calculations
✓ this.forceImmediateFocusSettlement    // Navigation flag
✓ this.focusRingDebugFlag              // Debug logging
```

#### Modified Renderer State (Requires callbacks or delegation)
```javascript
⚠️ this.focusElements.set/get/clear()    // Map operations (MOVE to FocusRingView!)
⚠️ this.lastRotationOffset              // Rotation tracking (MOVE to FocusRingView!)
⚠️ this.protectedRotationOffset         // Protection period (NEW - check usage)
⚠️ this._lastFocusItemsKey              // Change detection (DUPLICATE - use FRV's!)
⚠️ this.isRotating                      // Rotation state (callback to renderer)
⚠️ this.settleTimeout                   // Timeout handle (callback to renderer)
⚠️ this.selectedFocusItem               // Selected item (callback via setSelectedFocusItem)
⚠️ this.activePath                      // Active path (callback via buildActivePath)
```

#### Method Calls to Renderer
```javascript
this.positionMagnifyingRing()           // Magnifier positioning
this.clearFanLines()                    // Clear fan lines
this.navigationView.clearParentLine()   // Clear parent line
this.buildActivePath(focusItem)         // Build breadcrumb
this.setSelectedFocusItem(focusItem)    // Update selection
this.updateParentButton(name, skip)     // Update parent button
this.showChildContentForFocusItem()     // Show child content
this.hideParentButton()                 // Hide parent button
this.calculateFocusPosition()           // Calculate position (MOVE to FRV!)
this.createFocusElement()               // Create element (MOVE to FRV!)
this.updateFocusElement()               // Update element (MOVE to FRV!)
this.getPreviousHierarchyLevel()        // Hierarchy navigation
this.getItemHierarchyLevel()            // Hierarchy navigation
this.getParentNameForLevel()            // Hierarchy navigation
this.focusRingDebug()                   // Debug logging
```

## Architecture Decision Matrix

### Option 1: Keep updateFocusRingPositions() in Renderer ❌
**Pros:**
- No refactoring needed
- State stays centralized

**Cons:**
- Renderer stays bloated (2,164 lines)
- Doesn't meet Week 2 goals
- Violates separation of concerns

### Option 2: Move to FocusRingView with Massive Coupling 🤔
**Pros:**
- Reduces renderer line count
- All Focus Ring logic in one place

**Cons:**
- FocusRingView needs to call many renderer methods
- Still tightly coupled via callbacks
- Risk of circular dependencies
- Hard to test independently

### Option 3: Extract State + Behavior to FocusRingView ✅ RECOMMENDED
**Approach:**
1. **Move duplicated state to FocusRingView:**
   - `focusElements` Map (eliminate duplicate)
   - `_lastFocusItemsKey` (eliminate duplicate)
   - `lastRotationOffset` (already in FRV!)
   - `positionCache` Map (eliminate duplicate)

2. **Move Focus Ring methods to FocusRingView:**
   - `updateFocusRingPositions()` (309 lines)
   - `createFocusElement()` (small)
   - `updateFocusElement()` (small)
   - `updateFocusItemText()` (104 lines)
   - `calculateFocusPosition()` (small)
   - `calculateFocusPositionBilingual()` (small)
   - `triggerFocusSettlement()` (52 lines)
   - `getSelectedFocusIndex()` (26 lines)

3. **Keep coordination callbacks in Renderer:**
   - Renderer provides callbacks for: `onFocusItemSelected()`, `onRotationStart()`, `onRotationEnd()`
   - FocusRingView calls callbacks at appropriate times
   - Clean separation: FRV handles rendering, Renderer coordinates behavior

4. **Pass immutable context object:**
   ```javascript
   const context = {
       currentFocusItems: this.currentFocusItems,
       allFocusItems: this.allFocusItems,
       forceImmediateSettle: this.forceImmediateFocusSettlement,
       elements: this.elements, // Read-only DOM references
       viewport: this.viewport
   };
   focusRingView.updatePositions(rotationOffset, context, callbacks);
   ```

**Pros:**
- ✅ Clean separation of concerns
- ✅ FocusRingView owns Focus Ring state
- ✅ Eliminates duplicate state (focusElements, _lastFocusItemsKey, positionCache)
- ✅ Testable: FRV can be tested with mock callbacks
- ✅ Reduces renderer by ~400 lines
- ✅ Clear ownership: FRV = rendering, Renderer = coordination

**Cons:**
- ⚠️ Requires careful state migration
- ⚠️ Must update all references to moved state
- ⚠️ Need thorough testing after migration

## Implementation Plan: Option 3

### Phase 1: Eliminate State Duplication (Safety First!)
**Goal:** Merge duplicate Maps, establish single source of truth

1. **Update FocusRingView to be authoritative for Focus Ring state:**
   ```javascript
   // Remove from Renderer:
   - this.focusElements
   - this._lastFocusItemsKey
   - this.positionCache (if unused elsewhere)
   
   // Access via FocusRingView:
   - this.focusRingView.focusElements
   - this.focusRingView._lastFocusItemsKey
   ```

2. **Search & replace all renderer references:**
   - `this.focusElements` → `this.focusRingView.focusElements`
   - `this._lastFocusItemsKey` → `this.focusRingView._lastFocusItemsKey`

3. **Test thoroughly:**
   - Verify Focus Ring rendering still works
   - Check rotation behavior
   - Confirm no duplicate DOM elements

**Estimated Changes:** ~30 find-replace operations  
**Risk:** LOW (mechanical replacement)  
**Lines Saved:** ~3 lines (state declarations)

### Phase 2: Move updateFocusRingPositions() Method
**Goal:** Transfer 309-line method to FocusRingView

1. **Add callback interface to FocusRingView:**
   ```javascript
   updatePositions(rotationOffset, context, callbacks) {
       // context = { currentFocusItems, allFocusItems, elements, viewport, ... }
       // callbacks = { onRotationStart, onRotationEnd, onItemSelected, ... }
   }
   ```

2. **Copy method body to FocusRingView:**
   - Replace `this.elements` with `context.elements`
   - Replace `this.currentFocusItems` with `context.currentFocusItems`
   - Replace method calls with callbacks
   - Keep FRV state references: `this.focusElements`, `this.lastRotationOffset`

3. **Update renderer to delegate:**
   ```javascript
   updateFocusRingPositions(rotationOffset) {
       const context = { /* ... */ };
       const callbacks = {
           onRotationStart: () => { /* hide child pyramid */ },
           onRotationEnd: () => { /* show child pyramid */ },
           onItemSelected: (item) => this.handleFocusItemSelected(item),
           buildActivePath: (item) => this.buildActivePath(item),
           // etc.
       };
       this.focusRingView.updatePositions(rotationOffset, context, callbacks);
   }
   ```

**Estimated Changes:** 1 large method move + delegation wrapper  
**Risk:** MEDIUM (complex logic, many dependencies)  
**Lines Saved:** ~300 lines from renderer

### Phase 3: Move Related Methods
**Goal:** Complete Focus Ring extraction

1. **Move to FocusRingView:**
   - `createFocusElement()` - already pure DOM
   - `updateFocusElement()` - already pure DOM
   - `updateFocusItemText()` - 104 lines of text rendering
   - `calculateFocusPosition()` - position math
   - `calculateFocusPositionBilingual()` - bilingual layout
   - `triggerFocusSettlement()` - settlement logic
   - `getSelectedFocusIndex()` - index calculation

2. **Update references in renderer:**
   - Create delegation wrappers or direct access via `this.focusRingView.*`

**Estimated Changes:** 7 method moves  
**Risk:** LOW (smaller, well-defined methods)  
**Lines Saved:** ~150 lines from renderer

### Phase 4: Testing & Validation
**Goal:** Ensure no regressions

1. **Manual testing:**
   - Load application
   - Test Focus Ring rotation
   - Verify selection behavior
   - Check Child Pyramid display
   - Test navigation between levels
   - Validate translation switching

2. **Verify no console errors:**
   - Check for undefined references
   - Confirm no DOM mismatch errors
   - Validate proper Map synchronization

**Risk:** LOW (thorough testing phase)

## Expected Results: Task 1 Complete

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Renderer Size** | 2,164 lines | ~1,750 lines | -414 lines |
| **FocusRingView Size** | 796 lines | ~1,210 lines | +414 lines |
| **State Duplication** | 3 duplicate Maps | 0 duplicates | ✅ Fixed |
| **Separation of Concerns** | Mixed | Clean | ✅ Improved |

## Risk Mitigation

### High-Risk Areas
1. **State access patterns:** Thorough grep to find all `this.focusElements` references
2. **Callback timing:** Ensure callbacks fire at correct lifecycle points
3. **DOM manipulation order:** Maintain correct element append/update sequence

### Safety Measures
1. **Granular commits:** Commit after each phase
2. **Version bumps:** 0.8.140 → 0.8.141 (Phase 1) → 0.8.142 (Phase 2) → etc.
3. **Testing checkpoints:** Test after each phase before proceeding
4. **Git tags:** Tag stable points for easy rollback

## Next Tasks After Task 1

Once Focus Ring extraction is complete:
- **Task 2:** AnimationCoordinator (~200 lines)
- **Task 3:** HierarchyNavigator (~150 lines)  
- **Task 4:** DataQueryHelper (~150 lines)

**Week 2 Target:** 1,500 lines (save 664 total)  
**Task 1 Progress:** 414 lines (62% of Week 2 goal!)

## Conclusion

**Recommendation:** Proceed with Option 3 (Extract State + Behavior)

**Why:**
- Eliminates technical debt (duplicate state)
- Clean architectural separation
- Achieves 62% of Week 2 goals in Task 1
- Reduces risk for subsequent tasks
- Testable and maintainable

**Start with:** Phase 1 (Eliminate State Duplication) - lowest risk, highest confidence builder.
