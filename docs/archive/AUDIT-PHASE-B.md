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

> **Resolution status (recorded 2026-07-20).** Phase C opened by clearing
> these debts: C.1 (`9e8494b`) fixed H1, H3, H4, M1–M4, M6, M7, L4 and
> most of M5; C.1b (`434c667`) completed H1/M5 (volume-configs split,
> forbidden-literals scan of main.js) and L2 (gateway round-trip tests).
> Still open: **L3** (dead-code sweep — cheap, any passing release) and
> the [D]-tagged **L1** residue (gatewayReturnLabel now comes from volume
> config per ff2be5c; move it fully into gateway data when dimensions
> work reopens the gateway schema). Per-finding tags below.

### High

- **H1 [FIXED, C.1/C.1b]** `volume === 'bible'` branch + ~25 lines of bible logic inside
  shared `bootVolume` (main.js:947) — doctrine violation; and
  forbidden-literals.test.js exempts main.js wholesale, so the guard is blind
  exactly where the gateway machinery lives. Fix: move startup-verse prefetch
  into the bible adapter via a generic `onBoot` hook; narrow the exemption.
- **H2 [FIXED, PR #25]** Calendar gateway was a one-way door: adapter ignored
  `onGatewayReturn`/`gatewayLabel`. Now mirrors the bible pattern (millennium
  ring OUT = gateway return).
- **H3 [FIXED, C.1]** merge-mmdm-manufacturer.mjs scopes
  neither market nor country-bounds when locating the manufacturer key, and
  family names colliding with manufacturer names (Lugger's "Komatsu"/"John
  Deere" families) make a wrong-block splice possible; count-only validation
  passes prose-only merges. Fix: brace-match market→country, bound the key
  search, deep-equal the merged node, assert rest-of-tree unchanged.
- **H4 [FIXED, C.1]** Gateway boot: no `r.ok` check on manifest fetch (404 → cryptic
  SyntaxError); `pushState` fires before boot resolves — failed boot strands
  the URL on the broken volume. Fix: named errors, pushState on success,
  visible error state.

### Medium

- **M1 [FIXED, C.1]** Teardown-before-validation in bootVolume → black-screen failure
  mode on late boot errors.
- **M2 [FIXED, C.1]** sync-to-server.sh: excludes without `--delete-excluded` leave
  stale data on the remote (the gutenberg-bug mechanism, still armed for
  other volume pairings); exclude lists are hand-maintained and not derived
  from the gateway graph; `LOCAL_PATH=$(pwd)` unanchored.
- **M3 [FIXED, C.1]** No validation that `gateway_children[].volume` names a known
  volume (typo = silently dead node); integrity test's gateway checks are
  shape-blind; `gateway_children`+`cylinders` coexistence unguarded.
- **M4 [FIXED, C.1]** Gateway return context is in-memory only — reload inside a
  gateway loses the way back. Persist in history state.
- **M5 [FIXED, C.1/C.1b]** Duplication: two Roman-numeral implementations; `Capitulum`
  formatting in three places; four identical createHandlers blocks in
  volumeConfigs; ~100 lines of bible label/chain logic living in main.js
  (with a `'NAB'` default contradicting the pinned-VUL comment).
- **M6 [FIXED, C.1]** Debug artifacts in shipped paths: `[DIAG]` block (20+ lines per
  boot), `[startup-verse]`/`[arc-layout]` logs, duplicated
  `suppressNativeClickUntil` paste remnant, 65 lines of module-level console
  tuning knobs in child-pyramid-geometry.js (file header claims purity).
- **M7 [FIXED, C.1]** At-least-one pyramid block: honest in intent, but re-implements
  the hunt's rejection predicates in a second dialect (will silently diverge
  when Phase C retunes constraints) and has zero test coverage. Extract
  shared `isValidNodePosition`; add a zero-intersection test case.

### Low

- **L1 [D]** `gatewayLabelFromItemId` bakes the catalog id convention into
  shared code; label belongs in gateway data (`returnLabel`).
- **L2 [FIXED, C.1b]** No test exercises launchGateway/returnThroughGateway round trip.
- **L3 [C]** Dead code: unused DEFAULT_* constants in geometry, unused
  imports/destructures.
- **L4 [FIXED, C.1]** sync script: legacy `both` option; stray root `data/manifest.json`.

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

## 4. Appendix — DNS runbook (mmdm.it) — EXECUTED 2026-07-17

Goal: mmdm.it serves the site directly (no masked frame), Google/Wayback see
real content, cPanel management preserved. All online; no registrar transfer
required; no purchases from GoDaddy; no trip to Italy required.

**Status: done.** Executed in one sitting, zero downtime, mail untouched.
See "As executed" below for where reality diverged from the plan; the
numbered steps are kept as the reference procedure.

The three roles are independent — GoDaddy's marketing blurs them, this plan
pries them apart: REGISTRAR (owns the registration; stays GoDaddy) · DNS
(answers "what IP is mmdm.it?"; edited free inside the existing GoDaddy
account) · HOSTING (the server; stays the $5 Namecheap plan). Namecheap's
inability to REGISTER .it domains is irrelevant here: Namecheap-the-host
serves any domain from any registrar on any TLD as a cPanel addon domain —
it never asks where a name is registered, only that its A record points at
the server.

Why (costs of the mask, all fixed at once by this runbook): query strings
never reach the app (the frame src is hardcoded — ?probe/?volume/?splash all
die); an extra document + frame on every load; mobile browsers ignore a
framed page's viewport meta and render at ~980px scaled down ~0.42×, which
thins fixed-pixel strokes (the splash arc, the fan lines — fonts are
compensated by --iframe-scale, strokes are not); search engines index a
frameset, not content.

1. Lower the mmdm.it DNS TTL (e.g. 600s) a day ahead, if GoDaddy exposes it —
   makes the switch (and any rollback) propagate in minutes.
2. **Namecheap cPanel** → Addon Domains → add `mmdm.it`, document root: the
   directory currently serving `howellgibbens.com/mmdm/` (or a copy).
3. **GoDaddy** → mmdm.it DNS management → delete the masked-forwarding rule →
   set A record(s) (and `www` CNAME) to the Namecheap hosting IP shown in
   cPanel (right column, "Shared IP Address"). This is a free DNS edit, NOT a
   transfer — none of GoDaddy's 7-day/48-hour lockout machinery applies, and
   it is reversible in minutes (re-enable forwarding).
4. Wait for propagation (minutes to hours). Verify `https://mmdm.it` loads
   the wheel directly with the URL bar staying on mmdm.it *and deep links
   work* (masking never allowed them).
5. SSL: cPanel → SSL/TLS Status → run AutoSSL for the new addon domain
   (needs DNS already pointing at the server; free, auto-renewing).
6. Optional, later: 301 `howellgibbens.com/mmdm/` → `mmdm.it` to consolidate
   search equity; add Wayback SavePageNow call to sync-to-server.sh.
7. GoDaddy remains registrar, demoted to a filing cabinet: annual renewal
   only, no services, no fees beyond it.

### As executed (2026-07-17) — divergences and findings

- **Step 1 (TTL pre-lowering) was impossible**: the forwarding service OWNS
  its two A records (15.197.225.128 / 3.33.251.168, AWS accelerator IPs) and
  GoDaddy grays out Edit on them. Skipped; the replacement record was born
  with 600s TTL, so rollback speed was preserved anyway.
- **Step 2 detour — ownership validation**: Namecheap refuses an addon
  domain whose DNS points elsewhere. Fix: its "simpledcver" DNS validation —
  a TXT record `_simpledcver` at GoDaddy carrying a JWT token. (A stale,
  expired token of the same kind was already in the zone — a previous
  attempt, now deleted.) HTTP/HTML validation variants are dead ends while
  masking is live: the frameset answers instead of the validation file.
  Modern cPanel calls the tool **Domains → Create a New Domain** (Addon
  Domains is merged into it); "Registered Domain", uncheck shared document
  root, root = `public_html/mmdm`, accept the suggested bookkeeping
  subdomain. Ignore cPanel's "offline until you point nameservers" banner —
  it assumes whole-DNS moves; an A record serves identically.
- **Step 3 order matters**: deleting the forwarding rule is what unlocks /
  removes the service-owned A records. End state: one `a @` →
  199.188.201.227 (Namecheap shared IP), 600s TTL; forwarding's companion
  `https @` record deleted with it. All Zoho mail records untouched
  throughout, verified by MX query after the swap.
- **Propagation was near-instant**: authoritative and 1.1.1.1 both answered
  with the new IP within a minute of the edit.
- **Step 5 SSL**: this plan's "AutoSSL" is a **Namecheap SSL** cPanel plugin
  on this host (no SSL/TLS Status tool). Adding the addon domain
  auto-triggered a free 1-year StandardSSL; issuance completed in ~20 min
  once DNS pointed home. Note the ~200-day CA cap (post-2026-03 rule): a
  "1-year" product now reissues mid-cycle. The panel's status rows lag
  reality — verify with `openssl s_client`, not the dashboard.
- **Verified end-to-end after cutover**: https + www 200 with real cert,
  `?probe=1` reaches the app (query strings live for the first time),
  `.json.gz` rewrite serving (catalog 167 KB on the wire), telemetry.php
  204, deep links work.
- **Wayback**: SavePageNow returned 520 on every attempt yet captured
  anyway — first real-content snapshot
  `web.archive.org/web/20260718041648/https://mmdm.it/`. Prior archive
  history: 2013, the personal site of Marco Marzano De Marinis, the
  domain's previous MMdM.
- **Still open**: flip the plugin's HTTPS Redirect toggle to On (http
  currently serves directly, no bounce); the optional 301 from
  howellgibbens.com/mmdm/ (step 6) deliberately deferred.

### Annex A — Cloudflare (optional second step, free tier)

Leave GoDaddy as registrar but switch mmdm.it's NAMESERVERS to Cloudflare's
free plan (a nameserver change, not a transfer — no lockouts, reversible).
Gains: a sane DNS panel instead of GoDaddy's, and Cloudflare's edge network —
which matters specifically because the server is in the US and the QR-code
audience is in Fano: with edge caching, an Italian shop's phone pulls most of
the site from a Milan node instead of crossing the Atlantic. Do the A-record
swap (above) first; this layers on any time after.

### Annex B — registrar transfer: DON'T, for now

Earlier drafts said "transfer any time — auth code + email, nothing more."
Overconfident for .it: it is a ccTLD with an EEA residency/presence
requirement for registrants. GoDaddy got a US registrant in under whatever
arrangement it uses; a transfer would re-open that question. Leave the
registration parked at GoDaddy until the Fano shop provides a genuine
Italian presence — at which point an Italian registrar/host (Aruba.it,
Register.it) aligns with the MMdM story anyway, possibly arranged on the
trip. The masking problems are 100% solved by the DNS steps above without
ever touching the registration.

Deadline anchor: before this year's calendar mailing, so every printed QR
lands on the real address. **Met** — executed 2026-07-17.
