# Punch List

Running list of feel/cosmetic observations noticed during any phase.
One line each, tagged **[C]** (how the wheel responds — physics, timing,
geometry), **[D]** (dimensions/strata), or **[E]** (how it reads at rest —
typography, alignment, theming). Cheap fixes may be batched into any passing release; this list
just guarantees nothing evaporates. Delete lines when done.

- [ ] [E] Font sizes need a full review pass (ring labels, magnifier, detail sector)
- [ ] [E] Label alignment (left/right anchoring) inconsistent in places
- [ ] [C] Animation speeds need tuning as part of the feel-constants pass
- [ ] [C] Star field residue: ordinal skies (Psalms, chapters) seat the FIRST 28 then smudge — decide whether they instead want the 2026-07-14 stride-anchor idea (human-number strides, I X XX … CL, both ends anchored) inside the star field. (The planetary-cluster/depth-of-field design itself SHIPPED in C.5 — golden-angle scatter, prominence tiers, depth taper, seat cap 28; drained 2026-07-20.)
- [ ] [C] Pyramid rotation dim-only (0.35) vs old dim+blur — blur dropped for perf (the ~150ms/frame SVG filter); `#pyramid-rotate-blur` kept in defs for a device-gated revival. Howell to rule whether dim-only is the feel.
- [ ] [C] Portrait gate part two: loading already in landscape boots a mis-sized wheel (gate covers it, but rotating to portrait reveals it until reload); live viewport-change relayout unhandled.
- [ ] [C] Magic-number hygiene from the C.4/C.5 sprint: gateway-wipe `0.02` margin / `1.05` radius / `'#868686'`×3, densify `0.65` + relax ladder in child-pyramid-geometry, day-grid inline ratios (`0.765`, `0.38`, corner ratios) — name them into their tunable blocks. Also audit L3 (dead DEFAULT_* constants, retired ray×spiral knobs in pyramid-tuning-knobs.js).
- [ ] [E] Vulgate slots holding no Latin — **re-measured 2026-08-02, was "152"**: now **103** in the canonical books (Judith 29, the Sirach Prologue 22, Psalms 11, and a scatter across Exodus/Acts/Genesis and others); the truncation repairs and the Esther fill closed the difference. Decide the display fallback for those. SEPARATELY, the appendix books show 2,264 more, and they are two different things: 1,833 (Odes, Psalms of Solomon, Enoch, 3–4 Maccabees) are TRUE Vulgate absences awaiting an `editions.VUL.absent` assertion, while 431 (I_ESDR — which the Clementine prints as *Esdrae III*) and the 22 Prologue slots are genuinely OWED Latin text and belong to the Vulgate's "prologues owed" work, not to any display fallback. — Wilbur
