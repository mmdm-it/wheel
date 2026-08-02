# Design Clarifications - December 18, 2025 (v3 baseline)

> v3 delta tracking: This clarification set is copied from v2. Any v3-specific answers or reversals should be added as short "v3 delta" callouts adjacent to the affected questions (e.g., hub formula, radius formula, magnifier behavior) rather than replacing the v2 text.

## Critical Questions Answered

This document records the authoritative answers provided that resolved ambiguities in the v2 design specification.

---

## Question 1: Hub Position Formula

**Question**: Which Hub formula is correct?
- v1: `hubX = LSd - SSd/2, hubY = -(LSd/2)` from center origin
- v2: `hubX = (2×LSd)²/(8×SSd) + SSd/2, hubY = 0` from top-left origin

**Answer**: **The v2 formula is correct.** It shifts the origin from viewport center (v1) to upper-left corner (v2) while maintaining the same geometric relationships.

**Implication**: v2 uses web-standard coordinate system (top-left origin) correctly. All positioning calculations must use v2 formulas.

---

## Question 2: Focus Ring Radius Formula

**Question**: Which radius formula should be used?
- v1: `R = LSd` (simple formula, gives 667px for 375×667)
- v2: `R = SSd/2 + LSd²/(2×SSd)` (complex formula, gives 780.7px for 375×667)

**Answer**: **The more complex v2 formula is correct.** It accurately accounts for the coordinate system transformation from center-origin to top-left origin.

**Implication**: Focus Ring radius is NOT simply the long side dimension. The v2 formula must be used for correct positioning.

---

## Question 3: Magnifier Position

**Question**: How does the Magnifier work?
- Does it rotate with the Focus Ring?
- Does it have a fixed starting position?
- Where does Genesis "start"?

**Answer**: **The Magnifier position is fixed. It is the "lodestar".**

**Key Principles**:
1. Magnifier position is calculated once: `atan2(centerY - hubY, centerX - hubX)` ≈ 150.65° for iPhone SE
2. This screen position **stays fixed** - the Magnifier does not rotate
3. The Focus Ring **rotates around** the fixed Magnifier position
4. Different items pass through the Magnifier as the ring rotates

**Implication**: "The lodestar" is the central design metaphor - everything else moves around this fixed reference point.

---

## Question 4: Node Distribution - "Genesis Doesn't Start Anywhere"

**Question**: Where does Genesis (or any item) start on the Focus Ring?

**Answer**: **Genesis should not start anywhere.** Position is selection-driven, not fixed.

**How It Works**:

1. **Selection from Child Pyramid**: When user selects an item (e.g., Leviticus):
   - Leviticus **moves to the Magnifier** (the fixed lodestar)
   - Leviticus is **removed from the Focus Ring**
   - All other sibling items remain on Focus Ring

2. **Focus Ring Distribution**: Remaining items positioned relative to Magnifier:
   - Sorted by canonical order (sort_number)
   - Spaced by fixed 4.3° increments (π/42 radians)
   - Start from `magnifierAngle + NODE_SPACING`
   
3. **Example** (Leviticus selected):
   ```
   Magnifier (150.65°): Leviticus ← SELECTED
   Focus Ring nodes:
     Exodus:   150.65° + 4.3°  = 154.95° (1 node from Magnifier)
     Genesis:  150.65° + 8.6°  = 159.25° (2 nodes from Magnifier)
     Numbers:  150.65° + 12.9° = 163.55° (3 nodes from Magnifier)
   ```

4. **If Genesis Were Selected Instead**:
   ```
   Magnifier (150.65°): Genesis ← SELECTED
   Focus Ring nodes:
     Exodus:      150.65° + 4.3°  = 154.95°
     Leviticus:   150.65° + 8.6°  = 159.25°
     Numbers:     150.65° + 12.9° = 163.55°
   ```

**Implication**: No item has a fixed position. All positions depend on:
- Which item is currently selected (in Magnifier)
- The item's sort order relative to selected item
- The constitutional 4.3° spacing constant

---

## Design Philosophy Confirmed

> **"v1 code was very bad. v1 design was very good."**

This statement clarifies the v2 project goals:

1. **Preserve v1 Design Principles**:
   - Hub-centric coordinate system
   - Fixed angular spacing (4.3°)
   - Constitutional constants (arc ends at 180°)
   - Magnifier as lodestar concept
   - Selection-driven layout

