# Wheel v3 Roadmap

> v3.x keeps the geometry and rendering wins, but rebuilds the core architecture around adapters, schemas, and a central interaction store/state machine.

### Release Train Status (v3)
- v3.2.17 Baseline data + UI lift — done (seeded from v3)
- v3.3 Adapter + state-store foundation — done (shipped as 3.3.0)
- v3.4 Volume-safe interaction loop — done (shipped as 3.4.0; queue/cancel + deep-link hydration + rapid-switch stress tests)
- v3.5 Detail/pyramid rebuild on adapters + data-agnostic sweep — done (shipped as 3.5.0)
- v3.6 Theming + accessibility hardening — done (shipped as 3.6.0)
- v3.7 Dimension System + Child Pyramid — shipped (portals wired: language/edition metadata, store/bridge hydration, portal UI cycling, telemetry + perf budgets; pyramid geometry refactored to CPUA fan-lines/spiral; child pyramid node rendering with CHILD_PARAM_TABLE, connector lines, sort-number rotation offset; catalog data cleanup; shipped as v3.7.28)
- v3.8 IN/OUT Migration + patch series — done (shipped as v3.8.15; see patch notes below)
- v3.9+ Single-Stratum Program — in progress (Phases A–F below)
  - v3.9.0 Phase A (single stratum) — done
  - v3.10.x Phase B.2 gateway capability + interim pyramid guarantee — done
  - v3.11.0 Phase B close + Phase C sprint C.1–C.5 (catch-up release, 2026-07-20) — done

## Current Plan: Single-Stratum Program (decided 2026-07-13; six-phase scope ratified 2026-07-14)

Goal: a smooth-running single-stratum app before dimension development
resumes. Dimensions are **paused, not cancelled** — the strata design
(blur + mirrored secondary ring) is the ruled-canon UI for their return,
and the dormant store/bridge dimension state (`src/core/`) is retained as
the foundation they will land on. Pseudo-parents (v0's `rpp_` alternate
hierarchies) are retired permanently.

Dividing line between C and E: Phase C owns everything about how the
wheel *responds* (physics, timing, geometry); Phase E owns everything
about how it *reads at rest* (typography, alignment, theming). Running
cosmetic/jank observations are collected in `docs/PUNCHLIST.md`, tagged
C or E, and drained by whichever phase owns them. Dimensions (D) sit
between them deliberately: the strata inherit C's tuned physics, and E
then styles every surface — primary and strata — exactly once. The
packaged apps ship the full dimensioned instrument, so Packaging is
last (F).

- **Phase A — Single stratum** — SHIPPED as v3.9.0 (2026-07-14).
  Dimension UI machinery removed; Bible pinned to the Latin Vulgate
  (`VUL`); all four volumes behave identically.
- **Phase B — Data completeness + single-site consolidation** — DONE
  (closed 2026-07-16 with the first end-of-phase audit,
  `docs/AUDIT-PHASE-B.md`). B.1 Bible: Psalms rebuilt to native Vulgate
  numbering, Latin filled from the Clementine corpus (99.5%; 152
  divergent-recension residuals documented). B.2: the Gutenberg easter
  egg — generic cross-volume **gateway node** capability (shipped as
  v3.10.0). B.3 MMdM: population complete — 1,032 models across 99 real
  manufacturers, full prose, guarded by
  `test/catalog-integrity.test.js`. B.4: the Gregorio XIII gateway to
  the calendar volume — second gateway instance, zero shared-code
  changes.
