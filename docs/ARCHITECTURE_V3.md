# Architecture V2 Specification (v3 baseline)

> v3 note: This document is copied verbatim from wheel v2 and serves as the authoritative baseline for v3. Until a v3-specific revision is made, all constitutional constants, layer boundaries, and contracts here remain in force. Add any v3 deltas explicitly near the relevant sections rather than silently diverging.

> **Current state (v3.7.12)**: Child Pyramid now uses the CPUA L-shaped region with fan-lines + spiral intersections via `computeChildPyramidGeometry`; child nodes are not rendered. The triangular arc-bound pyramid described below is historical. Keep this doc as baseline reference only and add explicit v3 deltas when needed.

## v3 Delta Summary (dimension + secondary language)

- **Dimension mode behavior**: Dimension mode applies a blur to the primary focus ring and exposes the mirrored secondary stratum; only the Dimension button toggles mode. Secondary actions must never exit dimension mode.
- **Secondary stratum (language ring)**: Renders mirrored band, magnifier, and nodes while blurred. Secondary magnifier hides fill/label while rotating, matching the primary magnifier.
- **Language selection flow**: Clicking a secondary node only changes the translation. The current primary item is preserved by carrying `item=<id>` and `dimension=1` query params through the redirect.
- **Secondary language order**: Fixed sequence `Hebrew → Greek → Latin → French → Spanish → English → Italian → Portuguese → Russian` (see `buildSecondaryLanguages`).
- **Localized labels**: Book labels use per-language name maps from `data/gutenberg/translations.json` (`names.<language>.books.<BOOK_ID>`), falling back to defaults when missing. Testaments/sections currently fall back to English.
- **URL/query contract**: `translation`, `item`, and `dimension` are the supported params affecting state on reload; keep these stable for shareable links.

## Core Principles

1. **Separation of Concerns**: Geometry, data, view, and interaction are independent modules
2. **Single Source of Truth**: Data flows one direction, state is owned by one module
3. **Pure Functions**: Geometry calculations have no side effects
4. **Clear Contracts**: Interfaces defined, no defensive programming
5. **CSS Owns Presentation**: Zero `!important` flags, no inline styles, no JS font manipulation

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    User Interaction                      │
│              (touch, gestures, commands)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Interaction Layer                       │
│     (rotation-handler, tap-handler, dimension-mode)      │
│         Translates gestures → navigation commands        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Navigation Layer                       │
│      (navigation-state, migration-choreographer)         │
│     Owns current selection, handles IN/OUT migration     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     View Layer                           │
│   (focus-ring-view, child-pyramid-view, detail-view)     │
│         Pure rendering: State → SVG/DOM elements         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Geometry Layer                         │
│     (focus-ring-geometry, child-pyramid-geometry)        │
│        Pure math: Viewport → positions/angles/paths      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Data Layer                           │
│          (volume, schema, item-normalizer)               │
│       Hierarchical data access and normalization         │
└─────────────────────────────────────────────────────────┘
```

---

## Core Abstractions

### 1. Volume

A **Volume** is a complete hierarchical dataset (Bible, Catalog, Music library, Social media archive).

**Responsibilities:**
- Load and parse JSON data
- Provide schema information (levels, properties)
- Navigate hierarchy (get item, get children, get parent)
- Apply dimension filters (language, time, person)

**Interface:**
```javascript
class Volume {
    constructor(data, schema) { }
    
    // Navigation
    getRoot()                    // Returns root item
    getItem(id)                  // Returns item by ID
    getChildren(id)              // Returns array of child items
    getParent(id)                // Returns parent item or null
    getSiblings(id)              // Returns array including item itself
    
    // Schema
    getSchema()                  // Returns schema definition
    getLevelName(depth)          // "Testament", "Book", "Chapter"
    getItemDepth(id)             // 0, 1, 2, etc.
    getMaxDepth()                // 3 for Bible (Testament/Book/Chapter)
    
    // Dimensions
    getDimensions()              // Returns available dimensions
    applyDimension(name, value)  // Filter by dimension
    clearDimensions()            // Reset all filters
    