2. **Modernize Code Architecture**:
   - Web-standard coordinate system (top-left origin)
   - ES6 modules and clean separation of concerns
   - Event-driven state management
   - Simplified formulas where possible WITHOUT changing geometry

3. **What Changed from v1 to v2**:
   - **Coordinate origin**: Center → top-left (web standard)
   - **Code structure**: Monolithic → modular
   - **Formula expression**: Adapted for new coordinate system
   
4. **What MUST NOT Change**:
   - Physical Hub position (same location, different coordinates)
   - Angular relationships (4.3° spacing, arc ending at 180°)
   - Magnifier as fixed lodestar
   - Selection-driven positioning model

---

## Impact on Current Implementation

### What Is Correct (v1.0.3)

✅ **Hub formula**: Using v2 authoritative formula correctly  
✅ **Radius formula**: Using v2 authoritative formula correctly  
✅ **Magnifier positioning**: Calculated correctly via atan2  
✅ **Selection filtering**: Selected item removed from Focus Ring  
✅ **Node spacing**: 4.3° constant applied correctly  
✅ **Visual styling**: Brown circles, perpendicular text, no strokes  

### What Is Missing (Phase 1 Requirements)

⚠️ **Rotation handler NOT IMPLEMENTED**:
- Magnifier should stay fixed while Focus Ring rotates
- User drag/swipe should rotate the entire ring
- Closest item should snap to Magnifier when rotation ends
- New item becomes selected, layout re-distributes

**This is required for Phase 1 completion** per original success criteria: "Smooth rotation with touch/mouse drag on Focus Ring"

### Next Steps

1. ✅ **Design Spec Complete** (this document + v2_DESIGN_SPEC.md v2.1)
2. **Implement Rotation Handler**:
   - Track rotation offset during drag
   - Apply offset to all node angles
   - Keep Magnifier position fixed
   - Snap-to-nearest on drag end
   - Update selection and re-render
3. **Test rotation** on multiple devices/viewports
4. **Validate** smooth 60fps performance
5. **Complete Phase 1**

---

## Terminology Confirmed

| Term | Definition | Usage |
|------|------------|-------|
| **Hub** | Constitutional rotational center at `(hubX, 0)` | Origin for all angular positioning |
| **Magnifier** | Fixed screen position displaying selected item | "The lodestar" - reference point |
| **Lodestar** | Metaphor for Magnifier's fixed, guiding position | Everything rotates around it |
| **Focus Ring** | Arc of sibling items at current hierarchy level | Rotates around Magnifier |
| **Selected Item** | Current item displayed in Magnifier | NOT on Focus Ring |
| **Node Spacing** | Constitutional 4.3° (π/42 radians) | Distance between adjacent nodes |
| **Sort Order** | Canonical sequence (sort_number) | Determines item sequence on ring |

---

## Mathematical Verification

### Hub Position Equivalence (375×667 Portrait)

**v1 Formula (center origin)**:
```
hubX = LSd - SSd/2 = 667 - 187.5 = 479.5 (from center)
hubY = -(LSd/2) = -333.5 (above center)

Absolute screen coordinates:
hubX_screen = 479.5 + (width/2) = 479.5 + 187.5 = 667
hubY_screen = -333.5 + (height/2) = -333.5 + 333.5 = 0
```

**v2 Formula (screen origin)**:
```
hubX = (2×LSd)²/(8×SSd) + SSd/2
     = (1334)²/(8×375) + 187.5
     = 1,778,224/3,000 + 187.5
     = 592.74 + 187.5
     = 780.24

hubY = 0
```

**Wait - these don't match!**
- v1 absolute: (667, 0)
- v2: (780.24, 0)

This discrepancy was noted in V1_V2_DESIGN_COMPARISON.md. The answer clarified that **v2 formula is correct**, suggesting either:
1. v1 formula had an error, OR
2. v1 used different LSd/SSd values, OR
3. The conversion wasn't straightforward

**Resolution**: Use v2 formula as authoritative. The v2 implementation will define the correct geometry going forward.

---

## Document Status

**Date**: December 18, 2025  
**Version**: 1.0  
**Related Documents**:
- `v2_DESIGN_SPEC.md` v2.1 (updated with authoritative answers)
- `V1_V2_DESIGN_COMPARISON.md` (comparison that prompted questions)
- `archive/DESIGNSPEC.md` (v1 archived specification)

**Signed Off By**: Project owner via answers to 4 critical questions

---
