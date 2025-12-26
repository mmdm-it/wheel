# Wheel v4

> **Active codebase**: This branch (`v4`) is the live Wheel code. Legacy v1/v2 remain on `main`, and v3 is preserved under `/wheel-v3` for reference. File issues and PRs against `v4`.

Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v4.0.1 (2025-12-25)

## Release Train
- v4.0.1 Data-agnostic core + multi-volume baseline — done
- v4.0.1 Parent/Child adapters hardening — active
- v4.0.1 Child Pyramid — queued
- v4.0.1 Detail Sector — queued

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
Keep modules small (<200 lines), zero inline styles/`!important`, pure functions where possible, and validate volumes at load to stay data-agnostic.
