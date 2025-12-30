# CPUA and DSUA Boundary Definitions

## Overview

This document defines the mathematical formulae and calculations used to create two critical boundary areas in the Wheel interface:

- **DSUA** (Detail Sector Usable Area): A rectangular region clipped by the Focus Ring's inner arc, creating an arc-bounded trapezoid
- **CPUA** (Child Pyramid Usable Area): The area available for spiral node layout, which is DSUA minus the logo exclusion zone (when present)

## Terminology

| Term | Definition |
|------|------------|
| DSUA | Detail Sector Usable Area - arc-bounded trapezoid (rectangle clipped by Focus Ring) |
| CPUA | Child Pyramid Usable Area - DSUA minus logo exclusion |
| SSd | Shorter Side dimension (minimum of viewport width/height) |
| Focus Ring | The circular navigation ring centered at (hubX, hubY) |
| Arc-bounded trapezoid | A quadrilateral with three straight edges and one arc edge |

## Viewport Coordinate System

- Origin: **Top-left corner** (0, 0)
- X-axis: Increases **right**
- Y-axis: Increases **down**
- All calculations use SVG coordinate system

## Common Parameters

### Base Viewport Values

```javascript
const viewport = {
  width,   // Viewport width in pixels
  height,  // Viewport height in pixels
  SSd      // min(width, height)
};
```

### Focus Ring Parameters

```javascript
const { hubX, hubY, radius } = getArcParameters(viewport);
const innerRadius = radius * 0.98;  // 98% of Focus Ring radius
```

### Margin Constants

```javascript
const marginPercent = 0.03;           // 3% of SSd
const topMargin = SSd * marginPercent;
const rightMargin = SSd * marginPercent;
```

### Magnifier Parameters

```javascript
const MAGNIFIER_RADIUS_RATIO = 0.060;
const magnifierRadius = SSd * MAGNIFIER_RADIUS_RATIO;
const magnifierPos = getMagnifierPosition(viewport);
```

## DSUA (Detail Sector Usable Area)

DSUA is an **arc-bounded trapezoid** - a rectangular region that is clipped by the circular arc of the Focus Ring's inner edge. This creates a shape with three straight edges (left, top, right/bottom) and one curved edge (the Focus Ring arc).

### Boundary Formulae

```javascript
// DSUA Rectangle Boundaries
const dsuaLeftX = 0;
const dsuaTopY = 0 + topMargin;
const dsuaRightX = viewport.width - rightMargin;
const dsuaBottomY = Math.min(
  viewport.height, 
  magnifierPos.y - (1.5 * magnifierRadius)
);

// DSUA Dimensions
const dsuaWidth = dsuaRightX - dsuaLeftX;
const dsuaHeight = dsuaBottomY - dsuaTopY;
```

### Clipping by Focus Ring

DSUA is clipped by a circular path following the inner edge of the Focus Ring:

```javascript
// Clip Path Circle
const clipCenterX = hubX;
const clipCenterY = hubY;
const clipRadius = innerRadius;  // 98% of Focus Ring radius
```

**Result**: DSUA is the intersection of:
1. Rectangle from (dsuaLeftX, dsuaTopY) to (dsuaRightX, dsuaBottomY)
2. Circle centered at (hubX, hubY) with radius = 98% of Focus Ring radius

**Geometric Shape**: Arc-bounded trapezoid - a quadrilateral with:
- **Left edge**: Vertical line at x = dsuaLeftX
- **Top edge**: Horizontal line at y = dsuaTopY  
- **Right edge**: Vertical line at x = dsuaRightX
- **Bottom edge**: Either horizontal line at y = dsuaBottomY (if below arc) or clipped by the circular arc
- **Arc edge**: Portion of circle that intersects the rectangle, typically on the right/bottom quadrant

## Logo Exclusion Zone

When a volume logo is present, it occupies a square region in the upper-right corner.

### Logo Bounds Calculation

