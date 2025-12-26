# Sprocket Wheel & Cousin Navigation (v3 baseline)
**Technical Specification for v2 Implementation**

> v3 delta tracking: This sprocket spec is imported from v2. Record any v3-specific changes (e.g., windowing strategy, gap handling, performance limits) as concise "v3 delta" notes near the relevant sections instead of modifying the original text silently.

## Overview

The Focus Ring implements a **sprocket wheel** metaphor where all items exist on a virtual infinite chain, but only items within the visible viewport arc are rendered. This enables smooth navigation through thousands of items with 60fps performance.

---

## 1. THE SPROCKET WHEEL SYSTEM

### Concept

Imagine a bicycle chain wrapped around a sprocket gear. The entire chain exists, but you only see the portion passing through a small window. As the sprocket rotates, different links pass through the window.

**In Wheel v2**:
- **Full Chain**: All items at current hierarchy level stored in `allFocusItems` array
- **Viewport Window**: Only 11-21 nodes rendered (aspect-ratio dependent)
- **Rotation**: Scrolls the chain through the window, rendering/destroying nodes as needed
- **Performance**: No rendering cost for off-screen items

### Data Structure

```javascript
// State management
const state = {
    allFocusItems: [],           // Full sprocket chain (all items)
    visibleItems: [],             // Currently rendered subset
    rotationOffset: 0,            // Current rotation angle in radians
    magnifierAngle: 2.631,        // Fixed lodestar position (radians)
    viewportWindow: {
        startAngle: 2.436,        // Lower bound of visible arc
        endAngle: Math.PI,        // Upper bound (always 180° = π)
        maxNodes: 11              // Aspect-ratio dependent
    }
};
```

### Viewport Window Calculation

```javascript
// Calculate visible arc range
function calculateViewportWindow(viewportWidth, viewportHeight) {
    const LSd = Math.max(viewportWidth, viewportHeight);
    const SSd = Math.min(viewportWidth, viewportHeight);
    
    // Hub position (v2 formula)
    const hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2;
    const hubY = 0;
    
    // Visible range: from bottom-left corner to 180° (9 o'clock)
    const startAngle = Math.atan2(viewportHeight - hubY, 0 - hubX);
    const endAngle = Math.PI;  // Constitutional constant
    
    // Calculate max visible nodes (aspect-ratio dependent)
    const arcLength = endAngle - startAngle;
    const NODE_SPACING = Math.PI / 42;  // 4.3° constant
    const maxNodes = Math.floor(arcLength / NODE_SPACING);
    
    return {
        startAngle,
        endAngle,
        arcLength,
        maxNodes: Math.min(maxNodes, 21)  // Cap at 21 for square viewports
    };
}
```

### Node Filtering Algorithm

```javascript
// Filter full chain to visible subset
function getVisibleNodes(allItems, rotationOffset, viewportWindow, magnifierAngle) {
    const NODE_SPACING = Math.PI / 42;
    const visibleNodes = [];
    
    allItems.forEach((item, index) => {
        if (item === null) return;  // Skip gap entries
        
        // Calculate node's current angle after rotation
        const baseAngle = magnifierAngle + ((index + 1) * NODE_SPACING);
        const currentAngle = baseAngle + rotationOffset;
        
        // Normalize angle to 0-2π range
        const normalizedAngle = ((currentAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        
        // Check if within visible viewport window
        if (normalizedAngle >= viewportWindow.startAngle && 
            normalizedAngle <= viewportWindow.endAngle) {
            visibleNodes.push({
                item,
                index,
                angle: normalizedAngle,
                x: hubX + radius * Math.cos(normalizedAngle),
                y: hubY + radius * Math.sin(normalizedAngle)
            });
        }
    });
    
    return visibleNodes;
}
```

### Rendering Optimization

**Only render visible nodes**:
- Track previously rendered node IDs
- Remove DOM nodes that scrolled out of view
- Create DOM nodes for items that scrolled into view
- Update positions for nodes that stayed in view

