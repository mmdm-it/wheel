# Wheel Design Specification
## Spatial Model, Terminology, and Coordinate Systems

### Document Purpose
This specification defines the spatial model, terminology standards, and coordinate system conventions for the Wheel navigation system. It serves as the authoritative reference to prevent positioning errors and terminology confusion during development.

---

## Part I: Code Implementation

### 1. SPATIAL MODEL - THE VIEWPORT

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

### 2. COORDINATE SYSTEMS

### 2.1 Constitutional Definition of Hub and Nuc

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

### 2.2 Nuc-Based SVG Coordinate System (Primary)

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

### 2.3 Hub-Based Polar Coordinate System (Secondary)

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

### 2.4 System Interactions (Hybrid Usage)

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

### 3. VISUAL POSITIONING RULES

### 3.1 Focus Ring Coordinate System - COUNTERINTUITIVE ANGLES

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

### 3.2 Child Pyramid Item Distribution

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

### 3.3 Magnifier Dynamic Positioning

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

### 3.4 Detail Sector Metadata Layout

The detail sector now renders entirely from catalog metadata, replacing former hardcoded content. Layout decisions remain anchored to the Hub/Nuc spatial model while templates drive text and media.

#### Configuration Sources
- **Hierarchy-Level Overrides**: `hierarchy_levels[*].detail_sector` supplies header templates and per-view definitions (info/list/gallery/links)
- **Item-Level Data**: Leaf nodes provide `data` payloads that hydrate view templates via Handlebars-style `{{ }}` interpolation
- **Default Fallbacks**: Volume-level detail sector config applies when a hierarchy level omits overrides

#### Rendering Flow (mobile-detailsector.js)
1. **Config Resolution**: DataManager delivers merged configuration (volume defaults + level overrides + item overrides)
2. **Context Assembly**: Base context includes taxonomy fields (market, country, manufacturer, etc.) and item `data`
3. **View Iteration**: Renderer walks each configured view block and delegates to specialized renderers
4. **SVG Placement**: Renderers convert templated strings into SVG text/images positioned relative to the Hub-centric detail circle
5. **Diagnostics**: mobile-logger traces config selection, resolved template data, and per-view item counts

#### Supported View Types
- **info**: Header, subtitle, optional body, and labeled field list
- **list**: Repeating bullet rows with primary/secondary/meta/badge templates
- **gallery**: Image tiles sourced from resolved asset paths (pending registry integration)
- **links**: Action list with label/description templates and resolved URLs

#### Spatial Considerations
- Renderers share vertical flow: header block → padding → view stack
- Text wrapping honors `wrapText()` constraints (default 40 characters per line)
- Gallery/link layouts reserve gutters to prevent overlap with circle boundary
- Legacy fallback remains for items without configuration, preserving older layout rules

---

### 4. COMMON POSITIONING ERRORS

### 4.1 Off-Screen Placement
**Symptom**: Elements invisible, appear "missing"

**Causes:**
- Using 0° - 90° range (12:00 → 3:00 quadrant)
- Hardcoding angles without viewport awareness
- Confusing degrees with radians

**Solution**: Always use aspect-ratio-dependent visible range, verify with viewport.getCenterAngle()

---

### 4.2 Angle System Confusion
**Symptom**: Elements rotated 90° from expected position

**Causes:**
- Using degrees with Math.cos/sin (expects radians)
- Confusing SVG Y-down with mathematical Y-up
- Wrong reference angle (0° vs 90° start)

**Solution**: Convert degrees→radians, use consistent reference system

---

### 4.3 Coordinate System Mixing
**Symptom**: Elements positioned incorrectly by sqrt(2) or similar factor

**Causes:**
- Treating polar radius as Cartesian distance
- Adding angles to Cartesian coordinates
- Forgetting polar→Cartesian conversion

**Solution**: Keep calculations in one system, convert at boundary

---

### 5. DEVELOPMENT GUIDELINES

### 5.1 New Feature Checklist

Before implementing new visual features:

