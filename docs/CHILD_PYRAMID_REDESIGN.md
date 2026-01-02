# Child Pyramid Redesign Specification

> **Superseded note (v3.7.12)**: Current implementation renders the CPUA L-shaped region with fan-lines/spiral/intersections computed by `computeChildPyramidGeometry`, with nodes hidden. The triangular arc-bound pyramid and node placement below are retained for historical reference only.

## Overview

The Child Pyramid is a triangular region displaying a preview of the selected item's children. It sits between the Magnifier and the top-right corner of the viewport, bounded by a convex arc (the Focus Ring / Detail Sector arc) as its hypotenuse.

**Shape**: Right triangle with convex arc hypotenuse
**Purpose**: Show sampled children before full navigation
**Animation**: "Sorting ballet" during IN migration to Focus Ring

---

## Geometry Definition

### The Detail Sector / Child Pyramid Arc

**Critical**: The Child Pyramid boundary arc is **the same arc** as the Detail Sector expanding circle. Both share:
- Same center point (calculated from viewport geometry)
- Same radius (corner-to-corner arc formula)

This is the Focus Ring arc, which also serves as the Detail Sector circle when expanded.

### Arc Center Calculation

The Focus Ring uses the **corner-to-corner arc formula** to calculate the arc that passes through opposite viewport corners. This is the fundamental geometry for the entire interface.

**The Formula:**

```
R = SSd/2 + LSd²/(2×SSd)
```

Where:
- `LSd` = Longer Side Dimension (max of width, height)
- `SSd` = Shorter Side Dimension (min of width, height)  
- `R` = Arc radius

**Arc Center Position (in center-origin coordinates):**

Portrait mode:
```javascript
centerX = R - SSd/2
centerY = -LSd/2
```

Landscape mode:
```javascript
centerX = LSd/2
centerY = -(R - SSd/2)
```

**Implementation (from v0.8.x `mobile-viewport.js`):**

```javascript
getArcParameters() {
    const viewport = this.getViewportInfo();
    const LSd = viewport.LSd;  // Math.max(width, height)
    const SSd = viewport.SSd;  // Math.min(width, height)
    
    // Corner-to-corner arc formula
    const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);
    
    let centerX, centerY;
    
    if (viewport.isPortrait) {
        // Arc passes through (-SSd/2, -LSd/2) and (+SSd/2, +LSd/2)
        centerX = radius - SSd / 2;
        centerY = -(LSd / 2);
    } else {
        // Arc passes through (-LSd/2, -SSd/2) and (+LSd/2, +SSd/2)
        centerX = LSd / 2;
        centerY = -(radius - SSd / 2);
    }
    
    return { centerX, centerY, radius };
}
```

This creates an arc that:
1. Passes through two opposite viewport corners
2. Has its center offset from viewport center (0,0)
3. Creates the maximum usable circular sector
4. Is viewport-responsive (recalculates on resize)

### Child Pyramid Boundaries

The Child Pyramid occupies the region:
- **Vertex 1**: Top-right corner of viewport `(viewportWidth/2, -viewportHeight/2)`
- **Vertex 2**: Magnifier position `(magnifierX, magnifierY)`
- **Hypotenuse**: Arc from Magnifier to top-right corner, following the Detail Sector circle arc

**NOT** bottom-left as previously stated.

### Diagnostic Visualization

A lime green path traces the pyramid boundary:
```
M 0,viewportHeight              // Bottom-left corner
L magnifierX,magnifierY         // Straight line to Magnifier
A radius,radius 0 0,1 0,viewportHeight  // Arc back to corner
Z                               // Close path
```

This diagnostic **must remain available** via debug flag for design work.

---

## Dynamic Node Capacity

### Problem Statement

Current implementation uses hardcoded node counts:
```javascript
// BAD - Fixed counts
{ radiusRatio: 0.75, maxNodes: 7 },
{ radiusRatio: 0.65, maxNodes: 4 },
{ radiusRatio: 0.85, maxNodes: 8 }
// Total: 19 nodes always
```

This fails to adapt to viewport shape. A square viewport has more pyramid space than a tall/skinny portrait viewport.

### Solution: Capacity Calculation

Node capacity must be calculated dynamically based on:
1. **Viewport aspect ratio**: `aspectRatio = viewportWidth / viewportHeight`
2. **Available angular range**: Angle swept by pyramid arc
3. **Minimum spacing**: Nodes must not overlap (visual or hit zones)

### Capacity Formula

