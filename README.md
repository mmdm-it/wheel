# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)

> **Active codebase**: This branch uses v3.x numbering for the adapter reset. Legacy v1/v2 remain on `main`, and prior v4 labeling has been rolled back to align with the actual release train. File issues and PRs against this branch.

Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.7.4 (2025-12-29)

## Notable Changes in 3.7.3
- Child Pyramid nodes are now placed in a Cartesian grid (origin at top-left, offset by 0.2 × SSd).
- Grid gap is 0.18 × SSd between columns and rows.
- All child nodes are included (no sampling or filtering).
- Polar/arc placement logic has been removed for the pyramid grid.

## Release Train
- v3.7.4 Baseline data + UI lift — done
- v3.7.4 Adapter + state-store foundation — done
- v3.7.4 Volume-safe interaction loop — done
- v3.7.4 Detail/pyramid rebuild on adapters — done
- v3.7.4 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.7.4 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.7.0`).
- Historical majors live on archive branches (e.g., `archive/v0`, `archive/v1`, `archive/v2`).
- Future v4 will branch from the final v3 tag and tag releases as `v4.*` (no versioned folders).

## Scripts
- `npm test` — run Node built-in tests (no external deps)
- `npm run lint:forbidden` — guard for forbidden volume-specific literals in shared code (runs `test/forbidden-volume-literals.test.js`)
- `npm run bump-version -- 3.7.0` — bump package/changelog version for release (or run `./bump-version.sh 3.7.0`)

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