- [ ] Identify coordinate system needed (Cartesian vs Polar)
- [ ] Verify angle range (must be within aspect-ratio-dependent visible range)
- [ ] Check aspect ratio impact (test square + portrait)
- [ ] Use viewport.getCenterAngle() for dynamic positioning
- [ ] Convert radians↔degrees appropriately
- [ ] Test on device with different aspect ratio
- [ ] Confirm detail sector view definitions exist for target hierarchy level or volume fallback

### 5.2 Debugging Positioning Issues

```javascript
// Add these logs to troubleshoot positioning
Logger.debug(`Angle: ${angle} rad = ${angle * 180/Math.PI}°`);
Logger.debug(`Position: (${x}, ${y}) from Hub (${hubX}, ${hubY})`);
Logger.debug(`Visible range: ${startAngle * 180/Math.PI}° → ${endAngle * 180/Math.PI}°`);
Logger.debug(`Viewport aspect: ${viewportWidth}×${viewportHeight} = ${viewportWidth/viewportHeight}:1`);
Logger.debug('📋 DetailSector: resolved config', { itemId, viewIds });
```

### 5.3 Code Review Questions

When reviewing positioning code:

1. **Coordinate System**: Is this Cartesian or Polar?
2. **Angle Units**: Degrees or radians?
3. **Visible Range**: Is this within the aspect-ratio-dependent visible range?
4. **Dynamic Center**: Using getCenterAngle() or hardcoded?
5. **Aspect Ratio**: Tested on different device shapes?
6. **Conversion**: Polar→Cartesian done correctly?

---

### 6. REFERENCE TABLES

### 6.1 Angle Reference Chart (From Hub Perspective)

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

### 6.2 Component Position Summary (From Hub Perspective)

| Component | Clock Range | Hub Angle Range | Visibility | Coordinate System |
|-----------|-------------|-----------------|------------|-------------------|
| Focus Ring | Variable → 9:00 | Variable - 180° | ⚠️ Aspect Dependent | Polar → Cartesian |
| Child Pyramid | Same as Focus Ring | Variable - 180° | ⚠️ Aspect Dependent | Polar → Cartesian |
| Parent Button | Lower-Left Corner | Nuc-based | ⚠️ JSON Dependent | Cartesian (from Nuc) |
| Detail Sector | Hub Center | N/A | ✅ Visible | Cartesian (from Hub) |
| Magnifier | ~7:30-8:00 | ~135° | ✅ Visible | Dynamic (Polar) |

**CRITICAL**: All positioning must respect aspect-ratio-dependent visible range from Hub

---

### 7. TERMINOLOGY STANDARDS

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
- **Pseudo Parent Level**: Dynamically created hierarchy level triggered by `rpp_` prefix
- **rpp_ Prefix**: Universal trigger for pseudo parent creation (e.g., `rpp_family: true`)
- **rpgp_ Prefix**: Pseudo grandparent trigger (2nd degree above triggering item)
- **rpggp_ Prefix**: Pseudo great-grandparent trigger (3rd degree above triggering item)
- **Orphan Adoption**: System that groups items without pseudo parent triggers into configurable categories
- **Pseudo Orphan Group**: Configurable group name for uncategorized items (e.g., "Pending Approval", "Uncategorized")

#### Pseudo Parent System Terms
- **Pseudo Parent Architecture**: Revolutionary system for dynamic hierarchy creation using curatorial prefix triggers
- **Universal Trigger Pattern**: `rpp_propertyname: true` creates pseudo parent levels dynamically for any data domain
- **Domain Agnostic**: Works for marine engines (family), music (venue_type), medical equipment (certification), etc.
- **Nested Pseudo Parents**: Pseudo parents can trigger their own pseudo parents for unlimited depth (rpp_ → rpgp_ → rpggp_)
- **Navigation Direction**: Pseudo parents positioned OUT (above) the triggering data level in hierarchy
- **Real vs Pseudo Levels**: Real levels exist in JSON structure; pseudo levels created dynamically by triggers
- **Orphan Items**: Data items without `rpp_` trigger properties that require adoption into groups
- **Curatorial Workflow**: Content management process using pseudo parents for organization without JSON changes

