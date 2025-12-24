# Wheel v3 Roadmap

> v3 note: This file now tracks the v3 release train; the legacy v2 roadmap remains below for reference until we rewrite the implementation details.

### Release Train Status
- v3.0 Focus Ring & Magnifier — done
- v3.1 Dimension Button — done
- v3.2 Parent Button — active (parent-out navigation control)
- v3.3 Child Pyramid — planned
- v3.4 Detail Sector — planned

## Legacy v2 Roadmap (reference)

## Vision

A generic framework for navigating hierarchical data through an innovative rotational interface. Any dataset with nested levels can be visualized and explored using Wheel.

## Core Principles

1. **Generic by Design** - Not a Bible app or catalog app, but a platform
2. **Clean Architecture** - Clear boundaries between data, logic, and view
3. **Zero Compromises** - Build it right or start over
4. **Minimal Code** - Fewest lines possible while maintaining clarity
5. **Fully Responsive** - No hardcoded pixel values

---

## Key Concepts

### The Sprocket Wheel
The Focus Ring operates like a sprocket gear with an infinite chain. All items exist on a virtual circular chain, but only items within the visible viewport arc are rendered. This enables smooth traversal of datasets with thousands of items without performance degradation.

**Key Properties**:
- Full item chain stored in memory (`allFocusItems`)
- Viewport window filters to visible subset (11-21 nodes)
- Rotation scrolls the chain through the viewport
- No DOM node creation for off-screen items
- Enables "2000 nodes in a few swipes" performance goal

### Cousin Navigation
Items at the same hierarchy level across different parent groups, with visual gaps between sibling groups.

**Examples**:
- **Siblings**: Genesis 32:14 and Genesis 32:15 (same parent: Genesis 32)
- **Cousins**: Genesis 32:32 and Genesis 33:1 (same grandparent: Genesis, different parents)
- **Not Cousins**: Genesis 50:26 and Exodus 1:1 (different grandparents)

**Visual Separation**: 2-node gaps inserted between sibling groups for clear boundaries.

### Rotation Physics Philosophy
No search. No keyboard. Navigation through rotation alone.

**Continuous Rotation Model:**
- **Visual Rotation**: Focus Ring rotates smoothly and continuously with finger movement
- **Selection Snapping**: When rotation crosses ±15° threshold, selection changes to next/previous item
- **Visual Reset**: After selection change, visual rotation resets to remainder (smooth continuation)
- **Momentum Physics**: After release, rotation continues with exponential decay (0.95/frame)
- **Precise Control**: Slow drags give 1:1 angular mapping for crawling between items
- **Rapid Traversal**: Fast swipes with momentum enable "2000 nodes in a few swipes"

**Two Modes**:
- **Slow Drag**: 1:1 mapping of angular movement to visual rotation (precise crawling)
- **Fast Swipe**: Momentum-based physics with inertia and deceleration (rapid traversal)

**Goal**: "Make the CyberTruck steering feel like a wooden tiller on an old dinghy"

---

## Development Phases

### Phase 0: Foundation (Current)
**Goal**: Establish architecture and specifications before writing code

- [x] Create wheel-v2/ directory structure
- [x] Initialize git repository
- [x] Setup sync-to-server script
- [x] Write ARCHITECTURE_V2.md
- [x] Write CHILD_PYRAMID_REDESIGN.md
- [x] Write DIMENSION_SYSTEM.md
- [x] Write DETAIL_SECTOR_PLUGINS.md
- [ ] Copy data/ from wheel v1 (gutenberg/, mmdm/)

**Deliverable**: Complete technical specifications, approved and ready for implementation

---

### Phase 1: Focus Ring + Magnifier
**Goal**: Prove the core geometry, sprocket wheel system, and rotation physics work flawlessly

**What we're building**:
- Pure geometry calculations (Hub-based, viewport-responsive)
- **Sprocket Wheel System**: Full item chain with viewport window filtering
  - All items positioned on virtual infinite chain
  - Only items in visible viewport arc rendered (11-21 nodes depending on aspect ratio)
  - Smooth scrolling/rotation through entire dataset
- **Cousin Navigation**: Items at same level across parent groups
  - Genesis 32:14 and Genesis 32:15 are siblings (same parent: Genesis 32)
  - Genesis 32:32 and Genesis 33:1 are cousins (same grandparent: Genesis)
  - Genesis 50:26 and Exodus 1:1 are NOT cousins (different grandparents)
  - 2-node gap between sibling groups for visual separation
- **Continuous Rotation Physics**:
  - Visual rotation accumulates continuously during drag
  - Selection changes when ±15° threshold crossed
  - Visual rotation resets after selection change (remainder preserved)
  - Momentum animation: 0.95 decay per frame, stops at 0.001 velocity
  - Slow drag: 1:1 angular mapping for precise crawling between nodes
  - Fast swipe: Momentum/inertia with physics-based deceleration
  - Can traverse 2000 nodes in "just a few swipes" (flingable)
  - Can crawl precisely between 3-5 nodes