```javascript
function calculatePyramidCapacity(aspectRatio, focusRingRadius, magnifierAngle) {
    // Calculate angular range of pyramid arc
    // From magnifier to bottom-left corner
    const cornerAngle = Math.atan2(
        viewportHeight - centerY,
        0 - centerX
    );
    const angularRange = Math.abs(magnifierAngle - cornerAngle);
    
    // Calculate capacity for each arc based on angular range
    const minAngularSpacing = 8 * Math.PI / 180; // 8 degrees minimum
    
    const arcs = [
        { radiusRatio: 0.65, weight: 0.3 },  // Inner arc
        { radiusRatio: 0.75, weight: 0.4 },  // Middle arc
        { radiusRatio: 0.85, weight: 0.3 }   // Outer arc
    ];
    
    const capacityPerArc = arcs.map(arc => {
        const arcLength = arc.radiusRatio * focusRingRadius * angularRange;
        const nodeSpacing = 2 * MOBILE_CONFIG.RADIUS.CHILD_NODE + 8; // Node diameter + gap
        const maxNodesPhysical = Math.floor(arcLength / nodeSpacing);
        const maxNodesAngular = Math.floor(angularRange / minAngularSpacing);
        return Math.min(maxNodesPhysical, maxNodesAngular);
    });
    
    return {
        inner: capacityPerArc[0],   // e.g., 3-5 nodes
        middle: capacityPerArc[1],  // e.g., 5-8 nodes
        outer: capacityPerArc[2],   // e.g., 6-10 nodes
        total: capacityPerArc.reduce((a, b) => a + b, 0)
    };
}
```

### Expected Capacities

| Viewport Shape | Aspect Ratio | Angular Range | Total Capacity |
|----------------|--------------|---------------|----------------|
| Square         | 1.0          | ~90°          | ~20-25 nodes   |
| Portrait 9:16  | 0.56         | ~60°          | ~12-15 nodes   |
| Landscape 16:9 | 1.78         | ~75°          | ~16-20 nodes   |

---

## Sibling Sampling Algorithm

### Problem Statement

When there are more siblings than pyramid capacity (e.g., 150 Psalms chapters, 15 pyramid nodes), we must **sample** intelligently.

### Requirements

1. **Preserve sort order**: Sampled nodes maintain relative ordering
2. **Even distribution**: Sample every Nth sibling where N = totalSiblings / pyramidCapacity
3. **Include first and last**: Always show first and last siblings if possible
4. **Stable**: Same siblings every time (deterministic, not random)

### Sampling Algorithm

```javascript
function sampleSiblings(siblings, pyramidCapacity) {
    const total = siblings.length;
    
    // If siblings fit completely, return all
    if (total <= pyramidCapacity) {
        return siblings;
    }
    
    // Calculate sampling interval
    const interval = total / pyramidCapacity;
    
    // Sample evenly
    const sampled = [];
    for (let i = 0; i < pyramidCapacity; i++) {
        const index = Math.floor(i * interval);
        sampled.push(siblings[index]);
    }
    
    // Ensure last sibling is included (if not already)
    if (sampled[sampled.length - 1] !== siblings[siblings.length - 1]) {
        sampled[sampled.length - 1] = siblings[siblings.length - 1];
    }
    
    return sampled;
}
```

### Example: 150 Psalms, 15 Nodes

```
Sampling interval: 150 / 15 = 10
Sampled chapters: [1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 101, 111, 121, 131, 150]
```

Users see a representative subset. After IN migration, all 150 chapters appear on Focus Ring for complete browsing.

---

## Node Placement: Even Angular Distribution

### Current Problem

Nodes currently fill 3 arcs sequentially with uneven angular spacing:
- Inner arc: 4 nodes at 8° spacing
- Middle arc: 7 nodes at 8° spacing  
- Outer arc: 8 nodes at 8° spacing

This creates **uneven fan line angles** - some dense, some sparse.

### Desired Behavior

**All nodes should have uniform angular spacing** regardless of which arc they're on.

### Placement Algorithm

```javascript
function placeNodesEvenlyAcrossArcs(sampledSiblings, capacity, arcs, magnifierAngle, angularRange) {
    const { inner, middle, outer } = capacity;
    
    // Calculate even angular spacing for ALL nodes combined
    const totalNodes = inner + middle + outer;
    const angleStep = angularRange / (totalNodes + 1); // +1 for padding at edges
    
    // Starting angle (bottom of pyramid)
    const startAngle = magnifierAngle - angularRange / 2;
    
    const nodePlacements = [];
    let siblingIndex = 0;
    
    // Fill inner arc
    for (let i = 0; i < inner; i++) {
        const angle = startAngle + (siblingIndex + 1) * angleStep;
        nodePlacements.push({
            sibling: sampledSiblings[siblingIndex++],
            angle: angle,
            radius: arcs[0].radiusRatio * focusRingRadius,
            arc: 'inner'
        });
    }
    
    // Fill middle arc
    for (let i = 0; i < middle; i++) {
        const angle = startAngle + (siblingIndex + 1) * angleStep;
        nodePlacements.push({
            sibling: sampledSiblings[siblingIndex++],
            angle: angle,
            radius: arcs[1].radiusRatio * focusRingRadius,
            arc: 'middle'
        });
    }
    
    // Fill outer arc
    for (let i = 0; i < outer; i++) {
        const angle = startAngle + (siblingIndex + 1) * angleStep;
        nodePlacements.push({
            sibling: sampledSiblings[siblingIndex++],
            angle: angle,
            radius: arcs[2].radiusRatio * focusRingRadius,
            arc: 'outer'
        });
    }
    
    return nodePlacements;
}
```