#### Spatial Terms
- **nzone**: Spatial zone allocated to specific component (Focus Ring nzone, Pyramid nzone)
- **Arc**: Curved path of positioned items
- **Center Angle**: Dynamic angle where magnifier appears
- **Visible Range**: Portion of arc within viewport
- **Nuc**: The nucleus - SVG origin (0, 0) at center of viewport

---

### 8. IMPLEMENTATION PRIORITIES

### 8.1 Immediate: Pseudo Parent System Implementation
**Problem**: Domain-specific code in mobile-renderer.js prevents universal deployment

**Solution Required**:
1. Implement `rpp_` prefix detection in mobile-data.js
2. Add pseudo parent configuration support
3. Update navigation flow in mobile-renderer.js
4. Remove hardcoded 'model', 'family' references
5. Test with marine, Bible, and music catalogs

### 8.2 Critical: Automatic Volume Discovery
**Problem**: Volume list hardcoded in mobile-data.js line 128-131 prevents automatic catalog detection

**Current Implementation**: 
```javascript
const candidateFiles = [
    'mmdm_catalog.json',
    'gutenberg.json',
    'hg_mx.json'  // Must be manually added for each new volume
];
```

**Required Solution**: Automatic detection of Wheel-compatible JSON files
- Server endpoint that lists available `.json` files in catalog directory
- Client-side validation of `wheel_volume_version` property in JSON
- Dynamic volume discovery without code changes
- Enables true plug-and-play catalog deployment

**Impact**: Currently every new catalog requires editing mobile-data.js source code, violating universal architecture principle

### 8.3 Documentation Maintenance
- Update this DESIGNSPEC when adding new components
- Document any new coordinate system interactions  
- Add positioning rules for new navigation zones
- Maintain angle reference table accuracy

---

## Part II: JSON Configuration

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

## Part II: JSON Configuration

### 1. DETAIL SECTOR CONTENT RENDERING

**Coordinate System**: Detail Sector content uses Hub-based Cartesian coordinates
- **contentGroup Transform**: `translate(hubX, hubY)` positions group at Hub center
- **Child Element Coordinates**: All positioned relative to Hub (0, 0)
- **Vertical Flow**: Content positioned vertically using `currentY` accumulator
- **Horizontal Centering**: x=0 represents center of Detail Sector circle

#### Content Types and Positioning

##### Text Elements (Info Views)
- **Position**: x=0 (centered), y=currentY
- **Alignment**: text-anchor="middle" for horizontal centering
- **Vertical Spacing**: Each element increments currentY by height + margin
- **Font Sizes**: Configurable via view templates (typically 12-22px)

##### Audio Player (HTML5 in foreignObject)
- **Element Type**: foreignObject wrapping HTML5 audio element
- **Width**: 280px (playerWidth constant)
- **Height**: 40px (playerHeight constant)
- **X Position**: -playerWidth / 2 (centers player at x=0)
- **Y Position**: currentY (vertical flow position)
- **Spacing**: Returns currentY + playerHeight + 12 (adds bottom margin)

**Audio Player Implementation Details:**
- **Technology**: SVG foreignObject embedding HTML5 `<audio controls>` element when the browser supports it
- **Styling**: Semi-transparent background (rgba(255,255,255,0.1)), 4px border-radius
- **Audio Source**: Configurable base_path + audio_file property from item data
- **Data Pipeline**: audio_file property flattened from item.data into detail context
- **Browser Support**: iOS Safari/DuckDuckGo do not fully support interactive controls inside SVG foreignObject. The system auto-detects this case and renders a tappable "Play Audio Sample" link that opens a native HTML overlay sheet with the audio element, metadata, and close control. The overlay uses standard DOM outside the SVG to guarantee playback on iPhone/iPad.

##### List Views
- **Title**: x=0, y=currentY, bold 16px
- **Items**: x=0, sequential y positions with 16px spacing
- **Empty State**: Centered message when no items available

#### View Configuration Architecture

