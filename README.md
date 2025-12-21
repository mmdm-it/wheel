# Wheel v3

Minimal scaffold following the v2 architecture (interaction → navigation → view → geometry → data) with the lodestar Magnifier, sprocket wheel windowing, and pure geometry.

## Scripts
- `npm test` — run Node built-in tests (no external deps)

## Structure
- `src/geometry` — pure math helpers (hub/radius, arc window, positions)
- `src/navigation` — navigation state and events
- `src/interaction` — rotation choreographer (momentum + snapping)
- `src/view` — rendering stubs (SVG hooks) and DOM bindings
- `data` — sample volume/schema/manifest
- `styles` — CSS variables and base styles
- `test` — node test files for geometry/state

## Goals
Keep modules small (<200 lines), zero inline styles/`!important`, and pure functions where possible.
