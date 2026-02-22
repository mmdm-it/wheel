# Changelog

## 3.8.38 — Fix click-to-magnify after migrateIn (pointerup race)
- Fixed click-to-magnify failing at deeper hierarchy levels (e.g. clicking
  a cylinder after navigating IN from manufacturer → model). Root cause:
  the `pointerup` handler called `selectNearest()` unconditionally, which
  could start a snap animation before the browser's `click` event arrived.
- Fix: mirror the v0 touch pattern — track `wasDragging` and call
  `selectNearest()` only after real drags, never after taps.

## 3.8.34 — iOS WebKit animation reliability fix
- Fixed iOS WebKit animation "pop" (nodes jumping to final position instead
  of animating).  Root cause: `requestAnimationFrame` on iOS can fire within
  the same compositing pass (<12 ms), before the initial CSS transform has
  been painted.  The `afterPaint` helper now measures elapsed time since the
  reflow; if < 12 ms it pads the `setTimeout` delay so the total wait is
  ≥ 34 ms (two 60 fps frames), guaranteeing at least one full paint cycle.
  On well-behaved browsers this adds zero extra delay.
- Applied `--iframe-scale` compensation to all Detail Sector font sizes and
  panel dimensions (same GoDaddy iframe fix applied to Focus Ring earlier).
- Removed diagnostic logging overlay and download button.

## 3.8.33 — iOS animation fix & debug overlay removal
- Removed debug overlay (ES5 error-catching panel) from production.
- Fixed iOS Safari first-load animation failure: replaced all
  `setTimeout(fn, 10)` reflow-gap calls in migration-animation.js with
  double-`requestAnimationFrame` (`afterPaint`) pattern. iOS Safari's
  compositor needs a full paint cycle to commit the initial CSS transform
  before the transition target is applied; 10 ms was not enough on cold
  start, causing the "ballet" migration to be skipped entirely.

## 3.8.32 — Chrome 80 compatibility (Android 10 dumb-phone support)
- Replaced top-level `await import()` in all 4 adapter modules with lazy
  `_ensureNode()` init pattern. Top-level await requires Chrome 89+;
  Android 10 ships with Chrome ~80, causing a fatal SyntaxError at parse
  time that prevented the app from loading entirely.
- Replaced CSS `gap` in flexbox (Chrome 84+) with `> * + *` margin
  fallback for `.detail-panel` and `.detail-card`.
- Logo circle now links to mailto:info@mmdm.it (configured via
  `contact_email` in volume manifest).

## 3.8.31 — Copyright notice & version badge relocation
- Added copyright notice bar across top of screen:
  "© 2026 Meccanismi Marittimi delle Marche. Tutti i diritti riservati."
  White text on dark semi-transparent strip, iframe-scale-aware.
- Version badge ("WHEEL V3.8.31") moved from top-right overlay into the
  Detail Sector panel as a subtle footer line, visible when the detail
  panel expands on leaf-level items.

## 3.8.30 — Iframe font-size compensation (mmdm.it)
- GoDaddy "Forward with Masking" wraps the app in an iframe without a viewport
  meta tag, causing mobile browsers to default to a ~980 px layout viewport and
  zoom out.  CSS `clamp()` floors (in px) resolve pre-zoom, so fonts appeared
  much smaller than intended while SVG geometry (proportional to SSd) was fine.
- Added iframe-zoom detection in `index.html`: compares `screen` dimensions to
  `window.innerWidth/Height`; when the CSS viewport is >20 % wider than the
  physical screen, sets `--iframe-scale` CSS custom property.
- All `vmin`-based font-size `clamp()` rules now multiply their min/max bounds
  by `var(--iframe-scale, 1)`, so the clamp floors survive the browser zoom.
- Version badge `12px` likewise scales by `--iframe-scale`.
- No effect on non-iframe or desktop browsing (`--iframe-scale` defaults to 1).

## [Unreleased]
### Added
- Spiral Child Pyramid node layout: nodes are now placed equidistantly along an Archimedean spiral using true arc-length spacing. This provides visually uniform node distribution for all child counts.
> Versioning note: items previously labeled v4.x are now tracked as v3.x. Mapping: v4.2.x → v3.4.x, v4.1.x → v3.3.x, v4.0.x → v3.2.17/18. Package version is set to 3.5.0.


## [3.8.29] - 2026-02-17

### Fixed
- Magnifier and Parent Button labels now reliably hidden during migration animation — switched from `display` attribute (which `render()` clobbers via `removeAttribute('display')`) to `style.visibility: hidden` which render never touches
- Circle fills use `style.fill: none` to keep stroke rings visible while hiding the gold fill during animation


## [3.8.28] - 2026-02-17

### Added
- **Magnifier ↔ Parent Button migration animation**: during IN migration, the old magnifier circle+label travels in a straight line to the parent-button position (label transitions from centered to offset-left); during OUT, the parent button travels back up to the magnifier position (label transitions offset-left to centered)
- **Parent Button radial exit/entry**: during IN, the old parent button exits radially outward from the HUB (same direction as Focus Ring nodes); during OUT, the new parent button flies in from off-screen along its radial ray
- **Clicked node → magnifier growth**: the clicked Child Pyramid node now grows from pyramid node radius to magnifier radius during its IN animation to the Focus Ring
- Magnifier and Parent Button stroke rings remain visible (empty) during animation, matching the Focus Ring band pattern
- All animation durations temporarily set to 1200 ms for design/test


