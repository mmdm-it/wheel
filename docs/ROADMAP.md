# Wheel v3 Roadmap

> v3.x keeps the geometry and rendering wins, but rebuilds the core architecture around adapters, schemas, and a central interaction store/state machine.

### Release Train Status (v3)
- v3.2.17 Baseline data + UI lift — done (seeded from v3)
- v3.3 Adapter + state-store foundation — done (shipped as 3.3.0)
- v3.4 Volume-safe interaction loop — done (shipped as 3.4.0; queue/cancel + deep-link hydration + rapid-switch stress tests)
- v3.5 Detail/pyramid rebuild on adapters + data-agnostic sweep — done (shipped as 3.5.0)
- v3.6 Theming + accessibility hardening — done (shipped as 3.6.0)
- v3.7 Dimension System (lens: language/time) — planned

## Vision

A pluggable wheel UI where each volume ships an adapter that provides data, layout, and capabilities. Core interaction and rendering are data-agnostic, guarded by a single state machine. Validation is schema-first and runs at build/test time.

## Core Principles (v3)
1. **Adapters over conditionals** — each volume ships a contract, not bespoke branches.
2. **Single interaction source of truth** — one store/state machine for rotation, focus, and volume switching.
3. **Schema-first data** — JSON Schema + adapter validation in CI; runtime warnings only.
4. **Pure renderers** — geometry/view read normalized data + layout specs, no data logic inside.
5. **Composable themes** — shared base tokens, per-volume overlays.

---

## Milestones

### v3.2.17 — Baseline Data + UI Lift (shipped in 3.2.17)
**Goal:** Seed the refreshed data and UI while keeping geometry and rendering stable ahead of the adapter rebuild.

**Status:** Complete. Baseline manifests and UI assets were lifted from the prior track to anchor the v3.x restart.

**Exit criteria:** core data/UI parity with prior release; geometry unchanged; staging volumes validated.

**Build/Test Checkpoints:**
- Manifests load and render with legacy adapters; geometry snapshots stable.
- Smoke rotation/focus flows verified on seeded volumes.

### v3.3 — Adapter + Store Foundation (shipped in 3.3.0)
**Goal:** Stand up the new architecture skeleton while keeping the existing UI assets.
- Define adapter contract (`loadManifest`, `validate`, `normalize`, `layoutSpec`, `capabilities`).
- Add JSON Schemas for each manifest; enforce via `node --test`.
- Introduce interaction store/state machine (actions for rotate, focus, volume switch, deep link).
- Wrap existing geometry/rendering to consume `normalized + layoutSpec` shapes.

**Status:** Complete. Adapter contract and schemas are enforced in tests; interaction store drives render/navigation; telemetry emits use centralized `safeEmit`; debug logging is gated.

**Exit criteria:** adapter contract merged; schemas enforced in CI; store drives render loop for one sample volume.

**Build/Test Checkpoints:**
- Store + adapter skeleton green: unit tests for store reducers/guards; adapter normalize/layoutSpec tests; schema validation in CI.
- One adapter end-to-end: manifest → validate/normalize → layoutSpec → focus-ring render using store state.
- No data-specific conditionals remain in shared render/navigation paths.

### v3.4 — Volume-Safe Interaction (complete)
**Goal:** Make volume switching a first-class, race-free operation.
- Guarded transitions in the store (no switch mid-transition without queue/cancel).
- Transition choreography between volumes (loading, placeholder, apply, reveal).
- Integration tests: switch during rotation; invalid manifest rejection; deep-link hydration.

**Status:** Complete (released as 3.4.0). Queue/cancel guard rails, telemetry + `store:error` affordance, deep-link hydration, rapid-switch stress tests (50-cycle switch/rotate burst + in-flight deep-link), and child-pyramid geometry helpers (dynamic capacity, sampling, even-angle placement) are landed.

**Exit criteria:** volume switch tests green; UX smooth under load; errors degrade gracefully. (Met via rapid-switch stress coverage and deep-link-in-flight test.)

