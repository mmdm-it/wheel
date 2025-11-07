# Wheel Design Specification
## Spatial Model, Terminology, and Coordinate Systems

### Document Purpose
This specification defines the spatial model, terminology standards, and coordinate system conventions for the Wheel navigation system. It serves as the authoritative reference to prevent positioning errors and terminology confusion during development.

---

## 1. SPATIAL MODEL - THE VIEWPORT

### 1.1 Visual Space Definition

The Wheel interface operates within a **portrait-oriented mobile viewport** divided into distinct spatial zones:

#### Clock Position Reference System
- **12 o'clock**: Top of viewport (0°)
- **3 o'clock**: Right edge (90°)
- **6 o'clock**: Bottom of viewport (180°)
- **9 o'clock**: Left edge (270°)
- **Rotation**: Clockwise (CW) moves from 12→3→6→9→12

#### Visible Navigation Zones
```
    12:00 (TOP)
      ╱│╲
     ╱ │ ╲
    ╱  │  ╲ OFF-SCREEN
   ╱   │   ╲ ZONE
  ╱    │    ╲ (0° - 90°)
 ╱     │     ╲
╱      │      ╲
───────┼───────  3:00 (RIGHT EDGE)
       │
       │ CENTER
       │ (SVG origin)
       │
       │  FOCUS RING
───────┼───────  6:00 (START)
╲      │      ╱
 ╲     │     ╱  VISIBLE ARC
  ╲    │    ╱   (180° - 270°)
   ╲   │   ╱    
    ╲  │  ╱  CHILD PYRAMID
     ╲ │ ╱   (90° - 180°)
      ╲│╱
    9:00 (END) ← 270° = π * 1.5 radians
```

#### Off-Screen Zone (NEVER USE)
**0° - 90° (12 o'clock → 3 o'clock)**
- This quadrant is **OFF-SCREEN** on all mobile devices
- Positioning elements here will make them invisible
- Historical source of positioning bugs
- **RULE**: Never place interactive elements between 12:00 and 3:00

