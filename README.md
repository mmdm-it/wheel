# Wheel v3

> **Active codebase**: This branch uses v3.x numbering for the adapter reset. Legacy v1/v2 remain on `main`, and prior v4 labeling has been rolled back to align with the actual release train. File issues and PRs against this branch.

Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.4.13 (2025-12-27)

## Release Train
- v3.2.17 Baseline data + UI lift — done
- v3.3 Adapter + state-store foundation — done
- v3.4 Volume-safe interaction loop — done
- v3.5 Detail/pyramid rebuild on adapters — active
- v3.6 Theming + accessibility hardening — planned
- v3.7 Dimension System (lens: language/time) — planned

## Branching & Tags
- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.4.13`).
- Historical majors live on archive branches (e.g., `archive/v0`, `archive/v1`, `archive/v2`).
- Future v4 will branch from the final v3 tag and tag releases as `v4.*` (no versioned folders).

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
