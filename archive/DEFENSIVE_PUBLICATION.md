# DEFENSIVE PUBLICATION: WHEEL NAVIGATION SYSTEM

**Publication Date**: November 21, 2025  
**Inventor/Author**: MMdM (Motori Marini di Montagna), Fano (PU), Italy  
**Repository**: https://github.com/mmdm-it/wheel  
**Version**: 0.7.0  
**Purpose**: Establish prior art for rotational hierarchical navigation system

---

## ABSTRACT

This document discloses a novel mobile-first user interface system for navigating deep hierarchical data structures using rotational gestures and click-based advancement. The system employs a unique coordinate system (Hub/Nuc) based on a constitutional formula, combined with a pseudo parent architecture that enables dynamic metadata-driven regrouping of hierarchical content. The invention addresses the fundamental problem of browsing large datasets (1000+ items across 4+ levels) on mobile touchscreen devices where traditional tree views, nested menus, and infinite scroll interfaces fail due to screen size constraints and poor gesture affordances.

**Key Innovations**:
1. Hub/Nuc coordinate system with constitutional formula for viewport state management
2. Pseudo parent system enabling virtual hierarchical levels from metadata
3. Rotational gesture navigation with momentum physics
4. Detail sector architecture preserving navigational context during content display
5. Focus ring sprocket gear interface metaphor
6. **Magnifier click advancement**: Single-tap clockwise navigation eliminating scroll fatigue
7. **Bounded content presentation**: Hierarchical limits replace infinite scrolling

---

## 1. TECHNICAL PROBLEM

### 1.1 Prior Art Limitations

Existing mobile hierarchical navigation systems suffer from:

- **Vertical scrolling tree views**: Poor space efficiency, lose context when scrolling deep hierarchies
- **Tap-to-drill navigation**: Full-screen transitions destroy breadth view, no sibling visibility
- **Zoomable interfaces**: Require precise pinch gestures, disorienting at depth, no natural "out" path
- **Search-centric approaches**: Assume user knows target, prevent exploratory browsing
- **Carousel pickers**: Limited to single-level flat lists, no hierarchy support
- **Infinite scroll feeds**: Create addictive engagement loops, scroll fatigue, loss of position context
- **Swipe-only navigation**: Repetitive gesture strain, imprecise control, momentum overshoot

### 1.2 Unmet Need

No existing system enables efficient **browsing** (as opposed to searching) of hierarchical datasets with:
- 1000+ total items
- 4-8+ levels of depth  
- Mobile touchscreen as primary interface
- Preservation of navigational context during content viewing
- Support for multiple classification paths (family → subfamily vs. manufacturer → model)
- **Bounded navigation**: Natural start/end points preventing endless scrolling
- **Low-friction advancement**: Single tap replaces repetitive swipe gestures

---

## 2. SOLUTION OVERVIEW

**Wheel** is a gesture-based navigation system that treats hierarchical data as a series of rotatable rings, where:
- Clockwise/counter-clockwise swipe rotates the current level
- A focus ring highlights the current selection
- Tapping navigates IN (to children) or expands a detail sector (if leaf node)
- Parent button navigates OUT
- Coordinate system maintains precise viewport state across unlimited depth

---

## 3. HUB/NUC COORDINATE SYSTEM

### 3.1 Constitutional Formula

Every viewport state is uniquely identified by a **constitutional formula**:

```
h(ub).n(uc).r(otation).e(xpansion)
```

**Components**:
- **Hub (h)**: Array of node IDs representing path from root to current level
  - Example: `["marine_engines", "diesel", "manufacturers"]`
  - Length of array = current depth in hierarchy
  
- **Nuc (n)**: Index of currently focused item at current level
  - Integer from 0 to (siblings.length - 1)
  - Determines which item appears in focus ring
  
- **Rotation (r)**: Current rotational offset in degrees
  - Float value, typically 0-360° (can exceed for momentum)
  - Maps focal item to 12 o'clock position
  