- **Phase C — Feel** (in progress; shipped in the 3.11.0 catch-up
  release through C.5). Phone-gated per WORKFLOW.md; the calendar's
  6,000-year ring is the primary physics test rig; constants ledgered
  in `docs/FEEL.md`. As-run sub-phases:
  - **C.1/C.1b** — Phase B audit debts cleared (12 of 14; L1 deferred to D, L3 to C.7);
    `src/volume-configs.js` as the one home for volume literals;
    gateway speed (cache + idle prefetch).
  - **C.2** — instruments (boot-phase decomposition, feel HUD, field
    probe `?probe=1`), catalog lite/prose split, cache hygiene, staging
    deploy target. Perf series: pre-compressed JSON, O(visible)
    selectNearest, memoized pyramid geometry, rotation blur dropped.
  - **C.3** — the gesture ladder: tap / scrub (frozen 1:1) /
    scrub-anchored flick / double-flick; velocity-gain amplifier
    retired.
  - **C.4** — arrivals: boot splash "the instrument arrives";
    migration rebuild (declared grammar, transaction barrier,
    fixed-vessel fills); gateway cinema wipe.
  - **C.5** — the star field (golden-angle scatter, prominence tiers,
    Favorites halo, seat cap 28); canonical usable areas
    (`src/geometry/usable-areas.js`); the wedge calendar.
  - **C.6 — "five thousand nodes"** (Howell's post-it): DONE, declared
    2026-07-20. The day ring: grid-tap migration (±5-year chain, thumb
    doctrine), months-ring front door on the current month, historical
    Julian/Gregorian reckoning (Gregory's ten missing days fall out of
    the arithmetic), the present-moment mark; plus the e-reader (NEXT
    gesture, continuous verse chain) and the sweep at every level. The
    6,000-year chain, the 86k-link months timeline, and the 31k-verse
    chain all scrub at speed on the field phones — the O(visible)
    render path made chain length free. (As-run, this work shipped
    across the C.5/day-ring/e-reader series, not as one labeled drop.)
  - **C.7 — phase close** (in progress, opened 2026-07-20): end-of-phase
    audit ritual (adversarial code + prose reviews, performance
    baselines), FEEL.md final pass, native-vs-wrapper evidence memo for
    Phase F, [C] punchlist drained or explicitly carried.
- **Between D and E — catalog family flattening** (ruled 2026-07-19;
  DEFERRED out of C by Howell 2026-07-20 to reach dimensions sooner).
  Families leave the navigation hierarchy; the parent button becomes the
  live family suffix ("FORD WINDSOR", replacing, never accumulating;
  orphans bare "FORD"). Safe to defer: the shared engine never knew
  families existed (adapter-level change), and D's strata mirror
  whatever chain the adapter hands them. MUST land before E, which
  styles every surface exactly once and shouldn't style doomed family
  rings. When built, it needs its own brief on-device feel pass and one
  new check: the suffix's behavior with a secondary stratum present.
- **Phase D — Dimensions**: the strata design (mirrored/standard rings,
  z-travel = dimension change) on C's tuned physics. D inherits the
  choreographer, migration machinery, and gesture ladder from C, so the risk
  was never motion mechanics; it was (a) the dimension MODEL on paper, and
  (b) the strata blur — the returning C.2 perf villain and the
  native-vs-wrapper decider. **Both softened in the build (2026-07-21):** the
  model landed and was then revised past its own draft (a third stratum
  appeared), and the recede+blur shipped as a cheap STATIC snap the
  iPhone/Moto floor takes without complaint — the C.2 villain only bites
  PER-FRAME blur, which a snap never asks for. The open risk moved
  downstream, to the animated tween (D.4). Outline blessed 2026-07-20,
  revised 2026-07-21 as the build overtook the plan.
  - **D.1 — Doctrine + schema (paper first)** — ✅ shipped. `DIMENSION_SYSTEM.md`
    rewritten to the strata canon; the dormant `src/core/` store/bridge
    revived, not rebuilt. NOTE: the canon was revised again 2026-07-21 — the
    "no third stratum is needed" ruling was **reversed** (see D.3).
  - **D.2 — The dimension model, headless** — ✅ shipped (`feat(D.2)`).
    Dimension state in the live store (select, persist-on-select, host-level
    survival across gateway reboots); the Bible's translation swaps in-app
    via state, no page redirect. Its close surfaced the LIVE LABEL SWAP
    problem (carried to D.6).
  - **D.3 — The strata, built** — ✅ shipped (**v3.13.0**). Far past the
    original "static, sharp, unblurred scaffolding" scope; it absorbed most
    of D.4's visual and all of D.5's static blur:
    - Secondary (mirrored) AND **tertiary** (standard) rings — the third
      stratum the D.1 draft called unneeded, now the translation plane, with
      the single-translation skip (Latin ⇄ secondary only; English/Greek
      earn the third).
    - The **honest sprocket chain**: bands are arc + straight tangent runs
      (vertical up / ~SE, mirrored), not a circle — a receded ring must read
      as a straight chain, never a hose-reel coil.
    - The **receding stack** as a SNAP: primary → secondary → tertiary,
      depths 1.0/0.4/0.2, a straight camera pull-back (2D scale about the
      viewport centre). Static blur 0/5/10px — affordable *because* static.
    - **Tangent fill** (the receded chain populates its straight runs), the
      globe gated to the detail sector, native-tongue language labels.
    - Left unbuilt on purpose: the MOTION (D.4). Selection is tap-for-now;
      the strata transition is a snap.
  - **D.4 — The motion made real**: the two stopgaps D.3 shipped, retired.
    (a) **Orbital rotation of the secondary/tertiary rings** —
    magnifier-as-selection, whatever's in the lens is obeyed; retires
    tap-for-now and restores the two-motion premise. The strata become
    rotatable focus rings inheriting C's choreographer and gesture ladder
    (their chains are short, so bounds/snap are simpler than the primary's).
    (b) **The z-travel TWEEN** — the multiplane pull-back animated (glide,
    not snap), the incoming plane sliding in from behind the head. **Deferred
    by Howell 2026-07-21** ("we can live with the skip a while longer"); the
    snap is an honest resting state meanwhile.
  - **D.5 — Blur under motion** (the residue of the old "hardest subphase"):
    the STATIC blur already ships and performs (D.3), so the
    native-vs-wrapper decider softened. What remains is only blur DURING the
    D.4 tween — the C.2 per-frame villain returns *only if* the glide
    animates blur. Likely resolved by the C.2 lesson: drop blur during
    motion, snap it back on settle. Effectively folds into D.4's tween; kept
    as a slot for the wrapper-evidence entry if the animated case forces the
    question.
  - **D.6 — The Bible, dimensioned, end to end**: much shipped early —
    Latin/English/Greek and more on the secondary, translations on the
    tertiary, the live TEXT swap (D.2). What remains: (a) the **LIVE LABEL
    SWAP** — book/testament/ring/parent-button labels re-derive their
    language on a translation change without a reboot (D.2's carried-over
    headline; the reading text already swaps because its render takes the
    translation live, but labels bake from a boot-fixed `namesMap`); (b) the
    **translation + versification DATA campaign** — DRA is declared but
    empty, BYZ is NT-only, versification maps are unbuilt; "weeks of work,"
    deliberately deferred by Howell 2026-07-21 (see the debt note). (c) the
    Greek OT/NT one-per-book collapse decision. Deployment scoping
    (single-stratum public egg vs full dimensions gated to the apps and
    bibliacatholica.org) still stands.
  - **D.7 — Phase close**: audit ritual, FEEL.md dimension constants, the
    wrapper-evidence memo's decisive final entry, punchlist drain.
- **Phase E — Presentation**: typography (sizes, families), label
  alignment, spacing, per-volume theming polish, detail-sector layout
  refinement — across every surface, primary and strata, exactly once.
- **Phase F — Packaging**: web remains the trunk; PWA groundwork
  (manifest, service worker, offline volume cache), then Capacitor/TWA
  store wrappers of the same bundle for iOS/Android, shipping the full
  dimensioned instrument. The public web demo remains single-stratum
  (the Gutenberg egg); full dimensions are gated to the apps and
  bibliacatholica.org — deployment scoping designed in F, not before.

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

### v3.8 — IN/OUT Migration Animation (shipped in v3.8.15)
**Goal:** Restore the v0-era visual animation of Child Pyramid nodes into and out of the Focus Ring during hierarchy navigation.

**Status:** Complete (released as v3.8.15). Migration animation module (`src/view/migration-animation.js`) provides `animateIn` and `animateOut` as flat function exports. A LIFO stack saves cloned nodes during IN for exact OUT reversal across multi-level navigation. All volume adapters (catalog, bible, calendar) use `app.migrateIn`/`app.migrateOut` with instant-swap fallback.

**Architecture:**
- `animateIn(opts)` — clones child pyramid nodes, applies CSS `transform: translate(dx,dy) rotate(Δ°)` with 600ms ease-in-out to slide them to their calculated focus ring positions, pushes to LIFO stack.
- `animateOut(opts)` — pops from LIFO stack, shows saved clones at focus ring positions, reverse-animates back to pyramid positions, removes clones.
- `isAnimating()` — guard that blocks pyramid clicks, parent button clicks, and rotation during animation.
- `clearStack()` — resets animation state on full navigation reset.
- `prefers-reduced-motion` respected via CSS (`transition: none !important`).

**Integration pattern:** `index.js` exposes `migrateIn` and `migrateOut` on the app object. These pre-calculate focus ring target positions (normalise, align-to-selected, clamp), run the animation overlay, then call `setPrimaryItems` on completion. Pyramid `onClick` and adapter `parentHandler` use `app.migrateIn`/`app.migrateOut` when available, falling back to `app.setPrimaryItems`.

**Exit criteria:** Animated IN/OUT transitions match v0 visual quality; LIFO stack supports multi-level undo; interaction blocked during animation; all existing tests pass. (Met.)

**Build/Test Checkpoints:**
- All 28 unit tests across 7 test files pass (volume-pyramid, catalog-adapter, bible-adapter, child-pyramid, navigation, volume-layout, adapter-types).
- Visual verification on production: Ford → cylinder → family/subfamily IN/OUT cycles.
- Reduced-motion honored; instant-swap fallback verified.

**v3.8 patch series (v3.8.16 → v3.8.40):**
- v3.8.34 iOS WebKit animation reliability fix (rAF timing guard, `--iframe-scale` font compensation).
- v3.8.38 Fix click-to-magnify after migrateIn (pointerup/click race via `wasDragging` guard).
- v3.8.39 Mobile tap reliability + parent-button restore (proximity fallback, duplicate-touch suppression, touch-device OUT migration fix).
- v3.8.40 Revert commit 52cb891 — suppressed initial render and forced pyramid nodes to `display:none`, causing black screen on load.

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
- Legacy launch tracker (v0.8/v1, bibliacatholica.org): see `../wheel-v0/TODO.md` (archive; naming explained in `VERSIONING.md`)