## [3.8.27] - 2026-02-17

### Fixed
- Eliminated ~300 ms flicker at end of IN migration where Focus Ring nodes briefly disappeared: `animateIn` clones (600 ms) were hidden before `animateRingOutward` (900 ms) restored the real nodes — clones now stay visible until the outward overlay is removed and real nodes are restored


## [3.8.26] - 2026-02-18

### Fixed
- Ring inward animation (OUT migration) now starts all nodes at a uniform distance from the HUB, just far enough that every node begins off-screen — nodes maintain equal radial distance from the HUB at every frame, and the rectangular viewport naturally causes staggered entry as nodes closer to their nearest edge appear first
- Per-node ray-viewport intersection determines the minimum clearance for each node; the maximum across all nodes becomes the single uniform translate distance
- Restored `ease-in-out` timing (from `ease-out`) since the slow-start phase is now visible, giving smooth acceleration-deceleration matching the outward animation


## [3.8.25] - 2026-02-17

### Fixed
- OUT migration ring inward animation now uses 600 ms `ease-out` (matching animateOut and animatePyramidToHub) instead of 900 ms `ease-in-out` — all three OUT animations are now synchronous, simultaneous, and fluid
- Previously the 900 ms ease-in-out started slow off-screen (wasted motion), then nodes appeared to jerk into the viewport late; the 600 ms ease-out enters decisively and decelerates smoothly into final position


## [3.8.24] - 2026-02-16

### Fixed
- Synced `CHILD_PARAM_TABLE` in child-pyramid-geometry.js with docs/child_pyramid_params.csv: `minNodeDist` now decreases with child count (7→6 at 5, 6→5 at 7, 5→4 at 10, 4→3.5 at 12) instead of being hardcoded to 7 for all counts ≤ 11


## [3.8.23] - 2026-02-16

### Fixed
- Focus Ring animation clones now replicate the real label positioning: offset/radial labels (`text-anchor: end`, pulled toward hub by `radius × -1.3`) for manufacturer-level nodes, centered labels for cylinder-level nodes — eliminates visible "snap" at start of outward and end of inward ring animations


## [3.8.22] - 2026-02-16

### Fixed
- Eliminated doubled Focus Ring labels during IN animation (old ring nodes overlapping new ring nodes between 600–900 ms)
- Eliminated doubled Focus Ring labels during OUT animation (real ring nodes reappearing at 600 ms while inward clones still settling until 900 ms)
- Ring node group visibility now controlled solely by the ring radial animation (900 ms) instead of the shorter core animation (600 ms)


## [3.8.21] - 2026-02-16

### Changed
- OUT migration: `animateRingInward` now fires simultaneously with `animateOut` and `animatePyramidToHub` instead of sequentially after them (eliminates ~600ms delay before parent ring nodes enter frame)
- Parent ring node positions pre-calculated before animations start, matching the pattern used by IN migration


## [3.8.20] - 2026-02-16

### Added
- Focus Ring radial outward animation during IN migration: existing ring nodes fly outward along their hub→node rays (expanding galaxy) while new nodes animate in
- Focus Ring radial inward animation during OUT migration: parent ring nodes fly inward from off-screen along their radial rays to populate the ring
- New exports `animateRingOutward` and `animateRingInward` in migration-animation module
- `RING_RADIAL_DURATION` constant (900ms) — intentionally leisurely compared to 600ms core animations
- Magnifier node excluded from radial animations (reserved for future Magnifier ↔ Parent Button animation)

### Changed
- IN migration now fires three simultaneous animations: animateIn + animateRingOutward + animatePyramidFromHub
- OUT migration fires animateRingInward after animateOut completes and parent items are painted


## [3.8.19] - 2026-02-16

### Added
- Adapter-driven Parent Button labelling: catalog adapter now exports `getParentLabel(item)` on its handler set
- Parent label builds progressively from navStack depth: country (depth 0) → manufacturer (depth 1) → frozen "MANUFACTURER N CIL" compound (depth 2+)
- All parent button suffixes forced uppercase for visual consistency
- `createApp` accepts optional `getParentLabel` callback; delegates to adapter when provided, falls back to built-in logic

### Changed
- Renamed original `getParentLabel` in index.js to `builtinGetParentLabel` to avoid collision with adapter-supplied function
- index.html wiring updated to extract `getParentLabel` from adapter handler set and pass to `createApp`


## [3.8.18] - 2026-02-16

### Changed
- Hub ↔ Child Pyramid animation now runs simultaneously with Child Pyramid ↔ Focus Ring animation (parallel 600ms, down from ~1200ms sequential)
- Restructured migrateIn to commit data swap immediately while real nodes are hidden, enabling both animations to fire at the same time
- Fixed pyramid group opacity not restored after OUT migration
- Removed duplicate animatePyramidFromHub call from migrateOut that caused nodes to vanish and re-animate from wrong direction


