# Wheel v2 Design Specification (v3 baseline)
## Hub-Centric Coordinate System
**Version 2.1**

> v3 delta tracking: This v2 spec is the authoritative baseline for v3. When v3 introduces changes, add a short, explicit "v3 delta" note near the affected section instead of silent edits. Constitutional constants (lodestar magnifier, 4.3° spacing, arc ends at 180°, no inline styles/`!important`) remain in force unless a delta is documented.

> Filename note: We keep the v2 filename (`v2_DESIGN_SPEC.md`) as the baseline reference for v3 to avoid breaking links; v3 deltas live in `ARCHITECTURE_V3.md` and inline notes rather than renaming this file.

### Document Purpose
This specification defines the **authoritative v2 coordinate system** for the Wheel navigation interface. Unlike v1 (which used Nuc/center-based origin with center as (0,0)), v2 uses **screen top-left as origin (0,0)** following standard web conventions.

**Critical**: The v2 formulas are the **correct** formulas. They shift the coordinate origin from viewport center (v1) to upper-left corner (v2) while maintaining the same geometric relationships.

---

### Visual Affordance System

The interface uses a consistent visual logic to indicate interactivity:

- **Interactive elements** (1px black stroke): Child Pyramid nodes, Magnifier, Parent Button circle
- **Reference elements** (no stroke): Focus Ring nodes (informational, not directly clickable)
- **Magnifier Click**: Advances Focus Ring by one node clockwise (keyboard-free navigation)
- **Rule**: Stroke presence indicates clickability; absence indicates informational purpose only

**Phase 1 Status**: Focus Ring rotation via touch/mouse drag is primary interaction. Magnifier click advancement is Phase 2+.

---

## COORDINATE SYSTEM FUNDAMENTALS

### Screen Origin at Top-Left (0,0)
```
(0,0) ────────────────── +X (screen right)
  │
  │
  │
  │
 +Y (screen down)
```

**Characteristics:**
- **Origin**: Top-left corner of viewport at (0, 0)
- **X-Axis**: Positive right (increases left to right)
- **Y-Axis**: Positive down (increases top to bottom)
- **Standard Web**: Matches SVG, Canvas, CSS positioning
- **Units**: Pixels

---

## HUB DEFINITION AND FORMULA

### The Hub
The **Hub** is the constitutional rotational center of the Focus Ring arc, positioned off-screen (typically to the right and at the top edge of the screen in portrait mode).

### Constitutional Formula (v2) - AUTHORITATIVE

For a portrait-oriented viewport (height > width):

```javascript
// Portrait mode Hub position from screen origin (0,0)
const LSd = Math.max(viewportWidth, viewportHeight);  // Long side
const SSd = Math.min(viewportWidth, viewportHeight);  // Short side

hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2;
hubY = 0;  // At top edge of screen
```

**This is the CORRECT formula.** It translates v1's center-origin coordinate system to v2's top-left origin while maintaining the same geometric relationships.

**Key Relationships:**
- `hubX` equals the Focus Ring radius: `R = SSd/2 + LSd²/(2×SSd)`
- Hub sits at the **top edge** of the screen (`y = 0`)
- Hub is **off-screen to the right** (beyond viewport width)

### Example Calculation (375×667 Portrait)

```javascript
LSd = 667  // height (longer)
SSd = 375  // width (shorter)

hubX = (2 × 667)² / (8 × 375) + 375/2
     = 1,778,224 / 3,000 + 187.5
     = 592.741 + 187.5
     = 780.241 pixels

hubY = 0 pixels

// Focus Ring radius
R = 375/2 + 667²/(2×375)
  = 187.5 + 444,889/750
  = 187.5 + 593.185
  = 780.685 pixels

// Note: hubX ≈ R (constitutional design)
```

**This is the CORRECT radius formula.** More complex than v1's simple `R = LSd`, but accurately accounts for the coordinate system transformation.

**Hub Position**: `(780.2, 0)` - off-screen to the right, at top edge

---

## POLAR COORDINATE SYSTEM (Hub-Based)

### Hub as Polar Origin

The Hub serves as the origin for all angular measurements:

```
        270° (π × 1.5)
        12 o'clock
         │
         │
         │
─────────●─────────  0°/360° = 3 o'clock (0 radians)
       HUB  │
         │
        90° (π/2)
        6 o'clock
```

**Angle Conventions:**
- **0° = East = Right = 3 o'clock** (standard mathematical convention)
- **90° = South = Bottom = 6 o'clock**
- **180° = West = Left = 9 o'clock** (Focus Ring arc always ends here)
- **270° = North = Top = 12 o'clock**
- **Direction**: Clockwise rotation
- **Units**: Radians for Math.cos/sin

### Visible Angular Range (Aspect Ratio Dependent)