### Result

**Even fan line spacing** - each line from Magnifier to pyramid node has uniform angular separation.

---

## The "Sorting Ballet" Animation

### Visual vs. Data Order

User requirement: "I like the seemingly random sorting because the OUT migration animation looks interesting."

**Key insight**: Visual placement order ≠ data sort order

### Implementation Strategy

**Data order**: Siblings sorted by `sort_number` (ascending)
**Visual order**: Nodes placed to create interesting animation patterns

During IN migration (pyramid → focus ring), nodes travel different distances and paths, creating a "ballet" effect.

### Placement Pattern

Use the existing `getCenterOutwardOrder()` logic:
```javascript
// For 7 nodes on an arc
// Visual positions: [3, 4, 2, 5, 1, 6, 0]  (middle first, then alternating)
// But data order: [0, 1, 2, 3, 4, 5, 6]    (sorted by sort_number)
```

This creates the visual "chaos" while maintaining data integrity. During animation:
- Node at visual position 0 (data: 0) travels far left
- Node at visual position 3 (data: 3) stays near center  
- Node at visual position 6 (data: 6) travels far right

**The mix of short/long paths creates the "sorting ballet".**

---

## Collision Detection

### Requirements

1. **No overlap between nodes**: Visual circles + hit zones must not intersect
2. **No overlap with Focus Ring**: Pyramid nodes stay inside pyramid boundary
3. **No overlap with Magnifier**: Pyramid nodes don't touch magnifier circle

### Collision Checks

```javascript
function validateNodePlacement(placement, allPlacements, magnifierPos, focusRingRadius) {
    const nodeRadius = MOBILE_CONFIG.RADIUS.CHILD_NODE;
    const hitRadius = nodeRadius * 1.5;
    const minSeparation = hitRadius * 2 + 4; // Hit zones + 0.6% SSd gap
    
    // Check against all existing nodes
    for (const other of allPlacements) {
        const dx = placement.x - other.x;
        const dy = placement.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minSeparation) {
            return { valid: false, reason: 'Node overlap' };
        }
    }
    
    // Check against magnifier
    const dmx = placement.x - magnifierPos.x;
    const dmy = placement.y - magnifierPos.y;
    const distToMagnifier = Math.sqrt(dmx * dmx + dmy * dmy);
    
    if (distToMagnifier < MOBILE_CONFIG.RADIUS.MAGNIFIER + hitRadius + 8) {
        return { valid: false, reason: 'Magnifier overlap' };
    }
    
    // Check against focus ring (must stay inside pyramid)
    const angle = Math.atan2(placement.y - centerY, placement.x - centerX);
    const distFromCenter = Math.sqrt(
        (placement.x - centerX) ** 2 + 
        (placement.y - centerY) ** 2
    );
    
    if (distFromCenter > focusRingRadius * 0.87) { // Stay inside outer edge
        return { valid: false, reason: 'Outside pyramid boundary' };
    }
    
    return { valid: true };
}
```

If collision detected, **reduce capacity** and recalculate. Never place overlapping nodes.

---

## Arc Configuration

### Fixed Arc Radii (Relative to Focus Ring)

```javascript
const PYRAMID_ARCS = [
    { 
        name: 'inner',
        radiusRatio: 0.65,  // 65% of focus ring radius
        color: '#ff9999'    // Light red (for debugging)
    },
    { 
        name: 'middle',
        radiusRatio: 0.75,  // 75% of focus ring radius
        color: '#99ff99'    // Light green (for debugging)
    },
    { 
        name: 'outer',
        radiusRatio: 0.85,  // 85% of focus ring radius
        color: '#9999ff'    // Light blue (for debugging)
    }
];
```

These ratios are **fixed**. Only the node count per arc varies with viewport.

---

## Fan Lines

### Requirements

1. **One line per node**: From magnifier center to each pyramid node center
2. **Even angular spacing**: Result of even node distribution
3. **Visual style**: 0.15% SSd black stroke, no fill

### Rendering

