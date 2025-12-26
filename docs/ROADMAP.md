# Wheel v4 Roadmap

> v4 is a deliberate restart on top of the v4 data and UI lessons. We keep the geometry and rendering wins, but rebuild the core architecture around adapters, schemas, and a central interaction store/state machine.

### Release Train Status (v4)
- v4.0.0 Baseline data + UI lift — done (seeded from v3)
- v4.1 Adapter + state-store foundation — done (shipped as 4.1.0)
- v4.2 Volume-safe interaction loop — done (shipped as 4.2.0; queue/cancel + deep-link hydration + rapid-switch stress tests)
- v4.3 Detail/pyramid rebuild on adapters — active
- v4.4 Theming + accessibility hardening — planned
- v4.5 Dimension System (lens: language/time) — planned

## Vision

A pluggable wheel UI where each volume ships an adapter that provides data, layout, and capabilities. Core interaction and rendering are data-agnostic, guarded by a single state machine. Validation is schema-first and runs at build/test time.

## Core Principles (v4)
1. **Adapters over conditionals** — each volume ships a contract, not bespoke branches.
2. **Single interaction source of truth** — one store/state machine for rotation, focus, and volume switching.
3. **Schema-first data** — JSON Schema + adapter validation in CI; runtime warnings only.
4. **Pure renderers** — geometry/view read normalized data + layout specs, no data logic inside.
5. **Composable themes** — shared base tokens, per-volume overlays.

---

## Milestones

### v4.1 — Adapter + Store Foundation (shipped in 4.1.0)
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

### v4.2 — Volume-Safe Interaction (complete)
**Goal:** Make volume switching a first-class, race-free operation.
- Guarded transitions in the store (no switch mid-transition without queue/cancel).
- Transition choreography between volumes (loading, placeholder, apply, reveal).
- Integration tests: switch during rotation; invalid manifest rejection; deep-link hydration.

**Status:** Complete (released as 4.2.0). Queue/cancel guard rails, telemetry + `store:error` affordance, deep-link hydration, rapid-switch stress tests (50-cycle switch/rotate burst + in-flight deep-link), and child-pyramid geometry helpers (dynamic capacity, sampling, even-angle placement) are landed.

**Exit criteria:** volume switch tests green; UX smooth under load; errors degrade gracefully. (Met via rapid-switch stress coverage and deep-link-in-flight test.)

**Build/Test Checkpoints:**
- Integration: rotation → volume switch → rotation (no stale state); queued/cancelled switches behave deterministically.
- Stress/perf: rapid switch + rotation bursts keep last requested volume/focus and clear hover; deep-link hydration stable while prior switch runs.
- Error paths: invalid manifest surfaces warning and retains prior volume; deep-link hydration stable.
- Telemetry hooks emit load/validate/switch events.

### v4.3 — Detail/Pyramid on Adapters
**Goal:** Rebuild child pyramid and detail sector on normalized data + layout specs.
- Child pyramid consumes adapter layout; sampling and migration animations operate on normalized children.
- Detail sector uses adapter-provided templates/layout metadata.
- Expand plugin surface for detail renderers (text, cards, media) with per-volume themes.

**Status:** Active. Pyramid geometry helpers landed; catalog adapter emits pyramid capacity/sample/place hooks; pyramid view instructions helper added; detail plugin registry scaffolded with sample text/card plugins. Next: wire pyramid instructions into the UI and stand up adapter-specific detail templates/plugins with snapshots.

**Exit criteria:** pyramid/detail work for at least two volumes; migrations stable; theming respected.

**Build/Test Checkpoints:**
- Pyramid sampling tested on large sibling sets; migration animations do not conflict with volume switches.
- Detail renderers driven by adapter templates/meta; snapshot tests per volume.
- Two volumes validated end-to-end (e.g., gutenberg + catalog) through pyramid/detail flows.

### v4.4 — Theming + Accessibility
**Goal:** Make the experience skinable and accessible by contract.
- Theme tokens (color, type, spacing, motion) per volume; base tokens shared.
- Accessibility pass: focus order, ARIA labels from normalized data, motion-reduced mode.
- Performance tuning: lazy data and cache hooks in adapters.

**Exit criteria:** a11y checks pass; theme swap verified across volumes; perf budgets met.

**Build/Test Checkpoints:**
- Theme swap smoke tests across volumes; reduced-motion honored.
- A11y checklist: ARIA labels from normalized meta; focus order aligned with interaction state; keyboard paths verified.
- Perf: manifest fetch/cache budgets met; interaction frame timing within target.

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