```javascript
function updateFocusRingDisplay(visibleNodes, previousNodeIds) {
    const currentNodeIds = new Set(visibleNodes.map(n => n.item.id));
    
    // Remove nodes that left the viewport
    previousNodeIds.forEach(id => {
        if (!currentNodeIds.has(id)) {
            const element = document.getElementById(`node-${id}`);
            if (element) element.remove();
        }
    });
    
    // Add or update visible nodes
    visibleNodes.forEach(node => {
        let element = document.getElementById(`node-${node.item.id}`);
        
        if (!element) {
            // Create new node
            element = createFocusRingNode(node.item);
            focusRingGroup.appendChild(element);
        }
        
        // Update position
        element.setAttribute('cx', node.x);
        element.setAttribute('cy', node.y);
    });
    
    return currentNodeIds;
}
```

---

## 2. COUSIN NAVIGATION SYSTEM

### Definition

**Cousins** are items at the same hierarchy level that share a common grandparent but have different parents.

### Hierarchy Relationships

```
Grandparent Level (e.g., Genesis)
├── Parent 1 (e.g., Genesis 32)
│   ├── Sibling 1 (Genesis 32:14)
│   ├── Sibling 2 (Genesis 32:15)
│   └── Sibling 3 (Genesis 32:32)
├── [2-node gap]
└── Parent 2 (e.g., Genesis 33)
    ├── Cousin 1 (Genesis 33:1) ← Cousin to Genesis 32 siblings
    ├── Cousin 2 (Genesis 33:2)
    └── Cousin 3 (Genesis 33:3)
```

### Not Cousins

Items from different grandparents are **not** cousins:
```
Grandparent A (Genesis)
└── Parent (Genesis 50)
    └── Child (Genesis 50:26)

Grandparent B (Exodus)  ← Different grandparent
└── Parent (Exodus 1)
    └── Child (Exodus 1:1)  ← NOT a cousin to Genesis 50:26
```

### Implementation Algorithm

```javascript
function getCousinItemsForLevel(item, itemLevel) {
    // Navigate up two levels to find grandparent
    const parentLevel = getPreviousHierarchyLevel(itemLevel);
    if (!parentLevel) {
        // No parent level - return siblings only
        return getSiblingsForItem(item, itemLevel);
    }
    
    const grandparentLevel = getPreviousHierarchyLevel(parentLevel);
    if (!grandparentLevel) {
        // No grandparent level - return siblings only
        return getSiblingsForItem(item, itemLevel);
    }
    
    // Build parent and grandparent items from current item
    const parentItem = buildParentItem(item, parentLevel);
    const grandparentItem = buildParentItem(item, grandparentLevel);
    
    // Get all parents (uncles/aunts) under the grandparent
    const allParents = getChildrenForItem(grandparentItem, parentLevel);
    
    // Find current parent's position
    const currentParentIndex = findItemIndex(allParents, parentItem);
    
    // Only include parents from current parent forward (no wrap-around)
    const parentsToInclude = currentParentIndex >= 0 
        ? allParents.slice(currentParentIndex) 
        : allParents;
    
    // Collect all cousins with gaps
    const cousinsWithGaps = [];
    
    parentsToInclude.forEach((parent, parentIndex) => {
        // Get all children (siblings) under this parent
        const siblings = getChildrenForItem(parent, itemLevel);
        
        // Add all siblings
        cousinsWithGaps.push(...siblings);
        
        // Add 2-node gap after each sibling group (except last)
        if (parentIndex < parentsToInclude.length - 1) {
            cousinsWithGaps.push(null, null);  // Two gap entries
        }
    });
    
    return cousinsWithGaps;
}
```

### Gap Handling in Rendering

Gaps are represented as `null` entries in the items array:

```javascript
// Example array with gaps
const allFocusItems = [
    { id: 'gen32:14', name: 'Genesis 32:14' },
    { id: 'gen32:15', name: 'Genesis 32:15' },
    { id: 'gen32:32', name: 'Genesis 32:32' },
    null,  // Gap 1
    null,  // Gap 2
    { id: 'gen33:1', name: 'Genesis 33:1' },
    { id: 'gen33:2', name: 'Genesis 33:2' },
    { id: 'gen33:3', name: 'Genesis 33:3' }
];
```

**Rendering Rules**:
- `null` entries occupy space in the chain but render nothing
- Maintain spacing calculations including gaps
- Skip `null` when creating DOM nodes
- Handle selection: if gap is at Magnifier, snap to nearest non-null item