```javascript
// From VolumeLogo.getBounds()
const logoRadius = SSd * 0.12;           // 12% of SSd
const logoScaleFactor = 1.8;
const logoMargin = SSd * 0.03;

// Full logo size
const fullLogoSize = logoRadius * 2 * logoScaleFactor;

// Exclusion box (80% of full logo size)
const boxSize = fullLogoSize * 0.80;
const boxHalfSize = boxSize / 2;

// Logo center position
const logoCenterX = viewport.width - boxHalfSize - logoMargin;
const logoCenterY = boxHalfSize + logoMargin;

// Logo exclusion square bounds
const logoBounds = {
  left: logoCenterX - boxHalfSize,
  right: logoCenterX + boxHalfSize,
  top: logoCenterY - boxHalfSize,
  bottom: logoCenterY + boxHalfSize,
  boxSize: boxSize,
  centerX: logoCenterX,
  centerY: logoCenterY
};
```

## CPUA (Child Pyramid Usable Area)

CPUA is **DSUA minus the logo exclusion zone** when a logo is present.

### Case 1: No Logo Present

When no logo is configured:

```javascript
CPUA = DSUA  // Identical boundaries
```

### Case 2: Logo Present (L-Shaped CPUA)

When a logo is present, CPUA has an L-shaped boundary:

```javascript
// L-Shape Path (SVG path notation)
const cpuaPath = `
  M ${dsuaLeftX},${dsuaTopY}
  L ${logoBounds.left},${dsuaTopY}
  L ${logoBounds.left},${logoBounds.bottom}
  L ${dsuaRightX},${logoBounds.bottom}
  L ${dsuaRightX},${dsuaBottomY}
  L ${dsuaLeftX},${dsuaBottomY}
  Z
`;
```

**Path explanation**:
1. Start at top-left corner (dsuaLeftX, dsuaTopY)
2. Move right along top edge to logo's left edge
3. Move down to logo's bottom edge
4. Move right to DSUA's right edge
5. Move down to DSUA's bottom edge
6. Move left back to DSUA's left edge
7. Close path back to start

### Logo Exclusion Test

For spiral node placement, test if a point is within the logo exclusion zone:

```javascript
function isInLogoExclusion(x, y) {
  if (!logoBounds) return false;
  
  return (
    x >= logoBounds.left &&
    x <= logoBounds.right &&
    y >= logoBounds.top &&
    y <= logoBounds.bottom
  );
}
```

### Spiral Boundary Checking

For spiral placement, use different right boundaries:

```javascript
// For spiral center calculation (stability)
const cpuaRightXFull = viewport.width - rightMargin;

// For boundary/collision checking
const cpuaRightX = logoBounds 
  ? Math.min(cpuaRightXFull, logoBounds.left - rightMargin)
  : cpuaRightXFull;
```

### CPUA Center (Spiral Origin)

```javascript
const cpuaCenterX = (dsuaLeftX + cpuaRightXFull) / 2;
const cpuaCenterY = (dsuaTopY + dsuaBottomY) / 2;

// Shift spiral center 10% right for better distribution
const spiralCenterX = cpuaCenterX + ((cpuaRightXFull - dsuaLeftX) * 0.1);
const spiralCenterY = cpuaCenterY;
```

## Diagnostic Visualization

### Console Commands

```javascript
showDetailSectorBounds()   // Display DSUA (blue arc-bounded trapezoid)
hideDetailSectorBounds()   // Hide DSUA

showPyramidBounds()        // Display CPUA (red arc-bounded L-shape or trapezoid)
hidePyramidBounds()        // Hide CPUA
```

### Visual Indicators

| Element | Color | Opacity | Pattern | Meaning |
|---------|-------|---------|---------|---------|------|
| DSUA fill | Blue | 0.1 | Solid | Arc-bounded trapezoid area |
| DSUA outline | Blue | 1.0 | Dashed (5,5) | DSUA rectangular bounds |
| CPUA fill | Red | 0.2 | Solid | Arc-bounded (L-shape if logo) |
| CPUA outline | Red | 1.0 | Solid | CPUA boundary |
| Logo exclusion | Orange | 1.0 | Dashed (5,5) | Logo square bounds |
| Clip circle | Blue/Red | 1.0 | Dashed (8,4) | Focus Ring arc (curved edge) |

