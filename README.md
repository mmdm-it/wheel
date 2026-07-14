# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)


Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.10.1 (2026-07-14)

## Notable Changes in 3.10.0
- The Gutenberg easter egg: the Bible is reachable inside the MMdM catalog (GERMANIA → GUTENBERG → BIBLIA SACRA LATINA → testaments), with theme crossover and a working return door.
- Generic **gateway node** capability: catalog data can declare a door into any other volume; the host boots volumes in-app without a page reload (`bootVolume`), with browser history integration.
- Full Latin identity for the Bible volume: Capitulum + Roman numerals for chapters and verses, Latin book names everywhere including the parent button.
- Phase B Bible data: Psalms rebuilt to native Vulgate numbering from the Clementine corpus; Vulgate coverage 95.5% → 99.5%.

## Release Train
- v3.2.17 Baseline data + UI lift — done
- v3.3 Adapter + state-store foundation — done
- v3.4 Volume-safe interaction loop — done
- v3.5 Detail/pyramid rebuild on adapters — done
- v3.6 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.7 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets
- v3.8.15 Migration Animation (Child Pyramid ↔ Focus Ring) — shipped: `animateIn`/`animateOut` with LIFO stack, 600ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` support
- v3.8.19 Parent Button Labelling — shipped: adapter-driven `getParentLabel`, progressive depth labels (country → manufacturer → compound), uppercase suffix

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.10.1`).
- Historical majors are maintained outside the active v3 repository (archived folders/repos for v0/v1/v2).
- Future v4 will branch from the final v3 tag and tag releases as `v4.*` (no versioned folders).
- GitHub flow is feature branch → pull request → merge into protected `main` after required checks pass.

## Scripts
- `npm test` — run Node built-in tests (no external deps)
- `npm run build` — esbuild bundle (`src/main.js` → `dist/app.js`, target Chrome 74, IIFE)
- `npm run lint:forbidden` — guard for forbidden volume-specific literals in shared code (runs `test/forbidden-literals.test.js`)
- `./bump-version.sh [major|minor|patch] ["changelog note"]` — bump version across package.json, README, and CHANGELOG
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