**Success Criteria**:
- ✅ Shows items on Focus Ring (viewport window: 11 portrait, 21 square)
- ✅ Sprocket wheel works: 2000+ items with only visible nodes rendered
- ✅ Cousin navigation with 2-node gaps between sibling groups
- ✅ Magnifier stays fixed while Focus Ring rotates around it
- ✅ Continuous rotation: Ring rotates smoothly with finger (visual feedback)
- ✅ Selection snapping: Changes at ±15° threshold with visual reset
- ✅ Slow drag = precise crawling (1:1 angular mapping)
- ✅ Fast swipe = momentum carry with smooth deceleration (0.95 decay)
- ✅ Can traverse large datasets (2000 items) in a few swipes
- ✅ 60fps performance on mobile devices (rotation and momentum)
- ✅ Works on square/portrait/landscape viewports
- ✅ Zero hardcoded px values
- ✅ Tested with both Bible and MMdM catalog
- ✅ RotationChoreographer properly separated from interaction layer deceleration
- ✅ Can traverse large datasets (2000 items) in a few swipes
- ✅ 60fps performance on mobile devices
- ✅ Works on square/portrait/landscape viewports
- ✅ Zero hardcoded px values
- ✅ Tested with both Bible and MMdM catalog

**Test Datasets**: 
- **Bible (large cousin sets)**: 
  - Genesis chapters: 50 chapters (Genesis 1-50)
  - Psalms chapters: 150 chapters (test large sibling group)
  - All verses in Genesis 32 + Genesis 33 (test cousin gaps)
- **MMdM Catalog (varied hierarchy)**:
  - Markets → Countries → Manufacturers → Cylinders → Families → Sub-Families → Models
  - Load with Manufacturers in Focus Ring (skip Markets/Countries)
  - Test with 100+ manufacturers, 2-5 engine models
- **Stress Test**: Create 2000-item synthetic JSON for physics validation

**Phase 1 Complete When**:
- All rotation physics feel perfect ("CyberTruck steering feel like wooden tiller")
- Large and small datasets both work flawlessly
- No search window or keyboard needed - rotation alone is sufficient
- Code is clean, minimal, and ready for Phase 2

---

### Phase 2: Dimension Button
**Goal**: Prove meta-navigation state machine works

**What we're building**:
- Dimension button (bottom center, above copyright notice)
- State machine (normal mode ↔ dimension mode)
- Focus Ring repurposed to show dimensions
- Dimension selection and return to normal

**Success Criteria**:
- ✅ Click button → Focus Ring shows dimensions
- ✅ Select "Latin" → return to normal mode
- ✅ State persists correctly
- ✅ Animation feels natural
- ✅ No data filtering yet - just mode switching

**Test Dataset**: Bible languages (Latin, English, Hebrew, Greek, French, Spanish, Italian, Portuguese, Russian)

---

### Phase 3: Child Pyramid + Parent Button
**Goal**: Prove dynamic layout and migration animations work

**What we're building**:
- Child Pyramid with dynamic node capacity (viewport-responsive)
- Sampling algorithm (150 siblings → 15 nodes)
- Even fan line distribution
- IN migration animation (Child Pyramid → Focus Ring, Focus Ring → Detail Sector)
- OUT migration animation (Detail Sector → Focus Ring, Focus Ring → Child Pyramid)
- Parent Button for OUT navigation (toward root/testament)

**Success Criteria**:
- ✅ Pyramid shows correct number of nodes for viewport aspect ratio
- ✅ 150 Psalms chapters → sampled to fit pyramid capacity
- ✅ Even angular spacing on all fan lines
- ✅ Smooth "sorting ballet" animation during migrations
- ✅ Parent button appears and enables OUT navigation

**Test Datasets**:
- Bible chapters (Genesis: 50, Psalms: 150, Matthew: 28)
- Catalog structure (manufacturers → countries → categories → products)

---

### Phase 4: Detail Sector
**Goal**: Prove plugin system and content rendering works

**What we're building**:
- Detail Sector expanding circle
- Plugin registry system
- Bible verse text wrapper plugin (line wrapping, dynamic font sizing)
- Catalog product card plugin (image, description, links)
- Template system for volume-specific layouts

**Success Criteria**:
- ✅ Bible verse renders with proper text wrapping
- ✅ No wasted space, optimal line usage
- ✅ Catalog product shows image + text + link
- ✅ Different volumes use different templates
- ✅ Clean plugin interface (easy to add new templates)

**Test Content**:
- Bible verses (varying lengths: 5 words to 80 words)
- Catalog products (with images and descriptions)

---

## Post-Launch (v2.1+)

**Once all 4 phases work flawlessly**:

- [ ] Performance optimization (lazy loading, caching)
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Additional volumes (Music player, Social media archive)
- [ ] Documentation for adding new volumes
- [ ] Public API documentation
- [ ] Deploy to bibliacatholica.org
- [ ] Deploy to mmdm.it
- [ ] Mobile app wrappers (Android, iOS)

---

## Success Metrics

**Code Quality**:
- Total lines < 2,000 (vs v1: 12,628)
- Average function length < 20 lines
- Zero CSS !important flags
- 80%+ test coverage

**User Experience**:
- Smooth 60fps animations
- Touch response < 16ms
- Works on all viewport sizes
- Intuitive navigation (no tutorial needed)

**Architecture**:
- Clear module boundaries
- One-way data flow
- No defensive programming
- Easy to add new volumes

---

## Timeline

**No deadlines. Quality over speed.**

Each phase completes when:
1. Code is clean and minimal
2. Tests pass 100%
3. No known bugs
4. Documentation complete
5. User testing confirms it works

If architecture needs revision, we start the phase over. No patches.

---

## Reference

- **v1 codebase**: `/media/howell/dev_workspace/wheel/`
- **v2 codebase**: `/media/howell/dev_workspace/wheel-v2/`
- **Production v1**: https://howellgibbens.com/mmdm/wheel/
- **Staging v2**: https://howellgibbens.com/mmdm/wheel-v2/
