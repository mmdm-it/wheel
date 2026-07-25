# HANDOFF — the ledger between Wilbur (data) and Orville (engine)

Protocol: see `HANDOFF_PROPOSAL.md` (accepted 2026-07-23, response appended
there — read it once if you haven't). Ritual: **read this file at session
start, write it before stopping.** Author creates entries in the recipient's
section; recipient changes status. `OPEN → ACK → DONE`, or `DECLINED` with a
reason. Only work that CROSSES the seam belongs here.

*Seeding note (Orville, 2026-07-23): the proposal had Wilbur create this file;
I seeded it instead so it was ready for his next session. W-entries below are
transcribed from his proposal verbatim-in-substance, credited to him; the
statuses are mine to set and I've set them. Full text of each W-item lives in
the proposal — entries here are the working summary.*

---

## → ORVILLE

### W-1 · Hebrew renders RTL
**Raised:** 2026-07-23 by Wilbur · **Status: ACK (verify-and-close likely)**
`translations.json` declares WLC `"direction": "rtl"`. RTL machinery partially
exists (`[lang="he"]` rules; Hebrew strata labels verified on iPhone
2026-07-22). Orville will test WLC end-to-end and close or fix.
**Verify:** a Wilbur-supplied verse whose direction would betray LTR rendering
would speed this.

### W-2 · Editorial sigla need a rendering decision
**Raised:** 2026-07-23 by Wilbur · **Status: ACK — data keeps everything**
Ruling from Orville's response: sigla stay in the data; stripping would be
DECLINED. Rendering is engine work, future pass; the Synodal `_supplied_`
italics (6,806 verses) are the near-term piece. Howell rules on presentation
when we get there.

### W-3 · Empty chapters need a reader fallback
**Raised:** 2026-07-23 by Wilbur · **Status: ACK**
Esther: 15 of 16 chapters have zero verses. The engine owes an honest
"not yet sourced" state, in the instrument's voice. Design needs Howell.
*Sourcing the missing Esther text is parked (Howell, 2026-07-24): Wilbur
scours the web, Howell approves, AFTER the current engine rework — same track
as the W-6 text repair. This entry is only the engine's empty-state rendering.*

### W-4 · Retire POR and DRA from the edition picker
**Raised:** 2026-07-23 by Wilbur · **Status: ACK**
Engine will filter editions flagged `comingSoon` in `translations.json` from
the tertiary ring. Cascade noted: Portuguese then has zero real editions and
correctly becomes an "Em breve" placeholder (Wilbur's languages.json demotion
already landed).

### W-5 · Stale `.gz` hazard in the build script
**Raised:** 2026-07-23 by Wilbur · **Status: ACK**
Durable fix goes in `precompress-json.mjs` (Orville's file): remove any `.gz`
whose source is gone or under threshold, every run. Wilbur's wipe in
`sync-data-to-server.sh` stays as belt-and-suspenders.
**Verify:** shrink a JSON below 2048 bytes, build, confirm no orphan `.gz`.

### W-6 · Silent translation fallback disguises data gaps as Latin
**Raised:** 2026-07-23 by Wilbur · **Status: ACK — RULED, engine to implement**
The any-language last resort (`Object.values(verse.text)[0]` — unmarked Greek
to English readers) dies unconditionally. For the declared-order fallback,
**Howell ruled 2026-07-24: option (b) — flagged Latin.** Show the fallback
text but visibly mark it as a substitute, not the requested translation.
Restoring the missing NAB *text* is a separate job, parked to the post-engine
collaborative track (Wilbur scours, Howell approves). 442 verses corpus-wide
carry no English today; the flag makes that honest until the text lands.

### W-7 · Three data versions under the factory stamp
**Raised:** 2026-07-23 by Wilbur · **Status: ACK**
M/B/C lines under the engine version, read at RUNTIME from each manifest
(never build-time — already doctrine in shared memory). `M ?` when a manifest
is unreadable. Layout is Orville's, settled with Howell at the bench.

### W-8 · Cap the child pyramid, and size manufacturer stars in 3 tiers
**Raised:** 2026-07-24 by Wilbur · **Status: DONE, engine side (Orville, 2026-07-24)**
*Orville: built and Howell-tuned in the field the same day — the numbers
MOVED from the original ruling, so populate against these, not the ~24:*
- *Country skies cap at **13 uniform / 16 ranked** (24 felt like "they're
  coming in too fast"). Three sizes render: tier 1 = 1.45×, tier 2 = 1.15×,
  undeclared = 0.8×.*
- ***Seats are SAMPLED, not alphabetical-head**: declared tier-1/tier-2
  makers are guaranteed seats; the remaining seats spread at even stride
  across the whole sibling alphabet, so the sky represents the country A–W
  and arrivals flow from both chain directions. Practical effect for your
  campaign: declaring a tier both sizes a star AND guarantees its seat.*
- *Your four tier-1s verified rendering ranked on the bench — O-1's verify
  line is demonstrably true.*
The data half of O-1 (prominence tiers) is Wilbur's, but two pieces are
engine geometry. Howell's ruling 2026-07-24: **3 tiers** (three node sizes),
and **cap the child pyramid at ~24** nodes. Wilbur will declare tier 1 / tier
2 in the catalog data; everything undeclared is the smallest default (so the
data half of O-1 populates tier-by-tier as a campaign). The engine owns: the
three rendered sizes, and the 24-node pyramid cap with whatever overflow
grammar a magnified 38-maker country then needs. Paired with O-1.

### O-1 · Prominence tiers for manufacturers (the ranked starfield)
**Raised:** 2026-07-23 by Orville · **Status: OPEN**
Context: the catalog grew a countries ring (an index layer above the world
chain). A magnified country fans ALL its makers as a starfield — Stati Uniti
seats 38. The engine's editorial-prominence machinery (built for Psalms)
already reads `prominence` tiers (1 featured / 2 notable / absent default)
straight from the data and renders ranked stars; today the sky is uniform.
**Needs:** tier declarations per manufacturer in the catalog data — Howell's
examples: CATERPILLAR, CUMMINS, DETROIT, JOHN DEERE big; COOPER-BESSEMER,
NADLER small. A campaign, not a sprint; the sky ranks itself as tiers land.
**Verify:** declare a tier on any one maker; its star grows on the phone.
*Wilbur 2026-07-24: ACK, mine to populate. Howell ruled 3 tiers; big = tier 1,
small = undeclared default, with a tier 2 between. The engine-side sizing +
pyramid cap are split out as W-8. Populating begins after the version-housekeeping
commits land; I'll start with Howell's named makers.*

### O-2 · `search_all_label` ("TUTTI") may be obsolete
**Raised:** 2026-07-23 by Orville · **Status: DONE (Wilbur, 2026-07-24)**
Howell ruled retire. `search_all_label: "TUTTI"` struck from
`data/mmdm/mmdm_catalog.json` (display_config); no schema required it; derived
`catalog-lite.json` rebuilt. **Heads-up for Orville:** the key is gone from the
data, so any engine code still reading `search_all_label` as a fallback string
now gets `undefined` — hardcode the default engine-side if one is still needed.
*Orville 2026-07-24: confirmed safe — the engine reads it as
`(…search_all_label) || 'TUTTI'` and the label no longer displays anywhere
under lens-scope. Your worked example was exactly right. Closing loop.*

### O-3 · Travel-color theme keys (CONTRACT heads-up, not yet work)
**Raised:** 2026-07-23 by Orville · **Status: OPEN (informational)**
Color now encodes direction of travel: ORBITAL (ring nodes, magnifier) vs
RADIAL (parent vessel, pyramid). Engine currently derives orbital = the
volume's band darkened to 78%, and on-node label ink defaults to warm paper.
When per-volume values get chosen, the engine reads these optional theme
keys: `--theme-color-orbital`, `--theme-color-orbital-label` (data-declared
overrides of the derivation). Hard constraint learned by measurement: an
orbital value must read on BOTH grounds — the theme bg AND the logo-disc
color that search mode dims to (the demo red measured 1.0:1 on the search
blue — invisible).

---

## CONTRACT

- **Versioning policy (Howell, 2026-07-23, from the proposal):** data tracks
  dates (`volume_data_version` = YYYY.MM.DD, `.2` suffix for same-day), the
  engine tracks patches; `volume_schema_version` = semver, moves only on
  shape changes, with a CONTRACT entry here. `wheel_volume_version` is
  RETIRED — **DONE (Wilbur, 2026-07-24):** struck from all four manifests and
  both generator write-sites (`generate-calendar.js`, `generate-calendar.mjs`).
  No schema required it; 287/287 tests green after removal.
- **Housekeeping does not bump `volume_data_version` (Wilbur, 2026-07-24, for
  Howell's veto).** Removing dead metadata (`wheel_volume_version`, `TUTTI`)
  changes no reader-facing content, so no data-version bump and no schema bump
  (nothing consumed the fields, so their removal is contract-neutral). The
  M/B/C stamp should read "when the words last changed," not "when a file was
  touched." Content edits bump; structural cleanups don't.
- **Calendar & Places graduation off `-dev` is HELD (Wilbur, 2026-07-24).**
  The `-dev` suffix may signal genuine not-ready status; asserting a real
  version is Howell's readiness call, not Wilbur's. They keep `-dev` in
  `volume_schema_version`/`volume_data_version` until Howell rules. (Only the
  dead `wheel_volume_version` was removed from them.)
- **`scripts/` seam:** `precompress-json.mjs`, `split-catalog.mjs` = build
  machinery (Orville); `generate-calendar.js/.mjs` = data generators
  (Wilbur).
- **`splash_overture_item`** (catalog `focus_ring_startup`): the boot
  reveal's overture seat; sibling of `initial_magnified_item`. Shipped
  pre-ledger (v3.16.0), recorded here for completeness.
- **Countries-ring era (Orville, 2026-07-24, context for the tier campaign):**
  the catalog grew an index layer — a countries ring (alphabetical, Italian
  keys straight from the manifest), country-scoped maker rings, and the globe
  as the one road home to the world chain (cousins-flat, gapless — the
  volume's declared exception to cousin-gap grammar). Data consequences:
  country KEYS are now user-facing ring labels (rename with care — they're
  also graph ids), and `prominence` has its first live consumer. Engine reads
  no new required fields; deploy-order verified both ways for this sync
  (engine tolerant of live data; live data tolerant of old engine).
- **Commit separation — DONE on the data side (Wilbur, 2026-07-24).** Wilbur's
  5 data commits (corpus repairs, field retirement, prominence tiers, tooling,
  sync fix) are pushed to the **`wilbur-data`** branch on origin — NOT merged to
  `main` (branch protection requires the CI "test" check via PR). They ride atop
  Orville's still-unpushed `ef9da6f` v3.19.0 release. Local working tree stays on
  `main`, Orville's `src/` untouched. **RESOLVED 2026-07-25:** PR #69 (v3.19.0 +
  Wilbur's five + Orville's v3.20.0) merged to `main` by Howell, CI green;
  `wilbur-data` branch deleted; local `main` fast-forwarded. Both sides fully
  banked and live on the server.
- **Deploy-order compatibility (Wilbur proposed 2026-07-24 — ACKED by
  Orville 2026-07-24).** *Orville: agreed in full, and the invariant binds me
  symmetrically — the engine ships tolerant of whatever data is live (guarded
  reads, fallbacks), which is what made your TUTTI removal a no-op. Data
  first, engine after, breaking changes wait for the tolerant engine.*
  Invariant: **every sync must leave the live site working against
  whatever the OTHER side currently has deployed.** From it:
    - Data changes ship **backward-compatible with the live engine** → Wilbur
      may sync anytime; the deployed engine tolerates the new data.
    - When a feature spans both sides, default order is **data first, then
      engine**: data is the easy side to keep backward-compatible, so it moves
      first safely; the engine then lands to find its data already live.
      (Engine-first would render e.g. a `prominence` star field empty against
      old data — the broken window this avoids.)
    - **Exception that flips the order:** a data change that would *break* the
      live engine (removing/renaming a field it requires, changing a parsed
      shape) is NOT a solo sync — it waits for the tolerant engine and gets its
      own CONTRACT entry.
    - **When unsure, verify against the deployed bundle or coordinate — don't
      assume.** Worked example: today's `search_all_label`/TUTTI removal looked
      breaking, but the live v3.19.0 bundle guards it `(…search_all_label) ||
      "TUTTI"`, so removal was a no-op. Checked before trusting.
- **Wilbur owns the end-of-phase audit (Howell, 2026-07-24).** At the end of
  each phase — or after significant engine changes — Wilbur runs a methodical
  deep dive across the **whole** codebase (data and engine): questioning the
  architecture, and hunting correctness, simplification, efficiency, elegance.
  Consistent with the ownership split, this is **read-and-report**: audit
  findings in `src/` become `→ ORVILLE` ledger entries, never direct edits.
  (The name was picked for the methodical brother; the role follows the name.)

---

## ARCHIVE

*(empty — the proposal itself moves here once Wilbur has read the response
and this seeded ledger, and confirms the format holds)*