## Key Relationships

```
DSUA = Arc-bounded trapezoid (rectangle ∩ circular arc)
     = Rectangular bounds clipped by Focus Ring inner circle

If logo present:
  CPUA = DSUA - Logo Exclusion Square
       = Arc-bounded L-shape
  
If no logo:
  CPUA = DSUA
       = Arc-bounded trapezoid

Area of logo exclusion:
  logoArea = boxSize²
  where boxSize = 0.80 × (logoRadius × 2 × 1.8)
```

## Implementation Files

| File | Purpose |
|------|---------|
| `src/diagnostics/child-pyramid-bounds.js` | Diagnostic visualization |
| `src/geometry/child-pyramid.js` | CPUA calculation and spiral placement |
| `src/view/volume-logo.js` | Logo bounds calculation |
| `src/geometry/focus-ring-geometry.js` | Viewport and Focus Ring parameters |

## Constants Reference

```javascript
// Margin ratios (percentage of SSd)
const TOP_MARGIN_RATIO = 0.03;      // 3%
const RIGHT_MARGIN_RATIO = 0.03;    // 3%

// Logo ratios
const LOGO_RADIUS_RATIO = 0.12;     // 12% of SSd
const LOGO_SCALE_FACTOR = 1.8;      // Scale from circle to image
const LOGO_EXCLUSION_RATIO = 0.80;  // 80% of full logo size

// Magnifier ratios
const MAGNIFIER_RADIUS_RATIO = 0.060;  // 6% of SSd
const MAGNIFIER_BOTTOM_MARGIN = 1.5;   // 1.5× magnifier radius

// Focus Ring clip
const FOCUS_RING_CLIP_RATIO = 0.98;    // 98% of Focus Ring radius

// Spiral positioning
const SPIRAL_CENTER_SHIFT_RATIO = 0.1; // 10% right shift
```

## Example Calculation

Given:
- Viewport: 1920×1080 pixels
- SSd = 1080
- hubX = 960, hubY = 540
- Focus Ring radius = 432

Calculate DSUA:
```
topMargin = 1080 × 0.03 = 32.4px
rightMargin = 1080 × 0.03 = 32.4px
magnifierRadius = 1080 × 0.060 = 64.8px
magnifierPos.y = 972px (example)

dsuaLeftX = 0
dsuaTopY = 0 + 32.4 = 32.4px
dsuaRightX = 1920 - 32.4 = 1887.6px
dsuaBottomY = min(1080, 972 - 1.5×64.8) = min(1080, 874.8) = 874.8px

DSUA base rectangle: (0, 32.4) to (1887.6, 874.8)
Clipped by circle at (960, 540) with radius 423.36px (98% of 432)
Result: Arc-bounded trapezoid with curved right/bottom edge
```

Calculate Logo Exclusion:
```
logoRadius = 1080 × 0.12 = 129.6px
fullLogoSize = 129.6 × 2 × 1.8 = 466.56px
boxSize = 466.56 × 0.80 = 373.25px
boxHalfSize = 186.625px

logoCenterX = 1920 - 186.625 - 32.4 = 1700.975px
logoCenterY = 186.625 + 32.4 = 219.025px

Logo exclusion square:
  left: 1514.35px
  right: 1887.6px
  top: 32.4px
  bottom: 405.65px
```

Calculate CPUA:
```
CPUA = Arc-bounded L-shape
     = DSUA (arc-bounded trapezoid) with upper-right logo square removed
Exclusion removes area from (1514.35, 32.4) to (1887.6, 405.65)
Result: L-shaped region with one curved edge (the Focus Ring arc)
```

---

**Version**: 3.7.8  
**Last Updated**: December 30, 2025  
**Related Documents**: ARCHITECTURE_V4.md, CHILD_PYRAMID_REDESIGN.md