**Views Array Structure**: Detail sector views defined as array in catalog JSON
```json
"views": [
    {
        "id": "audio_player",
        "type": "audio",
        "audio_file_property": "audio_file",
        "audio_base_path": "assets/mx/"
    },
    {
        "id": "info",
        "type": "info",
        "fields": [...]
    }
]
```

**Critical Implementation Details:**
- Views MUST be array with id properties (not object with keys)
- Array iteration required for proper rendering order
- View types: "audio", "info", "list", "gallery", "links"
- Each view type has specific rendering method in mobile-detailsector.js

#### Content Flow Control

**Vertical Flow Algorithm:**
1. Start at currentY = 100 (below Hub center, in visible area)
2. Render header (if configured)
3. Iterate through views array sequentially
4. Each renderView() returns updated currentY position
5. Next view starts at returned currentY value

**Position Calculation Example (Audio Player):**
- contentGroup translated to (hubX, hubY) = (479.5, -333.5)
- Audio player at x=-140, y=100 (relative to Hub)
- Absolute screen position: x = 479.5 + (-140) = 339.5
- For 375px wide screen, center = 187.5, so player offset from center ≠ 0
- **Note**: x=0 is Hub center, NOT screen center - different coordinate systems

**Why Simple Centering Works:**
- contentGroup transform positions coordinate origin at Hub
- All text uses text-anchor="middle" at x=0
- foreignObject at x = -playerWidth/2 aligns with text centering
- Consistent visual alignment across all content types

#### Data Context for Content Rendering

**Context Object Structure**: Flattened combination of item properties and item.data properties
```javascript
// Created in mobile-data.js getDetailSectorContext()
context = {
    name: item.name,
    key: item.key,
    color: item.color,
    // ... all item properties
    audio_file: item.data.audio_file,  // Flattened from item.data
    year: item.data.year,               // Flattened from item.data
    // ... all item.data properties
}
```

**Template Resolution**: mobile-data.js resolveDetailTemplate() replaces {property} placeholders
- Example: "{name} ({year})" → "Far Away Eyes (1978)"
- Works with any property in flattened context
- Supports nested access for complex data structures

---

### 2. PSEUDO PARENT LEVEL SYSTEM

#### Universal Pseudo Parent Architecture

The Wheel system implements a revolutionary **pseudo parent level system** using curatorial prefix triggers that enable universal, domain-agnostic dynamic hierarchy creation.

##### Core Concept
**Pseudo parents are dynamically created levels that sit "above" (OUT from Hub) the data level containing the trigger.** They provide organizational structure without requiring pre-defined JSON hierarchy changes.

##### Universal Trigger Pattern: `rpp_` Prefix
```json
{
  "model": "LADA_Niva_4x4_1977",
  "political_era": "Soviet",
  "rpp_political_era": true,        // 🔥 Triggers "political_era" pseudo parent
  "fuel_type": "Gasoline", 
  "rpp_fuel_type": true             // 🔥 Triggers "fuel_type" pseudo parent
}
```

##### Navigation Flow Creation
**Before Trigger:** `Manufacturer → Engine → Model`  
**After Trigger:** `Manufacturer → Engine → [political_era] → [fuel_type] → Model`

#### Universal Algorithm (Domain-Agnostic)

##### Pseudo Parent Detection
```javascript
getParentHierarchyLevel(currentLevel, childItem) {
  const currentLevelConfig = this.getHierarchyLevelConfig(currentLevel);
  
  // Check for pseudo parent triggers
  if (currentLevelConfig.supports_pseudo_parents) {
    for (const pseudoParent of currentLevelConfig.supports_pseudo_parents) {
      const triggerProperty = `rpp_${pseudoParent}`;
      if (childItem[triggerProperty] === true) {
        return pseudoParent;  // Create pseudo parent level
      }
    }
  }
  
  // Standard hierarchy progression
  const levelNames = this.getHierarchyLevelNames();
  const currentIndex = levelNames.indexOf(currentLevel);
  return currentIndex > 0 ? levelNames[currentIndex - 1] : null;
}
```

#### Configuration Architecture