## [3.8.17] - 2026-02-16

### Added
- Child Pyramid nodes now animate to/from the hub (off-screen focus-ring center) during IN and OUT migrations instead of popping on/off
- New `animatePyramidFromHub` and `animatePyramidToHub` exports in migration-animation module


## [3.8.16] - 2026-02-16

### Changed
- Migration animation now runs simultaneously with Detail Sector expand/collapse (parallel 600ms, down from ~1200ms sequential)
- All child pyramid nodes animate during migration, including those destined for off-screen arc positions (no more filtering to visible window)
- Added `calculateAllNodePositions` geometry export (unfiltered arc positions for animation targets)


## [3.8.15] - 2026-02-15

### Added
- Migration animation: Child Pyramid nodes now animate smoothly to their Focus Ring positions during IN migration (600ms ease-in-out CSS transform), matching v0 behavior
- Migration animation: Focus Ring nodes animate back to Child Pyramid positions during OUT migration (reverse of IN, LIFO stack for multi-level navigation)
- New module `src/view/migration-animation.js` with `animateIn`, `animateOut`, LIFO stack, and `isAnimating` guard
- All volume adapters (catalog, bible, calendar) use animated migration when available, with instant-swap fallback
- Interaction blocked during animation (pyramid clicks, parent button clicks)
- CSS `will-change: transform` on animation clones; `prefers-reduced-motion` support


## [3.8.14] - 2026-02-15