#### On-Screen Zones (ACTIVE AREAS)
**90° - 270° (3 o'clock → 9 o'clock via 6 o'clock)**
- This 180° arc spans the visible portion of the viewport
- All interactive elements MUST be within this range
- Specific zones allocated to different navigation elements

---

### 1.2 Navigation Zone Allocations

#### Focus Ring Arc
**Primary Zone: 180° - 270° (6 o'clock → 9 o'clock)**
- **Theoretical Maximum**: 90° arc on 1:1 aspect ratio device
- **Practical Range**: 60° - 70° arc on typical portrait devices
- **Example (Z Fold 5)**: ~210° - 270° (7:00 → 9:00)
- **Purpose**: Rotational traversal of items at current hierarchy level
- **Magnifier Position**: Dynamic center angle calculated by viewport
- **Visual Metaphor**: Sprocket gear with chain extending beyond visible arc

#### Child Pyramid Zone  
**Primary Zone: 90° - 180° (3 o'clock → 6 o'clock)**
- **Arc Range**: Three concentric arcs in this quadrant
- **Angular Positions**: 
  - chpyr_85: 122° (closer to 6 o'clock)
  - chpyr_70: 126°
  - chpyr_55: 142° (closer to 3 o'clock)
- **Purpose**: Radial IN migration for child nodes
- **Capacity**: 19 total nodes (8 + 7 + 4)
- **Spacing**: 8° between nodes

#### Parent Button Zone
**Primary Zone: 270° - 360° (9 o'clock → 12 o'clock)**
- **Approximate Position**: ~315° (10:30 position)
- **Purpose**: Radial OUT migration to parent level
- **Visual**: Single circular button
- **State**: Hidden at top level, visible at depth ≥ 1

#### Detail Sector Zone
**Expands to fill**: Centered on SVG center (0, 0)
- **Radius**: 90% of focus ring radius when expanded
- **Purpose**: Display leaf item details (text, images, data)
- **Animation**: Smooth expansion from Focus Ring magnifier position
- **Content**: Positioned using viewport center as origin

---

### 1.3 Aspect Ratio Impact

#### Square Viewport (1:1 - Theoretical)
- Focus Ring: Full 90° arc visible (180° → 270°)
- All navigation zones fit within visible space
- Used for calculations and as reference model

#### Portrait Viewport (Typical Mobile)
**Examples:**
- **Z Fold 5** (~2.4:1): Focus Ring ~60° visible (210° → 270°)
- **iPhone** (~2.2:1): Focus Ring ~65° visible (205° → 270°)
- **Tall Android** (~2.5:1): Focus Ring ~55° visible (215° → 270°)

**Effect**: Narrower aspect ratios compress visible Focus Ring arc, but arc ALWAYS ends at 9 o'clock (270°)

#### Landscape Viewport (Future Implementation)
- Not currently implemented for navigation
- Will use different visual model (layer traversal)
- Will reuse underlying data navigation system

---

## 2. TERMINOLOGY STANDARDS

### 2.1 Direction Terminology

#### CORRECT: Radial Directional Terms
- **OUT**: Movement from Focus Ring toward Parent Button (hierarchy ascending)
- **IN**: Movement from Child Pyramid toward Focus Ring (hierarchy descending)
- **CW** (Clockwise): Rotation increasing angle (6→9→12→3→6)
- **CCW** (Counter-Clockwise): Rotation decreasing angle (6→3→12→9→6)

#### INCORRECT: Avoid These Terms
- ❌ **UP** - Ambiguous (screen up ≠ hierarchy up)
- ❌ **DOWN** - Ambiguous (screen down ≠ hierarchy down)
- ❌ **TOP** - Use specific clock position (e.g., "12 o'clock" or "9 o'clock")
- ❌ **BOTTOM** - Use "6 o'clock" instead
- ❌ **LEFT/RIGHT** - Use "9 o'clock" / "3 o'clock" instead

#### Examples of Correct Usage
```javascript
// ✅ CORRECT
migrateNodeOUT();  // Navigate to parent
migrateNodeIN();   // Navigate to child
rotateCW();        // Rotate clockwise
positionAt270();   // Position at 9 o'clock

// ❌ INCORRECT  
moveUp();          // Ambiguous
navigateDown();    // Ambiguous
positionAtTop();   // Which top?
```

---

### 2.2 Component Terminology

#### Navigation Components
- **Focus Ring**: The arc-based sprocket gear for rotational traversal
- **Child Pyramid**: Three-arc concentric display for IN migration
- **Parent Button**: Single button for OUT migration
- **Detail Sector**: Expanded circle for leaf item display
- **Magnifier**: Visual indicator at dynamic center angle of Focus Ring

#### Hierarchy Terms
- **Level**: A configured depth in the hierarchy (testament, book, chapter, verse)
- **Item**: A data node at any level
- **Leaf**: Terminal item with no children (displays in Detail Sector)
- **Virtual Level**: Computed grouping level (e.g., chapter_group, verse_group)
- **Aggregated Level**: Items combined across intermediate collections

#### Spatial Terms
- **nzone**: Spatial zone allocated to specific component (Focus Ring nzone, Pyramid nzone)
- **Arc**: Curved path of positioned items
- **Center Angle**: Dynamic angle where magnifier appears
- **Visible Range**: Portion of arc within viewport
- **Viewport Center**: SVG origin (0, 0) in coordinate space

---

## 3. COORDINATE SYSTEMS

### 3.1 SVG Coordinate System (Primary)

#### Origin and Axes
```
        -Y (screen up)
         │
         │
         │
─────────┼─────────  +X (screen right)
         │ (0,0)
         │ SVG CENTER
         │
        +Y (screen down)
```

**Characteristics:**
- **Origin**: Center of viewport (0, 0)
- **X-Axis**: Positive right, negative left
- **Y-Axis**: Positive down, negative up (SVG convention)
- **Units**: SVG user units (typically maps to pixels)
- **Usage**: Primary coordinate system for ALL rendering

#### Components Using Cartesian (SVG) Coordinates
1. **mobile-renderer.js**
   - All SVG element creation and positioning
   - Text element placement
   - Detail Sector content layout
   - Logo positioning

2. **mobile-childpyramid.js**
   - Node positioning (converts from polar first)
   - Text label placement
   - Hit zone calculations

3. **mobile-detailsector.js**
   - Content rendering within expanded circle
   - Text positioning at viewport center (0, 0)
   - Specification lists and product details

#### Calculation Pattern
```javascript
// Polar to Cartesian conversion (ALWAYS use this pattern)
const x = centerX + radius * Math.cos(angleRadians);
const y = centerY + radius * Math.sin(angleRadians);
```

---

### 3.2 Polar Coordinate System (Secondary)

#### Definition
```
        270° (π * 1.5)
        9 o'clock
         │
         │
         │
─────────●─────────  0°/360° = 3 o'clock (0 radians)
    radius │ angle
         │
        180° (π)
        6 o'clock
```

**Characteristics:**
- **Origin**: Center of Focus Ring / navigation center
- **Radius**: Distance from origin (in SVG units)
- **Angle**: Measured in radians (Math.cos/sin expect radians)
  - 0° = 0 radians (3 o'clock)
  - 90° = π/2 radians (6 o'clock)
  - 180° = π radians (9 o'clock)
  - 270° = π * 1.5 radians (12 o'clock)
- **Direction**: Clockwise (standard mathematical convention inverted)

#### Components Using Polar Coordinates
1. **mobile-viewport.js**
   - Focus Ring center angle calculations
   - Arc parameter computations
   - Aspect ratio adjustments

2. **mobile-touch.js**
   - Rotation angle tracking
   - Gesture angle calculations
   - Momentum physics

3. **mobile-childpyramid.js** (hybrid)
   - Arc angle calculations (polar)
   - Node positioning (converts to Cartesian)

#### Angle Conversion
```javascript
// Degrees to Radians
const radians = degrees * (Math.PI / 180);

// Radians to Degrees  
const degrees = radians * (180 / Math.PI);

// Common angles
const angle_0   = 0;           // 0° = 3 o'clock
const angle_90  = Math.PI / 2; // 90° = 6 o'clock
const angle_180 = Math.PI;     // 180° = 9 o'clock (Focus Ring end)
const angle_270 = Math.PI * 1.5; // 270° = 12 o'clock
```

---

### 3.3 System Interactions (Hybrid Usage)

#### Focus Ring Positioning Flow
1. **mobile-viewport.js** (Polar)
   - Calculates center angle (radians)
   - Calculates arc start/end angles (radians)
   - Returns arc parameters object

2. **mobile-renderer.js** (Polar → Cartesian)
   - Receives arc parameters with center angle
   - For each item, calculates item angle in radians
   - Converts to Cartesian: `x = centerX + radius * cos(angle)`
   - Creates SVG elements at (x, y) coordinates

#### Child Pyramid Positioning Flow
1. **mobile-childpyramid.js** (Polar)
   - Receives magnifier angle from viewport
   - Calculates arc spread angles (e.g., ±28° for 8 nodes)

2. **mobile-childpyramid.js** (Polar → Cartesian)
   - Converts each angle to Cartesian coordinates
   - Positions SVG elements at calculated (x, y)

#### Detail Sector Positioning Flow
1. **mobile-detailsector.js** (Pure Cartesian)
   - Uses viewport center (0, 0) as content origin
   - All text and elements positioned relative to center
   - No polar calculations needed

---

## 4. VISUAL POSITIONING RULES

### 4.1 Focus Ring Item Distribution

#### Current Implementation (ISSUE)
- **Algorithm**: Items evenly distributed across arc
- **Center**: Middle item centered at magnifier angle
- **Problem**: First item (e.g., Genesis) appears in middle of visible range

#### Desired Behavior (TO BE IMPLEMENTED)
- **Algorithm**: Items evenly distributed across arc
- **Start**: First item positioned at 9 o'clock (270° = π * 1.5)
- **Progression**: Subsequent items follow clockwise from start
- **Effect**: Sequential navigation begins at visible arc edge

#### Implementation Location
- **File**: `mobile-renderer.js`
- **Method**: `updateFocusRingPositions()`
- **Current**: Centers middle index at center angle
- **Required**: Offset calculation to place index[0] at 270°

---

### 4.2 Child Pyramid Item Distribution

#### Pattern: Center-Outward Placement
```
Arc with 8 nodes (magnifier at center):
      
    7   5   3   1   0   2   4   6
    ←───────  ●  ───────→
          magnifier
```

**Algorithm:**
1. Place first item (index 0) at magnifier angle
2. Place subsequent items alternating CW/CCW
3. Maintain 8° spacing between nodes
4. Creates symmetric spread centered on magnifier

**Code Reference:** `mobile-childpyramid.js` → `getCenterOutwardOrder()`

---

### 4.3 Magnifier Dynamic Positioning

The magnifier position is **NOT FIXED** - it adjusts based on aspect ratio:

#### Calculation (mobile-viewport.js)
```javascript
// arcStartAngle = 180° (6 o'clock)
// arcEndAngle = 270° (9 o'clock)  
const centerAngle = (arcStartAngle + arcEndAngle) / 2;
```

#### Typical Results
- **Square device**: centerAngle ≈ 225° (7:30 position)
- **Portrait device**: centerAngle ≈ 240° (8:00 position)
- **Tall portrait**: centerAngle ≈ 245° (8:10 position)

**Critical**: All rotational positioning uses this dynamic angle, not hardcoded 225°

---

## 5. COMMON POSITIONING ERRORS

### 5.1 Off-Screen Placement
**Symptom**: Elements invisible, appear "missing"

**Causes:**
- Using 0° - 90° range (12:00 → 3:00 quadrant)
- Hardcoding angles without viewport awareness
- Confusing degrees with radians

**Solution**: Always use 90° - 270° range, verify with viewport.getCenterAngle()

---

### 5.2 Angle System Confusion
**Symptom**: Elements rotated 90° from expected position

**Causes:**
- Using degrees with Math.cos/sin (expects radians)
- Confusing SVG Y-down with mathematical Y-up
- Wrong reference angle (0° vs 90° start)

**Solution**: Convert degrees→radians, use consistent reference system

---

### 5.3 Coordinate System Mixing
**Symptom**: Elements positioned incorrectly by sqrt(2) or similar factor

**Causes:**
- Treating polar radius as Cartesian distance
- Adding angles to Cartesian coordinates
- Forgetting polar→Cartesian conversion

**Solution**: Keep calculations in one system, convert at boundary

---

## 6. DEVELOPMENT GUIDELINES

### 6.1 New Feature Checklist

Before implementing new visual features:

- [ ] Identify coordinate system needed (Cartesian vs Polar)
- [ ] Verify angle range (must be 90° - 270° for visibility)
- [ ] Check aspect ratio impact (test square + portrait)
- [ ] Use viewport.getCenterAngle() for dynamic positioning
- [ ] Convert radians↔degrees appropriately
- [ ] Test on device with different aspect ratio

### 6.2 Debugging Positioning Issues

```javascript
// Add these logs to troubleshoot positioning
Logger.debug(`Angle: ${angle} rad = ${angle * 180/Math.PI}°`);
Logger.debug(`Position: (${x}, ${y}) from center (${centerX}, ${centerY})`);
Logger.debug(`Visible range: ${startAngle * 180/Math.PI}° → ${endAngle * 180/Math.PI}°`);
Logger.debug(`Viewport aspect: ${viewportWidth}×${viewportHeight} = ${viewportWidth/viewportHeight}:1`);
```

### 6.3 Code Review Questions

When reviewing positioning code:

1. **Coordinate System**: Is this Cartesian or Polar?
2. **Angle Units**: Degrees or radians?
3. **Visible Range**: Is this in 90° - 270° range?
4. **Dynamic Center**: Using getCenterAngle() or hardcoded?
5. **Aspect Ratio**: Tested on different device shapes?
6. **Conversion**: Polar→Cartesian done correctly?

---

## 7. REFERENCE TABLES

### 7.1 Angle Reference Chart

| Clock | Degrees | Radians | Screen | Zone | Status |
|-------|---------|---------|--------|------|--------|
| 12:00 | 0° | 0 | Top | Off-Screen | ❌ Don't Use |
| 1:30 | 45° | π/4 | Top-Right | Off-Screen | ❌ Don't Use |
| 3:00 | 90° | π/2 | Right Edge | Boundary | ⚠️ Edge |
| 4:30 | 135° | 3π/4 | Lower-Right | Child Pyramid | ✅ Active |
| 6:00 | 180° | π | Bottom | Focus Ring Start | ✅ Active |
| 7:30 | 225° | 5π/4 | Lower-Left | Focus Ring Center | ✅ Magnifier |
| 9:00 | 270° | 3π/2 | Left Edge | Focus Ring End | ✅ Active |
| 10:30 | 315° | 7π/4 | Upper-Left | Parent Button | ✅ Active |

### 7.2 Component Position Summary

| Component | Clock Range | Angle Range | Coordinate System |
|-----------|-------------|-------------|-------------------|
| Focus Ring | 6:00 → 9:00 | 180° - 270° | Polar → Cartesian |
| Child Pyramid | 3:00 → 6:00 | 90° - 180° | Polar → Cartesian |
| Parent Button | ~10:30 | ~315° | Cartesian |
| Detail Sector | Center | N/A | Cartesian (from 0,0) |
| Magnifier | ~7:30-8:00 | ~225°-240° | Dynamic (Polar) |

---

## 8. IMPLEMENTATION PRIORITIES

### 8.1 Current Issue: Focus Ring Positioning
**Problem**: First sorted item appears in middle of visible arc instead of at 9 o'clock edge

**Location**: `mobile-renderer.js` → `updateFocusRingPositions()`

**Solution Required**:
1. Calculate offset to place array[0] at 270° (9 o'clock)
2. Distribute remaining items clockwise from that position
3. Maintain even spacing across arc
4. Test with different item counts and aspect ratios

### 8.2 Documentation Maintenance
- Update this DESIGNSPEC when adding new components
- Document any new coordinate system interactions
- Add positioning rules for new navigation zones
- Maintain angle reference table accuracy

---

## GLOSSARY

**Arc Parameters Object**: Data structure from viewport containing centerX, centerY, radius, startAngle, endAngle, centerAngle

**Center Angle**: Dynamic angle calculated by viewport where magnifier appears (typically 225° - 245° depending on aspect ratio)

**Clock Position**: Angle described using clock face analogy (12:00 = top, 3:00 = right, 6:00 = bottom, 9:00 = left)

**Dynamic Center**: The magnifier position that adjusts based on device aspect ratio (not hardcoded)

**nzone**: Spatial zone allocated to a navigation component (Focus Ring nzone, Pyramid nzone, etc.)

**Off-Screen Zone**: The 0° - 90° quadrant (12:00 → 3:00) that is invisible on mobile devices

**Polar Coordinate**: Position defined by radius and angle from origin

**Radians**: Angular measurement used by Math.cos/sin (π radians = 180°)

**SVG Center**: The origin point (0, 0) at the center of the viewport

**Visible Range**: The portion of the Focus Ring arc actually displayed in viewport (aspect-ratio dependent)

---

**Document Version**: 1.0  
**Last Updated**: November 7, 2025  
**Related**: STATUS, README.md, mobile-viewport.js, mobile-renderer.js