- **Expansion (e)**: Boolean indicating detail sector state
  - `true` = detail sector expanded (leaf node content visible)
  - `false` = detail sector collapsed (navigation mode)

### 3.2 State Transitions

The system defines atomic state transitions:

1. **ROTATE**: Modify `r` value, update `n` when rotation crosses threshold
2. **IN**: Append child ID to `h`, reset `n` and `r` to 0
3. **OUT**: Remove last element from `h`, restore parent's `n` and `r`
4. **EXPAND**: Toggle `e`, render detail content if `true`

### 3.3 Coordinate Persistence

The constitutional formula enables:
- **History tracking**: Each state is serializable for browser history
- **Deep linking**: URLs can encode exact viewport state
- **State restoration**: Return to precise view after interruption
- **Animation paths**: Calculate shortest rotation between states

### 3.4 Mathematical Foundation

**Rotation-to-Index Mapping**:
```javascript
nuc = Math.floor((rotation + itemAngle/2) / itemAngle) % itemCount
```

**Index-to-Rotation Mapping**:
```javascript
rotation = nuc * itemAngle
```

Where:
- `itemAngle = 360° / itemCount`
- Modulo operation handles wrap-around at 360°

---

## 4. PSEUDO PARENT SYSTEM

### 4.1 Problem Statement

Traditional hierarchies have fixed structure (e.g., Country → Manufacturer → Family → Model). Users may want to browse by different paths (Manufacturer → Family or Family → Manufacturer) depending on whether they know the brand or the engine type.

### 4.2 Innovation: Metadata-Driven Virtual Levels

The pseudo parent system creates **virtual hierarchical levels** from item metadata without duplicating data.

### 4.3 Architecture

**Prefix Convention**:
- `rpp_` = "regrouped pseudo parent" (1 level up)
- `rpgp_` = "regrouped pseudo grandparent" (2 levels up)
- Can extend: `rpggp_`, `rpgggp_`, etc.

**Example Metadata**:
```json
{
  "id": "volvo_d3_220",
  "name": "Volvo Penta D3-220",
  "rpp_family": "inline_4cyl_diesel",
  "rpgp_manufacturer": "volvo_penta"
}
```

**Generated Hierarchy**:
```
Root
├── Manufacturers (pseudo grandparent level)
│   ├── Volvo Penta
│   │   └── Inline 4-Cylinder Diesels (pseudo parent level)
│   │       └── Volvo Penta D3-220 (actual item)
│   └── Yanmar
│       └── Inline 4-Cylinder Diesels
│           └── Yanmar 4JH5E
└── Families (pseudo parent level)
    ├── Inline 4-Cylinder Diesels
    │   ├── Volvo Penta D3-220
    │   └── Yanmar 4JH5E
    └── V6 Diesels
        └── Mercruiser 4.5L V6
```

### 4.4 Dynamic Hierarchy Creation

**Algorithm**:
1. Parse item metadata for `rpp_*`, `rpgp_*` fields
2. Create virtual parent nodes with IDs from field values
3. Establish parent-child links in navigation graph
4. Render virtual levels identically to static levels
5. When navigating OUT from real item, traverse to virtual parent (not static parent)

**Key Insight**: User never sees "virtual" vs "real" levels—navigation is seamless. The system dynamically constructs hierarchy based on which entry point user chooses.

### 4.5 Benefits

- **Multiple classification paths**: Same data browsable via different taxonomies
- **No data duplication**: Items exist once, appear in multiple hierarchies via metadata
- **Extensible**: Add new grouping fields without restructuring JSON
- **Domain-agnostic**: Works for products (brand/category), books (author/genre), music (artist/album/genre)

---

## 5. ROTATIONAL NAVIGATION MECHANICS

### 5.1 Gesture Recognition

**Touch Events**:
- `touchstart`: Record initial touch position, timestamp
- `touchmove`: Calculate delta from start position, update rotation
- `touchend`: Calculate velocity, initiate momentum decay

**Rotation Calculation**:
```javascript
// Convert linear swipe to rotational displacement
const touchDelta = currentTouch.x - startTouch.x;
const rotationDelta = (touchDelta / viewportWidth) * 360;
rotation = initialRotation + rotationDelta;
```