    // Metadata
    getName()                    // "Bible", "MMdM Catalog"
    getVersion()                 // "v2.0"
}
```

**Example:**
```javascript
const bibleVolume = new Volume(bibleData, bibleSchema);
const root = bibleVolume.getRoot();           // { id: "root", children: ["ot", "nt"] }
const ot = bibleVolume.getItem("ot");         // Old Testament
const books = bibleVolume.getChildren("ot");  // 46 books
const genesis = bibleVolume.getItem("genesis");
const chapters = bibleVolume.getChildren("genesis"); // 50 chapters
```

---

### 2. Schema

A **Schema** defines the structure and properties of a Volume's hierarchy.

**Schema Definition:**
```javascript
{
    "name": "Bible",
    "version": "2.0",
    "levels": [
        {
            "name": "Testament",
            "depth": 0,
            "properties": ["id", "name", "abbreviation"]
        },
        {
            "name": "Book",
            "depth": 1,
            "properties": ["id", "name", "abbreviation", "chapters"]
        },
        {
            "name": "Chapter",
            "depth": 2,
            "properties": ["id", "number", "verses"]
        },
        {
            "name": "Verse",
            "depth": 3,
            "properties": ["id", "number", "text"],
            "isLeaf": true
        }
    ],
    "dimensions": [
        {
            "name": "language",
            "type": "translation",
            "values": ["latin", "hebrew", "greek", "english", "russian"]
        }
    ],
    "root": {
        "id": "root",
        "children": ["ot", "nt"]
    }
}
```

---

### 3. NavigationState

**NavigationState** owns the current selection and manages IN/OUT migration through the hierarchy.

**Responsibilities:**
- Track current item (selected on Focus Ring)
- Track navigation history (breadcrumb trail)
- Execute IN migration (move toward leaves)
- Execute OUT migration (move toward root)
- Notify observers of state changes

**Interface:**
```javascript
class NavigationState {
    constructor(volume) { }
    
    // Current state
    getCurrent()                 // Current selected item
    getCurrentDepth()            // Depth of current item
    getHistory()                 // Array of ancestor IDs
    
    // Navigation commands
    select(itemId)               // Select sibling on Focus Ring
    navigateIn()                 // Migrate to children (Focus → Pyramid → Focus)
    navigateOut()                // Migrate to parent (Focus → Pyramid → Focus)
    jumpTo(itemId)               // Direct navigation (dimension mode)
    
    // Queries
    canNavigateIn()              // True if current has children
    canNavigateOut()             // True if not at root
    
    // Observers
    onChange(callback)           // Subscribe to state changes
    offChange(callback)          // Unsubscribe
}
```

**State Change Events:**
```javascript
{
    type: "select",              // "select", "navigateIn", "navigateOut", "jumpTo"
    from: "genesis",             // Previous item ID
    to: "exodus",                // New item ID
    depth: 1,                    // Current depth
    history: ["root", "ot"]      // Breadcrumb trail
}
```

---

### 4. FocusRingGeometry

**FocusRingGeometry** calculates Focus Ring positions (pure math, no DOM).

**Responsibilities:**
- Calculate arc parameters (center, radius)
- Calculate node positions on arc
- Calculate node capacity based on viewport
- Calculate angles for even distribution

**Interface:**
```javascript
class FocusRingGeometry {
    constructor(viewport) { }
    
    // Arc parameters
    getArcParameters()           // { centerX, centerY, radius }
    
    // Node positioning
    calculateNodePositions(itemCount)  // Array of { x, y, angle, index }
    getNodeCapacity()            // 21 on square, 11 on portrait
    
    // Angles
    getCenterAngle()             // Angle pointing to viewport center
    getAngleForIndex(index, total) // Angle for specific node
    
    // Viewport queries
    getViewportInfo()            // { width, height, LSd, SSd, isPortrait }
}
```

**Example:**
```javascript
const geometry = new FocusRingGeometry(viewport);
const arcParams = geometry.getArcParameters();
// { centerX: 593.19, centerY: -333.5, radius: 780.69 }

const capacity = geometry.getNodeCapacity();
// 21 on square viewport (650x650)
// 11 on portrait viewport (412x915)

const positions = geometry.calculateNodePositions(73); // Bible books
// [ { x, y, angle, index: 0 }, { x, y, angle, index: 1 }, ... ]
```

---

### 5. FocusRingView

**FocusRingView** renders the Focus Ring (pure rendering, no state).

**Responsibilities:**
- Create SVG elements for Focus Ring nodes
- Update node text and styling
- Apply CSS classes for states (selected, dimmed)
- Render magnifying ring
- No touch handling (interaction layer handles that)

**Interface:**
```javascript
class FocusRingView {
    constructor(container, geometry) { }
    
