# Punch List

Running list of feel/cosmetic observations noticed during any phase.
One line each, tagged **[C]** (how the wheel responds — physics, timing,
geometry) or **[D]** (how it reads at rest — typography, alignment,
theming). Cheap fixes may be batched into any passing release; this list
just guarantees nothing evaporates. Delete lines when done.

- [ ] [D] Font sizes need a full review pass (ring labels, magnifier, detail sector)
- [ ] [D] Label alignment (left/right anchoring) inconsistent in places
- [ ] [C] Animation speeds need tuning as part of the feel-constants pass
- [ ] [C] **Child pyramid: anchored-stride sampling + layout** (design ruled 2026-07-14). The pyramid is a PREVIEW, not an index — the focus ring is the complete view after migrate-IN. **(1) DONE early (Phase B, 2026-07-14): fit guarantee** — the fan/spiral hunt starved small counts (childCount 4 → 0 slots on phones = unreachable subtrees, found via empty Lombardini pyramid); `computeChildPyramidGeometry` now harvests relaxed-constraint spiral points until every child has a slot. Phase C should revisit whether synthetic slots need aesthetic tuning. Remaining spec: (2) children > capacity → deterministic sampling anchored at BOTH ends with stride rounded to human numbers (5/10/25) for ordinal sets — Psalms preview reads I, X, XX … CL (Howell's every-Nth idea + v2 CHILD_PYRAMID_REDESIGN's "150 Psalms → ~15 nodes"); plain even spacing for nominal sets; (3) same selection every render — "shotgun spray" motion applies to placement, not selection. (4) **"Planetary cluster" depth-of-field idea (Howell, 2026-07-14)**: stride anchors (every ~10th) render as full-size labeled nodes; the remaining siblings render as smaller nodes at 2–3 radius tiers — near/medium/far planets — unlabeled or faintly labeled, conveying sibling multitude pre-attentively. This IS the sampling-honesty cue (supersedes the [D] garnish note): 7 children = all near and labeled; 150 = ten anchors + starfield. Implementation notes: minor nodes are cheap SVG circles but cap the background count (150 Psalms ≠ 150 DOM nodes — render a bounded constellation, e.g. ≤40 minors); minor nodes still tappable → migrate IN lands on nearest actual sibling. To DISCUSS before implementing (Phase C).
- [ ] [D] 152 Vulgate residual verses render with empty Latin (Baruch 5, Judith, versification tails) — decide display fallback
- [ ] [C] sync-to-server.sh completion banner prints wrong URLs for bible/calendar/places (howellgibbens.com paths are correct)
