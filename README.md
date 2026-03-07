# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)


Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.8.44 (2026-03-07)

## Notable Changes in 3.8.43
- Restored migration animation durations to 600ms (pyramid↔ring) and 900ms (ring radial); values had been slowed to 1200ms for design/test.
- Bible volume starts at verse level: Matthew 16 verses on the ring, 16:18 in the magnifier, verse text in the Detail Sector.
- Verse items from `buildBibleVerseCousinChain` now carry `level: 'verse'` and `parentId` for correct leaf detection and OUT navigation.
- `createHandlers` pre-populates both `bibleVerseContext` and `bibleChapterContext` at verse-level startup so two successive OUT taps work from the opening position.

## Release Train
- v3.8.42 Baseline data + UI lift — done
- v3.8.42 Adapter + state-store foundation — done
- v3.8.42 Volume-safe interaction loop — done
- v3.8.42 Detail/pyramid rebuild on adapters — done
- v3.8.42 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.8.42 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets
- v3.8.42 Migration Animation (Child Pyramid ↔ Focus Ring) — shipped: `animateIn`/`animateOut` with LIFO stack, 600ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` support
- v3.8.42 Parent Button Labelling — shipped: adapter-driven `getParentLabel`, progressive depth labels (country → manufacturer → compound), uppercase suffix

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.8.43`).
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
