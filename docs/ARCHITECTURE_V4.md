# Architecture (Adapter Reset, v3.x numbering)

> Goal: keep the proven geometry/rendering pieces but rebuild around adapters, schemas, and a single interaction store/state machine. Every volume ships a plugin adapter; renderers stay data-agnostic. Filename retained from the prior v4 draft; roadmap now tracks this work as v3.3–v3.6.

## Layering

```
User Input (touch/click/keys)
    ↓ events
Interaction Store / State Machine (single source of truth)
    ↓ derived state
Rendering Pipeline (views) — consumes normalized data + layoutSpec
    ↓ layout math
Geometry (pure functions: focus ring, pyramid, detail sector)
    ↓ data
Adapters (per-volume) — load/validate/normalize + layoutSpec + capabilities
    ↓ IO
Services (fetch/cache/telemetry/feature flags)
```

## Volume Adapter Contract

Each volume implements:
- `loadManifest(env): Promise<RawManifest>` — fetch/load data.
- `validate(raw): ValidationResult` — JSON Schema + custom invariants (no side effects).
- `normalize(raw): { items, links, meta }` — stable typed shape (no UI concerns).
- `layoutSpec(normalized, viewport): LayoutSpec` — rings/spokes/palettes/labels.
- `capabilities` — e.g., `{ search: true, deepLink: true, theming: true }`.
- Optional hooks: `onSelect`, `onHover`, `resolveDeepLink`, `search(query)`.

**Contracts:**
- Normalized IDs are opaque strings; adapters own ID semantics.
- Normalized shape must be immutable/pure; no DOM, no globals.
- LayoutSpec must be deterministic for a given `normalized + viewport`.

## Interaction Store / State Machine

Single source of truth for UI state.
- State: `{ volume, rotation, focusId, hoverId, animation: 'idle'|'spinning'|'transitioning', modal: null|{type,payload}, error: null|ErrorLike }`.
- Events: `SET_VOLUME`, `ROTATE_TO`, `FOCUS`, `HOVER`, `ANIMATION_START/END`, `DEEP_LINK`, `LOAD_RESULT`.
- Guards: block/queue volume switch during transitions; clear hover on volume change; reject stale loads; debounce rotation commands while applying layout.
- Side effects: confined to effect handlers (load adapter, fetch manifest, log telemetry); reducers remain pure.

**Dimension portals**
- Dimension Button is the sole portal control. It cycles strata in order: Primary (hierarchy) → Secondary (first portal) → Tertiary (second portal, if present) → back to Primary.
- Volumes may expose zero, one, or two portals; never more than two. No portals: Dimension Button hidden/inactive. One portal: Primary ↔ Secondary. Two portals: Primary ↔ Secondary ↔ Tertiary.
- Portals are selection layers for dimension values (e.g., language, then translation); they are not additional dimensions themselves.
- Terminology: use “languages” for the Secondary portal options (manifest field), and “translations/editions” for the Tertiary portal options (translation registry keyed by language).

## Rendering Pipeline

- Inputs: `normalized data`, `layoutSpec`, `interaction state`.
- Views are pure: state → DOM/SVG/Canvas instructions; no fetch/validation.
- Geometry helpers provide positions/angles/paths; they take `layoutSpec` and viewport.

### Spiral Child Pyramid Node Layout

The Child Pyramid supports a spiral node layout mode, in which child nodes are placed equidistantly along an Archimedean spiral. This ensures visually uniform spacing between all nodes, regardless of their order or count.

- **Spiral formula:** $r = a + b\theta$ (with $a=0$)
- **Equidistant placement:** Node positions are computed so that the arc length along the spiral between consecutive nodes is constant. This is achieved by numerically solving for each node's angle $\theta_n$ such that the arc length $s(\theta_{n-1}, \theta_n) = d$, where $d$ is the desired gap.
- **Arc length calculation:**
    $$
    s(\theta_0, \theta) = \frac{1}{2b} \left[ (b\theta) \sqrt{(b\theta)^2 + b^2} + b^2 \ln\left( b\theta + \sqrt{(b\theta)^2 + b^2} \right) \right] \Bigg|_{\theta_0}^{\theta}
    $$
- **Implementation:** The layout uses a root-finding algorithm (bisection) to solve for each $\theta_n$ given $\theta_{n-1}$ and the desired gap.
- **Benefits:** This method guarantees true equidistant spacing along the spiral curve, improving visual consistency and layout quality for large or irregular child sets.

Adapters and geometry helpers expose this layout as part of the `layoutSpec` contract, and it is selected automatically for appropriate volumes or node counts.
- Theming: base tokens + per-volume tokens injected at render time; no inline styles/`!important`.

## Validation & Data Contracts

- JSON Schemas per manifest; enforced in CI/test via `node --test`.
- Adapters run `validate` in build/test; runtime validation logs warnings only.
- Invariants to keep: unique IDs, acyclic parent/child links, required fields per level, volume capability flags consistent with data.

## Testing Strategy

- Unit: adapter `validate/normalize/layoutSpec`, geometry functions, store reducers/guards.
- Integration: volume switch during rotation; deep-link hydration; invalid manifest rejection path; theme swap.
- Fixtures: per-volume sample manifests + synthetic stress sets (large chains, sparse cousins, deep hierarchies).

## Migration Notes (reuse from v3)

- Keep: focus-ring geometry, rotation choreography math, rendering primitives — wrap them to consume `layoutSpec`.
- Move data-specific conditionals into adapters; delete from shared render/navigation code.
- Lift current runtime validator into: JSON Schema + adapter-level invariants + tests.
- Child pyramid and detail sector should consume normalized children + adapter-provided templates, not raw manifest structures.

## Telemetry & Ops

- Log adapter load/validate timings, volume switches, rotation errors.
- Surface warnings for invalid manifests without breaking the session.
- Feature flags for experimental volumes or layouts flow through adapters/capabilities, not global constants.

## Accessibility & Performance

- Provide ARIA labels from normalized metadata; ensure focus order respects interaction state.
- Respect reduced motion; allow theme tokens to adjust motion duration/curves.
- Use lazy data hydration per adapter when supported; cache manifests per volume.

**Roadmap alignment:** Build/test checkpoints live in `docs/ROADMAP.md` (v3.3–v3.6) and reference this contract for adapter/store expectations.

## Migration Checklist (from v3 → v4)

- **Data & validation**: Turn `data/*/manifest.json` into JSON Schemas + adapter `validate/normalize`; move runtime validator logic into tests.
- **Adapters**: Create one adapter per volume (gutenberg/bible, catalog/mmdm, calendar, places); each owns `loadManifest`, `validate`, `normalize`, `layoutSpec`, `capabilities`.
- **Interaction state**: Replace scattered navigation/rotation/volume globals with a single store/state machine (actions: rotate, focus, set-volume, deep-link, animation start/end).
- **Rendering**: Point focus-ring/geometry and views to consume `normalized + layoutSpec`; delete data-specific conditionals in shared render/navigation code.
- **Child pyramid & detail**: Rebuild on normalized data; sampling/templates driven by adapter layout/meta (no raw manifest assumptions).
- **Theming**: Introduce base tokens + per-volume theme tokens; remove inline/implicit styling.
- **Tests**: Add schema tests for each manifest; unit tests for adapter normalize/layoutSpec; integration tests for volume switching during rotation and deep-link hydration.
