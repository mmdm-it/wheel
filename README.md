# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)

> v3.8.32 Designed

Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. v3.8.29 Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.8.39 (2026-02-22)

## Notable Changes in 3.7.3
- Child Pyramid nodes now support a spiral layout mode, placing nodes equidistantly along an Archimedean spiral using true arc-length spacing. This ensures visually uniform node distribution for all child counts. (Cartesian grid mode is also available.)

## Release Train
- v3.8.15 Baseline data + UI lift — done
- v3.8.15 Adapter + state-store foundation — done
- v3.8.15 Volume-safe interaction loop — done
- v3.8.15 Detail/pyramid rebuild on adapters — done
- v3.8.15 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.8.15 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets
- v3.8.15 Migration Animation (Child Pyramid ↔ Focus Ring) — shipped: `animateIn`/`animateOut` with LIFO stack, 600ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` support
- v3.8.19 Parent Button Labelling — shipped: adapter-driven `getParentLabel`, progressive depth labels (country → manufacturer → compound), uppercase suffix

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.8.39`).
- Historical majors are maintained outside the active v3 repository (archived folders/repos for v0/v1/v2).
- Future v4 will branch from the final v3 tag and tag releases as `v4.*` (no versioned folders).
- GitHub flow is feature branch → pull request → merge into protected `main` after required checks pass.

## Scripts
- `npm test` — run Node built-in tests (no external deps)
- `npm run build` — esbuild bundle (`src/main.js` → `dist/app.js`, target Chrome 74, IIFE)
- `npm run lint:forbidden` — guard for forbidden volume-specific literals in shared code (runs `test/forbidden-literals.test.js`)
- `npm run bump-version -- 3.7.0` — bump package/changelog version for release (or run `./bump-version.sh 3.7.0`)
- `bash sync-to-server.sh` — build + deploy using local team deployment config

## Mobile Device Diagnostics

Diagnostic/logging procedures are intentionally maintained in the local
team testing runbook and are not part of the public repository docs.

## Structure
- `src/geometry` — pure math helpers (hub/radius, arc window, positions)
- `src/navigation` — navigation state and events
- `src/interaction` — rotation choreographer (momentum + snapping)
- `src/view` — rendering (SVG hooks), DOM bindings, and migration animation (`migration-animation.js`)
- `data` — sample volume/schema/manifest
- `styles` — CSS variables and base styles
- `test` — node test files for geometry/state

## Goals
Keep modules small (<200 lines), zero inline styles/`!important`, pure functions where possible, and validate volumes at load to stay data-agnostic.