**Build/Test Checkpoints:**
- Integration: rotation → volume switch → rotation (no stale state); queued/cancelled switches behave deterministically.
- Stress/perf: rapid switch + rotation bursts keep last requested volume/focus and clear hover; deep-link hydration stable while prior switch runs.
- Error paths: invalid manifest surfaces warning and retains prior volume; deep-link hydration stable.
- Telemetry hooks emit load/validate/switch events.

### v3.5 — Detail/Pyramid on Adapters
**Goal:** Rebuild child pyramid and detail sector on normalized data + layout specs.
- Child pyramid consumes adapter layout; sampling and migration animations operate on normalized children.
- Detail sector uses adapter-provided templates/layout metadata.
- Expand plugin surface for detail renderers (text, cards, media) with per-volume themes.
- Data-agnostic sweep: eliminate volume-specific conditionals (e.g., Bible/Catalog/Calendar) from shared navigation/render flows; route through adapter capabilities/layoutSpec.

**Status:** Complete (shipped as 3.5.0). All volumes ship adapters (bible, catalog, calendar, places) with normalized layout/detail and pyramid configs; handler delegation is adapter-driven; detail plugin registry has text/card samples; adapter-specific detail templates are covered for Bible, Catalog, Calendar, and Places via mock DOM render tests. Data-agnostic guard (forbidden volume literals) runs via `npm run lint:forbidden`. Next: roll into v3.6 theming/accessibility hardening.

**Exit criteria:**
- Pyramid/detail work for at least two volumes; migrations stable; theming respected.
- Shared navigation/render code is data-agnostic (no hardcoded volume branches); adapters provide volume selection, children resolvers, label formats, and layout.
- Light guard rails: lint/search check for forbidden volume literals in shared modules and an automated assertion to prevent regression.

**Build/Test Checkpoints:**
- Pyramid sampling tested on large sibling sets; migration animations do not conflict with volume switches.
- Detail renderers driven by adapter templates/meta; snapshot tests per volume.
- Two volumes validated end-to-end (e.g., gutenberg + catalog) through pyramid/detail flows.
- Data-agnostic sweep validated: string scan for volume literals in shared code passes; adapter-provided hooks cover selection, children, labels, and layout; handler delegation verified in web smoke and test suite.

### v3.6 — Theming + Accessibility (shipped in 3.6.0)
**Goal:** Make the experience skinable and accessible by contract.
- Theme tokens (color, type, spacing, motion) per volume; base tokens shared.
- Accessibility pass: focus order, ARIA labels from normalized data, motion-reduced mode.
- Performance tuning: render/manifest perf telemetry with budgets and CI guards.

**Status:** Complete (released as 3.6.0). Base tokens expanded; per-volume overlays wired via `styles/themes/*.css`; theme swap smoke added. Accessibility hardening covers keyboard activation, ARIA-from-meta, reduced motion, and enforced tab order. Perf telemetry emits `perf:render` and `perf:manifest` with budget flags; CI checks guard budgets.

**Exit criteria:** a11y checks pass; theme swap verified across volumes; perf budgets met. (Met.)

**Build/Test Checkpoints:**
- Theme swap smoke tests across volumes; reduced-motion honored; focus order validated.
- A11y: ARIA labels from normalized meta; keyboard activation on nodes/pyramid/parent/dimension controls; enforced tab order.
- Perf: manifest fetch/cache and render budgets emitted and CI-guarded.

---

## Success Metrics
- Architecture: adapters isolated; renderers data-agnostic; single interaction store; schemas enforced in CI.
- UX: 60fps rotations; smooth volume transitions; no stale state during switches.
- Quality: 80%+ test coverage on store + adapter validation + volume-switch integration.
- Operability: clear telemetry hooks around adapter load/validation and interaction events.

---

## References
- Adapter contract: `docs/ARCHITECTURE_V4.md`
- Prior spec (baseline geometry/contracts): `docs/ARCHITECTURE_V3.md`
- Dimension behavior details: `docs/DIMENSION_SYSTEM.md`
- Legacy launch tracker (v0.8/v1, bibliacatholica.org): see `../wheel/TODO.md`
