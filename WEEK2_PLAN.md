# Week 2 Refactoring Plan

## Starting Point
- **Current Size:** 2,164 lines (down from 3,073)
- **Week 1 Achievement:** 909 lines saved (29.6% reduction)
- **Week 2 Target:** 1,500 lines (save another 664 lines, 30.7% reduction)
- **Ultimate Goal:** Under 1,000 lines

## Largest Methods Analysis

Top 10 largest methods identified:
1. `updateFocusRingPositions()` - **309 lines** (Focus Ring rendering)
2. `continueChildPyramidClick()` - **175 lines** (Animation coordination)
3. `updateFocusItemText()` - **104 lines** (Text rendering)
4. `getParentNameForLevel()` - **97 lines** (Hierarchy navigation)
5. `getCousinItemsForLevel()` - **94 lines** (Data queries)
6. `showChildContentForFocusItem()` - **92 lines** (Content display)
7. `computeLoopInOutDebugFlag()` - **86 lines** (Debug logic)
8. `handleChildPyramidClick()` - **83 lines** (Click handling)
9. `resolveChildLevel()` - **65 lines** (Hierarchy logic)
10. `buildParentItemFromChild()` - **60 lines** (Data construction)

## Week 2 Tasks

### Task 1: Extract FocusRingManager (Priority: HIGH)
**Target Savings:** ~400 lines

**Methods to Extract:**
- `updateFocusRingPositions()` (309 lines) - Main Focus Ring rendering logic
- `createFocusElement()` (small)
- `updateFocusElement()` (small)
- `updateFocusItemText()` (104 lines) - Text rendering
- `calculateFocusPosition()` (small)
- `calculateFocusPositionBilingual()` (small)
- `triggerFocusSettlement()` (52 lines)
- `getSelectedFocusIndex()` (26 lines)

**Rationale:**
- Focus Ring is already partially extracted to `FocusRingView`
- Major rendering logic still in renderer
- Clear boundary: all Focus Ring DOM manipulation
- High impact: 400+ lines in single coherent module

**Architecture:**
- Enhance existing `focus-ring-view.js` module
- Move all Focus Ring positioning/rendering logic
- Renderer delegates to `this.focusRingView`

### Task 2: Extract AnimationCoordinator (Priority: HIGH)
**Target Savings:** ~200 lines

**Methods to Extract:**
- `continueChildPyramidClick()` (175 lines) - Complex animation orchestration
- `handleChildPyramidClick()` (83 lines) - Click → animation pipeline
- `animateNodeToMagnifier()` (small)
- `animateMagnifierToParentButton()` (small)
- `animateSiblingsToFocusRing()` (small)
- `animateFocusRingToChildPyramid()` (small)

**Rationale:**
- Animation logic is complex coordination
- `MobileAnimation` module exists but doesn't handle full pipeline
- Clear separation: animation orchestration vs business logic
- Reduces cognitive load in renderer

**Architecture:**
- Create `animation-coordinator.js` module
- Handles multi-step animation sequences
- Renderer calls high-level methods like `coordinator.handlePyramidClick()`

### Task 3: Extract HierarchyNavigator (Priority: MEDIUM)
**Target Savings:** ~150 lines

**Methods to Extract:**
- `getParentNameForLevel()` (97 lines)
- `buildParentItemFromChild()` (60 lines)
- `resolveChildLevel()` (65 lines)
- `getHierarchyLevelDepth()` (small)
- `getItemHierarchyLevel()` (small)
- `getNextHierarchyLevel()` (small)
- `getPreviousHierarchyLevel()` (24 lines)

**Rationale:**
- Hierarchy navigation is independent domain logic
- No direct DOM manipulation
- Pure data structure traversal
- Highly testable when extracted

**Architecture:**
- Create `hierarchy-navigator.js` module
- Handles all hierarchy level calculations
- Returns structured data to renderer

### Task 4: Extract DataQueryHelper (Priority: MEDIUM)
**Target Savings:** ~150 lines

**Methods to Extract:**
- `getCousinItemsForLevel()` (94 lines)
- `getChildItemsForLevel()` (17 lines)
- `getTopLevelItems()` (39 lines)
- `findItemIndexInArray()` (18 lines)
- `validateSortNumbers()` (small)
- `showSortNumberError()` (29 lines)

**Rationale:**
- Data queries are separate from rendering
- No DOM dependencies
- Can be optimized independently
- Better error handling when isolated

**Architecture:**
- Create `data-query-helper.js` module
- Centralizes all data fetching logic
- Caching and validation in one place

## Expected Results

| Metric | Week 1 End | Week 2 Target | Improvement |
|--------|------------|---------------|-------------|
| **Renderer Size** | 2,164 lines | ~1,500 lines | -664 lines (30.7%) |
| **Total Reduction** | 909 lines | 1,573 lines | 51.2% from start |
| **Modules Created** | 7 modules | +4 modules | 11 total |

## Success Criteria

1. ✅ Renderer under 1,500 lines
2. ✅ No functional regressions
3. ✅ All tests pass (manual testing)
4. ✅ Clean module boundaries
5. ✅ Improved code organization
6. ✅ Version bumps for each task

## Risk Assessment

**Low Risk:**
- Task 3 (HierarchyNavigator): Pure functions, no DOM
- Task 4 (DataQueryHelper): Data access only

**Medium Risk:**
- Task 1 (FocusRingManager): Complex rendering logic
- Task 2 (AnimationCoordinator): Multi-step animations

**Mitigation:**
- Test thoroughly after each extraction
- Use existing test-data-manager.html for validation
- Keep git commits granular for easy rollback

## Next Steps After Week 2

If Week 2 completes successfully (renderer at ~1,500 lines):

**Week 3 Candidates:**
- Extract EventHandlers (~100 lines)
- Extract CoordinateCalculations (~100 lines)
- Extract ParentButtonManager (~80 lines)
- Consolidate remaining small utilities (~100 lines)

**Target:** Under 1,200 lines by end of Week 3
**Ultimate Goal:** Under 1,000 lines (coordinator pattern)