##### Hierarchy Level Configuration
```json
"hierarchy_levels": {
  "cylinder": {
    "sort_type": "numeric_desc",
    "supports_pseudo_parents": ["family", "fuel_type"]
  },
  "family": {
    "is_pseudo_parent": true,
    "pseudo_trigger_prefix": "rpp_",
    "pseudo_orphan_group": "Pending Approval",
    "supports_pseudo_parents": ["fuel_type"]  // Nested pseudo parents
  },
  "fuel_type": {
    "is_pseudo_parent": true,
    "pseudo_trigger_prefix": "rpp_",
    "pseudo_orphan_group": "Mixed Fuel"
  }
}
```

#### Cross-Domain Examples

##### Marine Engines
```json
"8": [
  {
    "model": "X8LG",
    "family": "Lightning_Series",
    "rpp_family": true,
    "fuel_type": "Gas",
    "rpp_fuel_type": true
  }
]
```

##### Music Catalog
```json
"1960s": [
  {
    "song": "Paint_It_Black", 
    "venue_type": "Studio",
    "rpp_venue_type": true,
    "recording_session": "Olympic_Studios",
    "rpp_recording_session": true
  }
]
```

##### Medical Equipment
```json
"Cardiac": [
  {
    "device": "Stethoscope_Model_X",
    "certification": "FDA_Approved", 
    "rpp_certification": true,
    "specialization": "Pediatric",
    "rpp_specialization": true
  }
]
```

#### Orphan Adoption System

##### Orphan Classification
Items without `rpp_trigger: true` are considered orphans and adopted into configurable groups:

**Examples:**
- **"Pending Approval"**: Items awaiting curatorial classification
- **"Uncategorized"**: General catch-all group
- **"Studio Only"**: Domain-specific orphan group (music)
- **"Legacy Models"**: Historical items without modern classification

##### Benefits
1. **Universal Pattern**: Works across any data domain
2. **Curatorial Workflow**: Supports content management processes  
3. **Data Consistency**: Maintains navigation structure regardless of data completeness
4. **Non-Dickensian**: Positive naming avoids stigmatizing uncategorized items

#### Implementation Status

**Current State:** Architecture defined, implementation pending  
**Priority:** Critical for eliminating domain-specific code in mobile-renderer.js  
**Complexity:** Medium - requires navigation flow refactoring  
**Impact:** Enables true universal data domain support

---

### GLOSSARY

**Arc Parameters Object**: Data structure from viewport containing Hub coordinates (hubX, hubY), radius, startAngle, endAngle, centerAngle

**Center Angle**: Dynamic angle calculated from Hub to Nuc where magnifier appears (typically 225° - 245° depending on aspect ratio)

**Clock Position**: Angle described using clock face analogy (12:00 = top, 3:00 = right, 6:00 = bottom, 9:00 = left)

**Hub**: The calculated rotational center of the Focus Ring, positioned off-screen using the constitutional formula: hubX = LSd - SSd/2, hubY = -(LSd/2) for portrait mode. Uses polar perspective.

**Hub-Based Polar**: Coordinate system using the Hub as origin with angle and radius measurements for rotational calculations

**Nuc**: The nucleus - the rendering center at SVG origin (0, 0) in the viewport. Uses Cartesian perspective.

**nzone**: Spatial zone allocated to a specific navigation component (Focus Ring nzone, Pyramid nzone)

**Off-Screen Zone**: The 0° - 90° quadrant (12:00 → 3:00) that is invisible on mobile devices

**Polar Coordinate**: Position defined by radius and angle from the Hub origin

**Radians**: Angular measurement used by Math.cos/sin (π radians = 180°)

**Reference Direction**: 0° = East = Right = 3 o'clock (standard mathematical convention used in both Hub and Nuc coordinate systems)

**Visible Range**: The portion of the Focus Ring arc actually displayed in viewport (aspect-ratio dependent)

**Document Version**: 1.2  
**Last Updated**: November 15, 2025 - Split into Part I (Code Implementation) and Part II (JSON Configuration)  
**Related**: STATUS, README.md, mobile-viewport.js, mobile-renderer.js, mobile-detailsector.js