    // Rendering
    render(items, selectedIndex)  // Create/update SVG for items
    updateSelection(index)        // Highlight selected item
    
    // Magnifier
    renderMagnifier(position)     // Draw magnifying ring
    
    // Animation support
    rotateBy(degrees, duration)   // Smooth rotation
    
    // Cleanup
    clear()                       // Remove all SVG elements
}
```

**CSS Contract:**
```css
.focus-ring-node { }              /* Base node styling */
.focus-ring-node.selected { }     /* Selected node */
.focus-ring-node.dimmed { }       /* Unselected nodes */
.focus-ring-text { }              /* Text styling */
.magnifying-ring { }              /* Magnifier styling */
```

---

### 6. ChildPyramidGeometry

**ChildPyramidGeometry** calculates Child Pyramid positions (pure math).

**Responsibilities:**
- Calculate pyramid boundary (right triangle with arc hypotenuse)
- Calculate node capacity (viewport-responsive)
- Calculate fan line angles (even distribution)
- Sample children (e.g., 150 → 15 nodes)
- Detect collisions between text labels

**Interface:**
```javascript
class ChildPyramidGeometry {
    constructor(viewport, focusRingGeometry) { }
    
    // Boundary
    getPyramidBounds()           // { vertices, arcParams }
    
    // Capacity
    calculateNodeCapacity()      // Dynamic: 8-25 nodes
    
    // Sampling
    sampleChildren(children, capacity) // Array of sampled items
    
    // Positioning
    calculateNodePositions(count) // Array of { x, y, angle, index }
    
    // Collision detection
    detectCollisions(positions, fontSize) // Array of collision pairs
}
```

---

### 7. ChildPyramidView

**ChildPyramidView** renders the Child Pyramid (pure rendering).

**Responsibilities:**
- Create SVG elements for pyramid nodes
- Render fan lines from magnifier to nodes
- Apply CSS classes for styling
- Animate "sorting ballet" during migration
- No touch handling

**Interface:**
```javascript
class ChildPyramidView {
    constructor(container, geometry) { }
    
    // Rendering
    render(items, magnifierPos)   // Create/update SVG
    
    // Animation
    animateSortingBallet(from, to, duration) // IN migration animation
    
    // Diagnostic
    renderBoundary(bounds)        // Lime green triangle (debug mode)
    
    // Cleanup
    clear()                       // Remove all SVG elements
}
```

---

### 8. DetailSectorView

**DetailSectorView** renders the Detail Sector with plugins.

**Responsibilities:**
- Expand/collapse circular sector
- Load appropriate plugin for content type
- Pass content to plugin for rendering
- Handle scrolling within sector
- No touch handling (except scroll)

**Interface:**
```javascript
class DetailSectorView {
    constructor(container, geometry, pluginRegistry) { }
    
    // Rendering
    render(item, plugin)          // Expand with content
    collapse(duration)            // Shrink to Focus Ring
    
    // Plugin management
    setPlugin(pluginName)         // Switch plugin
    
    // Scrolling
    scrollTo(position)            // Scroll content
    
    // Cleanup
    clear()                       // Remove all elements
}
```

---

### 9. PluginRegistry

**PluginRegistry** manages Detail Sector content plugins.

**Responsibilities:**
- Register plugins for content types
- Select appropriate plugin for item
- Provide plugin interface contract

**Interface:**
```javascript
class PluginRegistry {
    constructor() { }
    
    // Registration
    register(name, plugin)        // Add plugin
    unregister(name)              // Remove plugin
    
    // Selection
    getPlugin(item)               // Get plugin for item type
    
    // Query
    list()                        // Array of registered plugin names
}
```

**Plugin Interface:**
```javascript
class Plugin {
    // Must implement these methods
    canHandle(item)               // Returns true if plugin handles this item
    render(item, bounds)          // Returns DOM elements
    onResize(bounds)              // Handle viewport changes
    cleanup()                     // Clean up resources
}
```

---

### 10. RotationChoreographer

**RotationChoreographer** manages continuous Focus Ring rotation with momentum physics.

**Responsibilities:**
- Own visual rotation state (angle offset from neutral)
- Apply momentum animation with deceleration
- Detect selection threshold crossings
- Emit selection change commands
- Handle touch interruptions during momentum

**Interface:**
```javascript
class RotationChoreographer {
    constructor(geometry, navigationState) { }
    