### Changed
- revert: Focus Ring band back to original gray (#7a7979, opacity 1)


## [3.8.13] - 2026-02-15

### Changed
- style: catalog band opacity 0.5 to match Detail Sector circle muted blue


## [3.8.12] - 2026-02-15

### Changed
- style: catalog Focus Ring band color changed to Detail Sector blue (#362e6a)


## [3.8.11] - 2026-02-15

### Changed
- fix: Child Pyramid reappears automatically after Detail Sector collapse


## [3.8.10] - 2026-02-15

### Changed
- fix: Parent Button click at manufacturer level no longer duplicates country label in magnifier


## [3.8.9] - 2026-02-15

### Changed
- fix: Parent Button + country label reappear after migrating all the way OUT


## [3.8.8] - 2026-02-15

### Changed
- fix: Detail Sector logo animation — position relative to screen center not hub, fix opacity parity with v0


## [3.8.7] - 2026-02-15

### Added
- feat: Detail Sector expand/collapse animation — VolumeLogo gains expand() and collapse() methods (600ms quadratic ease-in-out); circle grows from 12% SSd upper-right to 99% FR radius at hub center, logo shrinks to 10% watermark at -35% FR offset with magnifier-angle rotation; leaf detection in render loop suppresses Child Pyramid when model-level item is in Magnifier; CPUA bounds suppressed during animation

### Fixed
- fix: volume-pyramid test updated for child mode (setCatalogMode('child') not 'model')


## [3.8.6] - 2026-02-15

### Changed
- feat: family/subfamily/orphan support — getCatalogChildren walks families, subfamilies, and orphan models; normalize builds full hierarchy graph; multi-level IN/OUT via navStack; detailFor resolves models at any depth; orphans sort before containers


## [3.8.5] - 2026-02-15

### Changed
- fix: OUT migration restores pre-IN state instead of initial load state


## [3.8.4] - 2026-02-15

### Changed
- fix: shiftLayersOut re-stashing isLayerOut after parentHandler already reset it


## [3.8.3] - 2026-02-15

### Changed
- fix: magnifier stuck on old label after OUT migration — reset isLayerOut in setPrimaryItems


## [3.8.2] - 2026-02-15

### Changed
- fix: parent button blank after child pyramid migration — add parentName to catalog children


## [3.8.1] - 2026-02-15

### Changed
- fix: child pyramid click — SVG-level event delegation for reliable node migration on all platforms


## [3.8.0] - 2026-02-15

### Changed
- feat: begin IN/OUT migration — child pyramid complete (v3.7.x)


## [3.7.29] - 2026-02-15

### Changed
- chore: remove dead hashString01, archive 7 stale docs, update ROADMAP + version refs + WORKFLOW


## [3.7.28] - 2026-02-14

### Changed
- refactor: replace fan line sweep + spiral with magnifier-to-node connector lines, remove debug logging


## [3.7.27] - 2026-02-14

### Changed
- feat: sort-number rotation offset formula, fix node oscillation (CSS transform transition removal), min-distance-from-origin guard


## [3.7.26] - 2026-02-14

### Changed
- feat: child pyramid params lookup table by childCount, alphabetical manufacturer sort, remove duplicate Mercruiser


## [3.7.25] - 2026-02-14

### Changed
- feat: child pyramid params lookup table by childCount, alphabetical manufacturer sort, remove duplicate Mercruiser


## [3.7.24] - 2026-02-14

### Changed
- fix: formatLabel crash on Bible — call factory with proper args, detect context-aware catalog formatter


## [3.7.23] - 2026-02-14

### Changed
- feat: child pyramid placement — tighter spiral, dynamic spacing, arc margin, deterministic per-parent fan-line rotation


## [3.7.22] - 2026-02-13

### Changed
- fix: rotate child pyramid labels relative to hub, not magnifier


## [3.7.21] - 2026-02-13

### Changed
- fix: center and rotate child pyramid labels over nodes, matching focus ring label style


## [3.7.20] - 2026-02-13

### Changed
- fix: center cylinder labels in focus ring, show N CIL suffix in magnifier


## [3.7.19] - 2026-02-13

### Changed
- cosmetic: solid gold child nodes with black stroke, uppercase labels, cylinder labels number-only (N CIL in magnifier)


## [3.7.18] - 2026-02-13

### Changed
- fix: restore V0 catalog colors (gray/gold/blue), add catalog logo, show cylinders (not models) as pyramid children, remove diagnostic green band lines


## [3.7.17] - 2026-02-13

### Changed
- refactor: place child nodes at fan-line × spiral intersections instead of independent spiral walk; suppress red X markers when nodes present


## [3.7.16] - 2026-02-13

### Changed
- Fix pyramidConfig merge: merge adapter layout (capacity/place) with volume layout (getChildren/onClick) so child nodes render


## [3.7.15] - 2026-02-13

### Changed
- feat: enable child pyramid node rendering with click-to-drill for catalog


## [3.7.14] - 2026-01-02

### Changed
- Tertiary magnifier now uses the same stroke/fill, font, and rotating label behavior as primary/secondary magnifiers for consistent styling across strata.


## [3.7.13] - 2026-01-02

### Changed
- Dimension button now auto-hydrates language/edition portals from `display_config.languages/editions` and the translations registry in the demo bootstrap, restoring tertiary strata visibility when portal data exists.
- Focus ring stage flags log `hasPortals` and allow the secondary stratum to render in blurred mode even without portals (while keeping tertiary gated to edition stage).


## [3.7.12] - 2026-01-01

### Changed
- Focus ring now feeds child pyramid geometry data (fan lines/spiral/intersections) to PyramidView and removes legacy pyramid instruction wiring.


## [3.7.11] - 2025-12-31

### Changed
- CPUA bottom edge raised to 4× magnifier radius (geometry, fan-line clipping/spiral origin, diagnostics).
- Documentation updated to match CPUA bottom change.


## [3.7.10] - 2025-12-30

### Changed
- CPUA fan-line clipping now respects the full right edge (width minus margin), subtracting the logo cutout and logging endpoints for diagnostics.


## [3.7.9] - 2025-12-30

### Changed
- Fan line visualization with CPUA intersection filtering


## [3.7.8] - 2025-12-30

### Changed
- (Add changes here)


## [3.7.7] - 2025-12-30

### Changed
- (Add changes here)


## [3.7.6] - 2025-12-30

### Changed
- (Add changes here)


## [3.7.5] - 2025-12-30

### Changed
- (Add changes here)


## [3.7.4] - 2025-12-29

### Changed
- (Add changes here)


## [3.7.3] - 2025-12-29

### Changed
- Child Pyramid node placement switched to a Cartesian grid (origin at top-left, offset by 0.2 * SSd).
- Grid gap increased to 0.18 * SSd between columns and rows.
- All child nodes are now included in the grid (no sampling or filtering).
- Removed all polar/arc logic from pyramid node placement.

## [3.7.2] - 2025-12-29

### Changed
- (Internal/test versions; see 3.7.3 for final grid/placement logic.)


## [3.7.1] - 2025-12-29

### Changed
- Removed the temporary "CHILDREN (IN)" inner control and its handlers; parent button is the sole layer toggle.

## [3.7.0] - 2025-12-29

### Added
- Dimension portals: language (secondary) and edition (tertiary) lenses with UI cycling, aria labels, and keyboard activation.
- Schema/data: manifest languages/editions metadata required and validated; adapters pass through `display_config.languages/editions`.
- Telemetry: `dimension:stage`, `dimension:language`, `dimension:edition`, plus perf:render budget checks covering portal toggles.

### Changed
- Interaction store/bridge hydrate language/edition defaults per volume and reset on volume switch.
- Focus ring repurposes secondary ring for portals; dimension control uses stage-aware labels.

### Tests
- Portal UI coverage (aria, keyboard, telemetry), volume-switch dimension resets, and perf budget guard for dimension toggle.

## [3.6.1] - 2025-12-28

### Changed
- (Add changes here)


## [3.6.0] - 2025-12-28

### Added
- Theme swap smoke coverage for all volumes via `test/theme-swap-smoke.test.js`.
- Render/manifest performance telemetry with budget flags and CI guardrails (`perf:render`, `perf:manifest`, `test/perf-ci-budget.test.js`).

### Changed
- Accessibility hardening: keyboard activation across controls, ARIA-from-meta labels, reduced-motion handling, and enforced tab sequence (parent outer → parent inner → primary → pyramid → secondary → dimension).
- Theme tokens expanded and per-volume overlays wired; base styles consume spacing/radii/motion/magnifier stroke tokens.

### Fixed
- Focus order validation aligns DOM re-append behavior in tests to mirror browser tab order.

## [3.5.1] - 2025-12-28

### Changed
- Version bump to 3.5.1 (theming token expansion + overlay test coverage; manual testing planned)

## [3.5.0] - 2025-12-27

### Added
- Adapter-specific detail templates covered via plugin registry for all volumes (Bible, Catalog, Calendar, Places) with mock DOM render tests

### Changed
- Version bump to 3.5.0 to mark v3.5 release train complete

## [3.4.16] - 2025-12-27

### Added
- Detail template coverage for Calendar (year/month) and Places (hierarchy) rendered through the plugin registry

### Changed
- Bumped version to 3.4.16

## [3.4.15] - 2025-12-27

### Added
- Detail template coverage for Bible and Catalog via plugin registry with mock DOM render tests

### Changed
- CI wired to run forbidden volume-literal guard and tests on master; README badge added for CI status

## [3.4.14] - 2025-12-27

### Changed
- Host now delegates per-volume handlers to adapters; handler wiring lives alongside each adapter

## [3.4.13] - 2025-12-27

### Changed
- Version bump to 3.4.13 (no functional changes)

## [3.4.12] - 2025-12-27

### Changed
- Version bump to 3.4.12 (no functional changes)

## [3.4.11] - 2025-12-27

### Changed
- Adapter-driven detail panel (catalog) with text/card plugins and demo wiring
- Pyramid/detail styles for rendered preview and detail content


## [3.4.10] - 2025-12-27

### Changed
- Version bump to 3.4.10 (no functional changes)


## [3.4.9] - 2025-12-27

### Changed
- Version bump to 3.4.9 (no functional changes)


## [3.4.8] - 2025-12-26

### Changed
- Version bump to 3.4.8 (no functional changes)


## [3.4.7] - 2025-12-26

### Changed
- Version bump to 3.4.7 (no functional changes)


## [3.4.6] - 2025-12-26

### Changed
- Version bump to 3.4.6 (no functional changes)

## [3.4.5] - 2025-12-26

### Changed
- Version bump to 3.4.5 (no functional changes)

## [3.4.4] - 2025-12-26

### Changed
- Version bump to 3.4.4 (no functional changes)

## [3.4.3] - 2025-12-26

### Added
- Pyramid preview builder that samples/places children and produces render instructions (with tests)
- Optional pyramid configuration in `createApp` to render instructions and handle pyramid clicks
- Pyramid child resolvers for all volumes (Bible/Calendar/Catalog/Places) with pyramid click drill-down (chapters/months/models/places)

### Changed
- Pyramid instruction builder now retains the source item to support click affordances

## [3.4.2] - 2025-12-26

### Added
- Focus view renders child-pyramid instructions (nodes + labels with click hooks)

### Changed
- Detail plugins (text/card) now support non-DOM render contexts via injected createElement factory

## [3.4.1] - 2025-12-26

### Added
- Detail plugin registry scaffold (register/unregister/cache) with unit tests
- Catalog adapter layoutSpec emits pyramid capacity/sample/place hooks using child-pyramid geometry helpers

## [3.4.0] - 2025-12-26

### Added
- Rapid volume-switch stress coverage (50-cycle burst + in-flight deep-link hydration) to lock volume-safe interaction exit criteria
- Child pyramid geometry helpers: dynamic capacity by viewport window, deterministic sampling, center-outward ordering, and even-angle placement across arcs

### Changed
- Marked volume-safe interaction loop complete; queue/cancel guards, telemetry, and error affordance solidified

## [3.3.3] - 2025-12-25

### Added
- `store:error` emission and optional `onError` callback in `createStoreNavigationBridge` so hosts can surface error states

### Changed
- Error transitions now dedupe notifications and clear state on recovery

## [3.3.2] - 2025-12-25

### Added
- Telemetry payload/order assertions for volume switching and deep-link hydration, including error paths and resolver failures

### Changed
- Strengthened queue/cancel coverage to ensure only final queued switches complete

## [3.3.1] - 2025-12-25

### Added
- Queue-and-replace guard rails for concurrent volume switches with telemetry events for queued/cancelled paths
- Integration test coverage for queued/replaced switches and invalid manifest rejection preserving prior volume

### Changed
- Telemetry emits now include validation start/success for volume loads

## [3.3.0] - 2025-12-25

### Added
- Introduced a `safeEmit` telemetry helper to centralize and harden onEvent hooks

### Changed
- Routed navigation volume load/switch events through telemetry helper for safer callbacks
- Gated focus-ring debug logging and chain summary emission behind the debug flag to reduce noise
- Bumped package metadata to version 4.1.0

## [3.2.18] - 2025-12-25

### Changed
- Updated branding/logging to Wheel v3 in the demo HTML
- Added a data-agnostic volume validation helper for manifests
- Wired manifest validation into loader flow and added tests for catalog, calendar, bible, and places


## [3.2.17] - 2025-12-25

### Added
- Forked v4 codebase from v3 with data-agnostic posture and copied all four volumes (calendar, gutenberg, mmdm, places)
- Updated package, docs, and tooling references to wheel paths and versioning

## [3.2.16] - 2025-12-25

### Fixed
- Parent label now migrates into the magnifier on OUT and the parent button updates to the new parent label

## [3.2.15] - 2025-12-25

### Changed
- Parent OUT shows siblings only


## [3.2.14] - 2025-12-25

### Changed
- Keep siblings visible after handled IN/OUT


## [3.2.13] - 2025-12-24

### Added
- Calendar OUT/IN level swap: parent click switches to millennia, hides parent button when at top; CHILDREN (IN) returns to years scoped to the selected millennium, restoring last selected year per millennium when available

## [3.2.12] - 2025-12-24

### Added
- Layer migration wiring: parent button shifts labels out; CHILDREN (IN) shifts back in

## [3.2.11] - 2025-12-24

### Changed
- Locale defaults to translation language when `lang` param is absent
- Parent button uses localized section names for Bible chains

## [3.2.8] - 2025-12-24

### Fixed
- Parent button section label now follows the active translation in cousin mode
- Added debug log for language, magnifier label, and parent button labels

## [3.2.7] - 2025-12-24

### Added
- Localized Bible section names (<=22 chars) across 9 languages and surfaced as parent labels

### Fixed
- Calendar millennia labels corrected to "MILLENNIUM" spelling
- Parent button now uses localized section names in cousin-mode chains

### Added
- Bible section names localized in 9 languages (<=22 chars) and used for parent labels

## [3.2.6] - 2025-12-24

### Changed
- Calendar defaults to cousins-with-gaps again and uses millennia breaks as data-driven gaps

## [3.2.5] - 2025-12-24

### Changed
- Calendar volume now has real Millennia level and parent labels; removed synthetic cousin gaps

## [3.2.4] - 2025-12-24

### Changed
- Parent button outer label offset multiplier set to -1.7 for better centering

## [3.2.3] - 2025-12-24

### Changed
- Parent button X=0.13*SSd


## [3.2.2] - 2025-12-24

### Changed
- Parent button Y=0.93*LSd


## [3.2.1] - 2025-12-24

### Changed
- Parent button labels horizontal and parent label binding


## [3.2.0] - 2025-12-24

### Changed
- Marked v3.2.0 as the Parent Button phase kickoff and completed book-name translations for all 67 books across nine languages
- Documented the v3 release train (v3.0–v3.4) with current status


## [3.1.35] - 2025-12-23

### Fixed
- Dimension button no longer starts a secondary drag; toggling out of Dimension mode works reliably

## [3.1.34] - 2025-12-23

### Fixed
- Secondary language now applies immediately when a language node snaps into the secondary magnifier (drag or click); no extra click required

## [3.1.33] - 2025-12-23

### Fixed
- Corrected localized name mapping keys for Exodus (EXO) and Numbers (NUME) so they now localize with other books

## [3.1.32] - 2025-12-23

### Added
- Localized book-name support: translation metadata now carries per-language book name maps, and the focus ring uses them for primary/secondary language changes while falling back to defaults when missing

## [3.1.31] - 2025-12-23

### Fixed
- Secondary selection now preserves the current primary item by carrying the active item id in the URL when changing translations; primary magnifier no longer resets to Genesis after language switch

## [3.1.30] - 2025-12-23

### Changed
- Secondary language ring order is now fixed to Hebrew, Greek, Latin, French, Spanish, English, Italian, Portuguese, Russian

## [3.1.29] - 2025-12-23

### Fixed
- Secondary magnifier now hides its fill and label while rotating, matching the primary magnifier’s behavior

## [3.1.28] - 2025-12-23

### Fixed
- Selecting a secondary language keeps Dimension mode active by persisting the dimension flag in the URL and restoring blur on load

## [3.1.27] - 2025-12-23

### Fixed
- Selecting a secondary (mirrored) node keeps Dimension mode active; secondary language selection no longer exits back to the primary stratum

## [3.1.26] - 2025-12-23

### Fixed
- Secondary mirrored magnifier now stays above secondary nodes, preventing unselected fill circles from covering the mirrored magnifier label text

## [3.1.25] - 2025-12-23

### Fixed
- Secondary Magnifier no longer shows small unselected labels; rotation state now resets cleanly and the mirrored magnifier hides labels while spinning

## [3.1.24] - 2025-12-23

### Fixed
- Secondary Magnifier label now uses the secondary ring geometry for rotation, matching the node orientation

## [3.1.23] - 2025-12-23

### Added
- Secondary Stratum language ring now rotates via drag while in Dimension mode, centered on the mirrored magnifier
- Secondary magnifier renders with filled stroke circle and larger label showing the selected language
- Language nodes and labels use native-language names (Greek, Hebrew, Cyrillic, etc.)

## [3.1.22] - 2025-12-23

### Fixed
- Secondary Stratum language nodes and labels now hide when leaving Dimension mode; they only render while the secondary band is visible

## [3.1.21] - 2025-12-23

### Fixed
- Secondary Stratum language ring now centers its window on the mirrored magnifier, preventing initial nodes from pinning to the lower-left entry point

## [3.1.20] - 2025-12-23

### Added
- Secondary Stratum now renders 9 language nodes (from `data/gutenberg/translations.json`) with mirrored magnifier and band; selecting a language reloads with that translation

## [3.1.19] - 2025-12-23

### Changed
- Version bump only

## [3.1.18] - 2025-12-23

### Changed
- Secondary Stratum magnifier stroke now renders without fill (hollow) while we await secondary nodes

## [3.1.17] - 2025-12-23

### Fixed
- Secondary Stratum magnifier stroke now mirrors the primary magnifier’s y-position across the viewport height (instead of following the mirrored arc), ensuring it remains visible in Dimension mode

## [3.1.16] - 2025-12-23

### Added
- Debug logging for Secondary Stratum magnifier positioning (prints mirrored hub, angle, radius, and coordinates when Dimension mode is active)

## [3.1.15] - 2025-12-23

### Fixed
- Secondary Stratum magnifier and band now anchor to y = LSd (as designed), ensuring the mirrored magnifier stroke renders in Dimension mode

## [3.1.14] - 2025-12-23

### Fixed
- Secondary Stratum magnifier and band now mirror using viewport height (true vertical reflection), keeping the mirrored magnifier stroke visible in Dimension mode

## [3.1.13] - 2025-12-23

### Added
- Mirrored magnifier stroke circle in the Secondary Stratum, positioned with the same mirrored geometry as the secondary band and kept unblurred

## [3.1.12] - 2025-12-23

### Fixed
- Secondary (mirrored) stratum band now renders above blurred content so underlying labels no longer show through; band remains unblurred

## [3.1.11] - 2025-12-23

### Changed
- Doubled the blur strength applied in Dimension mode for a stronger visual separation

## [3.1.10] - 2025-12-23

### Fixed
- Mirrored Focus Ring band now renders outside the blur layer so it stays sharp while Dimension mode blurs the primary ring

## [3.1.9] - 2025-12-23

### Fixed
- Dimension mode now immediately re-renders when toggled so the mirrored Focus Ring band stays visible while blurred

## [3.1.8] - 2025-12-23

### Added
- Dimension mode now renders a mirrored Focus Ring band across the viewport center line (lower-left to upper-right arc) while keeping the same size and style as the primary band

## [3.1.7] - 2025-12-23

### Fixed
- Blur mode now blocks drag/swipe rotation and momentum; rotation start/end and snapping respect the blur lock so only the Dimension button remains active

## [3.1.6] - 2025-12-23

### Changed
- When blurred (dimension mode), all ring interactions are disabled; only the Dimension button remains clickable

## [3.1.5] - 2025-12-23

### Fixed
- Blur demo now uses an SVG Gaussian blur filter for better mobile browser support (keeps dimension icon sharp)

## [3.1.4] - 2025-12-23

### Fixed
- Blur demo now works on mobile by grouping focus-ring content under a blur group (dimension icon stays sharp)

## [3.1.3] - 2025-12-23

### Added
- Dimension button now toggles a full-viewport blur while keeping the dimension icon sharp to demo the dimension switch visual signature

## [3.1.2] - 2025-12-23

### Changed
- Dimension button repositioned to bottom-right entry angle +9°, radius set to 90% of Focus Ring, and size scaled to 1.8× magnifier radius

## [3.1.1] - 2025-12-23

### Changed
- Dimension button now positioned at bottom-right entry angle +7° with 93% Focus Ring radius and sized to 2× magnifier radius

## [3.1.0] - 2025-12-23

### Added
- Dimension trigger icon placed at 135° from Hub at 90% of Focus Ring radius using `dimension_sphere_black.svg`, sized to node diameter

### Changed
- N/A

## [3.0.56] - 2025-12-23

### Fixed
- Calendar Focus Ring node labels now rotate to match other volumes while remaining centered

## [3.0.55] - 2025-12-23

### Changed
- Calendar volume centers Focus Ring node labels; other volumes unchanged

## [3.0.54] - 2025-12-23

### Added
- Focus Ring label formatter hooks per volume/level with context-aware magnifier vs node labels
- Calendar years show numbers in nodes and A.D./B.C. suffix in magnifier (with periods)
- Bible chapters/verses show numeric nodes and prefixed magnifier labels (Chapter/Verse)

### Changed
- createApp accepts custom label formatter and Focus Ring view uses formatted labels when provided

## [3.0.53] - 2025-12-22

### Fixed
- Honor authored startup item after sorting (Bible and MMdM) so Matthew and Lockwood-Ash load initially

## [3.0.52] - 2025-12-22

### Added
- Authorable startup defaults per volume (level + initial item) pulled from manifests and applied at load
- Per-level arrangement modes (cousins-with-gaps, cousins-flat, siblings-only) with manifest defaults for Bible, Calendar, and MMdM

## [3.0.51] - 2025-12-22

### Changed
- Remove neighbor wrap toggle and log boundaries explicitly for ordered volumes (calendar)

## [3.0.50] - 2025-12-22

### Fixed
- Align initial rotation so the selected item starts under the magnifier and logging reflects the visible neighbors without wraparound on calendar

## [3.0.49] - 2025-12-22

### Changed
- Neighbor logging now reports whether labels are visible/masked to mirror what the UI shows

## [3.0.48] - 2025-12-22

### Fixed
- Neighbor logging wraps indices so first/last items still report two before/after entries

## [3.0.47] - 2025-12-22

### Changed
- Neighbor logging now reports gaps/unknowns explicitly (magnifier + two before/after)

## [3.0.46] - 2025-12-22

### Added
- Console logging of magnifier label and two neighbor node labels when idle

## [3.0.45] - 2025-12-22

### Fixed
- Hide only the selected node label at the magnifier while keeping adjacent labels visible

## [3.0.44] - 2025-12-22

### Fixed
- Hide the node label closest to the magnifier on load (larger mask) to avoid duplicate magnifier label

## [3.0.43] - 2025-12-22

### Fixed
- Calendar magnifier stroke now stays in themed color during rotation (1px stroke)

## [3.0.42] - 2025-12-22

### Changed
- Calendar theme sets magnifier stroke to match label color

## [3.0.41] - 2025-12-22

### Added
- Single-click a focus node to rotate it into the magnifier without affecting swipe/scrub behavior

## [3.0.40] - 2025-12-22

### Changed
- Restore Montserrat fonts for Bible volume theme

## [3.0.39] - 2025-12-22

### Changed
- Split base styles from volume-specific themes and load per volume
- Default cousin gaps disabled for catalog (catalog items load as siblings)

## [3.0.38] - 2025-12-22

### Changed
- Add millennium gaps to calendar chain (2-node gap between millennia)

## [3.0.37] - 2025-12-22

### Changed
- Add cousin chains for Bible books with section gaps and logging summary

## [3.0.36] - 2025-12-22

### Changed
- Set magnifier angle to 142deg


## [3.0.35] - 2025-12-22

### Changed
- Fix magnifier angle to 140deg


## [3.0.34] - 2025-12-22

### Changed
- Remove multi-flick chaining; fixed 350-node quick swipe


## [3.0.33] - 2025-12-22

### Changed
- Boost chained flicks to half/full dataset


## [3.0.32] - 2025-12-22

### Changed
- Chain quick swipes to traverse large sets


## [3.0.31] - 2025-12-22

### Changed
- Scale quick-swipe spin to dataset size


## [3.0.30] - 2025-12-22

### Changed
- Boost quick-swipe spin gain


## [3.0.29] - 2025-12-22

### Changed
- Add calendar dataset and theme


## [3.0.28] - 2025-12-22

### Changed
- Keep snap non-rotating so magnifier fills


## [3.0.27] - 2025-12-22

### Changed
- Add 100ms snap-to-magnifier animation


## [3.0.26] - 2025-12-22

### Changed
- Add geometry tests and enforce node radius input


## [3.0.25] - 2025-12-22

### Changed
- Set focus label offset to -1.3 radius


## [3.0.24] - 2025-12-22

### Changed
- Pull focus labels further toward hub


## [3.0.23] - 2025-12-22

### Changed
- Pull focus labels closer to hub


## [3.0.22] - 2025-12-22

### Changed
- Shift focus labels toward hub


## [3.0.21] - 2025-12-22

### Changed
- Adjust focus label anchor offset


## [3.0.20] - 2025-12-22

### Changed
- (Add changes here)


## [3.0.19] - 2025-12-22

### Changed
- (Add changes here)


## [3.0.18] - 2025-12-21

### Changed
- (Add changes here)


## [3.0.17] - 2025-12-21

### Changed
- Increase label font sizes ~50% via CSS


## [3.0.16] - 2025-12-21

### Changed
- Return font sizing to CSS; remove inline styles


## [3.0.15] - 2025-12-21

### Changed
- Magnifier draws above nodes


## [3.0.14] - 2025-12-21

### Changed
- Keep magnifier stroke width; hide node label under magnifier when idle


## [3.0.13] - 2025-12-21

### Changed
- Force magnifier fill none during rotation


## [3.0.12] - 2025-12-21

### Changed
- Magnifier empty during rotation (no fill)


## [3.0.11] - 2025-12-21

### Changed
- Magnifier label hides during rotation; nodes flow through


## [3.0.10] - 2025-12-21

### Changed
- Magnifier label matches node font; nodes smaller


## [3.0.9] - 2025-12-21

### Changed
- Scale label font sizes to radius


## [3.0.8] - 2025-12-21

### Changed
- Dynamic spacing for focus ring


## [3.0.7] - 2025-12-21

### Changed
- Dynamic radii for nodes and magnifier


## [3.0.6] - 2025-12-21

### Changed
- Rotate magnifier label


## [3.0.5] - 2025-12-21

### Changed
- Add volume selection logging


## [3.0.4] - 2025-12-21

### Changed
- Fix volume selection by path


## [3.0.3] - 2025-12-21

### Changed
- Display version badge


## [3.0.2] - 2025-12-21

### Changed
- Magnifier integration and selection clamp


## [3.0.1] - 2025-12-21

### Changed
- Set v3 baseline version (major reset for v3 scaffold based on v2 architecture and specs).
