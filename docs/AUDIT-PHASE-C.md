# Phase C Audit — Feel, Performance & Elegance

Second edition of the end-of-phase ritual (opened 2026-07-20; method
established in `AUDIT-PHASE-B.md`): recorded performance baselines + two
fresh-context adversarial reviews (code, docs) instructed to refute, not
confirm. Findings triaged below; fixed items marked; unfixed items carry a
phase tag for scheduling.

## 1. Performance baselines (Phase C close)

| Metric | Value | vs Phase B close |
|---|---|---|
| Catalog size (raw) | 1,248 KB | unchanged (campaign closed in B) |
| Catalog size (gzip) | 170 KB | unchanged — the wire number |
| Catalog lite/prose split | 151 KB + 346 KB | boots on lite (C.2) |
| Calendar manifest (raw/gzip) | 447 KB / 79 KB | template-synthesized (was 8.4 MB pre-C) |
| Ephemeris 2026 (raw/gzip) | 43 KB / 5.7 KB | new in C.7 scoping |
| Bundle dist/app.js (raw/gzip) | 406 KB / 85 KB | grew with C features; still one file |
| Test suite | 274 tests, all green | 143 at B close |
| Perf CI budgets | pass (suite-enforced) | render, manifest phases, item-swap |

Phone reference points recorded during C (see CHANGELOG 3.11.0 for
provenance): Moto G boot 2215→1164 ms (catalog split); iPhone X boot
~1.1 s; gateway transits ~instant on both (was 2 s / 8 s); calendar scrub
render self-time worst 64→31 ms with over-budget frames 206/694→2/953
after the geometry memo + blur removal.

## 2. Code audit — findings and triage

Method: source attacked with instructions to refute; failing inputs
executed where possible (day-grid serials round-tripped over ±3000 years;
solar events executed per-year; verse-chain ids compared against all
1,215 chapter files).

### High

- **H1 [FIXED, C.7]** Catalog pyramid tap mid-rotation committed the
  WRONG manufacturer's children: onClick resolved children from the
  committed selection while the sky live-previews the passing parent —
  a mid-glide star tap poured the origin manufacturer's cylinders,
  seeded at index 0. Fix: a tapped star not among the committed parent's
  children is noise (guard before any state commit). Bible/calendar were
  immune (they re-resolve whole-volume chains by tapped id).

### Medium

- **M1 [FIXED, C.7]** `prefetchBibleVerses` dropped the second caller's
  `onLoaded` when a load was in flight — the verse sky could stay empty
  after settle until a nudge. Callbacks now queue on the in-flight entry.
- **M2 [FIXED, C.7]** Text plugin wrapped lines against sequential rows
  but seated them at strided rows — wide shallow budgets applied to
  narrow deep seats overflowed the taper. Both wrapping and tier
  estimation now consume the seat rows (`stridedRows`).
- **M3 [FIXED, C.7]** `clearStack` was imported but never called:
  migration overlays leaked per gateway transit and a later ascent could
  pop the previous volume's stack entry (blank ring for 600ms, stale
  clones). Cleared at gateway teardown in bootVolume.
- **M4 [FIXED, C.7]** Detail line table measured `window.inner*` while
  the wheel measures the visual viewport — the DDG-bar class of
  mismatch. Now uses `measureViewport()`.
- **M5 [FIXED (2 of 3), C.7]** solar.js: day-of-year used the JULIAN
  leap rule (1900/2100 off by a day from March) — fixed with the
  Gregorian test; phantom ora legale 1893–1915 — fixed (no DST before
  1966; the irregular 1916–65 era approximated as none, documented).
  CARRIED, documented in the header: the NOAA formula is epoch-centered
  — deep-past dates drift against the seasons (~10 min medieval, ~30+
  at 3000 BC). Upgrade path: full Meeus, if the deep past ever needs
  minutes.
- **M6 [FIXED, C.7]** The 450ms native-click suppressor could swallow a
  legitimate magnifier/parent tap in a fast node-then-control rhythm.
  Controls are now exempt from suppression.

### Low

- **L1 [FIXED, C.7]** Ephemeris fetch losing the race to a settled day
  left a sun-only card stale — onBoot now repaints the settled day when
  the table lands.
- **L2 [FIXED, C.7]** `advanceLeaf` skipped nulls but not placebos —
  latent (no volume combines a placebo tail with `detailTapAdvances`
  today), guarded anyway.
- **L3 [CARRIED — latent]** The magnified-slot arithmetic trusts
  order == index; every current builder satisfies it, the fast path
  validates it, this site doesn't. Watch when any adapter emits
  explicit non-index orders.
- **L4 [CARRIED — D-era]** Bible's module-level `_renderDetail` closure
  survives gateway exit; a late chapter fetch can rewrite the shared
  panel with the old volume's text in a narrow window. Proper fix is an
  adapter teardown hook — natural D work when adapters gain lifecycle.
- **L5 [CARRIED — benign]** Single-item ascent (BIBLIA root) restore
  hole: ring groups stay at opacity 0 until the next render; the only
  node sits under the opaque magnifier today.
- **L6 [CARRIED — punchlist]** First-visit splash can race an async
  detail-sector open (featured verse) — the panel fades in over
  half-drawn line work. First-visit-only, cosmetic.

