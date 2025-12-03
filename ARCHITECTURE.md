# Architecture Overview

Technical documentation for Wheel's navigation system.

## Core Concept

Wheel uses rotational gestures to navigate hierarchical data on mobile devices. Instead of scrolling through lists, users rotate an arc of items and tap to navigate deeper into the hierarchy.

## Module Structure

Wheel is built with ES6 native modules (no build process). Each module has a specific responsibility:

```
mobile/
├── catalog_mobile_modular.js    # Entry point, loads all modules
├── mobile-app.js               # Application controller, lifecycle
├── mobile-config.js            # Constants and configuration
├── mobile-data.js              # Data loading and navigation
├── mobile-logger.js            # Debug logging system
├── mobile-renderer.js          # SVG rendering and UI updates
├── mobile-animation.js         # Animation system (IN/OUT migrations)
├── mobile-touch.js             # Touch event handling
├── mobile-viewport.js          # Viewport calculations
├── mobile-coordinates.js       # Coordinate system (Hub/Nuc)
├── mobile-childpyramid.js      # Child item preview display
└── mobile-detailsector.js      # Content detail view (Gutenberg verse rendering)
```

### Module Responsibilities

**mobile-data.js**
- Loads JSON catalog files
- Provides navigation API (getChildren, getParent, etc.)
- Handles virtual hierarchy levels
- Domain-agnostic (works with any hierarchical JSON)

**mobile-renderer.js**
- Creates SVG elements for navigation UI
- Updates positions based on rotation angle
- Manages Focus Ring, Child Pyramid, Parent Button
- Handles UI state transitions

**mobile-animation.js**
- Manages all nzone migration animations (600ms transitions)
- IN animations (Child Pyramid → Focus Ring)
- OUT animations (Focus Ring → Child Pyramid)
- Animation stack for smooth reversals (LIFO)
- Magnifier and Parent Button position animations

**mobile-coordinates.js**
- Bilingual coordinate system (Hub polar / Nuc cartesian)
- Coordinate transformations and conversions
- Coordinate caching for performance

**mobile-touch.js**
- Processes touch events (start, move, end)
- Calculates rotation based on swipe distance
- Implements momentum physics
- Detects tap vs. swipe gestures

**mobile-viewport.js**
- Calculates viewport-specific positioning
- Handles portrait/landscape orientation
- Computes arc parameters based on aspect ratio
- Provides coordinate transformations

**mobile-app.js**
- Coordinates all modules
- Handles navigation flow (IN/OUT/rotate)
- Manages application state
- Error handling and recovery

**mobile-childpyramid.js**
- Renders child item preview nodes in concentric arcs
- Manages Child Pyramid visibility and transitions
- Handles child item click events for IN navigation

**mobile-detailsector.js**
- Displays detailed content for leaf items
- Gutenberg Bible verse rendering with arc-aware layout
- Dynamic font sizing (SSd-relative)
- `buildLineTable()`: Computes per-line positions and widths based on arc intersection
- `wrapTextWithLineTable()`: Variable-width text wrapping for curved boundaries
- `getContentBounds()`: Calculates usable content area within Focus Ring arc
- Error handling and recovery

## Coordinate Systems

Wheel's entire spatial model is built on **two fundamental points**: the **Nuc** and the **Hub**. These twin origins define all positioning in the system.

### The Nuc (Nucleus) - On-Screen Origin
- **Position**: Center of viewport at SVG origin (0, 0)
- **Coordinate system**: Cartesian (x, y)
- X-axis: positive right, negative left
- Y-axis: positive down, negative up (SVG standard)
- **Purpose**: Rendering center - where users see the interface