```javascript
function renderFanLines(nodePlacements, magnifierPos) {
    const lines = [];
    
    for (const placement of nodePlacements) {
        lines.push({
            x1: magnifierPos.x,
            y1: magnifierPos.y,
            x2: placement.x,
            y2: placement.y,
            stroke: 'black',
            strokeWidth: 1
        });
    }
    
    return lines;
}
```

---

## Complete Algorithm Summary

```javascript
// 1. Calculate viewport-responsive capacity
const capacity = calculatePyramidCapacity(aspectRatio, focusRingRadius, magnifierAngle);

// 2. Sample siblings if needed
const sampledSiblings = sampleSiblings(allSiblings, capacity.total);

// 3. Place nodes with even angular spacing
const placements = placeNodesEvenlyAcrossArcs(
    sampledSiblings, 
    capacity, 
    PYRAMID_ARCS, 
    magnifierAngle, 
    angularRange
);

// 4. Apply visual ordering for "sorting ballet"
const reorderedPlacements = applyCenterOutwardOrdering(placements);

// 5. Validate no collisions
const validPlacements = reorderedPlacements.filter(p => 
    validateNodePlacement(p, reorderedPlacements, magnifierPos, focusRingRadius).valid
);

// 6. Render nodes + fan lines
renderPyramidNodes(validPlacements);
renderFanLines(validPlacements, magnifierPos);
```

---

## Testing Requirements

### Unit Tests

- [ ] `calculatePyramidCapacity()` returns correct counts for various aspect ratios
- [ ] `sampleSiblings()` produces even distribution
- [ ] `placeNodesEvenlyAcrossArcs()` creates uniform angular spacing
- [ ] `validateNodePlacement()` detects all collision types

### Integration Tests

- [ ] Square viewport (1:1): ~20-25 nodes, no overlaps
- [ ] Portrait viewport (9:16): ~12-15 nodes, no overlaps
- [ ] Landscape viewport (16:9): ~16-20 nodes, no overlaps
- [ ] 150 siblings: Sampling works, all sampled nodes fit
- [ ] 5 siblings: No sampling, all 5 displayed

### Visual Tests

- [ ] Fan lines have even angular spacing
- [ ] No node overlaps (visual or hit zones)
- [ ] Nodes stay inside lime green pyramid boundary
- [ ] "Sorting ballet" animation during IN migration
- [ ] Smooth transitions when viewport rotates (portrait ↔ landscape)

---

## Edge Cases

### Empty or Few Siblings

```javascript
if (siblings.length === 0) {
    // Hide pyramid completely
    return [];
}

if (siblings.length === 1) {
    // Show single node at middle arc, magnifier angle
    return [{ sibling: siblings[0], angle: magnifierAngle, radius: middleArc.radius }];
}
```

### Extreme Aspect Ratios

```javascript
// Very narrow (tall portrait)
if (aspectRatio < 0.4) {
    // Reduce to 2 arcs (inner + middle only)
    // Capacity: ~8-10 nodes
}

// Very wide (ultrawide landscape)  
if (aspectRatio > 2.5) {
    // Use all 3 arcs but with higher density
    // Capacity: ~25-30 nodes
}
```

### Viewport Resize

```javascript
// When viewport dimensions change
function handleViewportResize() {
    // Recalculate capacity
    const newCapacity = calculatePyramidCapacity(...);
    
    // Re-sample if needed
    const newSample = sampleSiblings(allSiblings, newCapacity.total);
    
    // Re-render pyramid
    renderPyramid(newSample, newCapacity);
}
```

---

## Implementation Checklist

- [ ] Extract geometry calculations to `src/geometry/pyramid.js`
- [ ] Create `calculatePyramidCapacity()` function
- [ ] Create `sampleSiblings()` function  
- [ ] Create `placeNodesEvenlyAcrossArcs()` function
- [ ] Create `validateNodePlacement()` function
- [ ] Add collision detection
- [ ] Preserve `getCenterOutwardOrder()` for sorting ballet
- [ ] Add lime green diagnostic path (debug flag)
- [ ] Write unit tests (80%+ coverage)
- [ ] Test on 3 viewport shapes (square, portrait, landscape)
- [ ] Test with varying sibling counts (1, 5, 15, 50, 150)
- [ ] Verify even fan line spacing visually
- [ ] Verify no overlaps in all test cases

---

## Success Criteria

✅ **Responsive**: Node count adapts to viewport shape
✅ **Optimal**: Maximum nodes that fit without overlap
✅ **Sampled**: Large sibling sets sampled intelligently  
✅ **Even spacing**: Uniform fan line angles
✅ **No overlaps**: Visual and hit zones validated
✅ **Beautiful**: Sorting ballet preserved during animation
✅ **Zero hardcoded values**: Pure calculations from viewport geometry

**When all criteria met, Phase 3 is complete.**
