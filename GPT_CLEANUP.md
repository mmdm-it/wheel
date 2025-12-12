# GPT Cleanup Plan

Pragmatic checklist to reduce risk and complexity before v1.0.

## Priorities (order to execute)
1) Stabilize data loading
2) Simplify navigation + animation coupling
3) Finish/remove Hub↔Nuc dual coordinates
4) Harden cache + versioning
5) Reduce debug noise

## 1) Stabilize Data Loading
- Make volume discovery config-driven (no hardcoded filenames). Accept `volumes.json` and fallback glob of `data/*/manifest.json` + `*.json` with schema check.
- Enforce schema/version gate on load (reject if missing `volume_type`, `hierarchy_levels`, `volume_schema_version`). Fail fast with user-visible error.
- Generalize lazy-load paths to use hierarchy metadata, not hardcoded `testament/section/book/chapter`.
- Add sort_number validation earlier (DataManager) and remove DOM-time overlay.

## 2) Simplify Navigation/Animation Coupling
- Define clear events/API between app ↔ renderer ↔ animation ↔ child pyramid (no direct DOM cloning from app).
- Centralize navigation state (selected item, level, offsets) in one owner (renderer or a new controller) and emit events.
- Make animations cancellable; ensure a single pipeline per interaction (IN/OUT) with cleanup.
- Remove `window.mobileCatalogApp` references; pass callbacks instead.

## 3) Finish/Remove Hub↔Nuc Dual Coordinates
- Either implement correct Hub→Nuc/Nuc→Hub transforms using viewport/arc params, or delete unused bilingual helpers.
- Align touch rotation math to the finalized coordinate model (single-axis, angle-based).
- Add unit tests for coordinate conversion with known viewport cases (e.g., iPhone SE numbers in ARCHITECTURE.md).

## 4) Harden Cache + Versioning
- Version cache keys by `volume_id + volume_data_version + volume_schema_version`; purge on mismatch.
- Add a `cacheClear()` path in UI/debug for dev.
- Surface cache hits/misses via Logger level 3+ only.

## 5) Reduce Debug Noise
- Route all console logs through Logger with levels; gate emoji debug behind `loglevel>=4` or flags.
- Strip or silence verbose logs in production paths (rotation/animation loops).

## Work Sequencing (small PRs)
- PR1: Volume discovery + schema gate + cache versioning.
- PR2: Coordinate decision (finish or remove) + touch math alignment + tests.
- PR3: Navigation/animation contract + cancellable animations; remove `window.*` coupling.
- PR4: Sort-number validation in DataManager; remove overlay UI; tidy logs.

## Definition of Done per PR
- Unit/behavioral tests where feasible (discovery, coords, cache keying).
- Manual mobile check: load volume, rotate, navigate IN/OUT, translation toggle, lazy-load path works.
- Logs at loglevel 2 are quiet (no spam); no console errors.

## Notes
- Keep ASCII; avoid broad refactors in one PR—target isolated, testable changes.