```javascript
// Skip gaps during rendering
visibleNodes.forEach(node => {
    if (node.item === null) return;  // Don't render gap
    
    // Render actual node
    createFocusRingNode(node);
});

// Handle gap at Magnifier during selection
function selectItemAtMagnifier(visibleNodes, magnifierAngle) {
    // Find closest item to Magnifier
    let closest = null;
    let minDiff = Infinity;
    
    visibleNodes.forEach(node => {
        if (node.item === null) return;  // Skip gaps
        
        const diff = Math.abs(node.angle - magnifierAngle);
        if (diff < minDiff) {
            minDiff = diff;
            closest = node;
        }
    });
    
    return closest ? closest.item : null;
}
```

---

## 3. ROTATION PHYSICS SYSTEM

### Two-Mode Physics

#### Mode 1: Slow Drag (Precise Crawling)
- **Detection**: Drag velocity < threshold (e.g., 0.5 rad/s)
- **Behavior**: 1:1 mapping of touch/mouse movement to rotation angle
- **Use Case**: Precise positioning between 3-5 nodes

```javascript
function handleSlowDrag(deltaX, deltaY, previousAngle) {
    // Calculate angle change from touch/mouse movement
    const currentAngle = Math.atan2(deltaY - hubY, deltaX - hubX);
    const angleDelta = currentAngle - previousAngle;
    
    // Apply directly (1:1 mapping)
    rotationOffset += angleDelta;
    
    return rotationOffset;
}
```

#### Mode 2: Fast Swipe (Momentum)
- **Detection**: Drag velocity > threshold (e.g., 2.0 rad/s)
- **Behavior**: Momentum continues after release, physics-based deceleration
- **Use Case**: Rapid traversal of 2000 nodes in a few swipes

```javascript
// Physics constants (require tuning/testing)
const FRICTION = 0.95;           // Deceleration coefficient (per frame)
const MIN_VELOCITY = 0.01;       // Stop threshold (rad/frame)
const VELOCITY_THRESHOLD = 2.0;  // Fast swipe detection (rad/s)

let angularVelocity = 0;

function handleFastSwipe(velocity) {
    angularVelocity = velocity;
    
    // Start momentum animation loop
    requestAnimationFrame(updateMomentum);
}

function updateMomentum() {
    if (Math.abs(angularVelocity) < MIN_VELOCITY) {
        angularVelocity = 0;
        handleDragEnd();  // Snap to nearest item
        return;
    }
    
    // Apply velocity to rotation
    rotationOffset += angularVelocity;
    
    // Apply friction (deceleration)
    angularVelocity *= FRICTION;
    
    // Update display
    updateFocusRingDisplay(rotationOffset);
    
    // Continue animation
    requestAnimationFrame(updateMomentum);
}
```

### Velocity Calculation

Track touch/mouse positions over time to calculate velocity:

```javascript
const touchHistory = [];
const HISTORY_WINDOW = 100;  // milliseconds

function trackTouchPosition(angle, timestamp) {
    touchHistory.push({ angle, timestamp });
    
    // Remove old entries
    const cutoff = timestamp - HISTORY_WINDOW;
    while (touchHistory.length > 0 && touchHistory[0].timestamp < cutoff) {
        touchHistory.shift();
    }
}

function calculateVelocity() {
    if (touchHistory.length < 2) return 0;
    
    const first = touchHistory[0];
    const last = touchHistory[touchHistory.length - 1];
    
    const angleDelta = last.angle - first.angle;
    const timeDelta = (last.timestamp - first.timestamp) / 1000;  // Convert to seconds
    
    return angleDelta / timeDelta;  // radians per second
}
```

### Drag End & Snap

When drag ends (or momentum stops), snap to nearest item:

```javascript
function handleDragEnd(rotationOffset, allItems, magnifierAngle) {
    // Find item closest to Magnifier
    const NODE_SPACING = Math.PI / 42;
    let closestItem = null;
    let closestIndex = -1;
    let minDiff = Infinity;
    
    allItems.forEach((item, index) => {
        if (item === null) return;  // Skip gaps
        
        const baseAngle = magnifierAngle + ((index + 1) * NODE_SPACING);
        const currentAngle = baseAngle + rotationOffset;
        const diff = Math.abs(currentAngle - magnifierAngle);
        
        if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
            closestIndex = index;
        }
    });
    
    if (closestItem) {
        // Calculate snap adjustment
        const targetAngle = magnifierAngle + ((closestIndex + 1) * NODE_SPACING);
        const snapAdjustment = magnifierAngle - targetAngle;
        
        // Animate snap or apply immediately
        animateSnap(rotationOffset, rotationOffset + snapAdjustment);
        
        // Update selection
        selectItem(closestItem);
    }
}
```

