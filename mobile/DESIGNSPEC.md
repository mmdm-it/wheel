# Wheel Design Specification
## Spatial Model, Terminology, and Coordinate Systems

### Document Purpose
This specification defines the spatial model, terminology standards, and coordinate system conventions for the Wheel navigation system. It serves as the authoritative reference to prevent positioning errors and terminology confusion during development.

---

## 1. SPATIAL MODEL - THE VIEWPORT

### 1.1 Visual Space Definition

The Wheel interface operates within a **portrait-oriented mobile viewport** divided into distinct spatial zones:

#### Clock Position Reference System
- **12 o'clock**: Top of viewport (270°)
- **3 o'clock**: Right edge (0°) 
- **6 o'clock**: Bottom of viewport (90°)
- **9 o'clock**: Left edge (180°)
- **Rotation**: Clockwise (CW) moves from 12→3→6→9→12

#### Visible Navigation Zones

#### Off-Screen Zones (NEVER VISIBLE)
**As measured from Hub (0° = horizontal right):**
- **180° - 270° - 0°**: Area above the screen = NEVER VISIBLE
- **0° - 90°**: Area to the right of screen = NEVER VISIBLE

#### On-Screen Zone (VISIBLE) - Aspect Ratio Dependent
**Theoretical Maximum: 90° - 180° (6 o'clock → 9 o'clock)**
- **Square Device (1:1)**: Full 90° - 180° range visible
- **Portrait Devices**: Partial range visible, typically from 110° - 180° to 130° - 180°
- **Tall Portrait**: Even narrower range (e.g., 140° - 180° on very tall devices)
- Focus Ring arc exists within the visible portion of this range
- All interactive elements MUST be positioned within the visible range
- **CRITICAL RULE**: Visible range shrinks as aspect ratio becomes more portrait

---

### 1.2 Navigation Zone Allocations