### 5.2 Momentum Physics

**Velocity Calculation**:
```javascript
const timeDelta = touchEndTime - touchStartTime;
const velocity = rotationDelta / timeDelta; // degrees per millisecond
```

**Exponential Decay**:
```javascript
const DECAY_RATE = 0.95;
function updateMomentum() {
  if (Math.abs(velocity) < 0.1) {
    velocity = 0;
    return;
  }
  rotation += velocity;
  velocity *= DECAY_RATE;
  requestAnimationFrame(updateMomentum);
}
```

### 5.3 Focus Ring Positioning

**Problem**: At arbitrary rotation angles, no item is "centered" for selection.

**Solution**: Focus ring highlights whichever item is closest to 12 o'clock position.

**Visual Implementation**:
- SVG circle at fixed position (top center of viewport)
- CSS/SVG styling distinguishes focused item from siblings
- Color, scale, or border weight indicates focus state

**Selection Logic**:
```javascript
// Determine which nuc is currently in focus
const focusedNuc = Math.round(rotation / itemAngle) % itemCount;
```

---

## 6. DETAIL SECTOR ARCHITECTURE

### 6.1 Problem: Context Loss

Traditional drill-down navigation replaces entire screen with detail view, losing:
- Current position in hierarchy
- Sibling items (can't quickly compare)
- Path taken to reach item

### 6.2 Solution: Expansion Without Replacement

**Detail Sector** is a designated screen region (typically bottom 40% of viewport) that expands to show content while:
- Hierarchy rings remain visible (top 60%)
- Focus ring shows current selection
- Rotation still functional (can navigate to siblings without closing detail)

**State Transitions**:
1. User taps focused item (leaf node)
2. `expansion = true` in constitutional formula
3. Detail sector slides up from bottom
4. Content rendered (text, images, specs, etc.)
5. Navigation rings compress to top of screen
6. User can rotate to adjacent items; detail updates live
7. Tap close button sets `expansion = false`, sector slides down

### 6.3 Coordinate Preservation

Critical innovation: **Hub and Nuc remain unchanged during expansion**.

This enables:
- **Live comparison**: Rotate to sibling while detail open, content updates without closing
- **Navigation continuity**: Close detail sector, return to exact rotational state
- **History support**: Back button closes detail rather than navigating OUT

---

## 7. DOMAIN AGNOSTIC ARCHITECTURE

### 7.1 Universal Data Schema

**JSON Structure** (version 1.0.0):
```json
{
  "volume_schema_version": "1.0.0",
  "volume_data_version": "2025.11.20",
  "structure_type": "monolithic",
  "volume_name": "MMdM Marine Catalog",
  "top_level_id": "marine_engines",
  "nodes": {
    "node_id": {
      "name": "Display Name",
      "parent": "parent_id",
      "children": ["child_id_1", "child_id_2"],
      "content_html": "<p>Detail content</p>",
      "rpp_field": "pseudo_parent_value"
    }
  }
}
```

**Key Fields**:
- `nodes`: Flat dictionary of all items (not nested tree)
- `parent`/`children`: Explicit links define graph structure
- `content_html`: Leaf node detail (optional)
- `rpp_*`/`rpgp_*`: Metadata for pseudo parent generation

### 7.2 DataManager Module

**100% domain-agnostic** JavaScript module:
- Loads JSON, parses node graph
- Provides API: `getChildren(id)`, `getParent(id)`, `getContent(id)`
- Discovers pseudo parent fields dynamically
- No hardcoded references to "marine engines" or "manufacturers"

**Result**: Same codebase renders:
- Marine engine catalog (2000+ items, 5 levels)
- Gutenberg Bible (1189 chapters, 4 levels: Testament → Book → Chapter → Verse)
- Music library (28 albums, 3 levels: Artist → Album → Track)

---

## 8. SPLIT ARCHITECTURE (PLANNED v2.0.0)

### 8.1 Scalability Challenge

Monolithic JSON files (2+ MB) cause:
- Slow initial load (download entire catalog before first render)
- Wasted bandwidth (user only views ~5% of content per session)

### 8.2 Solution: Manufacturer-Level Splitting

**Structure** (schema v2.0.0):
```
volumes/
  mmdm_catalog/
    manifest.json          # Top-level index
    countries.json         # Country → Manufacturer map
    volvo_penta.json       # All Volvo engines (40 KB avg)
    yanmar.json            # All Yanmar engines
    mercruiser.json        # All Mercruiser engines
    ...
```

**Manifest Example**:
```json
{
  "volume_schema_version": "2.0.0",
  "structure_type": "split_manufacturer",
  "split_level": "manufacturer",
  "manufacturers": {
    "volvo_penta": {
      "file": "volvo_penta.json",
      "item_count": 47,
      "size_kb": 38
    }
  }
}
```

**Loading Strategy**:
1. Load manifest.json (5 KB)
2. Render top 2 levels (countries, manufacturers)
3. User taps "Volvo Penta"
4. Lazy-load volvo_penta.json (40 KB)
5. Render Volvo families/models
6. Repeat for each manufacturer

**Bandwidth Savings**: 75% reduction (typical session loads 3-4 manufacturers = 150 KB vs. 2.1 MB monolithic)

### 8.3 Backward Compatibility

**Dual Loader System**:
- Detect `structure_type` field in JSON
- Route to monolithic loader (v1.0.0) or split loader (v2.0.0)
- Identical DataManager API for both
- Enables gradual migration (not all volumes split simultaneously)

---

## 9. IMPLEMENTATION DETAILS

### 9.1 Technology Stack

- **Pure ES6 JavaScript**: No framework dependencies
- **Native Modules**: Zero build process, direct browser loading
- **SVG + CSS**: Vector graphics for rotational elements
- **Touch Events API**: Native gesture handling
- **History API**: Browser back/forward integration

### 9.2 Core Modules

**mobile-config.js**:
- Configuration constants (viewport dimensions, animation timing)
- Version management

**mobile-data.js**:
- DataManager class (domain-agnostic)
- JSON loading, node graph traversal
- Pseudo parent discovery and hierarchy generation

**mobile-viewport.js**:
- Viewport class managing Hub/Nuc state
- Constitutional formula calculations
- State transition methods

**mobile-renderer.js**:
- SVG generation for navigation rings
- Focus ring positioning
- Detail sector expansion animations

**mobile-touch.js**:
- Touch event handlers
- Gesture recognition
- Momentum physics calculations

**mobile-app.js**:
- Application controller
- Module orchestration
- Volume selection UI

### 9.3 Rendering Pipeline

1. **State Change**: User gesture modifies Hub/Nuc/Rotation/Expansion
2. **Data Query**: DataManager fetches relevant nodes
3. **Layout Calculation**: Compute item positions based on rotation
4. **SVG Generation**: Create/update DOM elements
5. **Animation**: RequestAnimationFrame loop for smooth transitions
6. **Event Rebinding**: Attach touch handlers to new elements

---

## 10. PERFORMANCE CHARACTERISTICS

### 10.1 Measured Performance

**Rendering**:
- 60 FPS rotation with 20-30 visible items
- Sub-100ms IN/OUT navigation transitions
- Smooth momentum decay on mid-range mobile devices (tested: iPhone SE 2020, Samsung Galaxy A52)

**Memory**:
- Monolithic: ~8 MB heap (2.1 MB JSON + parsed objects)
- Split (projected): ~2 MB heap (incremental loading)

**Network**:
- Initial load: 2.1 MB (monolithic) or 5 KB (split manifest)
- Per-manufacturer lazy load: 40 KB average

### 10.2 Optimization Techniques

- **Viewport culling**: Only render items within ±90° of focus (reduces DOM nodes by 50%)
- **Transform-based animation**: CSS `transform: rotate()` uses GPU, avoids reflow
- **Debounced touch events**: Throttle `touchmove` to 60 Hz max
- **Lazy image loading**: Detail sector images load on expansion, not page load

---

## 11. USE CASES

### 11.1 Product Catalogs

**Marine Engines** (current implementation):
- 2000+ engines from 106 manufacturers
- Browse by: Country → Manufacturer → Family → Model
- Or: Family → Manufacturer → Model (pseudo parents)
- Each engine has specs, images, pricing

**Applicable to**: Auto parts, industrial equipment, electronics, medical devices

### 11.2 Literary Works

**Gutenberg Bible** (implemented):
- Old/New Testament → Book → Chapter → Verse
- 1189 chapters, 31,102 verses
- Detail sector shows verse text + commentary

**Applicable to**: Any long-form structured text (legal codes, technical manuals)

### 11.3 Media Libraries

**Music Collection** (implemented):
- Artist → Album → Track
- 28 albums, 336 tracks
- Detail sector shows lyrics, playback controls

**Applicable to**: Video libraries, podcast archives, photo collections

### 11.4 Social Media: Eliminating Infinite Scroll

**Traditional Social Media Problems**:
- **Infinite scroll feeds**: Create addictive engagement loops where users lose hours without realizing
- **Loss of temporal context**: Scrolling removes sense of time (which day am I viewing?)
- **No natural boundaries**: Feeds extend indefinitely, creating "scroll fatigue" and FOMO
- **Swipe repetition**: Navigating stories requires repetitive swipe gestures (Instagram Stories, Snapchat)
- **Algorithmic control**: Users have little agency over navigation path

**Wheel Social Media Architecture**:

**Hierarchy Structure**:
```
YEARS → MONTHS → DAYS → POSTS
```

**User Experience Flow**:
1. **Today's Date in Magnifier**: App loads with today's date focused (e.g., "November 21")
2. **Month's Dates in Focus Ring**: Current month's dates populate the ring (November 1-30)
3. **Parent Button Shows Month**: "November 2025" visible as current context
4. **Child Pyramid Shows Today's Posts**: Visual overview of today's content (friends' posts/photos as thumbnails)
5. **Tap Post to Navigate IN**: Selected post moves to Magnifier, other posts to Focus Ring
6. **Detail Sector Expands**: Shows photo/text content for magnified post
7. **Magnifier Click Advances**: Single tap rotates to next post (eliminates swipe repetition)
8. **Bounded Navigation**: Focus Ring contains only today's posts (clear start/end)
9. **User Choice to Explore**: Tap OUT to return to date selection, choose different day
10. **Temporal Context Preserved**: Always know which date/month you're viewing

**Key Advantages**:

- **Bounded content sets**: Each day's posts form a complete, finite set (no infinite scroll)
- **Click advancement > swipe**: Single tap on magnifier advances to next post—smooth and elegant compared to repetitive swiping
- **Temporal awareness**: Date always visible in Magnifier or Parent Button
- **User agency**: Choice to explore other days/months, not pushed by algorithm
- **Natural stopping points**: End of day's posts = clear boundary, prevents mindless scrolling
- **Context preservation**: Hierarchical position clear (Year → Month → Day → Post)
- **Gesture efficiency**: Vertical scrolling eliminated, replaced with rotational navigation and single taps
- **Reduced scroll fatigue**: Bounded sets with explicit end points vs. endless algorithmic feed
- **Comparison view**: Rotate Focus Ring while Detail Sector open to compare multiple posts

**User Testimonial**:
> "Vertical scrolling feels like walking compared to Wheel's riding a bike."

**Applicable to**: Facebook, Instagram, Reddit, Twitter/X, LinkedIn, any feed-based social platform

**Implementation Notes**:
- Magnifier click advancement (v0.7.0) specifically designed for post-to-post navigation
- Focus Ring provides visual overview of bounded set (day's posts)
- Detail Sector expands over magnifier without losing navigation context
- Parent/Child pyramid navigation enables temporal exploration (days/months/years)

---

### 11.5 Future Applications

- **E-commerce**: Department → Category → Subcategory → Product
- **File systems**: Folder hierarchy navigation
- **Organization charts**: Company → Division → Department → Employee
- **Taxonomies**: Biological classification (Kingdom → Phylum → Class → Order...)
- **Geographic data**: Continent → Country → State → City

---

## 12. NOVELTY CLAIMS

### 12.1 Hub/Nuc Coordinate System

**Novel Aspects**:
1. Constitutional formula `h.n.r.e` uniquely identifies viewport state
2. Array-based hub representation enables unlimited depth
3. Rotation and nuc are co-dependent but independently modifiable
4. Single coordinate system handles both navigation and content display

**Prior Art Search**: No known system uses this specific coordinate representation for hierarchical navigation.

### 12.2 Pseudo Parent System

**Novel Aspects**:
1. Metadata-driven virtual hierarchy generation at runtime
2. `rpp_`/`rpgp_` prefix convention for arbitrary depth
3. Multiple simultaneous hierarchies from single dataset
4. Seamless mixing of static and virtual levels in navigation

**Prior Art Search**: Database "views" and "materialized views" create alternate representations, but require pre-computation and duplication. Pseudo parents are generated dynamically without data duplication.

### 12.3 Rotational Gesture Navigation

**Novel Aspects**:
1. Horizontal swipe mapped to rotational displacement (not linear scroll)
2. Focus ring as persistent selection indicator during continuous rotation
3. Momentum physics applied to rotation (not pan/zoom)
4. Rotation preserved during IN/OUT navigation (positional memory)

**Prior Art Search**: Carousel UIs use rotation, but for flat lists only. No prior art found for rotational navigation of multi-level hierarchies.

### 12.4 Detail Sector with Context Preservation

**Novel Aspects**:
1. Expandable content region without replacing navigation UI
2. Hub/Nuc coordinates unchanged during expansion
3. Live sibling comparison (rotate while detail open)
4. Detail sector as addressable state in constitutional formula

**Prior Art Search**: Split-screen and master-detail patterns exist, but typically in desktop layouts. No prior art for mobile touch-based detail expansion while preserving rotational navigation state.

---

## 13. ADVANTAGES OVER PRIOR ART

| Feature | Tree View | Tap-to-Drill | Zoom UI | Wheel |
|---------|-----------|--------------|---------|-------|
| **Depth Capacity** | 3-4 levels | 5-6 levels | Unlimited | Unlimited |
| **Breadth Per Level** | ~10 items | ~20 items | ~50 items | ~30 items |
| **Sibling Visibility** | All (scroll) | None | All (zoom out) | ±5 items |
| **Gesture Efficiency** | Scroll + Tap | Tap only | Pinch + Pan | Swipe + Tap |
| **Context Preservation** | Breadcrumb only | Breadcrumb only | Visual (all levels visible) | Visual (siblings visible) + Coordinate |
| **Detail View** | Replace screen | Replace screen | Popup modal | Expand in place |
| **Multiple Taxonomies** | Separate trees | Separate screens | Not supported | Pseudo parents |
| **Performance (1000+ items)** | Laggy scroll | Fast | Laggy zoom | Smooth rotation |

---

## 14. TECHNICAL SPECIFICATIONS

### 14.1 JSON Schema (v1.0.0 - Monolithic)

**Required Fields**:
```json
{
  "volume_schema_version": "1.0.0",
  "volume_data_version": "YYYY.MM.DD",
  "structure_type": "monolithic",
  "volume_name": "String",
  "top_level_id": "String (ID of root node)",
  "nodes": {
    "node_id": {
      "name": "String (display name)",
      "parent": "String (parent ID) | null",
      "children": ["String (child IDs)"] | null
    }
  }
}
```

**Optional Fields**:
- `content_html`: HTML string for detail sector
- `content_text`: Plain text alternative
- `rpp_*`: Pseudo parent metadata (any field starting with `rpp_` or `rpgp_`)
- Custom fields: Any additional metadata (images, specs, etc.)

### 14.2 JSON Schema (v2.0.0 - Split)

**Manifest File**:
```json
{
  "volume_schema_version": "2.0.0",
  "structure_type": "split_manufacturer",
  "split_level": "manufacturer",
  "split_files": {
    "file_id": {
      "file": "relative/path.json",
      "item_count": 123,
      "size_kb": 45
    }
  }
}
```

**Individual Split Files**: Same structure as v1.0.0 nodes dictionary, but scoped to one manufacturer.

### 14.3 API Surface (DataManager)

```javascript
class DataManager {
  async loadVolume(jsonPath)
  getNode(id)
  getChildren(id)
  getParent(id)
  getContent(id)
  getPseudoParents(id)
  discoverVolumes(volumePaths)
}
```

### 14.4 API Surface (Viewport)

```javascript
class Viewport {
  constructor(containerId, dataManager)
  navigateIN(childId)
  navigateOUT()
  rotate(degrees)
  setNuc(index)
  expand()
  collapse()
  getConstitutionalFormula()
  restoreFromFormula(formula)
}
```

---

## 15. DEVELOPMENT HISTORY

### 15.1 Version Timeline

- **v0.1.0** (2025-10): Initial prototype with fixed marine catalog
- **v0.2.0** (2025-10): Rotational navigation working
- **v0.3.0** (2025-10): Detail sector implementation
- **v0.4.0** (2025-11): DataManager refactored to be domain-agnostic
- **v0.5.0** (2025-11): Gutenberg Bible and music volumes added
- **v0.6.0** (2025-11): Pseudo parent system implemented
- **v0.6.5** (2025-11): Volume selector UI and Italian localization
- **v0.6.6** (2025-11): JSON schema versioning system (current)
- **v1.0.0** (2026 Q1): Planned split architecture deployment

### 15.2 Repository History

- **2025-10**: Initial development in private repository
- **2025-11-20**: Repository made public (mmdm-it/wheel)
- **2025-11-20**: This defensive publication created

---

## 16. REFERENCES

### 16.1 Source Code

- **Repository**: https://github.com/mmdm-it/wheel
- **Live Demo**: wheel.html, test-data-manager.html
- **Core Modules**: mobile/mobile-*.js
- **Data Files**: mmdm_catalog.json, gutenberg.json, hg_mx.json

### 16.2 Documentation

- **README.md**: Project overview and architecture
- **SPLIT_ARCHITECTURE_PLAN.md**: Migration plan to v2.0.0
- **SCHEMA_CHANGELOG.md**: JSON versioning documentation
- **CHANGELOG.md**: Version history
- **mobile/STATUS**: Development progress tracking

### 16.3 Related Concepts

- **Focus + Context visualization** (Furnas, 1986): Concept of showing detail while preserving overview
- **Zoomable User Interfaces** (Bederson & Hollan, 1994): Pan/zoom metaphor for information spaces
- **Hierarchical Roaming** (Lamping et al., 1995): Hyperbolic tree browser
- **Circular navigation**: Used in Apple Watch crown, iPod scroll wheel (linear control, not hierarchical)

**Key Distinction**: Wheel combines rotational gesture with hierarchical drill-down and pseudo parent dynamic regrouping—no prior art found with all three elements.

---

## 17. INVENTOR STATEMENT

I, the creator of the Wheel navigation system, hereby publish this technical disclosure to establish prior art and prevent others from patenting these innovations. This work was developed independently in Fano (PU), Italy, between October and November 2025.

The system is released as open-source software (repository: mmdm-it/wheel) and is freely available for use, modification, and distribution under the terms specified in the repository license.

This publication is made in good faith to contribute to the public domain of user interface design and to ensure these techniques remain freely available to developers and designers worldwide.

**Date**: November 20, 2025  
**Location**: Fano (PU), Italy  
**Organization**: Motori Marini di Montagna (MMdM)  

---

## 18. LEGAL DISCLAIMER

This document is provided for informational purposes and to establish prior art. It does not constitute legal advice. The techniques described herein are disclosed to the public domain as of November 20, 2025. Any patents filed after this date covering these specific innovations may be challenged using this publication as prior art.

The author makes no warranty regarding the novelty of these techniques relative to unpublished prior art. A comprehensive patent search should be conducted before pursuing patent protection.

---

**END OF DEFENSIVE PUBLICATION**

---

## APPENDIX A: CONSTITUTIONAL FORMULA EXAMPLES

### Example 1: Root Level
```
h: []
n: 0
r: 0
e: false
```
Meaning: At top level, first item focused, no rotation, detail collapsed.

### Example 2: Three Levels Deep
```
h: ["marine_engines", "italy", "volvo_penta"]
n: 5
r: 180
e: false
```
Meaning: Drilled into marine_engines → italy → volvo_penta, 6th item (index 5) focused, rotated 180°, detail collapsed.

### Example 3: Detail Expanded
```
h: ["marine_engines", "italy", "volvo_penta", "inline_4cyl"]
n: 2
r: 0
e: true
```
Meaning: At 4th level (inline_4cyl family), 3rd engine (index 2) focused, detail sector showing specs.

### Example 4: Pseudo Parent Path
```
h: ["marine_engines", "rpp_family", "inline_4cyl", "rpgp_manufacturer", "volvo_penta"]
n: 0
r: 0
e: false
```
Meaning: Browsing by family first (pseudo parent), then by manufacturer (pseudo grandparent), arrived at Volvo engines.

---

## APPENDIX B: PSEUDO PARENT FIELD EXAMPLES

### Marine Catalog
```json
{
  "id": "volvo_d3_220",
  "name": "Volvo Penta D3-220",
  "parent": "volvo_penta",
  "rpp_family": "inline_4cyl_diesel",
  "rpp_power_range": "200_to_300_hp",
  "rpgp_fuel_type": "diesel"
}
```
Enables browsing paths:
- Static: Country → Manufacturer → Model
- Pseudo: Family → Manufacturer → Model
- Pseudo: Power Range → Manufacturer → Model
- Pseudo: Fuel Type → Power Range → Manufacturer → Model

### Book Catalog
```json
{
  "id": "genesis_1",
  "name": "Genesis Chapter 1",
  "parent": "genesis_book",
  "rpp_theme": "creation",
  "rpp_author": "moses",
  "rpgp_literary_style": "narrative"
}
```
Enables browsing paths:
- Static: Testament → Book → Chapter
- Pseudo: Theme → Chapter
- Pseudo: Author → Chapter
- Pseudo: Literary Style → Theme → Chapter

---

## APPENDIX C: MIGRATION PATH (v1.0.0 → v2.0.0)

### Phase 1: Versioning (v0.6.6 - Complete)
- Add `volume_schema_version`, `volume_data_version`, `structure_type` fields
- DataManager logs schema version on load

### Phase 2: Dual Loader (v0.7.0 - Planned)
- Create `mobile-data-split.js` module
- Router detects `structure_type`, delegates to appropriate loader
- Both loaders expose identical API

### Phase 3: Manifest Creation (v0.8.0 - Planned)
- Split mmdm_catalog.json into 106 manufacturer files
- Generate manifest.json with file index
- Test lazy loading in development

### Phase 4: Production Testing (v0.9.0 - Planned)
- Deploy split architecture to production
- Monitor performance, bandwidth savings
- Fallback to monolithic if issues detected

### Phase 5: Multi-Volume Split (v0.10.0 - Planned)
- Split gutenberg.json (by book)
- Split hg_mx.json (by artist)
- Validate split architecture across all three volumes

### Phase 6: Deprecate Monolithic (v1.0.0 - Planned)
- Remove monolithic loader (keep v1.0.0 schema support for archives)
- All volumes in split format
- Update documentation to reflect v2.0.0 as standard

**Estimated Timeline**: 6-8 months (Phase 2-6)

---

**Document Version**: 1.1  
**Publication Date**: November 21, 2025  
**Last Updated**: November 21, 2025  
**Status**: Published  
**DOI**: (To be assigned by Zenodo upon release archival)