---

## 4. PERFORMANCE TARGETS

### Frame Rate
- **60fps during rotation**: 16.67ms per frame budget
- **No dropped frames**: Even with 2000-item datasets

### Memory
- **Full chain in memory**: Acceptable (2000 items × 1KB = ~2MB)
- **Rendered nodes**: Only 11-21 DOM nodes at any time
- **No memory leaks**: Clean up removed nodes

### Touch Response
- **< 16ms latency**: From touch to visual update
- **Smooth scrolling**: No jank or stuttering

---

## 5. TESTING REQUIREMENTS

### Test Datasets

#### Small Sets (3-5 items)
- Test precise crawling between nodes
- Verify 1:1 drag mapping
- Ensure no jank with minimal items

#### Medium Sets (50-150 items)
- Bible: Genesis chapters (50), Psalms chapters (150)
- MMdM: Manufacturers (~100)
- Test cousin gaps between sibling groups

#### Large Sets (2000+ items)
- **Synthetic Test**: Create 2000-item JSON
- Verify viewport filtering works
- Test momentum physics
- Confirm 60fps performance
- Validate "few swipes" traversal

### Cousin Navigation Tests

```
Test Case 1: Genesis Verses
├── Genesis 32 (32 verses)
├── [gap]
└── Genesis 33 (20 verses)
Expected: 32 + 2 + 20 = 54 items in Focus Ring

Test Case 2: All Genesis Chapters
├── All 50 Genesis chapters
└── Each chapter's verses with gaps
Expected: Sum of all verse counts + (49 × 2 gaps)

Test Case 3: Cross-Book Boundary
├── Genesis 50:26 (last verse of Genesis)
└── Exodus 1:1 (first verse of Exodus)
Expected: NOT cousins (different grandparents)
         Should require OUT navigation to switch books
```

### Physics Testing

#### Slow Drag Tests
- Drag 1 pixel → rotation angle proportional
- Release → snap to nearest node
- No momentum carry

#### Fast Swipe Tests  
- Swipe velocity > threshold → momentum engages
- Deceleration feels natural
- Can traverse 500 nodes in single swipe
- Can traverse 2000 nodes in 3-4 swipes

#### Mixed Interaction Tests
- Slow drag → fast swipe → slow drag (mode switching)
- Stop mid-momentum with touch
- Rapid direction changes

---

## 6. IMPLEMENTATION CHECKLIST

Phase 1 Sprocket Wheel Tasks:

- [ ] Implement `getCousinItemsForLevel()` with 2-node gaps
- [ ] Build full chain storage (`allFocusItems`)
- [ ] Calculate viewport window based on aspect ratio
- [ ] Implement node filtering (visible subset calculation)
- [ ] Optimize rendering (add/remove/update only changed nodes)
- [ ] Track previously rendered node IDs for delta updates
- [ ] Handle `null` gaps in rendering and selection
- [ ] Implement touch/mouse drag detection
- [ ] Calculate angular velocity from touch history
- [ ] Implement slow drag mode (1:1 mapping)
- [ ] Implement fast swipe mode (momentum physics)
- [ ] Tune friction/deceleration coefficients
- [ ] Implement snap-to-nearest on drag end
- [ ] Handle gap at Magnifier (skip to nearest non-null)
- [ ] Test with 3-5 item dataset (crawling)
- [ ] Test with 50-150 item dataset (medium)
- [ ] Test with 2000 item synthetic dataset (large)
- [ ] Profile frame rate during rotation (target 60fps)
- [ ] Test on multiple devices (iPhone, Android, tablets)
- [ ] Verify no memory leaks after extended use

---

## 7. V1 REFERENCE CODE

Key files to reference from v1 implementation:

- `/mobile/data-query-helper.js` - Lines 45-110 (cousin algorithm)
- `/mobile/focus-ring-view.js` - Lines 214-240 (sprocket chain filtering)
- `/mobile/mobile-config.js` - Lines 56-70 (viewport constants)

---

**Document Version**: 1.0  
**Date**: December 18, 2025  
**Status**: Specification for Phase 1 implementation  
**Related**: ROADMAP.md, v2_DESIGN_SPEC.md, ARCHITECTURE_V2.md