#### Focus Ring Arc
**Hub-Based Zone: Variable range ending at 180° (→ 9 o'clock)**
- **Square Device (1:1)**: Full 90° - 180° range visible (90° arc)
- **Typical Portrait (2.2:1)**: ~120° - 180° range visible (~60° arc)
- **Tall Portrait (2.5:1)**: ~135° - 180° range visible (~45° arc)
- **Ultra-Tall (10:1)**: ~160° - 180° range visible (~20° arc)
- **Purpose**: Rotational traversal of items at current hierarchy level
- **Magnifier Position**: Dynamic center angle calculated by viewport
- **Visual Metaphor**: Sprocket gear with chain extending beyond visible arc
- **Arc Always Ends**: At 180° (9 o'clock), regardless of where it starts

#### Child Pyramid Zone  
**Hub-Based Zone: Positioned radially inward from Focus Ring**
- **Arc Range**: Three concentric arcs at smaller radius than Focus Ring
- **Angular Positions**: Share same angular range as visible Focus Ring
- **Aspect Ratio Impact**: Child Pyramid visibility follows Focus Ring visibility
- **Purpose**: Radial IN migration for child nodes
- **Capacity**: 19 total nodes (8 + 7 + 4)
- **Spacing**: 8° between nodes
- **Note**: Not positioned at different angles, but at different radii

#### Parent Button Zone
**Nuc-Based Position: Lower-left corner of viewport**
- **Coordinate System**: Fixed Cartesian position relative to Nuc
- **Purpose**: Radial OUT migration to parent level
- **Visual**: Single circular button
- **State**: Hidden or visible based on JSON data (depth-dependent)

#### Detail Sector Zone
**Expands to fill**: Centered on Hub position, replaces Child Pyramid Zone
- **Radius**: 95% of focus ring radius when expanded
- **Purpose**: Display leaf item details (text, images, data)
- **Animation**: Smooth expansion from Focus Ring magnifier position
- **Content**: Positioned using Hub as center origin

---

### 1.3 Aspect Ratio Impact

#### Square Viewport (1:1 - Theoretical)
- Focus Ring: Full 90° arc visible (90° → 180°)
- All navigation zones fit within visible space
- Used for calculations and as reference model

#### Portrait Viewport (Typical Mobile)
**Examples:**
- **Z Fold 5** (~2.4:1): Focus Ring ~60° visible (~120° → 180°)
- **iPhone** (~2.2:1): Focus Ring ~65° visible (~115° → 180°)
- **Tall Android** (~2.5:1): Focus Ring ~55° visible (~125° → 180°)

**Effect**: Narrower aspect ratios compress visible Focus Ring arc, but arc ALWAYS ends at 9 o'clock (180°)

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
- **Focus Ring**: The arc-based sprocket gear for rotational traversal. The only nzone that responds to swipes by scrolling.
- **Child Pyramid**: Three-arc concentric display field of nodes for IN migration. ONly responds to clicks.
- **Parent Button**: Single button for OUT migration. Only responds to clicks.
- **Detail Sector**: Expanded circle for leaf item display. May or may not contain links. Only responds to clicks.
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
- **Nuc**: The nucleus - SVG origin (0, 0) at center of viewport

---

## 3. COORDINATE SYSTEMS

### 3.1 Constitutional Definition of Hub and Nuc

The **Hub** is the calculated rotational center of the Focus Ring, positioned off-screen outside the visible viewport. The **Nuc** (nucleus) is the rendering center of the viewport at SVG origin (0, 0).

#### Reference Direction (Both Systems)
**0° = East = Right = 3 o'clock** (standard mathematical convention)

#### Constitutional Formula
The Hub's position is constitutionally defined relative to the Nuc in SVG coordinates:

#### Portrait Mode Formula
- **x-coordinate (pixels)**: Length of viewport's long side minus half the length of the short side
  ```
  hubX = LSd - (SSd / 2)
  ```
- **y-coordinate (pixels)**: Half the length of the viewport's long side
  ```
  hubY = LSd / 2
  ```

#### SVG Coordinate System Conversion
Since SVG uses a y-down coordinate system, the y-coordinate is negated:
```javascript
// Portrait mode Hub position in SVG coordinates
hubX = LSd - (SSd / 2);
hubY = -(LSd / 2);
```

Where:
- **LSd** = Long Side dimension (Math.max(viewport.width, viewport.height))
- **SSd** = Short Side dimension (Math.min(viewport.width, viewport.height))

#### Dual Perspective Storage
Both coordinate relationships are stored and used:

**From Nuc perspective (Cartesian):**
- Hub position: `(hubX, hubY)` relative to Nuc center
- Used for SVG rendering calculations

**From Hub perspective (Polar):**
```javascript
// Derived polar coordinates
const distance = Math.sqrt(hubX * hubX + hubY * hubY);  // Distance from Hub to Nuc
const angle = Math.atan2(-hubY, -hubX);                 // Angle from Hub to Nuc (0° = East)
```

#### Key Characteristics
- **Hub**: Off-screen rotational center, thinks in polar coordinates
- **Nuc**: On-screen rendering center, thinks in Cartesian coordinates  
- **Focus Ring radius**: Always equals LSd (ensuring proper geometry)
- **Reference direction**: 0° = East = Right = 3 o'clock (both systems)

### 3.2 Nuc-Based SVG Coordinate System (Primary)

#### Origin and Axes
```
        -Y (screen up)
         │
         │
         │
─────────┼─────────  +X (screen right)
         │ (0,0)
         │  NUC
         │
        +Y (screen down)
```

**Characteristics:**
- **Origin**: Nuc at center of viewport (0, 0)
- **X-Axis**: Positive right, negative left
- **Y-Axis**: Positive down, negative up (SVG convention)
- **Reference Direction**: 0° = East = Right = 3 o'clock
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
   - Text positioning relative to Hub center
   - Specification lists and product details

#### Calculation Pattern
```javascript
// Hub-to-Nuc conversion (ALWAYS use this pattern)
const x = hubX + radius * Math.cos(angleRadians);  // Hub perspective to Nuc coordinates
const y = hubY + radius * Math.sin(angleRadians);  // 0° = East = Right = 3 o'clock
```

---

### 3.3 Hub-Based Polar Coordinate System (Secondary)

#### Definition
```
        270° (π * 1.5)
        12 o'clock
         │
         │
         │
─────────●─────────  0°/360° = 3 o'clock (0 radians)
    radius │ angle
         │
        90° (π/2)
        6 o'clock
```

**Characteristics:**
- **Origin**: The Hub (calculated rotational center, positioned off-screen)
- **Radius**: Distance from Hub origin (in SVG units)
- **Angle**: Measured in radians (Math.cos/sin expect radians)
- **Reference Direction**: 0° = 0 radians = East = Right = 3 o'clock
- **Angle Mapping**:
  - 0° = 0 radians (3 o'clock - East)
  - 90° = π/2 radians (6 o'clock - South)
  - 180° = π radians (9 o'clock - West)
  - 270° = π * 1.5 radians (12 o'clock - North)
- **Direction**: Clockwise (standard mathematical convention)

#### Components Using Polar Coordinates
1. **mobile-viewport.js**
   - Hub center angle calculations
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

### 3.4 System Interactions (Hybrid Usage)

#### Focus Ring Positioning Flow
1. **mobile-viewport.js** (Hub-based Polar)
   - Calculates Hub position using constitutional formula
   - Calculates center angle (radians) from Hub to Nuc
   - Returns arc parameters object with Hub coordinates

2. **mobile-renderer.js** (Polar → Cartesian)
   - Receives arc parameters with Hub coordinates
   - For each item, calculates item angle in radians from Hub
   - Converts to Nuc coordinates: `x = hubX + radius * cos(angle)`
   - Creates SVG elements at Nuc-relative (x, y) coordinates

#### Child Pyramid Positioning Flow
1. **mobile-childpyramid.js** (Hub-based Polar)
   - Receives magnifier angle from viewport (calculated from Hub)
   - Calculates arc spread angles (e.g., ±28° for 8 nodes)

2. **mobile-childpyramid.js** (Polar → Cartesian)
   - Converts each angle to Cartesian coordinates using Hub as origin
   - Positions SVG elements at calculated (x, y)

#### Detail Sector Positioning Flow
1. **mobile-detailsector.js** (Hub-Centered Cartesian)
   - Uses Hub coordinates as the circle center
   - Content positioned within 95% of Focus Ring radius
   - All text and elements positioned relative to Hub origin

---

## 4. VISUAL POSITIONING RULES

### 4.1 Focus Ring Coordinate System - COUNTERINTUITIVE ANGLES

#### Critical Understanding: Focus Ring "Top" vs "Bottom"

**The Focus Ring coordinate system is COUNTERINTUITIVE** and requires careful attention:

- **"Top" of Focus Ring**: Items with GREATER angles (closer to 180° - 9 o'clock)
- **"Bottom" of Focus Ring**: Items with SMALLER angles (further from 180° - toward 6 o'clock)

**Sorting Order (Top to Bottom):**
```
Genesis (sort_number: 1)     ← 178° (GREATER angle = "top")
Exodus (sort_number: 2)      ← 175° 
Leviticus (sort_number: 3)   ← 172°
Numbers (sort_number: 4)     ← 169°
Deuteronomy (sort_number: 5) ← 166° (SMALLER angle = "bottom")
```

**Why This Matters:**
- **Sorted items** appear first (have sort_number property)
- **First sorted items** should appear at GREATER angles (visual "top")
- **Visual progression** flows from greater angles to smaller angles
- **Alphabetical fallback** for unsorted items uses Z-to-A order to maintain this flow

**Implementation Rule**: When positioning sorted items, the first item (lowest sort_number) gets the GREATEST angle in the visible range.

#### Focus Ring Item Distribution

##### Current Implementation (CORRECTED)
- **Algorithm**: Items evenly distributed across arc with sort_number priority
- **Sorted Items**: Positioned at arc top (greater angles, closer to 180°)
- **Unsorted Items**: Fall back to Z-to-A alphabetical, positioned at smaller angles
- **Center**: Magnifier at dynamic center angle (typically ~145°)

##### Positioning Logic (mobile-renderer.js)
- **File**: `mobile-renderer.js`
- **Method**: `calculateInitialRotationOffset()`
- **Arc Top Positioning**: Sorted items positioned at `maxViewportAngle - smallMargin`
- **Visual Flow**: First sorted item at greatest angle, progressing to smaller angles

#### Implementation Location
- **File**: `mobile-renderer.js`
- **Method**: `updateFocusRingPositions()`
- **Current**: Uses calculateInitialRotationOffset to position sorted items at arc top
- **Status**: Implemented and working correctly

---

### 4.2 Child Pyramid Item Distribution

#### Geometric Challenge: Right Triangle with Arc Hypotenuse

The Child Pyramid represents the most complex spatial zone in the Wheel navigation system due to its **aspect-ratio-dependent triangular geometry**.

**Structural Components:**
- **3 Concentric Arcs**: `chpyr_85`, `chpyr_70`, `chpyr_55` (at different Hub radii)
- **Zone Shape**: Right triangle with curved arc as hypotenuse
- **Capacity**: 21 total nodes distributed across the three arcs (requirement: New Testament Epistles)
- **Apex**: Points toward Hub (off-screen)
- **Base**: Follows visible arc portion within viewport

**Aspect Ratio Complexity:**
- **Square (1:1)**: Triangle approaches equilateral shape
- **Portrait (2.2:1)**: Triangle becomes increasingly acute
- **Tall Portrait (2.5:1+)**: Triangle becomes very narrow and steep
- **Dynamic Spacing**: Node distribution must adapt to changing triangle geometry

**Implementation Challenges:**
1. **Dynamic Arc Positioning**: Each arc radius must maintain proper spacing relative to Focus Ring
2. **Node Distribution**: Items must be spaced evenly within the changing triangular zone
3. **Visibility Constraints**: All nodes must remain within aspect-ratio-dependent visible range
4. **Geometric Calculations**: Right triangle with curved hypotenuse creates complex spatial mathematics

**Current Status**: 
- **Architecture**: Defined in `mobile-childpyramid.js`
- **Positioning**: Hub-based polar → Cartesian conversion
- **Design Work Required**: Comprehensive geometric system for aspect ratio adaptation

**Documentation Note**: Due to the mathematical complexity of the triangular arc geometry, detailed positioning algorithms are maintained in the implementation files rather than this specification document.

---

### 4.3 Magnifier Dynamic Positioning

The magnifier position is **NOT FIXED** - it adjusts based on aspect ratio:

#### Calculation (mobile-viewport.js)
```javascript
// Calculate angle from Hub to Nuc using atan2
// Vector from Hub to Nuc (0,0)
const vectorX = 0 - hubX;  // Nuc is at (0,0)
const vectorY = 0 - hubY;
const centerAngle = Math.atan2(vectorY, vectorX);  // 0° = East = Right = 3 o'clock
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

**Solution**: Always use aspect-ratio-dependent visible range, verify with viewport.getCenterAngle()

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
- [ ] Verify angle range (must be within aspect-ratio-dependent visible range)
- [ ] Check aspect ratio impact (test square + portrait)
- [ ] Use viewport.getCenterAngle() for dynamic positioning
- [ ] Convert radians↔degrees appropriately
- [ ] Test on device with different aspect ratio

### 6.2 Debugging Positioning Issues

```javascript
// Add these logs to troubleshoot positioning
Logger.debug(`Angle: ${angle} rad = ${angle * 180/Math.PI}°`);
Logger.debug(`Position: (${x}, ${y}) from Hub (${hubX}, ${hubY})`);
Logger.debug(`Visible range: ${startAngle * 180/Math.PI}° → ${endAngle * 180/Math.PI}°`);
Logger.debug(`Viewport aspect: ${viewportWidth}×${viewportHeight} = ${viewportWidth/viewportHeight}:1`);
```

### 6.3 Code Review Questions

When reviewing positioning code:

1. **Coordinate System**: Is this Cartesian or Polar?
2. **Angle Units**: Degrees or radians?
3. **Visible Range**: Is this within the aspect-ratio-dependent visible range?
4. **Dynamic Center**: Using getCenterAngle() or hardcoded?
5. **Aspect Ratio**: Tested on different device shapes?
6. **Conversion**: Polar→Cartesian done correctly?

---

## 7. REFERENCE TABLES

### 7.1 Angle Reference Chart (From Hub Perspective)

| Clock | Hub Angle | Radians | Screen Position | Visibility | Zone |
|-------|-----------|---------|-----------------|------------|------|
| 3:00 | 0° | 0 | Right of Screen | ❌ Never Visible | Off-Screen Right |
| 4:30 | 45° | π/4 | Right of Screen | ❌ Never Visible | Off-Screen Right |
| 6:00 | 90° | π/2 | Bottom Edge | ⚠️ Square Only | Focus Ring Start (Square) |
| 7:30 | 135° | 3π/4 | Lower-Left | ✅ Visible | Focus Ring/Magnifier |
| 9:00 | 180° | π | Left Edge | ✅ Visible | Focus Ring End |
| 10:30 | 225° | 5π/4 | Upper-Left | ❌ Never Visible | Off-Screen Above |
| 12:00 | 270° | 3π/2 | Top of Screen | ❌ Never Visible | Off-Screen Above |
| 1:30 | 315° | 7π/4 | Upper-Right | ❌ Never Visible | Off-Screen Above |

**KEY RULE**: Visible range varies by aspect ratio, always ending at 180° (9 o'clock)

### 7.2 Component Position Summary (From Hub Perspective)

| Component | Clock Range | Hub Angle Range | Visibility | Coordinate System |
|-----------|-------------|-----------------|------------|-------------------|
| Focus Ring | Variable → 9:00 | Variable - 180° | ⚠️ Aspect Dependent | Polar → Cartesian |
| Child Pyramid | Same as Focus Ring | Variable - 180° | ⚠️ Aspect Dependent | Polar → Cartesian |
| Parent Button | Lower-Left Corner | Nuc-based | ⚠️ JSON Dependent | Cartesian (from Nuc) |
| Detail Sector | Hub Center | N/A | ✅ Visible | Cartesian (from Hub) |
| Magnifier | ~7:30-8:00 | ~135° | ✅ Visible | Dynamic (Polar) |

**CRITICAL**: All positioning must respect aspect-ratio-dependent visible range from Hub

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

**Arc Parameters Object**: Data structure from viewport containing Hub coordinates (hubX, hubY), radius, startAngle, endAngle, centerAngle

**Center Angle**: Dynamic angle calculated from Hub to Nuc where magnifier appears (typically 225° - 245° depending on aspect ratio)

**Clock Position**: Angle described using clock face analogy (12:00 = top, 3:00 = right, 6:00 = bottom, 9:00 = left)

**Hub**: The calculated rotational center of the Focus Ring, positioned off-screen using the constitutional formula: hubX = LSd - SSd/2, hubY = -(LSd/2) for portrait mode. Uses polar perspective.

**Hub-Based Polar**: Coordinate system using the Hub as origin with angle and radius measurements for rotational calculations

**Nuc**: The nucleus - the rendering center at SVG origin (0, 0) in the viewport. Uses Cartesian perspective.

**nzone**: Spatial zone allocated to a navigation component (Focus Ring nzone, Pyramid nzone, etc.)

**Off-Screen Zone**: The 0° - 90° quadrant (12:00 → 3:00) that is invisible on mobile devices

**Polar Coordinate**: Position defined by radius and angle from the Hub origin

**Radians**: Angular measurement used by Math.cos/sin (π radians = 180°)

**Reference Direction**: 0° = East = Right = 3 o'clock (standard mathematical convention used in both Hub and Nuc coordinate systems)

**Visible Range**: The portion of the Focus Ring arc actually displayed in viewport (aspect-ratio dependent)

---

**Document Version**: 1.0  
**Last Updated**: November 7, 2025  
**Related**: STATUS, README.md, mobile-viewport.js, mobile-renderer.js