### Held under attack

Day-grid serial arithmetic (full ±3000-year round-trip, 1582 seam,
BC/AD line — zero failures); verse-chain id contract vs all 1,215
chapter files; placebo flag coverage across bounds/snap/redirect/tap/
pyramid; `arcXAt` Infinity consumers; event-listener leaks across
gateway reboots; recycled ring DOM state; migrate temp-rotation clamps;
flick/double-flick sign chains; ephemeris data shape (all 365 days
well-formed, extractor gates enforce at build).

## 2b. Hygiene sweep (C.7, same pass)

Dead `FLICK_MIN_VELOCITY` deleted (docs-audit L1); stale comments
corrected (docs-audit L4); census guard added to catalog-integrity
(1,032 / 99 / 2 — docs-audit M1 follow-up). Still on PUNCHLIST by
choice: gateway-wipe/densify/day-grid magic-number naming and the
retired ray×spiral knobs in pyramid-tuning-knobs.js (with Phase B L3).

## 3. Docs audit — findings and triage

Method: every FEEL.md constant grepped against its named home; suite
re-run; data recounted from JSON; local and remote tags enumerated; ≥5
claims spot-checked per CHANGELOG entry.

### High

- **H1 [FIXED, C.7]** Nothing since v3.10.2 was "shipped" by
  VERSIONING.md's own definition — v3.11.0/.1/.2 and v3.12.0 had release
  commits but NO git tags (bump-version.sh only echoes the tag command).
  Fixed: four annotated tags created on the verified release commits
  (push with the next PR); VERSIONING.md rule 2 now states the tag is
  part of the ritual, not a suggestion. Residual accepted gap: the v3.7
  patch series and all of v3.8 are also untagged — historical, recorded
  here, not retro-tagged.
- **H2 [FIXED, C.7]** README said the next major line tags `v4.*`;
  VERSIONING.md rule 2 agreed — while VERSIONING's own "What v4 means"
  section rules `v5.*` (ten stale 2025 `v4.*` tags occupy the
  namespace). Both corrected to the v5 ruling.

### Medium

- **M1 [FIXED, C.7]** "1,032 models / 100 manufacturers" was false under
  every reading: 101 manufacturer nodes = 99 real + 2 gateway patrons
  (Gutenberg, Gregorio XIII). README/ROADMAP/CHANGELOG corrected to "99
  (plus two gateway patrons)". Open: catalog-integrity test asserts no
  counts — a census guard would pin this (C.7 hygiene candidate).
- **M2 [FIXED, C.7]** ROADMAP/CHANGELOG claimed "13 of 14" Phase B audit
  debts cleared; the audit ledger and the fixing commit both say 12 of
  14 (L1 → D, L3 → C.7). Corrected.
- **M3 [FIXED, C.7]** DETAIL_SECTOR_LOADS' "what is actually stored"
  block described a schema (tides window object, feast rules,
  solar_before in the station) that the shipped ephemeris file doesn't
  have. Doc trued to the real file shape.
- **M4 [FIXED, C.7]** Same doc claimed sun times have "no data payload";
  the file carries printed alba/tramonto per day (as the acceptance-test
  record, unread at render). Sentence corrected to say exactly that.

### Low

- **L1 [C.7 hygiene]** `FLICK_MIN_VELOCITY` in gesture-tiers.js is a
  dead unledgered duplicate of main.js's `DOUBLE_FLICK_MIN_VELOCITY` —
  delete with the dead-code sweep.
- **L2 [FIXED, C.7]** Two unledgered literals inside usable-areas.js
  itself (bottom clamp `0.02·SSd`, peninsula threshold `0.1·SSd`) —
  added to FEEL.md's CPUA table.
- **L3 [FIXED, C.7]** FEEL.md's `.is-placebo` font row omitted the
  `--iframe-scale` factor — noted in the ledger.
- **L4 [C.7 hygiene]** Stale in-source comments (boot-splash
  `nodeDrawMs` "(unchanged)"; volume-helpers example "3.11.0") — with
  the sweep.

### Held under attack

FEEL.md's entire constants ledger otherwise verified exact (every T,
CPUA_SPEC, WEDGE, star-field, prominence, gesture, wipe, NOW-mark, and
footnote value at its named home; all retired constants confirmed
absent); CHANGELOG 3.11.x–3.12.0 claims spot-checked and held; PUNCHLIST
items confirmed genuinely open; WORKFLOW attestation flow confirmed
real.

## 4. Punchlist disposition at C close

- **Drained during C**: star-field/planetary-cluster item (shipped C.5);
  sync banner URLs (obsoleted by the DNS cutover — both hostnames now
  serve every volume, verified 2026-07-20).
- **Carried, awaiting Howell rulings**: dim-only vs dim+blur during
  rotation (device-gated revival possible); ordinal-sky stride anchors
  (I, X, XX … CL) vs prominence-only; portrait-gate part two (landscape
  boot mis-size — behavioral, may belong to E's viewport work).
- **Mechanical hygiene** (magic-number naming, L3 dead-code sweep):
  scheduled within C.7 after audit triage, so one pass covers both lists.
- **[E] items**: font-size review, label alignment, 152 Vulgate residual
  display — carried to E by design.
