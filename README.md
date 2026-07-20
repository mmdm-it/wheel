# Wheel v3  [![CI](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mmdm-it/wheel/actions/workflows/ci.yml)


Minimal scaffold, data-agnostic: interaction → navigation → view → geometry → data, with the Magnifier as lodestar. Designed to handle deep, wide, varied hierarchies (e.g., calendar, catalog, Gutenberg, places) without dataset-specific assumptions.

## Current Version
- v3.11.0 (2026-07-20)

## Notable Changes in 3.11.0 (catch-up release — see CHANGELOG for the full sprint)
- **Phase B closed**: MMdM population complete — 1,032 models / 100 manufacturers, full prose; Gregorio XIII gateway to the calendar volume; end-of-phase audit ritual (docs/AUDIT-PHASE-B.md).
- **Phase C sprint (C.1–C.5)**: gesture ladder (tap / scrub / flick / double-flick, docs/FEEL.md); boot splash "the instrument arrives"; migration rebuild + gateway cinema wipe; golden-angle star field with editorial prominence; canonical usable areas; wedge calendar with historical Julian/Gregorian reckoning; day ring with the present-moment mark.
- **The e-reader**: NEXT gesture in the detail sector; one continuous verse chain Genesis 1:1 → Apocalypse 22:21; the sweep at books/chapters/verses levels; Roman chapters, Arabic verses.
- **Platform**: mmdm.it unmasked (direct DNS, real SEO); GPL-3.0 engine / reserved data IP split; pre-compressed JSON + perf probe cycle (cellular boot 1.3MB → 180KB).

## Release Train
- v3.2.17 Baseline data + UI lift — done
- v3.3 Adapter + state-store foundation — done
- v3.4 Volume-safe interaction loop — done
- v3.5 Detail/pyramid rebuild on adapters — done
- v3.6 Theming + accessibility hardening — done (theming tokens, a11y pass, perf budgets, theme swap smoke)
- v3.7 Dimension System (lens: language/time) — shipped: language + edition portals, schema/adapter hydration, UI cycling with aria/keyboard, perf budgets
- v3.8.15 Migration Animation (Child Pyramid ↔ Focus Ring) — shipped: `animateIn`/`animateOut` with LIFO stack, 600ms CSS transform, `isAnimating` guard, `prefers-reduced-motion` support
- v3.8.19 Parent Button Labelling — shipped: adapter-driven `getParentLabel`, progressive depth labels (country → manufacturer → compound), uppercase suffix

- `main` carries the active v3.x line; releases are tagged `v3.*` (current `v3.11.0`).
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

## License & IP

Copyright © 2025–2026 MMdM — Meccanismi Marittimi delle Marche.

- **Engine** (src, scripts, tests, styles, build config): free software under
  the **GNU GPL v3** — see [LICENSE](LICENSE).
- **Data & content** (catalog, curated volumes, artwork, brand assets):
  **all rights reserved** — see [NOTICE](NOTICE) for the exact boundary.
- The navigation mechanisms are published as **prior art** and free for all
  to use: see [docs/prior-art/](docs/prior-art/).
- "MMdM" and "Wheel by MMdM" are trademarks of MMdM; the GPL grants no
  trademark rights.
