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
├── mobile-renderer.js          # ⭐ Coordinator (920 lines - 70% reduction!)
├── mobile-animation.js         # Animation system (IN/OUT migrations)
├── mobile-touch.js             # Touch event handling
├── mobile-viewport.js          # Viewport calculations
├── mobile-coordinates.js       # Coordinate system (Hub/Nuc)
├── mobile-childpyramid.js      # Child item preview display
├── mobile-detailsector.js      # Content detail view (Gutenberg verse rendering)
├── focus-ring-view.js          # Focus ring rendering & positioning
├── magnifier-manager.js        # Magnifier element management
├── navigation-coordinator.js   # Navigation state transitions
├── child-content-coordinator.js # Child content display logic
├── data-query-helper.js        # Hierarchical data queries
├── parent-name-builder.js      # Parent button label generation
├── theme-manager.js            # Color scheme management
├── translation-toggle.js       # Translation switching UI
└── navigation-view.js          # Navigation UI components
```

### Module Responsibilities

**mobile-data.js**
- Loads JSON catalog files
- Provides navigation API (getChildren, getParent, etc.)
- Handles virtual hierarchy levels
- Domain-agnostic (works with any hierarchical JSON)

**mobile-renderer.js** ⭐ **REFACTORED (3,073 → 920 lines, 70% reduction)**
- Thin coordinator pattern with delegation to specialized modules
- Manages DOM element references and initialization
- Coordinates between all UI modules
- Handles application lifecycle and state
- **No longer contains**: rendering logic, data queries, animations, navigation coordination

**focus-ring-view.js** (1,302 lines)
- Creates and positions Focus Ring SVG elements
- Manages focus ring rotation and item positioning
- Handles text rendering with bilingual support
- Calculates and caches item positions
- Owns all Focus Ring state (focusElements, positionCache, rotation offsets)

**magnifier-manager.js** (269 lines)
- Creates and positions magnifier ring element
- Handles magnifier animations and transitions
- Manages advancing focus ring on rotation
- Brings focus items to center position

**navigation-coordinator.js** (287 lines)
- Orchestrates IN navigation (Child Pyramid → Focus Ring)
- Manages animation sequencing during navigation
- Handles leaf vs non-leaf navigation logic
- Updates navigation state and active paths
- Sets up rotation offsets for centered items

**child-content-coordinator.js** (230 lines)
- Determines if focus item has children or is a leaf
- Handles lazy loading for split volumes
- Shows Child Pyramid for non-leaf items
- Shows Detail Sector for leaf items
- Manages parent button updates during content display

**data-query-helper.js** (348 lines)
- Query items at different hierarchy levels
- Resolves child levels (skipping pseudo-levels)
- Builds cousin navigation (items across sibling groups with gaps)
- Constructs parent items from child metadata
- Finds item indices in arrays

**parent-name-builder.js** (124 lines)
- Generates display names for parent levels
- Builds contextual breadcrumbs from top navigation level
- Handles different parent button styles (simple vs cumulative)
- Pluralizes parent names appropriately

**theme-manager.js**
- Manages color schemes from display_config
- Provides color lookup for different element types
- Handles theme-related styling

**translation-toggle.js**
- Manages translation UI button
- Handles translation switching logic
- Maintains current translation state

**navigation-view.js**
- Manages Parent Button UI and animations
- Handles navigation breadcrumb display
- Controls button visibility and interactions

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

## Current Architecture: Split JSON + Caching

### Split JSON Files (Chapter-Level Architecture)

Large volumes use per-chapter files with a manifest for lazy loading:

```
/data/
  gutenberg/
    manifest.json           # Volume metadata + book/chapter index
    translations.json       # Versification system metadata
    chapters/
      GENE/
        001.json            # Genesis 1 - lazy loaded
        002.json            # Genesis 2
        ...
      PSAL/
        001.json            # Psalm 1
        ...
        150.json            # Psalm 150
      ...                   # 67 book directories, 1,215 chapter files total
```

**Chapter Schema (v2.0):**
```json
{
  "_schema_version": "2.0",
  "chapter_id": "GENE_001",
  "book_key": "GENE",
  "sequence": 1,
  "chapter_in": { "MT": 1, "VUL": 1, "LXX": 1 },
  "verses": {
    "1": {
      "seq": 1,
      "v_in": { "MT": 1, "VUL": 1, "LXX": 1 },
      "text": {
        "WLC": "בְּרֵאשִׁית...",
        "VUL": "In principio...",
        "NAB": "In the beginning..."
      }
    }
  }
}
```

**Benefits:**
- Faster navigation (15-20 KB chapters vs 500 KB books)
- Per-translation versification mapping (`chapter_in`, `v_in`)
- Tradition-specific content support (`exists_in` field)
- Offline caching via IndexedDB

### IndexedDB Caching Layer

Book files are cached in IndexedDB (`WheelVolumeCache`) for persistence across sessions:
- Cache checked before network fetch
- Automatic cache hit/miss logging
- Survives browser restarts

---

## Future Architecture

### Phase 3: Code Cleanup (Next)

- Remove dead code and unused functions
- Consolidate duplicate logic
- Performance profiling and optimization

### Domain-Specific Code Removal (Phase 2 - Complete)

All domain-specific references removed from JS/CSS. Configuration-driven approach:

**display_config flags:**
```json
{
  "fonts": {
    "display": "Montserrat, sans-serif",
    "text": "EB Garamond, Georgia, serif"
  },
  "text_tiers": [
    { "max_words": 30, "font_size": 30, "char_width_ratio": 0.45 },
    { "max_words": null, "font_size": 22, "char_width_ratio": 0.35 }
  ],
  "detail_sector": {
    "render_mode": "verse_text",
    "margins": { "left": 0.03, "right": 0.05 }
  }
}
```

**Replace in JS:**
```javascript
// Before
const isGutenberg = displayConfig?.volume_name === 'Gutenberg Bible';

// After  
const renderMode = displayConfig?.detail_sector?.render_mode || 'default';
```

### Known Technical Debt
- Large renderer module (recently refactored with animation extraction)
- Some hardcoded domain assumptions (gutenberg checks)
- Manual volume discovery
- Limited error recovery
- CSS `!important` overrides for font sizing

See [CHANGELOG.md](CHANGELOG.md) for version history and [CONTRIBUTING.md](CONTRIBUTING.md) for how to help.
