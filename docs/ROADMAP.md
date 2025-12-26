# Wheel v4 Roadmap

> v4 is a deliberate restart on top of the v4 data and UI lessons. We keep the geometry and rendering wins, but rebuild the core architecture around adapters, schemas, and a central interaction store/state machine.

### Release Train Status (v4)
- v4.0.0 Baseline data + UI lift — done (seeded from v3)
- v4.1 Adapter + state-store foundation — active
- v4.2 Dimension-safe interaction loop — planned
- v4.3 Detail/pyramid rebuild on adapters — planned
- v4.4 Theming + accessibility hardening — planned

## Vision

A pluggable wheel UI where each dimension is an adapter that provides data, layout, and capabilities. Core interaction and rendering are data-agnostic, guarded by a single state machine. Validation is schema-first and runs at build/test time.

## Core Principles (v4)
1. **Adapters over conditionals** — each dimension ships a contract, not bespoke branches.
2. **Single interaction source of truth** — one store/state machine for rotation, focus, and dimension switching.
3. **Schema-first data** — JSON Schema + adapter validation in CI; runtime warnings only.
4. **Pure renderers** — geometry/view read normalized data + layout specs, no data logic inside.
5. **Composable themes** — shared base tokens, per-dimension overlays.

---

## Milestones

### v4.1 — Adapter + Store Foundation (current)
**Goal:** Stand up the new architecture skeleton while keeping the existing UI assets.
- Define adapter contract (`loadManifest`, `validate`, `normalize`, `layoutSpec`, `capabilities`).
- Add JSON Schemas for each manifest; enforce via `node --test`.
- Introduce interaction store/state machine (actions for rotate, focus, dimension switch, deep link).
- Wrap existing geometry/rendering to consume `normalized + layoutSpec` shapes.

**Exit criteria:** adapter contract merged; schemas enforced in CI; store drives render loop for one sample dimension.

**Build/Test Checkpoints:**
- Store + adapter skeleton green: unit tests for store reducers/guards; adapter normalize/layoutSpec tests; schema validation in CI.
- One adapter end-to-end: manifest → validate/normalize → layoutSpec → focus-ring render using store state.
- No data-specific conditionals remain in shared render/navigation paths.

### v4.2 — Dimension-Safe Interaction
**Goal:** Make dimension switching a first-class, race-free operation.
- Guarded transitions in the store (no switch mid-transition without queue/cancel).
- Transition choreography between dimensions (loading, placeholder, apply, reveal).
- Integration tests: switch during rotation; invalid manifest rejection; deep-link hydration.

**Exit criteria:** dimension switch tests green; UX smooth under load; errors degrade gracefully.

**Build/Test Checkpoints:**
- Integration: rotation → dimension switch → rotation (no stale state); queued/cancelled switches behave deterministically.
- Error paths: invalid manifest surfaces warning and retains prior dimension; deep-link hydration stable.
- Telemetry hooks emit load/validate/switch events.

### v4.3 — Detail/Pyramid on Adapters
**Goal:** Rebuild child pyramid and detail sector on normalized data + layout specs.
- Child pyramid consumes adapter layout; sampling and migration animations operate on normalized children.
- Detail sector uses adapter-provided templates/layout metadata.
- Expand plugin surface for detail renderers (text, cards, media) with per-dimension themes.

**Exit criteria:** pyramid/detail work for at least two dimensions; migrations stable; theming respected.

**Build/Test Checkpoints:**
- Pyramid sampling tested on large sibling sets; migration animations do not conflict with dimension switches.
- Detail renderers driven by adapter templates/meta; snapshot tests per dimension.
- Two dimensions validated end-to-end (e.g., gutenberg + catalog) through pyramid/detail flows.

### v4.4 — Theming + Accessibility
**Goal:** Make the experience skinable and accessible by contract.
- Theme tokens (color, type, spacing, motion) per dimension; base tokens shared.
- Accessibility pass: focus order, ARIA labels from normalized data, motion-reduced mode.
- Performance tuning: lazy data and cache hooks in adapters.

**Exit criteria:** a11y checks pass; theme swap verified across dimensions; perf budgets met.

**Build/Test Checkpoints:**
- Theme swap smoke tests across dimensions; reduced-motion honored.
- A11y checklist: ARIA labels from normalized meta; focus order aligned with interaction state; keyboard paths verified.
- Perf: manifest fetch/cache budgets met; interaction frame timing within target.

---

## Success Metrics
- Architecture: adapters isolated; renderers data-agnostic; single interaction store; schemas enforced in CI.
- UX: 60fps rotations; smooth dimension transitions; no stale state during switches.
- Quality: 80%+ test coverage on store + adapter validation + dimension-switch integration.
- Operability: clear telemetry hooks around adapter load/validation and interaction events.

---

## References
- Adapter contract: `docs/ARCHITECTURE_V4.md`
- Prior spec (baseline geometry/contracts): `docs/ARCHITECTURE_V3.md`
- Dimension behavior details: `docs/DIMENSION_SYSTEM.md`