### The Hub - Off-Screen Origin  
- **Position**: Calculated point off-screen (portrait mode: upper-right)
- **Coordinate system**: Polar (angle, radius)
- 0° = East (3 o'clock), increases clockwise
- **Purpose**: Rotational center - items arc around this point

### Dual-Origin Architecture

Just as the viewport has only one center (Nuc), the program knows only one rotational origin (Hub). These two points form the twin lodestars of all code:

1. **Hub defines the arc geometry** - Focus Ring radius, item positions
2. **Nuc defines the visible space** - What appears on screen
3. **All positioning derives from their relationship** - Every element position is calculated from Hub, then rendered relative to Nuc

**Hub Position Formula (portrait mode):**

The Hub position and Focus Ring radius use a **corner-to-corner arc formula**. The arc enters the viewport at the upper-left corner and exits at the lower-right corner.

```javascript
// Focus Ring Radius: Using "Radius from Chord and Arc Height" formula
// Arc height (sagitta) = SSd, Chord length = 2 × LSd
// R = SSd/2 + LSd²/(2×SSd)
const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);

// Hub Position (portrait mode):
// X = Radius - SSd/2
// Y = -LSd/2
const hubX = radius - (SSd / 2);
const hubY = -(LSd / 2);
```

**Example for iPhone SE (375 × 667):**
- SSd = 375, LSd = 667
- Radius = 187.5 + 444889/750 = **780.69 px**
- Hub = (593.19, -333.5)

The arc passes exactly through corners (-187.5, -333.5) and (+187.5, +333.5).

**Focus Ring Band:**
- Inner edge: 99% of radius
- Outer edge: 101% of radius
- Text margin arc: 98% of radius (1% padding inside Focus Ring)

## Navigation Model

### Focus Ring
- Arc of items at current hierarchy level
- Rotates clockwise/counterclockwise with swipe gestures
- Center item (in "magnifier") is focused
- Tapping focused item navigates IN or shows details

### Child Pyramid
- Preview of child items available from focused item
- Arranged in concentric arcs
- Tapping child item navigates IN to that child

### Parent Button
- Returns to previous hierarchy level (OUT navigation)
- Shows context breadcrumb
- Hidden when at top level

### Detail Sector
- Expands to show item content (text, images, specs)
- Appears for leaf items (no children)
- Navigation remains visible while expanded

## Nzone Migration Animations

### IN Animation (Child Pyramid → Focus Ring)
When a child item is clicked:
1. All sibling nodes are cloned from Child Pyramid
2. CSS transforms applied: `translate(translateX, translateY) rotate(rotationDelta)`
3. Circles animate radius from `CHILD_NODE` to `MAGNIFIED` or `UNSELECTED`
4. Nodes saved to `lastAnimatedNodes` with `opacity: 0` for reuse
5. Duration: 600ms ease-in-out

### OUT Animation (Focus Ring → Child Pyramid)
When Parent Button is clicked:
1. Reuses saved `lastAnimatedNodes` from IN animation
2. CSS transforms reset: `translate(0, 0) rotate(0deg)`
3. Returns nodes to original SVG `transform` attribute positions
4. Circles animate radius back to `CHILD_NODE` size
5. Animated nodes removed after 600ms animation completes
6. Fresh Child Pyramid rendered for selected Focus Ring item
7. Duration: 600ms ease-in-out

**Parent Button Navigation**:
- `forceImmediateFocusSettlement` flag prevents rotation delay
- `lastRotationOffset` pre-set to avoid triggering rotation detection
- Child Pyramid remains visible throughout OUT → Focus Ring update sequence
- Prevents flash/disappearance during navigation transitions

### Animation Architecture
- **SVG Positions**: Set via `transform` attribute on `<g>` elements
- **CSS Transforms**: Applied via `style.transform` for animation
- **Transform Origin**: Set to node's SVG position for rotation around self
- **State Persistence**: Animated nodes stored in stack per hierarchy level for multi-level navigation
- **Stack Management**: Push `{level, nodes}` on IN animation, pop on OUT animation (LIFO)
- **Coordinate System**: All calculations in SVG viewport coordinates (origin at center)

### Technical Implementation
```javascript
// IN: Apply CSS transform from Child Pyramid position
node.style.transformOrigin = `${startX}px ${startY}px`;
node.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotationDeg}deg)`;

// OUT: Reset CSS transform to return to original position
node.style.transform = `translate(0, 0) rotate(0deg)`;
```

The elegance: OUT animation simply "undoes" the CSS transform, returning nodes to their SVG attribute positions without complex coordinate math.

## Data Format

Catalogs are JSON files with this structure:

```json
{
  "CatalogName": {
    "display_config": {
      "wheel_volume_version": "1.0",
      "volume_schema_version": "1.0.0",
      "hierarchy_levels": {
        "level1": {
          "color": "#FF6B6B",
          "sort_type": "alphabetical"
        },
        "level2": {
          "color": "#4ECDC4",
          "sort_type": "numeric"
        }
      }
    },
    "data": {
      "level1_items": {
        "item_id": {
          "name": "Display Name",
          "level2_items": { /* nested items */ }
        }
      }
    }
  }
}
```

### Key Properties

**display_config:**
- `hierarchy_levels`: Defines structure, colors, sorting
- `volume_name`: Display name for catalog
- `top_level_id`: Root level identifier

**Item properties:**
- `name`: Display name
- `sort_number`: Optional numeric sort order
- `{child_level}`: Nested child items
- Custom properties for detail display

### Virtual Levels

Items can trigger virtual hierarchy levels using metadata:
- `rpp_{property}`: Creates pseudo-parent level
- Groups items by that property value
- Multiple virtual hierarchies from same data

Example: Marine engines grouped by manufacturer OR by family type.

## Touch Interaction

### Gesture Recognition

**Swipe:**
- Horizontal drag > 10px
- Duration doesn't matter
- Rotates Focus Ring by distance × sensitivity

**Tap:**
- Touch movement < 10px
- Duration < 300ms
- Triggers navigation action

### Momentum Physics

After swipe ends:
- Calculate velocity from final drag speed
- Apply exponential decay (0.95 multiplier per frame)
- Continue rotation until velocity < threshold
- Requestanimationframe for smooth 60fps

### Rotation Calculation

```javascript
// Distance-based component
const baseRotation = (touchDelta / viewportWidth) * 360;

// Velocity-based component (for long lists)
const velocityScale = calculateVelocityScale(itemCount);
const rotation = baseRotation * velocityScale;
```

This hybrid approach allows browsing 2000+ items efficiently while maintaining precision for small lists.

## Performance Considerations

### Viewport Filtering
Only render items within visible arc (±90° from focus):
- Reduces DOM elements by ~50%
- Maintains smooth 60fps animation
- Tested with 2000+ items

### SVG Rendering
- Use CSS transforms for rotation (GPU-accelerated)
- Avoid reflow-triggering operations in animation loop
- Batch DOM updates when possible

### Data Loading
Currently monolithic (all data loaded at start). Planned split architecture will lazy-load by entity (manufacturer, book, etc.).

## Browser Compatibility

**Minimum Requirements:**
- ES6 module support
- SVG rendering
- Touch events API
- RequestAnimationFrame

**Tested Browsers:**
- Chrome Mobile 61+
- iOS Safari 10.1+
- Firefox Mobile 60+

**Known Issues:**
- Optional chaining removed for ES5 compatibility
- Some older Android devices have touch lag

## Extension Points

### Adding New Catalogs
1. Create JSON file following schema
2. Define hierarchy levels and colors
3. Place in root directory
4. Will appear in volume selector

### Custom Detail Views
Configure in JSON `display_config.detail_sector`:
- `info`: Text content
- `list`: Specification lists
- `gallery`: Image grids
- `audio_player`: Audio playback

### Custom Sorting
Set `sort_type` in hierarchy level config:
- `alphabetical`: A-Z by name
- `numeric`: By sort_number property
- `numeric_desc`: Reverse numeric

## Development Tips

### Debug Logging
Enable with URL parameter: `?loglevel=4`

Levels:
- 0: None
- 1: Errors only
- 2: Warnings
- 3: Info
- 4: Debug
- 5: Verbose (includes animation frames)

### Testing Rotation
Use `?forceMobile=true` on desktop, then:
1. Open DevTools console
2. Watch rotation angle logs
3. Verify item positions with inspector
4. Check for off-screen elements (0-90° quadrant)

### Common Pitfalls
- **Off-screen elements**: Check angle is in visible range (90-180° for portrait)
- **Touch not working**: Verify element doesn't have pointer-events: none
- **Rotation jumpy**: Check for conflicting event handlers
- **Missing items**: Verify JSON structure matches hierarchy config

## Desktop Version (Legacy)

A desktop version exists in `desktop/` directory but uses an older JSON format and architecture:
- Last updated: October 26, 2025
- Hardcoded for MMdM catalog structure
- Does not use current JSON schema (v1.0.0)
- Traditional JavaScript (no ES6 modules)

**Status**: Functional but incompatible with current mobile implementation. Needs rewrite to support new schema and universal architecture. See TODO.md for future plans.

---

## Future Architecture

### Planned Improvements
- Split JSON architecture (lazy-load by entity)
- Automated testing framework
- Accessibility enhancements (keyboard, screen readers)
- Landscape mode improvements

### Known Technical Debt
- Large renderer module (recently refactored with animation extraction)
- Some hardcoded domain assumptions
- Manual volume discovery
- Limited error recovery

See [CHANGELOG.md](CHANGELOG.md) for version history and [CONTRIBUTING.md](CONTRIBUTING.md) for how to help.
