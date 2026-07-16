# Phase B Audit — Performance & Elegance

First edition of the end-of-phase audit ritual (2026-07-16). Method: recorded
performance baselines + two fresh-context adversarial reviews (code, prose)
with instructions to refute, not confirm. Findings triaged below; fixed items
marked. Unfixed items carry a phase tag for scheduling.

## 1. Performance baselines (Phase B close)

| Metric | Value | Note |
|---|---|---|
| Catalog size (raw) | 1,248 KB | was ~592 KB at campaign start — doubled |
| Catalog size (gzip) | 170 KB | the number that matters on the wire |
| Catalog parse | ~15 ms | Python reference; browser comparable |
| Perf CI budgets | 5/5 pass | render, manifest phases, item-swap |
| Test suite | 143 tests, all green | incl. new catalog-integrity guard |

Growth headroom remains years deep at current dossier cadence. Re-measure at
each phase close; alarm threshold suggestion: gzip > 400 KB.

## 2. Code audit — findings and triage

### High

- **H1 [C]** `volume === 'bible'` branch + ~25 lines of bible logic inside
  shared `bootVolume` (main.js:947) — doctrine violation; and
  forbidden-literals.test.js exempts main.js wholesale, so the guard is blind
  exactly where the gateway machinery lives. Fix: move startup-verse prefetch
  into the bible adapter via a generic `onBoot` hook; narrow the exemption.
- **H2 [FIXED, PR #25]** Calendar gateway was a one-way door: adapter ignored
  `onGatewayReturn`/`gatewayLabel`. Now mirrors the bible pattern (millennium
  ring OUT = gateway return).
- **H3 [C, before next data batch]** merge-mmdm-manufacturer.mjs scopes
  neither market nor country-bounds when locating the manufacturer key, and
  family names colliding with manufacturer names (Lugger's "Komatsu"/"John
  Deere" families) make a wrong-block splice possible; count-only validation
  passes prose-only merges. Fix: brace-match market→country, bound the key
  search, deep-equal the merged node, assert rest-of-tree unchanged.
- **H4 [C]** Gateway boot: no `r.ok` check on manifest fetch (404 → cryptic
  SyntaxError); `pushState` fires before boot resolves — failed boot strands
  the URL on the broken volume. Fix: named errors, pushState on success,
  visible error state.

### Medium

- **M1 [C]** Teardown-before-validation in bootVolume → black-screen failure
  mode on late boot errors.
- **M2 [C]** sync-to-server.sh: excludes without `--delete-excluded` leave
  stale data on the remote (the gutenberg-bug mechanism, still armed for
  other volume pairings); exclude lists are hand-maintained and not derived
  from the gateway graph; `LOCAL_PATH=$(pwd)` unanchored.
- **M3 [C]** No validation that `gateway_children[].volume` names a known
  volume (typo = silently dead node); integrity test's gateway checks are
  shape-blind; `gateway_children`+`cylinders` coexistence unguarded.
- **M4 [C]** Gateway return context is in-memory only — reload inside a
  gateway loses the way back. Persist in history state.
- **M5 [C/E]** Duplication: two Roman-numeral implementations; `Capitulum`
  formatting in three places; four identical createHandlers blocks in
  volumeConfigs; ~100 lines of bible label/chain logic living in main.js
  (with a `'NAB'` default contradicting the pinned-VUL comment).
- **M6 [C]** Debug artifacts in shipped paths: `[DIAG]` block (20+ lines per
  boot), `[startup-verse]`/`[arc-layout]` logs, duplicated
  `suppressNativeClickUntil` paste remnant, 65 lines of module-level console
  tuning knobs in child-pyramid-geometry.js (file header claims purity).
- **M7 [C]** At-least-one pyramid block: honest in intent, but re-implements
  the hunt's rejection predicates in a second dialect (will silently diverge
  when Phase C retunes constraints) and has zero test coverage. Extract
  shared `isValidNodePosition`; add a zero-intersection test case.

### Low

- **L1 [D]** `gatewayLabelFromItemId` bakes the catalog id convention into
  shared code; label belongs in gateway data (`returnLabel`).
- **L2 [C]** No test exercises launchGateway/returnThroughGateway round trip.
- **L3 [C]** Dead code: unused DEFAULT_* constants in geometry, unused
  imports/destructures.
- **L4 [C]** sync script: legacy `both` option; stray root `data/manifest.json`.

Phase tags: **[C]** = queue at Phase C entry (most are feel/infra-adjacent);
**[D]** = with dimensions work; **[E]** = presentation era.

## 3. Prose & data audit

Structural integrity: **zero** defects — no year inversions or out-of-range
years, no duplicate/missing ids, no sibling sort collisions, no encoding
damage, all (vedi) cross-references resolve, no English leaks in Italian
prose (three candidates were legitimate quotes/terms).

Voice metrics over 1,032 descriptions:

| Signal | Count | Verdict |
|---|---|---|
| "annotato/a con riserva" | 58 (1 in 18) | house convention for hedges — keep |
| self-reference ("questo catalogo/questa enciclopedia") | 56 | deliberate voice trait; watch it |
| "vedi" cross-refs | 80 | the web is healthy |
| em-dashes | 546 (0.5/desc) | tolerable; author's tic |
| avg length: early→late houses | 219→259 chars | +18% drift, acceptable |
| avg length: Volvo Penta | 138 chars | notably terse (volume rebuild) — candidate for enrichment pass someday |

key_notes notation is mixed (hp @ X,XXX dominant at 143/146 uses; 12 bare-rpm
stragglers; PS/kW/cid used contextually). Low priority normalization.

## 4. Appendix — DNS runbook (mmdm.it, when ready)

Goal: mmdm.it serves the site directly (no masked frame), Google/Wayback see
real content, cPanel management preserved. All online; no registrar transfer
required; no trip to Italy required.

1. **Namecheap cPanel** → Addon Domains → add `mmdm.it`, document root: the
   directory currently serving `howellgibbens.com/mmdm/` (or a copy).
2. **GoDaddy** → mmdm.it DNS management → delete the masked-forwarding rule →
   set A record(s) (and `www` CNAME) to the Namecheap hosting IP shown in
   cPanel (right column, "Shared IP Address").
3. Wait for propagation (minutes to hours). Verify `https://mmdm.it` loads
   the wheel directly with the URL bar staying on mmdm.it *and deep links
   work* (masking never allowed them).
4. SSL: cPanel → SSL/TLS Status → run AutoSSL for the new addon domain.
5. Optional, later: 301 `howellgibbens.com/mmdm/` → `mmdm.it` to consolidate
   search equity; add Wayback SavePageNow call to sync-to-server.sh.
6. GoDaddy remains registrar (renewals only). Transfer to a cheaper EU
   registrar any time — auth code + email, nothing more.

Deadline anchor: before this year's calendar mailing, so every printed QR
lands on the real address.