    // Rotation state
    getVisualRotation()           // Current visual rotation angle (radians)
    
    // Rotation commands (from interaction layer)
    rotate(angleDelta)            // Apply rotation (immediate visual update)
    startMomentum(velocity)       // Begin momentum animation
    stopMomentum()                // Cancel momentum animation
    
    // Selection detection
    onSelectionChange(callback)   // Subscribe to threshold crossings
    
    // Reset
    resetRotation()               // Reset visual rotation to 0
}
```

**Continuous Rotation Model:**
- Visual rotation accumulates continuously during drag
- Selection changes when rotation crosses threshold (±15°)
- Visual rotation resets to 0 when selection changes
- Momentum continues rotation after touch release
- Deceleration factor: 0.95 per frame
- Minimum velocity: 0.001 radians/frame

**Example Flow:**
```javascript
// User drags 20° clockwise
choreographer.rotate(-0.349);  // -20° = -0.349 radians
// Visual rotation now -0.349, no selection change yet

// User continues dragging to -18° total
choreographer.rotate(-0.035);  // Additional -2°
// Crosses threshold (-15°), selection changes
// Event emitted: { type: 'select', delta: +1 }
// Visual rotation reset to -0.052 (remainder after threshold)

// User releases with velocity
choreographer.startMomentum(-0.02);
// Momentum animation begins, velocity decays by 0.95/frame
// Additional selection changes occur if thresholds crossed
// Stops when velocity < 0.001
```

### 11. MigrationChoreographer

**MigrationChoreographer** orchestrates animations during IN/OUT navigation.

**Responsibilities:**
- Coordinate multi-view animations
- Timing and easing functions
- Ensure views animate together
- Handle interruptions (user touch during animation)

**Interface:**
```javascript
class MigrationChoreographer {
    constructor() { }
    
    // Choreography
    choreographIn(from, to)       // IN migration animation
    choreographOut(from, to)      // OUT migration animation
    
    // Control
    pause()                       // Pause current animation
    resume()                      // Resume paused animation
    cancel()                      // Cancel and reset
    
    // Timing
    getDuration(migrationType)    // Standard duration (800ms)
    getEasing(migrationType)      // Easing function
}
```

**IN Migration Sequence:**
1. Fan lines and parent button line disappear (instant)
2. Child Pyramid nodes perform "sorting ballet" to Focus Ring (300ms)
   2a. Selected pyramid node migrates from pyramid to Magnifier
   2b. Unselected pyramid nodes move to Focus Ring
   2c. Magnifier node moves to Parent Button
   2d. Parent Button moves off-screen
3. New nodes appear in Child Pyramid OR Detail Sector enlarges for leaf (instant)
4. Fan lines and parent button line reappear (instant)

**OUT Migration Sequence:**
Reverse of above.

**Visual Changes:**
- No fading (opacity changes) except Detail Sector circle when enlarged
- Items either animate (move smoothly) or pop (appear/disappear instantly)
- Colors set per volume/dimension, never change during navigation
- All visual transitions must be approved before implementation

---

### 12. DimensionSystem

**DimensionSystem** manages meta-navigation (language, time, person filters).

**Responsibilities:**
- Track active dimensions
- Apply dimension filters to volume
- Switch between normal/dimension modes
- Render dimension button and dimension ring

**Interface:**
```javascript
class DimensionSystem {
    constructor(volume) { }
    
    // Mode
    isActive()                    // True if in dimension mode
    activate()                    // Enter dimension mode
    deactivate()                  // Exit dimension mode
    
    // Dimensions
    setDimension(name, value)     // Set dimension filter
    getDimension(name)            // Get current value
    clearDimension(name)          // Remove filter
    clearAll()                    // Remove all filters
    
    // Available dimensions
    getDimensions()               // Array of { name, values }
    
    // Observers
    onChange(callback)            // Subscribe to changes
}
```

---

## Data Flow

### Read Path (Rendering)

```
Volume
  ↓
NavigationState.getCurrent()
  ↓
FocusRingGeometry.calculateNodePositions()
  ↓
FocusRingView.render()
  ↓
SVG Elements in DOM
```

### Write Path (User Interaction)

```
User Touch
  ↓
RotationHandler.onTouchMove()
  ↓
RotationChoreographer.rotate(angleDelta)
  ↓
