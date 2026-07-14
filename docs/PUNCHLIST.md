# Punch List

Running list of feel/cosmetic observations noticed during any phase.
One line each, tagged **[C]** (how the wheel responds — physics, timing,
geometry) or **[D]** (how it reads at rest — typography, alignment,
theming). Cheap fixes may be batched into any passing release; this list
just guarantees nothing evaporates. Delete lines when done.

- [ ] [D] Font sizes need a full review pass (ring labels, magnifier, detail sector)
- [ ] [D] Label alignment (left/right anchoring) inconsistent in places
- [ ] [C] Animation speeds need tuning as part of the feel-constants pass
- [ ] [C] **Child pyramid undercount + layout rework** (Howell, 2026-07-14, Firefox/Moto G): Volvo Penta shows only 2 of its 7 cylinder counts in the child pyramid — the ring shows all 7 after migrating IN. Investigate capacity/sampling (`CHILD_PARAM_TABLE`, spiral/fan-line intersection logic in `child-pyramid-geometry.js`). Desired feel: scattered "shotgun spray" placement that shifts with each magnifier change. Large item.
- [ ] [D] 152 Vulgate residual verses render with empty Latin (Baruch 5, Judith, versification tails) — decide display fallback
- [ ] [C] sync-to-server.sh completion banner prints wrong URLs for bible/calendar/places (howellgibbens.com paths are correct)
