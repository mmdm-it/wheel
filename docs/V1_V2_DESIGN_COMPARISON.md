# Wheel Design Comparison: v1 vs v2
## What We're Keeping, What We're Changing, and Why

**Date**: December 18, 2025  
**Purpose**: Ensure v2 preserves all critical v1 design principles while modernizing architecture

---

## EXECUTIVE SUMMARY

### What We're Keeping (Design & UI)
✅ **Hub-based polar coordinate system** - The mathematical foundation  
✅ **Constitutional Hub formula** - The geometric relationship  
✅ **Arc always ends at 180° (9 o'clock)** - The visual constant  
✅ **Aspect-ratio-dependent visible range** - The responsive design  
✅ **Magnifier at dynamic center angle** - The UX pattern  
✅ **4.3° node spacing** - The proven visual rhythm  
✅ **Focus Ring rotation** - The core interaction model  
✅ **Child Pyramid radial positioning** - The hierarchy navigation  
✅ **nzone migration animations** - The spatial continuity  

### What We're Changing (Architecture & Code)
🔄 **Coordinate origin**: Nuc-centered → Screen top-left  
🔄 **Modular ES6 architecture**: Monolithic → Separation of concerns  
🔄 **State management**: Ad-hoc → Event-driven observable pattern  
🔄 **File structure**: Single files → Organized modules  

### What We're NOT Changing (Critical Design Loss Risk)
⚠️ **Node positioning relative to Magnifier** - NEEDS REVIEW  
⚠️ **Sorted items at arc "top" (180°)** - NEEDS IMPLEMENTATION  
⚠️ **Rotation offset calculations** - NEEDS VERIFICATION  
⚠️ **Sweep animations for OUT migration** - NOT YET IMPLEMENTED  

---

## COORDINATE SYSTEM ANALYSIS

### The Origin Change: WHY?

**v1 Approach** (Nuc-Centered):
- Origin at viewport center (Nuc)
- Hub calculated relative to center
- Required dual perspective (Nuc vs Hub)
- Negative coordinates for upper-left quadrant

**v2 Approach** (Screen Top-Left):
- Origin at (0, 0) top-left corner
- Hub calculated from screen origin
- Single perspective (all from screen)
- Standard web conventions

**CRITICAL INSIGHT**: This is a **coordinate transformation ONLY**. The Hub position relative to the viewport is IDENTICAL in both systems. We're just measuring from a different origin point.

**Formula Equivalence**:
```javascript
// v1 (from center):
hubX_v1 = LSd - (SSd / 2)        // 479.5 from center for 375×667
hubY_v1 = -(LSd / 2)             // -333.5 from center

// v2 (from top-left):
hubX_v2 = (2×LSd)²/(8×SSd) + SSd/2   // 780.2 from top-left
hubY_v2 = 0                           // 0 from top-left

// These describe THE SAME PHYSICAL POSITION:
// hubX_v1 + centerX = hubX_v2
// hubY_v1 + centerY = hubY_v2
// 479.5 + 187.5 = 667... WAIT, THIS DOESN'T MATCH!
```

**⚠️ CRITICAL PROBLEM IDENTIFIED**: The v2 Hub formula is DIFFERENT from v1! This is NOT just a coordinate transformation!

---

## HUB FORMULA VERIFICATION

### v1 Hub Position (375×667 Portrait)
```javascript
LSd = 667  // max(375, 667) = height
SSd = 375  // min(375, 667) = width

// From v1 DESIGNSPEC (Nuc-centered)
hubX = LSd - (SSd / 2)
     = 667 - 187.5
     = 479.5 pixels (from center)

hubY = -(LSd / 2)
     = -333.5 pixels (from center)

// Convert to screen coordinates (center is at 187.5, 333.5):
hubX_screen = 479.5 + 187.5 = 667 pixels
hubY_screen = -333.5 + 333.5 = 0 pixels

// v1 Hub position from top-left: (667, 0)
```

### v2 Hub Position (375×667 Portrait)
```javascript
LSd = 667
SSd = 375

// From v2 DESIGNSPEC (screen origin)
hubX = (2 × LSd)² / (8 × SSd) + SSd / 2
     = (2 × 667)² / (8 × 375) + 187.5
     = 1,778,224 / 3,000 + 187.5
     = 592.74 + 187.5
     = 780.24 pixels

hubY = 0 pixels

// v2 Hub position from top-left: (780.2, 0)
```

### ⚠️ DISCREPANCY IDENTIFIED

**v1 Hub**: (667, 0) from screen top-left  
**v2 Hub**: (780, 0) from screen top-left  

**These are DIFFERENT positions!** The v2 formula is placing the Hub ~113 pixels further to the right than v1.

---

## FOCUS RING RADIUS VERIFICATION

### v1 Radius
```javascript
// v1 DESIGNSPEC states: "Focus Ring radius: Always equals LSd"
radius_v1 = LSd = 667 pixels
```

### v2 Radius
```javascript
// v2 formula
radius_v2 = SSd/2 + LSd²/(2×SSd)
          = 187.5 + 444,889/750
          = 187.5 + 593.19
          = 780.69 pixels
```

### ⚠️ SECOND DISCREPANCY

**v1 Radius**: 667 pixels  
**v2 Radius**: 780.7 pixels  

**WHY THE DIFFERENCE?**

Looking at v1 DESIGNSPEC more carefully:
> "**Focus Ring radius**: Always equals LSd (ensuring proper geometry)"

But the v2 formula gives a DIFFERENT radius. This needs investigation.

---

## THE CONSTITUTIONAL QUESTION

### v1 Constitution (From DESIGNSPEC Section 2.1)

```javascript
// Portrait Mode Formula
hubX = LSd - (SSd / 2)
hubY = LSd / 2

// SVG Y-down conversion
hubY = -(LSd / 2)
```

This is SIMPLE and CLEAR:
- Hub X = one LSd minus half SSd from center
- Hub Y = half LSd above center

### v2 Constitution (Current Implementation)

```javascript
// From focus-ring-geometry.js
hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2
hubY = 0
```

This is COMPLEX. Where did this formula come from?

---

## CRITICAL QUESTIONS FOR USER

1. **Hub Formula Source**: Where did the v2 formula `(2×LSd)²/(8×SSd) + SSd/2` come from? Is this from:
   - A mathematical derivation you did?
   - A different section of v1 code?
   - A redesign for v2?

2. **Radius Definition**: Should the Focus Ring radius equal LSd (v1) or use the formula SSd/2 + LSd²/(2×SSd) (v2)?

3. **Physical Position**: Should the Hub be at:
   - (667, 0) - matching v1's LSd formula
   - (780, 0) - matching v2's complex formula
   - Something else entirely?

4. **Node Distribution**: In v1, section 3.1 describes:
   - First sorted item (Genesis) at GREATEST angle (closest to 180°)
   - Subsequent items at progressively SMALLER angles
   - This means nodes flow AWAY from 180° toward the Magnifier

   In v2, we currently:
   - Start nodes AFTER Magnifier angle
   - Increment toward 180°
   - This is the OPPOSITE direction

   **Which is correct for v2?**

---

## ROTATION LOGIC (CRITICAL DESIGN ELEMENT)

### v1 Behavior (From DESIGNSPEC 3.1)
```
Magnifier at ~145° (dynamic center)
Genesis (sort_number: 1) at 178° (near 180°, visual "top")
Exodus (sort_number: 2) at 175°
Leviticus (sort_number: 3) at 172°
...flowing toward Magnifier
```

**When user rotates CW** (increasing angle):
- Genesis rotates from 178° → 179° → 180° → disappears off left edge
- Exodus moves up to take Genesis's place near 180°
- New items appear from lower angles

### v2 Current Behavior
```
Magnifier at ~150.65° (dynamic center)
Genesis EXCLUDED (in Magnifier)
Exodus (first node) at 154.95° (after Magnifier)
Leviticus at 159.24°
...progressing toward 180°
```

**When user rotates CW**:
- ??? (not yet implemented)

### The Design Question

Does the Focus Ring rotate **with** the Magnifier (Magnifier stays at fixed screen position, nodes rotate past it), or does it rotate **independently** (nodes stay at fixed angles, Magnifier moves)?

**v1 Answer**: Focus Ring rotates, Magnifier stays at dynamic center angle. Nodes appear/disappear as they cross into/out of visible range.

**v2 Answer**: ??? (needs clarification)

---

## WHAT NEEDS TO HAPPEN NOW

### Immediate Actions

1. **Verify Hub Formula**: Confirm which formula is correct for v2
2. **Verify Radius Formula**: Confirm Focus Ring radius calculation
3. **Implement Rotation**: Add rotation handler to match v1 behavior
4. **Fix Node Distribution**: Implement sorted-items-at-180° logic from v1
5. **Document Design Decisions**: Explain ANY differences from v1

### Questions for User

Please clarify:
1. Should v2 use the simple v1 Hub formula or the complex v2 formula?
2. Should Focus Ring radius = LSd or use the v2 formula?
3. How should nodes be distributed relative to the Magnifier?
4. Should rotation work the same as v1?

---

## PHILOSOPHY: CODE vs DESIGN

### What This Analysis Reveals

**We ARE rebuilding the code** (good):
- Modular architecture ✅
- ES6 classes ✅
- Separation of concerns ✅
- Clean file structure ✅

**But we MIGHT be changing the design** (bad):
- Different Hub position? ⚠️
- Different radius? ⚠️
- Different node distribution? ⚠️
- Different rotation behavior? ⚠️

### The User Is Right

> "v1 code was very bad. v1 design was very good."

We need to preserve:
- The Hub-centric polar geometry
- The rotation interaction model
- The node spacing and distribution
- The animation patterns
- The visual rhythm

While modernizing:
- The code architecture
- The module structure
- The state management
- The rendering approach

---

## NEXT STEPS

1. **USER INPUT**: Get clarification on formula discrepancies
2. **Design Document**: Update v2 spec to match v1 design principles
3. **Implementation Audit**: Review current code against v1 design
4. **Rotation Handler**: Implement rotation matching v1 behavior
5. **Testing**: Verify visual output matches v1 across aspect ratios

**Document Status**: DRAFT - Awaiting user clarification on critical formula discrepancies