**The Focus Ring arc ALWAYS ends at 180° (9 o'clock)** but starts at different angles based on aspect ratio:

| Aspect Ratio | Start Angle | End Angle | Arc Length | Device Example |
|--------------|-------------|-----------|------------|----------------|
| 1:1 (Square) | 90° | 180° | 90° | Theoretical |
| 2.2:1 (iPhone) | ~120° | 180° | ~60° | iPhone 14 Pro |
| 2.4:1 (Fold) | ~125° | 180° | ~55° | Samsung Z Fold |
| 2.5:1 (Tall) | ~135° | 180° | ~45° | Tall Android |

**Critical Rule**: Narrower (taller) aspect ratios = narrower visible arc

---

## OFF-SCREEN ZONES (NEVER VISIBLE)

Understanding which angular ranges are off-screen is critical for proper positioning.

**As measured from Hub (0° = horizontal right = 3 o'clock):**

### Never Visible Zones
- **0° - 90°**: Area to the right of screen = **NEVER VISIBLE**
  - This is the 3 o'clock → 6 o'clock quadrant
  - Hub is positioned in this off-screen region
  
- **180° → 270° → 0° (wrapping)**: Area above and to the right of screen = **NEVER VISIBLE**
  - Continuous range from 9 o'clock through 12 o'clock to 3 o'clock
  - Passes through top of circle
  
### Visible Zone (Aspect Ratio Dependent)
- **Theoretical Maximum: 90° - 180°** (6 o'clock → 9 o'clock quadrant)
  - **Square Device (1:1)**: Full 90° - 180° range visible (90° arc)
  - **Portrait Devices**: Partial range visible, typically 110° - 180° to 130° - 180°
  - **Tall Portrait**: Even narrower range (e.g., 140° - 180° on very tall devices)

**CRITICAL RULE**: 
- Focus Ring arc **ALWAYS ends at 180°** (9 o'clock, left edge)
- Start angle varies by aspect ratio
- All interactive elements **MUST** be positioned within visible range

---

## THE MAGNIFIER: THE LODESTAR

### Magnifier as Fixed Reference Point

The **Magnifier** is the **lodestar** - a **fixed position on screen** that serves as the anchor point for the Focus Ring interface. It does not rotate; the Focus Ring rotates around it.

**Constitutional Principles:**

1. **Fixed Screen Position**: The Magnifier position is calculated once based on viewport geometry and remains fixed at that screen location
2. **Displays Selected Item**: The Magnifier always shows the currently selected item from the hierarchy
3. **Focus Ring Rotates Around It**: When user interacts with the Focus Ring, the entire ring rotates while the Magnifier stays fixed
4. **Angular Position**: Calculated as `atan2(centerY - hubY, centerX - hubX)` where center is viewport center

### Magnifier Position Calculation

```javascript
// Calculate Magnifier's fixed angle on the Focus Ring
const centerX = viewportWidth / 2;
const centerY = viewportHeight / 2;

const magnifierAngle = Math.atan2(centerY - hubY, centerX - hubX);

// Position Magnifier on Focus Ring at this angle
const magnifierX = hubX + radius * Math.cos(magnifierAngle);
const magnifierY = hubY + radius * Math.sin(magnifierAngle);

// Example for 375×667 viewport:
// centerX = 187.5, centerY = 333.5
// hubX = 780.2, hubY = 0
// magnifierAngle = atan2(333.5 - 0, 187.5 - 780.2)
//                = atan2(333.5, -592.7)
//                = 2.631 radians
//                = 150.65 degrees

// The Magnifier is positioned at ~150.65° (approximately 8 o'clock)
// and STAYS THERE as the Focus Ring rotates
```

### Selection-Driven Positioning Model

**How Items Appear in the Interface:**

1. **Selection from Child Pyramid**: When user selects an item (e.g., "Leviticus") from the Child Pyramid:
   - Leviticus **moves to the Magnifier** (the fixed lodestar position)
   - Leviticus becomes the "selected item" and is removed from the Focus Ring
   - All other sibling items distribute around the Focus Ring

2. **Focus Ring Distribution**: Remaining (non-selected) items are positioned on the Focus Ring:
   - Sorted by their canonical order (sort_number)
   - Distributed with **fixed angular spacing** of 4.3° (π/42 radians)
   - Genesis (if not selected) would appear at a position relative to the Magnifier
   - If Leviticus is selected (Magnifier), then Genesis is **2 nodes away** = 8.6° higher angle than Magnifier

3. **Example**: If Leviticus is selected:
   ```
   Magnifier (150.65°): Leviticus ← SELECTED, FIXED POSITION
   Focus Ring:
     - Exodus: 150.65° + 4.3° = 154.95°
     - Genesis: 150.65° + 8.6° = 159.25° (2 nodes from Magnifier)
     - Numbers: 150.65° + 12.9° = 163.55°
     - ... continues incrementing by 4.3° toward 180°
   ```

4. **"Genesis Doesn't Start Anywhere"**: Genesis (or any item) has no fixed starting position. Its position depends entirely on:
   - Which item is currently selected (in the Magnifier)
   - Its canonical sort order relative to the selected item
   - The fixed 4.3° spacing between nodes

### Rotation Behavior

When the user rotates the Focus Ring (via touch/swipe):

1. **Magnifier Position**: Remains **fixed** at its calculated screen position (~150.65° for iPhone SE)
2. **Focus Ring Rotates**: All Focus Ring nodes rotate clockwise or counter-clockwise around the Hub
3. **Items Pass Through Magnifier**: As the ring rotates, different items pass through the Magnifier position
4. **Selection Changes**: When rotation stops, the item closest to the Magnifier becomes the new selected item
5. **Re-distribution**: Interface updates to show new selected item in Magnifier, remaining items re-distributed on Focus Ring

**The Magnifier is the lodestar** - everything else moves around it.

---

## ROTATION MECHANICS

### How Rotation Works

**User Interaction**: Touch/mouse drag on Focus Ring initiates rotation

**Rotation State**:
```javascript
// Track cumulative rotation angle
let rotationOffset = 0;  // In radians, accumulates across gestures

// During drag
rotationOffset += deltaAngle;  // Add drag movement to offset

// Apply rotation to each node
focusRingItems.forEach((item, index) => {
    const baseAngle = magnifierAngle + ((index + 1) * NODE_SPACING);
    const rotatedAngle = baseAngle + rotationOffset;
    
    // Position at rotated angle
    const x = hubX + radius * Math.cos(rotatedAngle);
    const y = hubY + radius * Math.sin(rotatedAngle);
});
```

**Magnifier Behavior During Rotation**:
1. Magnifier **position stays fixed** at screen location (lodestar)
2. Magnifier **content changes** as different items rotate past it
3. When rotation stops, item closest to Magnifier angle becomes selected
4. Selected item "snaps" to Magnifier, others re-distribute

**Snap-to-Magnifier Logic**:
```javascript
// When rotation ends, find item closest to Magnifier
function snapToNearest(items, rotationOffset, magnifierAngle) {
    let closestItem = null;
    let smallestDiff = Infinity;
    
    items.forEach((item, index) => {
        const baseAngle = magnifierAngle + ((index + 1) * NODE_SPACING);
        const rotatedAngle = baseAngle + rotationOffset;
        const diff = Math.abs(rotatedAngle - magnifierAngle);
        
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestItem = item;
        }
    });
    
    // Select this item, reset rotation offset
    selectItem(closestItem);
    rotationOffset = 0;
}
```

**Visual Example** (Leviticus selected, user rotates clockwise):
```
Initial State:
  Magnifier (150.65°): Leviticus
  Node 1: Exodus (154.95°)
  Node 2: Genesis (159.25°)

User drags clockwise by ~10°:
  Magnifier (150.65°): Still displays Leviticus (content unchanged during drag)
  Node 1: Exodus (164.95°) ← moved away
  Node 2: Genesis (169.25°)
  
  But Genesis is now closest to Magnifier angle!

Drag ends:
  Magnifier (150.65°): Genesis ← NEW selection (snapped)
  Node 1: Exodus (154.95°) ← re-calculated from new reference
  Node 2: Leviticus (159.25°) ← formerly selected, now on ring
```

**Implementation Status**: Rotation handler NOT YET IMPLEMENTED (required for Phase 1 completion)

---

## ANIMATION SYSTEM (Phase 2+)

### Animation Timing Standards

**Universal Duration**: 600ms for all nzone migrations
- **IN migration**: Single 600ms phase for all animations
- **OUT migration**: Split into 300ms + 300ms phases

**Easing Function**: Ease-in-out (quadratic)
```javascript
const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
```

**Frame Rate**: `requestAnimationFrame` for smooth 60fps  
**State Blocking**: All user input blocked during animations via `isAnimating` flag

### IN Migration (Descending Hierarchy: Parent → Children)

**Trigger**: Child Pyramid node click  
**Duration**: 600ms total  
**Flow**: Child Pyramid → Focus Ring (with Detail Sector expansion for leaf items)

**Animation Sequence:**

1. **Magnifier Migration (0-600ms)**
   - Current magnified item (parent) animates from Magnifier to Parent Button position
   - Simultaneous fade-out during travel
   - Parent Button fades off-screen if moving beyond configured depth

2. **Sibling Migration (0-600ms, parallel)**
   - All Child Pyramid nodes (siblings of clicked item) animate to Focus Ring positions
   - Each node travels along calculated path from pyramid arc to focus arc
   - CSS transform-based animation for smooth motion
   - Focus Ring background band remains visible during animation

3. **Detail Sector Expansion (0-600ms, parallel - leaf items only)**
   - Triggered immediately on leaf item detection (`isLeafItem() === true`)
   - Animates from collapsed state (upper-right corner) to expanded state (Hub center)
   - Circle: radius 0.12×SSd → 0.98×radius
   - Opacity: 0.5 → configured detail_sector_opacity
   - Content display triggers after animation completes

**State Management:**
- `isAnimating` flag blocks all user input during 600ms
- `detailSectorAnimating` flag prevents duplicate expansions
- Focus Ring rebuilt with clicked item's siblings after animation completes

**Edge Cases:**
- **Single child**: Still animates to Focus Ring (no siblings to migrate)
- **Leaf item**: Detail Sector expands during animation
- **Non-leaf item**: Detail Sector remains collapsed

### OUT Migration (Ascending Hierarchy: Children → Parent)

**Trigger**: Parent Button click  
**Duration**: 600ms total (300ms + 300ms phases)  
**Flow**: Parent Button → Magnifier → Focus Ring sweep

**Animation Sequence:**

**Phase 1: Parent Button to Magnifier (0-300ms)**
- Parent Button item animates to Magnifier position
- Single node migration along calculated path
- CSS transform-based animation

**Phase 2: Sibling Sweep (300-600ms)**
- Parent's siblings populate Focus Ring in sequential sweep
- **Sweep Origin**: Magnifier position (where Parent Button item landed)
- **Sweep Direction**: 
  - **Bi-directional**: If Magnifier item is in middle of ring (sort_number 2 to n-1)
    - Nodes appear clockwise AND counterclockwise from origin simultaneously
    - Two sweep "fronts" move in opposite directions
  - **Uni-directional**: If Magnifier item is at ring boundary
    - sort_number = 1: Sweep only clockwise
    - sort_number = last: Sweep only counterclockwise
- **Animation**: Nodes instantly pop visible (opacity 0→1) as sweep reaches their position
- **Timing**: Staggered based on angular distance from Magnifier
- **Legacy**: Based on original desktop version's manufacturer ring sweep

**Phase 3: Detail Sector Collapse (0-600ms, parallel)**
- Starts immediately on Parent Button click (if Detail Sector is expanded)
- Runs full 600ms in parallel with both migration phases
- Animates from expanded state (Hub center) to collapsed state (upper-right corner)
- Circle: radius 0.98×radius → 0.12×SSd
- Opacity: configured detail_sector_opacity → 0.5
- Content hidden immediately before collapse animation starts

**State Management:**
- `isAnimating` flag blocks all user input during full 600ms
- `detailSectorAnimating` flag prevents duplicate collapses
- Focus Ring rebuilt with parent's siblings after Phase 1 completes (300ms)
- Sweep animation populates visible nodes during Phase 2 (300-600ms)

**Edge Cases:**
- **Only child (no siblings)**: 300ms Parent Button → Magnifier, skip Phase 2 sweep
- **First position**: 300ms migration + 300ms one-directional sweep (clockwise only)
- **Last position**: 300ms migration + 300ms one-directional sweep (counterclockwise only)
- **Middle position**: 300ms migration + 300ms bi-directional sweep
- **Detail Sector collapsed**: Skip collapse animation, only perform migration

**Sweep Algorithm:**
```javascript
// Simplified sweep logic
const magnifierIndex = findItemIndex(parentButtonItem, siblings);
const isFirst = magnifierIndex === 0;
const isLast = magnifierIndex === siblings.length - 1;

if (!isFirst && !isLast) {
    // Bi-directional sweep from magnifier position
    sweepClockwise(magnifierIndex, siblings.length - 1);
    sweepCounterClockwise(magnifierIndex - 1, 0);
} else if (isFirst) {
    // Uni-directional clockwise from position 0
    sweepClockwise(0, siblings.length - 1);
} else if (isLast) {
    // Uni-directional counterclockwise from last position
    sweepCounterClockwise(siblings.length - 1, 0);
}
```

**Implementation Status**: Phase 2+ feature, not required for Phase 1 completion

---

## POSITIONING CALCULATIONS

### Polar to Cartesian Conversion

**Universal Pattern** (Hub origin to screen coordinates):

```javascript
// Given: angle (radians), radius (pixels)
// Hub position: (hubX, hubY)

// Calculate screen position
const x = hubX + radius * Math.cos(angle);
const y = hubY + radius * Math.sin(angle);

// Result: (x, y) in screen coordinates from top-left origin
```

### Focus Ring Node Positioning

```javascript
// Example: Position node at 150° on Focus Ring
const angle = 150 * (Math.PI / 180);  // Convert to radians
const radius = 780.7;  // Focus Ring radius
const hubX = 780.2;
const hubY = 0;

const nodeX = hubX + radius * Math.cos(angle);
const nodeY = hubY + radius * Math.sin(angle);

// Calculate:
// nodeX = 780.2 + 780.7 × cos(150°)
//       = 780.2 + 780.7 × (-0.866)
//       = 780.2 - 676.1
//       = 104.1 pixels (visible, left side of screen)

// nodeY = 0 + 780.7 × sin(150°)
//       = 0 + 780.7 × 0.5
//       = 390.35 pixels (visible, middle of screen height)
```

---

## FOCUS RING ITEM ORDERING - SELECTION-DRIVEN POSITIONING

### Critical Understanding: Selected Item in Magnifier

**The Focus Ring displays items RELATIVE TO THE SELECTED ITEM:**

- **Selected Item**: Appears in Magnifier (NOT on Focus Ring arc)
- **Remaining Items**: Distributed BELOW (CCW from) Magnifier
- **No Items Above**: Nothing appears CW from (above) the Magnifier
- **Visual Flow**: Items flow downward from Magnifier position

### Sorting Order Example (Genesis Selected)

When Genesis (sort_number: 1) is selected:

```javascript
// Genesis is in Magnifier at ~150° (8 o'clock position)
Magnifier: Genesis (sort_number: 1)     ← 150° (SELECTED, not on arc)

// Remaining books appear BELOW magnifier
Exodus (sort_number: 2)                 ← 145.7° (magnifier - 4.3°)
Leviticus (sort_number: 3)              ← 141.4° (magnifier - 8.6°)
Numbers (sort_number: 4)                ← 137.1° (magnifier - 12.9°)
Deuteronomy (sort_number: 5)            ← 132.8° (magnifier - 17.2°)
...continues decreasing (CCW, toward 6 o'clock)
```

### Why This Matters

**Selection-Driven Layout**:
- Selected item ALWAYS in Magnifier (fixed screen position ~150°)
- Next items appear BELOW in sorted order
- Visual progression flows downward (CCW, decreasing angles)
- "Genesis doesn't start anywhere" - position depends on what's selected

**Sorted Items** (have `sort_number` property):
- Array sorted by `sort_number` ascending (1, 2, 3...)
- Selected item (e.g., Genesis) shown in Magnifier
- Remaining items (Exodus, Leviticus...) appear below
- Each item positioned at magnifier angle - (index × 4.3°)

### Implementation Rule

When positioning sorted items on the Focus Ring:

1. **Sort the items array** by `sort_number` (ascending: 1, 2, 3...)
2. **Identify selected item** (e.g., Genesis at index 0)
3. **Display selected in Magnifier** at fixed position (~150°)
4. **Distribute remaining items BELOW** starting at magnifier angle - 4.3°
5. **Decrement angles** by NODE_SPACING (4.3°) for each subsequent item

### Angular Progression Direction

**Correct Pattern** (Genesis selected):
```
Magnifier: 150° (Genesis, selected) ← IN MAGNIFIER
↓ Subtract NODE_SPACING (4.3°)
145.7° (Exodus, first visible on arc)
↓ Subtract NODE_SPACING
141.4° (Leviticus, second visible)
↓ Subtract NODE_SPACING
137.1° (Numbers, third visible)
...continues toward smaller angles (CCW)
```

**Wrong Pattern** (avoid):
```
180° (Genesis) ← Wrong! Genesis should be in Magnifier, not at arc end
175.7° (Exodus) ← Wrong! No items should appear above selected
```

### Code Implementation Location

- **File**: `src/view/focus-ring-view.js`
- **Method**: `positionNodes()` (to be implemented)
- **Current Status**: Data is sorted by `sort_number` in `main.js` but positioning logic not yet implemented

---

## ANGULAR RANGE CALCULATIONS

### Calculate Visible Arc Range

```javascript
// For portrait viewport
const LSd = Math.max(width, height);
const SSd = Math.min(width, height);

// Hub position
const hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2;
const hubY = 0;

// Focus Ring radius
const radius = SSd / 2 + (LSd ** 2) / (2 * SSd);

// Calculate angle to bottom-left corner (start of arc)
const cornerX = 0;
const cornerY = height;
const startAngle = Math.atan2(cornerY - hubY, cornerX - hubX);

// Arc always ends at 180° (9 o'clock)
const endAngle = Math.PI;  // 180° in radians

// Visible arc length
const arcLength = endAngle - startAngle;  // radians

// Example for 375×667:
// startAngle = atan2(667 - 0, 0 - 780.2)
//            = atan2(667, -780.2)
//            = 2.436 radians
//            = 139.6°
// 
// Visible arc: 139.6° to 180° = 40.4° arc
```

---

## COORDINATE SYSTEM COMPARISON

### v1 (Archived) vs v2 (Current - Authoritative)

| Aspect | v1 (Nuc-Centered) | v2 (Screen Origin) ✅ CORRECT |
|--------|-------------------|-------------------|
| **Origin** | Viewport center (Nuc) | Screen top-left corner |
| **Origin Coordinates** | (0, 0) at center | (0, 0) at top-left |
| **Y-Axis Direction** | Negative up, positive down | Positive down only |
| **Hub Formula** | `LSd - SSd/2, -(LSd/2)` from center | `(2×LSd)²/(8×SSd) + SSd/2, 0` from top-left |
| **Hub X (375×667)** | 479.5 (from center) → 667 abs | 780.2 (from top-left, correct) |
| **Hub Y (375×667)** | -333.5 (above center) → 0 abs | 0 (at top edge, correct) |
| **Radius Formula** | `R = LSd` (simple, 667px) | `R = SSd/2 + LSd²/(2×SSd)` (correct, 780.7px) |
| **Nuc Concept** | Central reference point | Eliminated (not needed) |
| **Complexity** | Dual perspectives needed | Single perspective |
| **Web Standards** | Non-standard | Standard SVG/Canvas |
| **Status** | Archived, design good but code bad | Active, authoritative |

**Key Insight**: The v2 formulas produce the **same geometric Hub position** as v1, but expressed in screen-origin coordinates instead of center-origin. The Hub is in the same physical location; the formulas differ because the coordinate system origin changed.

**Migration Impact**: All v1 positioning calculations must be rewritten for v2 coordinate system, but the underlying geometry remains faithful to v1 design principles.

---

## IMPLEMENTATION GUIDE

### 1. Calculate Hub Position

```javascript
class FocusRingGeometry {
    constructor(viewportWidth, viewportHeight) {
        const LSd = Math.max(viewportWidth, viewportHeight);
        const SSd = Math.min(viewportWidth, viewportHeight);
        
        // v2 Hub formula
        this.hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2;
        this.hubY = 0;  // At top edge
        
        // Focus Ring radius
        this.radius = SSd / 2 + (LSd ** 2) / (2 * SSd);
    }
}
```

### 2. Calculate Angular Range

```javascript
calculateVisibleRange(viewportWidth, viewportHeight) {
    // Start angle: to bottom-left corner
    const startAngle = Math.atan2(
        viewportHeight - this.hubY,
        0 - this.hubX
    );
    
    // End angle: always 180° (9 o'clock, left edge)
    const endAngle = Math.PI;
    
    return { startAngle, endAngle };
}
```

### 3. Position Nodes on Arc

```javascript
// CORRECT: Selection-driven distribution
// Selected item is in Magnifier, remaining items distributed on Focus Ring

distributeNodes(sortedItems, selectedItem, magnifierAngle) {
    // Remove selected item from Focus Ring
    const focusRingItems = sortedItems.filter(item => item.id !== selectedItem.id);
    
    // Fixed node spacing (constitutional constant)
    const NODE_SPACING = Math.PI / 42;  // 4.3 degrees in radians
    
    // Distribute nodes starting from one spacing after Magnifier
    // Incrementing toward 180° (9 o'clock, left edge)
    return focusRingItems.map((item, index) => {
        const angle = magnifierAngle + ((index + 1) * NODE_SPACING);
        
        return {
            item,
            angle,
            x: this.hubX + this.radius * Math.cos(angle),
            y: this.hubY + this.radius * Math.sin(angle)
        };
    });
}

// Example: Leviticus selected, Magnifier at 150.65°
// Focus Ring nodes:
//   Exodus:   150.65° + 4.3°  = 154.95°
//   Genesis:  150.65° + 8.6°  = 159.25° (2 nodes from Magnifier)
//   Numbers:  150.65° + 12.9° = 163.55°
//   Deuteronomy: 150.65° + 17.2° = 167.85°
//   ... continues toward 180°
```

**Key Principles:**
1. **Selected item NOT on Focus Ring** - it's in the Magnifier
2. **Sort order maintained** - items appear in canonical sequence
3. **Fixed spacing** - 4.3° between adjacent nodes (constitutional constant)
4. **Direction** - nodes increment clockwise from Magnifier toward 180°

---

## NAVIGATION ZONES

### Focus Ring Arc
- **Angular Range**: Aspect-ratio dependent, ending at 180°
- **Radius**: `R = SSd/2 + LSd²/(2×SSd)` (authoritative v2 formula)
- **Origin**: Hub at `(hubX, 0)`
- **Purpose**: Rotational traversal of sibling items at current hierarchy level
- **Content**: All sibling items EXCEPT the currently selected item (which is in Magnifier)
- **Spacing**: Fixed 4.3° (π/42 radians) between adjacent nodes

### The Magnifier (Lodestar)
- **Position**: Fixed at `atan2(centerY - hubY, centerX - hubX)` ≈ 150.65° for iPhone SE
- **Radius**: Same as Focus Ring (positioned ON the ring)
- **Origin**: Hub at `(hubX, 0)`
- **Purpose**: Display currently selected item at fixed, prominent position
- **Behavior**: Stays fixed while Focus Ring rotates around it
- **Size**: Circle 30% larger than Focus Ring nodes, font matches
- **Style**: Same brown color as nodes, black text, no stroke

### Child Pyramid
- **Angular Range**: Same as Focus Ring (shares visible range)
- **Radii**: Three concentric arcs at 85%, 70%, 55% of Focus Ring radius
- **Origin**: Hub at `(hubX, 0)`
- **Purpose**: Display child items of the currently selected item (Magnifier item)
- **Interaction**: Selecting a child moves it to the Magnifier
- **Capacity**: 19 total nodes (8 + 7 + 4) - sufficient for New Testament Epistles
- **Spacing**: 8° between nodes (constitutional constant)
- **Geometry**: Right triangle with curved arc as hypotenuse
- **Aspect Ratio Impact**: Triangle shape changes from near-equilateral (square) to very acute (tall portrait)

**Implementation Note**: Child Pyramid has the most complex spatial geometry due to aspect-ratio-dependent triangular positioning. Detailed algorithms maintained in implementation files.

### Parent Button
- **Position**: Lower-left corner (Cartesian coordinates)
- **Coordinates**: `(margin, viewportHeight - margin)`
- **Fixed**: Not Hub-based, simple screen position
- **Purpose**: Navigation to parent level

### Detail Sector
- **Center**: Hub position `(hubX, hubY)`
- **Radius**: 98% of Focus Ring radius when expanded
- **Purpose**: Display leaf item details
- **Content Positioning**: Relative to Hub center

---

## ANGLE REFERENCE TABLE

**From Hub Perspective** (0° = East = Right = 3 o'clock):

| Clock | Degrees | Radians | Screen Position | Visibility |
|-------|---------|---------|-----------------|------------|
| 3:00 | 0° | 0 | Right of screen | ❌ Never visible |
| 4:30 | 45° | π/4 | Right of screen | ❌ Never visible |
| 6:00 | 90° | π/2 | Bottom edge | ⚠️ Square only |
| 7:00 | 120° | 2π/3 | Lower-left | ✅ Typical portrait start |
| 7:30 | 135° | 3π/4 | Lower-left | ✅ Visible |
| 8:00 | 150° | 5π/6 | Left side | ✅ Visible |
| 9:00 | 180° | π | Left edge | ✅ Arc always ends here |
| 10:00 | 210° | 7π/6 | Upper-left | ❌ Never visible |
| 12:00 | 270° | 3π/2 | Top edge | ❌ Never visible |

**Key Insight**: For 375×667 portrait, visible range is approximately 140° to 180° (40° arc).

---

## NODE SPACING CONSTANT

### Constitutional 4.3° Spacing

**Fixed Angular Spacing**: The distance between adjacent nodes on the Focus Ring is a **constitutional constant**:

```javascript
const NODE_SPACING = Math.PI / 42;  // 4.3 degrees in radians
// Approximately 0.0749 radians = 4.29 degrees
```

**Why This Constant?**
- Provides consistent visual rhythm across all viewports
- Ensures nodes don't overlap or appear too sparse
- Inherited from v1 design (proven good design principle)
- Independent of viewport size or aspect ratio

**Application**:
```javascript
// Position nodes relative to Magnifier
focusRingItems.forEach((item, index) => {
    const angle = magnifierAngle + ((index + 1) * NODE_SPACING);
    // First node: magnifierAngle + 4.3°
    // Second node: magnifierAngle + 8.6°
    // Third node: magnifierAngle + 12.9°
    // etc.
});
```

**Example (Leviticus selected, Magnifier at 150.65°)**:
| Position | Item | Angle Calculation | Angle | Visual Position |
|----------|------|-------------------|-------|-----------------|
| Magnifier | Leviticus | (selected) | 150.65° | Fixed (lodestar) |
| Node 1 | Exodus | 150.65° + 4.3° | 154.95° | After Magnifier |
| Node 2 | Genesis | 150.65° + 8.6° | 159.25° | 2 nodes from Magnifier |
| Node 3 | Numbers | 150.65° + 12.9° | 163.55° | Continuing CW |
| Node 4 | Deuteronomy | 150.65° + 17.2° | 167.85° | Toward 180° |

**Note**: Node distribution continues until reaching the visible range limit (~180° for most viewports).

---

## TERMINOLOGY STANDARDS

### Correct Directional Terms

**Radial Direction (Hierarchy Navigation)**:
- **OUT**: Movement from Focus Ring toward Parent Button (ascending hierarchy to parent level)
- **IN**: Movement from Child Pyramid toward Focus Ring (descending hierarchy to children)
- **CW** (Clockwise): Rotation increasing angle (moving toward 180° from smaller angles)
- **CCW** (Counter-Clockwise): Rotation decreasing angle (moving away from 180° toward smaller angles)

**Angular Position**:
- **Clock Positions**: Use clock face analogy (3:00, 6:00, 9:00, 12:00)
- **Degrees**: Measured from Hub (0° = 3 o'clock, 90° = 6 o'clock, 180° = 9 o'clock, 270° = 12 o'clock)

### Incorrect Terms - AVOID THESE

❌ **UP/DOWN** - Ambiguous (screen up ≠ hierarchy up)  
❌ **TOP/BOTTOM** - Use specific clock position (e.g., "9 o'clock" or "near 180°")  
❌ **LEFT/RIGHT** - Use "9 o'clock" / "3 o'clock" instead  
❌ **ABOVE/BELOW** - Use radial terms (IN/OUT) or angular positions

### Examples of Correct Usage

```javascript
// ✅ CORRECT
migrateNodeOUT();      // Navigate to parent level
migrateNodeIN();       // Navigate to child level
rotateCW();            // Rotate clockwise
positionAt180();       // Position at 180° (9 o'clock, left edge)
centerAngle = 150°;    // Magnifier at 150° (approximately 8 o'clock)

// ❌ INCORRECT  
moveUp();              // Ambiguous - screen up or hierarchy up?
navigateDown();        // Ambiguous
positionAtTop();       // Which top? Visual top or hierarchical top?
leftEdge();            // Use "9 o'clock" or "180°"
```

### Component Naming

- **Focus Ring**: Arc-based navigation zone for sibling items (rotational traversal)
- **Child Pyramid**: Three-arc concentric display for IN migration (child items)
- **Parent Button**: Single button for OUT migration (parent level)
- **Detail Sector**: Expanded circle for leaf item display
- **Magnifier**: Fixed position indicator (the "lodestar") showing selected item
- **Hub**: Off-screen rotational center for all polar calculations
- **Nuc** (v1 only): Viewport center at (0,0) - eliminated in v2

### Hierarchy Terms

- **Level**: A configured depth in the hierarchy (testament, book, chapter, verse)
- **Item**: A data node at any level
- **Leaf**: Terminal item with no children (displays in Detail Sector)
- **Sibling**: Items at same hierarchy level sharing same parent
- **Selected Item**: Item currently displayed in Magnifier
- **sort_number**: Property defining canonical ordering of items

---

## DEBUGGING AND VALIDATION

### Visual Verification

```javascript
// Add debug circle at Hub position
function debugDrawHub(svg, hubX, hubY) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', hubX);
    circle.setAttribute('cy', hubY);
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', 'red');
    circle.setAttribute('opacity', '0.5');
    svg.appendChild(circle);
}

// Verify nodes are visible
function validateNodePosition(x, y, width, height) {
    const visible = x >= 0 && x <= width && y >= 0 && y <= height;
    console.log(`Node at (${x.toFixed(1)}, ${y.toFixed(1)}): ${visible ? '✅' : '❌'}`);
    return visible;
}
```

### Common Positioning Errors

1. **Selected Item on Focus Ring**: Showing selected item both in Magnifier AND on Focus Ring
   - **Fix**: Filter selected item from Focus Ring: `items.filter(item => item.id !== selectedItem.id)`

2. **Wrong Node Spacing**: Using variable spacing or wrong constant
   - **Fix**: Use constitutional constant: `NODE_SPACING = Math.PI / 42` (4.3°)

3. **Starting at Wrong Angle**: Nodes starting at Magnifier position or wrong reference
   - **Fix**: Start at `magnifierAngle + NODE_SPACING` (one spacing after Magnifier)

4. **Magnifier Rotates**: Magnifier moving when Focus Ring rotates
   - **Fix**: Magnifier is the lodestar - calculate once, keep fixed during rotation

5. **Wrong Radius Formula**: Using simple `R = LSd` from v1
   - **Fix**: Use v2 authoritative formula: `R = SSd/2 + LSd²/(2×SSd)`

6. **Wrong Hub Position Formula**: Using v1's center-origin formula
   - **Fix**: Use v2 formula: `hubX = (2×LSd)²/(8×SSd) + SSd/2, hubY = 0`

7. **Off-Screen Nodes**: Nodes positioned outside visible viewport
   - **Fix**: Ensure nodes stop before exceeding ~180° or visible arc limit

---

## DEVELOPMENT GUIDELINES

### New Feature Checklist

Before implementing new visual features:

- [ ] Identify coordinate system needed (screen-origin Cartesian vs Hub-based Polar)
- [ ] Verify angle range (must be within aspect-ratio-dependent visible range)
- [ ] Check aspect ratio impact (test square + portrait + tall portrait)
- [ ] Use dynamic Magnifier angle calculation (don't hardcode ~150°)
- [ ] Convert radians ↔ degrees appropriately for Math functions
- [ ] Test on device with different aspect ratio
- [ ] Confirm elements positioned within 90° - 180° visible zone
- [ ] Validate that Focus Ring arc ends at 180° (9 o'clock)

### Code Review Questions

When reviewing positioning code, ask:

1. **Coordinate System**: Is this screen-origin Cartesian or Hub-based Polar?
2. **Angle Units**: Degrees or radians? (Math.cos/sin require radians)
3. **Visible Range**: Is this within the aspect-ratio-dependent visible range (90° - 180°)?
4. **Dynamic Center**: Using calculated Magnifier angle or hardcoded value?
5. **Aspect Ratio**: Tested on square (1:1), portrait (2.2:1), and tall portrait (2.5:1)?
6. **Conversion**: Polar → Cartesian done correctly? `x = hubX + r*cos(θ), y = hubY + r*sin(θ)`
7. **Hub Position**: Using v2 authoritative formula correctly?

### Debugging Positioning Issues

```javascript
// Add these logs to troubleshoot positioning
console.log(`Angle: ${angle} rad = ${(angle * 180/Math.PI).toFixed(1)}°`);
console.log(`Position: (${x.toFixed(1)}, ${y.toFixed(1)}) from Hub (${hubX.toFixed(1)}, ${hubY})`);
console.log(`Magnifier angle: ${(magnifierAngle * 180/Math.PI).toFixed(1)}°`);
console.log(`Visible range: ${(startAngle * 180/Math.PI).toFixed(1)}° → 180°`);
console.log(`Viewport: ${viewportWidth}×${viewportHeight} (${(viewportHeight/viewportWidth).toFixed(2)}:1)`);
console.log(`Hub: (${hubX.toFixed(1)}, ${hubY}) | Radius: ${radius.toFixed(1)}px`);
```

### Common Implementation Patterns

**Pattern 1: Position item on Focus Ring**
```javascript
// 1. Calculate angle for item
const angle = magnifierAngle + ((index + 1) * NODE_SPACING);

// 2. Convert to screen coordinates
const x = hubX + radius * Math.cos(angle);
const y = hubY + radius * Math.sin(angle);

// 3. Create SVG element at (x, y)
element.setAttribute('cx', x);
element.setAttribute('cy', y);
```

**Pattern 2: Calculate Magnifier position**
```javascript
// 1. Get viewport center
const centerX = viewportWidth / 2;
const centerY = viewportHeight / 2;

// 2. Calculate angle from Hub to center
const magnifierAngle = Math.atan2(centerY - hubY, centerX - hubX);

// 3. Position Magnifier on Focus Ring at this angle
const magnifierX = hubX + radius * Math.cos(magnifierAngle);
const magnifierY = hubY + radius * Math.sin(magnifierAngle);
```

**Pattern 3: Validate visibility**
```javascript
// Check if angle is in visible range
function isVisible(angle) {
    const angleDeg = angle * (180 / Math.PI);
    // Visible range typically 90° - 180° (aspect-ratio dependent)
    return angleDeg >= 90 && angleDeg <= 180;
}
```

---

## TERMINOLOGY STANDARDS

### Spatial Terms
- **Hub**: Constitutional rotational center at `(hubX, 0)`
- **Screen Origin**: Top-left corner at `(0, 0)`
- **Focus Ring**: Arc-based navigation zone for current hierarchy level
- **Arc Range**: Angular span from start angle to 180° (9 o'clock)
- **Aspect Ratio**: Height/width ratio (portrait > 1, square = 1)

### Directional Terms (Hierarchy Navigation)
- **IN**: Radial movement toward Hub (descending hierarchy to children)
- **OUT**: Radial movement away from Hub (ascending hierarchy to parent)
- **CW** (Clockwise): Increasing angle (moving toward 180°)
- **CCW** (Counter-Clockwise): Decreasing angle (moving away from 180°)

### Avoid Ambiguous Terms
- ❌ **UP/DOWN**: Confuses screen direction with hierarchy direction
- ❌ **TOP/BOTTOM**: Use clock positions instead (e.g., "9 o'clock")
- ✅ **LEFT/RIGHT**: Acceptable for screen positions
- ✅ **CLOCK POSITIONS**: Clear and unambiguous (e.g., "7:30 position")

---

## DEVELOPMENT CHECKLIST

Before implementing Hub-based positioning:

- [ ] Calculate Hub position using v2 authoritative formula: `hubX = (2×LSd)²/(8×SSd) + SSd/2, hubY = 0`
- [ ] Verify Hub is off-screen (hubX > viewportWidth)
- [ ] Verify Hub at top edge (hubY = 0)
- [ ] Calculate Focus Ring radius using v2 formula: `R = SSd/2 + LSd²/(2×SSd)`
- [ ] Calculate Magnifier position (the lodestar): `atan2(centerY - hubY, centerX - hubX)`
- [ ] Calculate visible arc range (to bottom-left corner → 180°)
- [ ] Filter out selected item from Focus Ring (it goes in Magnifier)
- [ ] Distribute remaining nodes with 4.3° spacing starting from Magnifier + NODE_SPACING
- [ ] Convert polar (angle, radius) to Cartesian (x, y) using Hub as origin
- [ ] Validate all nodes are visible on screen
- [ ] Implement rotation handler: Magnifier fixed, Focus Ring rotates
- [ ] Test on multiple aspect ratios (square, portrait, tall portrait)

**Phase 1 Requirements** (Current Focus):
- ✅ Hub-centric coordinate system
- ✅ Magnifier as lodestar (fixed position)
- ✅ Selection-driven layout (selected item in Magnifier)
- ✅ Focus Ring node distribution with 4.3° spacing
- ⚠️ **Rotation handler NOT YET IMPLEMENTED**

---

## CONSTITUTIONAL PRINCIPLES

1. **Hub is The Origin**: All rotational positioning originates from Hub at `(hubX, 0)`
2. **Screen Top-Left is (0,0)**: Standard web coordinate system (v2 uses this correctly)
3. **Arc Ends at 180°**: Constitutional constant, regardless of aspect ratio
4. **hubX = Radius**: By design, Hub X-coordinate equals Focus Ring radius
5. **hubY = 0**: Hub always at top edge of screen in portrait mode
6. **Aspect Ratio Determines Start**: Taller viewports = narrower visible arc
7. **No Nuc Concept**: Eliminated for simplicity; Hub is the only reference point
8. **Magnifier is the Lodestar**: Fixed screen position calculated from viewport geometry
9. **Selection-Driven Layout**: Selected item in Magnifier, siblings distributed on Focus Ring
10. **Fixed Node Spacing**: 4.3° (π/42 radians) between adjacent Focus Ring nodes
11. **v2 Formulas Are Authoritative**: Hub and radius formulas correctly transform v1's center-origin to v2's top-left origin

---

## VERSION HISTORY

**v2.1** (December 18, 2025)
- Clarified that v2 formulas are **authoritative and correct**
- Added "The Magnifier: The Lodestar" section explaining fixed Magnifier position
- Documented selection-driven positioning model (selected item in Magnifier, siblings on Focus Ring)
- Clarified rotation behavior: Magnifier fixed, Focus Ring rotates around it
- Updated constitutional principles with Magnifier and selection concepts
- Emphasized: "Genesis doesn't start anywhere" - position depends on what's selected
- **Added from v1 DESIGNSPEC**:
  - Visual Affordance System (stroke = interactive)
  - Off-screen zones (0°-90° never visible, 180°-270°-0° never visible)
  - Animation System specifications (IN/OUT migrations, 600ms, easing, sweep algorithms)
  - Enhanced Child Pyramid details (19 nodes, 8° spacing, triangular geometry)
  - Terminology Standards (IN/OUT, avoid UP/DOWN, clock positions)
  - Development Guidelines (feature checklist, code review questions, implementation patterns)
  - Debugging section (common patterns, visibility validation)

**v2.0** (December 17, 2025)
- Initial v2 specification
- Hub-centric coordinate system with screen origin at top-left
- Eliminated Nuc concept from v1
- Constitutional Hub formula for web-standard coordinates
- Complete angle reference tables and examples

---

## RELATED DOCUMENTS

- `archive/DESIGNSPEC.md`: v1 specification (Nuc-based, archived)
- `wheel-v2/src/geometry/focus-ring-geometry.js`: Implementation
- `README.md`: Project overview
- `ARCHITECTURE.md`: System architecture

**Document Version**: 2.0  
**Last Updated**: December 17, 2025  
**Status**: Active (v2 implementation in progress)
