# SUNDAY v3.7 Steps (delete on v3.7.0 release)

## Purpose
Working checklist for v3.7 (Dimension System: language/time lens). Delete this file when 3.7.0 ships.

## Status snapshot (today)
- v3.6 shipped: theming/accessibility/perf budgets done; test + lint green; tag `v3.6.0` pushed.
- Dimension System is next: add language/time lens with adapter-driven hooks and UI affordances.

## Steps to v3.7 release
1) Requirements + design
- Define dimension model (language/time) contract exposed by adapters (capabilities + layoutSpec flags).
- Document UX flows: toggle dimension, show labels, announce changes (ARIA), reduced-motion behavior.
- Update `docs/DIMENSION_SYSTEM.md` with v3.7 scope.

2) Data + adapter surface
- Add capability flags and layout/meta for dimension lens to each adapter (bible/catalog/calendar/places).
- Ensure manifests carry any needed dimension metadata (language codes, time ranges) without literals in shared code.

3) Interaction + state
- Extend store/state to track active dimension lens (language/time) and expose actions/selectors.
- Wire navigation + rotation choreographer to respect dimension context (snap/rotation bounds if needed).
- Telemetry: emit dimension toggle/change events with adapter/volume context.

4) View + accessibility
- Add dimension control UI (icon/label) and align tab order; ARIA labels from adapter meta.
- Reduced-motion: ensure dimension transitions respect prefers-reduced-motion; no abrupt animations.
- Mirror/secondary views: ensure dimension state reflects in secondary/mirrored nodes if applicable.

5) Tests
- Unit tests: store actions/reducer for dimension lens; adapter capability plumbing; telemetry emission.
- View tests: dimension control keyboard activation, ARIA labels, tab order unaffected.
- Integration: toggle dimension while rotating/switching volumes; ensure state/telemetry consistent.

6) Performance + budgets
- Measure render impact of dimension lens (use existing `perf:render`/`perf:manifest` hooks if any extra costs).
- Add budget assertions if dimension toggle adds measurable latency.

7) Docs + release
- Update ROADMAP/README to mark v3.7 complete when done; add changelog entry.
- Re-run `npm test` and `npm run lint:forbidden`.
- Prep changelog and tag 3.7.0; delete this file.

## Files touched/expected
- Adapters: `src/adapters/**/*` (capabilities/layoutSpec/meta) and manifests under `data/` if metadata needed.
- Store/state: `src/interaction`, `src/navigation`, `src/core/store-navigation-bridge.js`.
- View/UI: `src/view/focus-ring-view.js`, `styles/*`, assets if new icons.
- Tests: `test/**/*dimension*`, updates to a11y/perf tests if needed.
- Docs: `docs/DIMENSION_SYSTEM.md`, ROADMAP, README, CHANGELOG.

## Notes
- Keep changes data-agnostic; derive labels/meta from adapter-provided data.
- Maintain perf guardrails; avoid regressing existing budgets.
- Preserve accessibility guarantees (keyboard/ARIA/focus order) when adding the dimension lens.