Visual Rotation Updated (continuous)
  ↓
FocusRingView.render(visualRotation) [every frame]
  ↓
[When threshold crossed]
  ↓
RotationChoreographer emits selection change
  ↓
NavigationState.select(newItemId)
  ↓
State Change Event
  ↓
RotationChoreographer.resetRotation()
  ↓
FocusRingView.render(0) [reset visual rotation]
```

### Migration Path (IN Navigation)

```
User Tap on Pyramid Node
  ↓
TapHandler.onTap()
  ↓
NavigationState.navigateIn()
  ↓
MigrationChoreographer.choreographIn()
  ↓
Multiple Views Animate (Pyramid → Focus → Pyramid)
  ↓
State Change Event
  ↓
All Views Re-render
```

---

## Module Boundaries

### What Each Module CAN Do

**Geometry Modules** (focus-ring-geometry, child-pyramid-geometry):
✅ Read viewport dimensions
✅ Perform mathematical calculations
✅ Return position objects
✅ Cache calculation results
❌ Access DOM
❌ Maintain navigation state
❌ Handle user input

**View Modules** (focus-ring-view, child-pyramid-view, detail-view):
**Interaction Modules** (rotation-handler, tap-handler):
✅ Listen to DOM events (touch, mouse)
✅ Calculate gesture parameters (angle, velocity)
✅ Send rotation commands to choreographer
✅ Prevent default browser behaviors
❌ Update DOM directly
❌ Maintain navigation state
❌ Maintain rotation state (choreographer owns this)
❌ Perform geometric calculations (geometry layer does this)

**Choreographer Modules** (rotation-choreographer, migration-choreographer):
✅ Own animation state (visual rotation, momentum)
✅ Run animation loops (requestAnimationFrame)
✅ Detect threshold crossings
✅ Emit commands to navigation state
✅ Request view updates
❌ Handle touch events (interaction layer does this)
❌ Maintain navigation state (navigation layer does this)
❌ Update DOM directly (view layer does this)
❌ Perform geometric calculations (geometry layer does this)
❌ Use `!important` in CSS

**Interaction Modules** (rotation-handler, tap-handler):
✅ Listen to DOM events (touch, mouse)
✅ Calculate gesture parameters (angle, velocity)
✅ Send commands to navigation state
✅ Prevent default browser behaviors
❌ Update DOM directly
❌ Maintain navigation state
❌ Perform geometric calculations

**Navigation Module** (navigation-state):
✅ Own current selection
✅ Maintain history stack
✅ Validate navigation commands
✅ Emit state change events
❌ Update DOM
❌ Handle touch events
❌ Perform geometric calculations

**Data Module** (volume, schema):
✅ Load and parse JSON
✅ Navigate hierarchy
✅ Apply dimension filters
✅ Normalize item data
❌ Update DOM
❌ Handle touch events
❌ Maintain navigation state

---

## Contracts

### 1. Geometry → View Contract

Geometry modules return **pure data objects** describing positions:

```javascript
// FocusRingGeometry returns:
{
    x: 120.5,           // SVG coordinate
    y: -45.3,           // SVG coordinate
### 3. Interaction → Choreographer Contract

Interaction modules send **rotation deltas** to choreographer:

```javascript
// Rotation handler does this:
rotationChoreographer.rotate(angleDelta);

// NOT this:
navigationState.select(newItemId);        // ❌ Skip layer
focusRingView.updateSelection(newIndex);  // ❌ Wrong layer
```
### 5. Navigation → View Contract

Navigation state emits **events**, views listen and re-render:
Choreographer detects thresholds and sends **selection commands**:

```javascript
// Rotation choreographer does this:
if (Math.abs(accumulatedRotation) >= threshold) {
    const delta = accumulatedRotation > 0 ? -1 : 1;
    navigationState.selectOffset(delta);  // Relative selection
    this.resetRotation();
}

// NOT this:
### 6. Choreographer → View Contract

Choreographer requests **visual updates** with rotation offset:

```javascript
// Rotation choreographer does this:
this.onRender(this.visualRotation);

// View responds:
rotationChoreographer.onRender((rotation) => {
    this.render(items, selectedIndex, rotation);
});
```

### 7. Volume → Schema Contract

Volume validates data against schema at load time:
// View does this:
node.classList.add('focus-ring-node', 'selected');

// CSS does this:
.focus-ring-node { font-size: 3.4%; } /* % of SSd */
.focus-ring-node.selected { font-size: 4.5%; } /* % of SSd */
```

**Zero inline styles.** **Zero `!important` flags.**

### 3. Interaction → Navigation Contract

Interaction modules send **commands**, not DOM updates:

```javascript
// Rotation handler does this:
navigationState.select(newItemId);

// NOT this:
focusRingView.updateSelection(newIndex); // ❌ Wrong layer
```

### 4. Navigation → View Contract

Navigation state emits **events**, views listen and re-render:

```javascript
// Navigation does this:
navigationState.emit('change', { type: 'select', to: 'genesis' });

// View does this:
navigationState.onChange((event) => {
    this.render(event.to);
});
```

### 5. Volume → Schema Contract

Volume validates data against schema at load time:

```javascript
// Schema defines structure:
{ "name": "Book", "properties": ["id", "name", "chapters"] }

// Volume validates:
if (!item.id || !item.name) {
    throw new Error('Invalid book item: missing required properties');
}
```

---

## Error Handling

### Principle: Fail Fast, Fail Loudly

**No defensive programming.** If a contract is violated, throw an error immediately:

```javascript
// ✅ Good
if (!item) {
    throw new Error('FocusRingView.render: item is required');
}

// ❌ Bad (v1 style)
if (!item) {
    Logger.warn('No item, using fallback...');
    item = this.fallbackItem || {};  // Defensive
}
```

### Error Types

**Programming Errors** (bugs in our code):
- Throw immediately
- Include context (module, method, parameters)
- Never catch (let it crash, fix the bug)

**User Errors** (invalid data files):
- Validate at load time
- Show clear error message
- Don't let app start with invalid data

**Runtime Errors** (network failures):
- Retry with exponential backoff
- Show user-friendly message
- Provide fallback behavior

---

## Testing Strategy

### Unit Tests (Geometry, Data)

Pure functions are easy to test:

```javascript
test('FocusRingGeometry calculates correct node capacity', () => {
    const viewport = { width: 650, height: 650, LSd: 650, SSd: 650 };
    const geometry = new FocusRingGeometry(viewport);
    
    expect(geometry.getNodeCapacity()).toBe(21);
});
```

### Integration Tests (Views + Geometry)

Test that views correctly render geometry:

```javascript
test('FocusRingView renders nodes at calculated positions', () => {
    const geometry = new FocusRingGeometry(viewport);
    const view = new FocusRingView(container, geometry);
    const items = [{ id: 'a' }, { id: 'b' }];
    
    view.render(items, 0);
    
    const nodes = container.querySelectorAll('.focus-ring-node');
    expect(nodes.length).toBe(2);
});
```

### System Tests (Full Navigation)

Test complete user flows:

```javascript
test('User can navigate from Testament to Book to Chapter', () => {
    const app = new App(bibleVolume);
    
    // Start at root
    expect(app.getCurrent().id).toBe('root');
    
    // Select OT and navigate in
    app.select('ot');
    app.navigateIn();
    expect(app.getCurrent().id).toBe('ot');
    
    // Select Genesis and navigate in
    app.select('genesis');
    app.navigateIn();
    expect(app.getCurrent().id).toBe('genesis');
});
```

---

## Migration from V1

### What We're Keeping

### Phase 1: Focus Ring + Magnifier
1. Implement FocusRingGeometry (pure math)
2. Test geometry with 73 Bible books
3. Implement FocusRingView (SVG rendering with rotation offset)
4. Test rendering on square/portrait/landscape
5. Implement RotationHandler (touch → rotation delta)
6. Test angular delta calculation
7. Implement RotationChoreographer (continuous rotation + momentum)
8. Test momentum physics feel
9. Implement NavigationState (selection only)
10. Wire layers: Handler → Choreographer → State → View
11. **Test until perfect**: 60fps, smooth feel, clean code, < 600 lines total
12. If physics don't feel right: **Tune constants and test again**
13. If architecture needs revision: **Start over** fail fast
🔧 **No more data transformations**: Single normalization at load
🔧 **No more unclear ownership**: Each module has clear responsibilities
🔧 **No more hardcoded px**: All geometry calculated from viewport
🔧 **No more Strategy 1/2/3**: One clean implementation

### What We're Removing

❌ Desktop mode (mobile-first only)
❌ Inline font calculations in JS
❌ 33 `!important` flags
❌ Multiple data transformation layers
❌ Defensive fallback logic
❌ Legacy coordinate system complexity

---

## Performance Targets

### Frame Rate
- **60fps** during rotation (16.67ms per frame)
- **60fps** during migration animations
- No jank, no dropped frames

### Load Time
- **< 1 second** to first render (Bible volume)
- **< 2 seconds** for large volumes (MMdM catalog)
- Progressive loading for huge datasets

### Memory
- **< 50MB** for Bible volume
- **< 200MB** for MMdM catalog
- No memory leaks (test with 1000 navigations)

### Viewport Responsiveness
- **< 100ms** to recalculate geometry on resize
- Debounce resize events (wait for user to finish)
- Cache calculations aggressively

---

## Development Workflow

### Phase 1: Focus Ring + Magnifier
1. Implement FocusRingGeometry (pure math)
2. Test geometry with 73 Bible books
3. Implement FocusRingView (SVG rendering)
4. Test rendering on square/portrait/landscape
5. Implement RotationHandler (touch → command)
6. Test rotation gesture detection
7. Implement NavigationState (selection only)
8. Wire everything together
9. **Test until perfect**: No bugs, clean code, < 500 lines total
10. If architecture needs revision: **Start over**

### Phase 2: Dimension Button
1. Implement DimensionSystem state machine
2. Implement dimension button view
3. Repurpose Focus Ring for dimension display
4. Test mode transitions
5. Wire to Volume dimension filters
6. **Test until perfect**

### Phase 3: Child Pyramid + Parent Button
1. Implement ChildPyramidGeometry (per spec)
2. Test capacity calculation with various viewports
3. Implement sampling algorithm
4. Test with Genesis (50), Psalms (150), Matthew (28)
5. Implement ChildPyramidView
6. Implement TapHandler (tap → navigateIn)
7. Implement MigrationChoreographer
8. Test IN/OUT migrations
9. **Test until perfect**

### Phase 4: Detail Sector
1. Design plugin API
2. Implement PluginRegistry
3. Implement DetailSectorView
4. Create BibleTextPlugin (verse wrapper)
5. Create CatalogCardPlugin (product display)
6. Test with varying content lengths
7. Test with dimension filters
8. **Test until perfect**

---

## Success Criteria

### Code Quality
✅ Zero `!important` flags
✅ Zero inline styles
✅ Zero defensive "Strategy 1/2/3" patterns
✅ < 2000 lines total (vs 12,628 in v1)
✅ Every module < 200 lines
✅ 100% test coverage for geometry
✅ Zero ESLint warnings

### User Experience
✅ 60fps throughout
✅ Smooth rotations with no jank
✅ Instant viewport responsiveness
✅ Intuitive navigation (no surprises)
✅ Works on square, portrait, landscape
✅ Handles edge cases gracefully (0 children, 1 child, 1000 children)

### Architecture
✅ Clear module boundaries (no cross-layer violations)
✅ Pure functions for geometry (100% testable)
✅ Single source of truth for state
✅ No data transformation layers
✅ CSS and JS never fight
✅ Easy to add new volumes (just provide JSON + schema)
✅ Easy to add new plugins (implement interface, register)

---

## Future Extensibility

### New Volumes
To add a new volume (Music library, Social media):
1. Create JSON data file
2. Define schema
3. Implement data loader (if format differs)
4. Register with app
5. **No code changes to core**

### New Plugins
To add a new Detail Sector plugin (Map view, Timeline):
1. Implement Plugin interface
2. Register with PluginRegistry
3. Add CSS styling
4. **No changes to core views**

### New Dimensions
To add a new dimension (Person, Place):
1. Add to schema
2. Implement filter logic in Volume
3. Add to dimension registry
4. **No changes to navigation or views**

### New Gestures
To add a new gesture (pinch zoom, swipe):
1. Implement new handler in interaction layer
2. Send commands to NavigationState
3. **No changes to views or geometry**

---

## Conclusion

This architecture is designed for:
- **Clarity**: Every module has one job
- **Testability**: Pure functions everywhere possible
- **Maintainability**: Change one thing, break nothing else
- **Extensibility**: Add volumes/plugins/dimensions without core changes
- **Performance**: 60fps, no jank, instant responsiveness
- **Quality**: Build it right or start over

**No compromises.** This is the foundation we build on.
