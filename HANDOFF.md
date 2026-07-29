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
**Raised:** 2026-07-23 by Wilbur · **Status: DONE (Orville, 2026-07-28)**
Not a verify-and-close — a real gap. The `[lang="he"]` CSS had been in
`base.css` since the D-era, but **nothing ever set that attribute** and the
bridge never read your `"direction": "rtl"`: the rules were unreachable and
Hebrew rendered as though it were Latin. Built the hookup — the bridge
surfaces `editionDirection()`/`editionLang()` FROM THE REGISTRY (never
guessed from the language; a per-edition `lang` may override the map), the
payload carries the script of the text ACTUALLY shown (a Vulgate
substitution correctly reverts to LTR), and the detail container is stamped
`lang`/`dir`. Two follow-on fixes: the substitution notice now exists in
Hebrew (a Hebrew reader was getting the English one — ⚠ engine-authored,
wants a native eye, belongs in the registry per O-7) and carries the
READER'S direction, since the notice's tongue may run opposite to the
verse above it; and RTL wrapped lines are now flush right (they were
left-stranded — the line box shrank to its content, so `text-align:right`
had nothing to act on). **Verified on the hardest case in the corpus:**
Esther 8:9 (the longest verse, the engine's own sizing reference), eight
wrapped lines of pointed Hebrew, flush right within the fence, Moto G.
**Related ruling (Howell 2026-07-28) — testament scope is NOT filtered:**
WLC and LXX are OT-only, BYZ NT-only, and the rings offer them everywhere.
A Hebrew reader in Matthew therefore sees flagged Latin — by design, not
by accident: the mark is honest and self-explaining, and filtering the
shelf per-verse would make it unstable (a language could vanish mid-read
as you cross Malachi into Matthew). Option (a) of two; revisit only with a
bench session for the vanishing rule.

### W-2 · Editorial sigla need a rendering decision
**Raised:** 2026-07-23 by Wilbur · **Status: ACK — data keeps everything**
Ruling from Orville's response: sigla stay in the data; stripping would be
DECLINED. Rendering is engine work, future pass; the Synodal `_supplied_`
italics (6,806 verses) are the near-term piece. Howell rules on presentation
when we get there.

### W-3 · Empty chapters need a reader fallback
**Raised:** 2026-07-23 by Wilbur · **Status: CLOSED (Wilbur, 2026-07-28) —
Esther is sourced; the hole the entry existed for is gone**
*Wilbur 2026-07-28: your ruling was right and it's done. Esther's 15 empty
chapters now hold 258 verses from six PD sources (Clementine, Douay,
Crampon, Synodal 77-book, Septuagint, Leningrad). Chapters 11-16 are the
Greek additions — they carry VUL numbering only, no Masoretic, because no
Hebrew text of them exists. Corpus 31,345 → 31,603 verses; ESTH 17 → 275.
**Your empty-branch check is built** (cargo `test/no-empty-branches.test.js`):
no chapter without verses on disk OR with `verse_count: 0` in the manifest
(the engine builds the verse chain from that count, so a zero would leave
real text invisible), no country without makers, no maker without models —
gateway portals exempt by design, models nested under `families` counted as
leaves. It went green the moment Esther landed, exactly the life cycle you
described. Note also: `add-verse-counts.mjs` had to run — 15 counts written.*
*Original ruling below.*
Howell's ruling, and it's the right one: *"we shouldn't spend too much time
writing code for a problem that can be, must be, and will be fixed
somewhere else."* Sourcing Esther's missing 15 chapters closes this; an
empty-state UI would be a permanent monument to a temporary hole. So: **no
engine work.** The design was fully scoped before the ruling (ring dress
for silent chapters + a spoken state on descent, in the reader's tongue,
because a chapter — unlike a held edition — is part of the WORK and must
keep its seat rather than be unseated). If a real need ever returns, that
scoping is in the 2026-07-28 session log; don't re-derive it.
**The general worry, measured rather than guessed:** "branches with no
leaves" is otherwise hypothetical here — audited the catalog: **0 of 361
cylinder buckets empty**, and only 2 of 101 manufacturers have no models —
*Gregorio XIII* and *Gutenberg*, which are the gateway portals, empty by
design and never dead ends (they launch a volume transit, not a descent).
**What I'd ask of you instead (cheap, and the honest home for it):** add an
empty-branch check to the cargo validation suite (O-4's) — flag any
chapter with `verse_count: 0`, any manufacturer whose cylinders hold no
models, any container with no leaves. Then a hole is caught in DATA CI
where it can be filled, instead of being papered over in the engine.
Esther will light that check up today; that's correct, and it goes dark
when you source the text.

### W-4 · Retire POR and DRA from the edition picker
**Raised:** 2026-07-23 by Wilbur · **Status: DONE (Orville, 2026-07-28)**
Subsumed by the honesty cluster's final ruling (see W-11): the tertiary
seats ONLY servable editions — `comingSoon` and `pendingLicense` alike are
unseated. A language with nothing servable shows its native "coming soon"
placeholder (your Em breve cascade, generalized). DRA no longer carries
`comingSoon` (your Douay import), so English seats it.

### W-5 · Stale `.gz` hazard in the build script
**Raised:** 2026-07-23 by Wilbur · **Status: DONE (Orville, 2026-07-27)**
Durable fix landed in `precompress-json.mjs`: every run removes any `.gz`
whose source is gone or under the 2048-byte floor, then rewrites survivors
from the current source; the build line reports `removed N stale .gz` when
it fires. **Verified by your recipe, both cases:** shrunk a JSON below 2048
→ orphan removed; deleted a source outright → orphan removed. Your wipe in
`sync-data-to-server.sh` stays as belt-and-suspenders.

### W-6 · Silent translation fallback disguises data gaps as Latin
**Raised:** 2026-07-23 by Wilbur · **Status: DONE (Orville, 2026-07-28)**
Every silent fallback is dead — three were found, not one: (a) the
any-language last resort in `getVerseTextFromCache`; (b) a `|| text.NAB`
vestige inside the chain builder's verse baking; (c) `translation = 'NAB'`
as the chain builder's default. The chain is now: the reader's edition,
else the VULGATE — **flagged** (Howell's bench ruling 2026-07-27 from three
sketches: the stood-in verse speaks in ITALIC, with a small upright
right-aligned footer notice IN THE READER'S CHOSEN LANGUAGE — "латинский
текст · перевод недоступен" for a Russian reader; engine notice map is
provisional, registry-per-language rides O-7) — else the honest empty.
**Bonus root-cause (the stale-Latin bug, 2026-07-28):** the boot verse
ring's items bake text at CHAIN-BUILD time and carried no cache
coordinates, so a live language switch repainted build-time Latin,
unflagged. Boot-ring verses now carry `meta.externalFile` like the
continuous chain, and baked text is honored ONLY in its own language.
**Ledger consequence for W-2:** italics now MEAN substitution — the
Synodal supplied-words rendering must find another voice when its pass
comes. The 442 missing-English verses (NAB-era count) render as flagged
Latin until texts land.

### W-7 · Three data versions under the factory stamp
**Raised:** 2026-07-23 by Wilbur · **Status: DONE (Orville, 2026-07-25)**
Built as chain links below the engine stamp: one blank link, then M/B/C
placebo lines. Versions read at RUNTIME per your requirement — fetched
`cache: no-cache` (revalidated against the server every boot; 304 when
unchanged), extracted via each volume's own `extractRoot`, so the stamp
shows the server's truth, never the bundle's memory. `?` when a manifest
doesn't answer — the line never silently vanishes. Letters are declared on
the volume configs (`stampLetter`), M reads the lite manifest (carries
`volume_data_version`, verified). Layout knobs (gap counts) tune at
Howell's bench if the spacing wants adjusting.

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

*(W-9 and W-10 below were first filed the morning of 2026-07-26 and were lost
in a concurrent rewrite of this file — restored same day. If you triaged a
version without them, re-read from here.)*

### W-9 · robots.txt + noindex for /data/
**Raised:** 2026-07-26 by Wilbur · **Status: DONE (Orville, 2026-07-26) — LIVE**
robots.txt (`Disallow: /data/` + sub-paths + `/*/data/`) and `.htaccess`
`X-Robots-Tag: noindex` on `.json`/`.json.gz` shipped and verified on
mmdm.it (robots.txt 200, noindex header present). Deployed via the patched
app sync — see O-5 (the app sync used to ship unfiltered data; fixed).
The site has no robots.txt (404) and no X-Robots-Tag on JSON. Licensing
posture wants crawling of the corpus forbidden by policy, not luck (the app
is client-rendered so scripture never reaches HTML — verified unindexed —
but the JSON is fetchable at predictable URLs). **Needs:** (a) robots.txt at
each deployment root with `Disallow: /data/`; (b) optionally
`Header set X-Robots-Tag "noindex"` for `.json` in .htaccess. Ships via
sync-to-server.sh (root files — your seam). Context: LICENSING.local.md
(untracked, Wilbur's licensing dossier).

### W-10 · The cargo split — data/ leaves the public repo
**Raised:** 2026-07-26 by Wilbur · **Status: DONE (2026-07-26) — data/ off public HEAD**
Closed. Both halves landed: Orville's fixtures + engine-test conversions
(PR #76) and Wilbur's cargo validation CI (green — see O-4). This commit
removes `data/` from the public HEAD: `git rm --cached -r data/` (1346
files untracked, local copies KEPT on disk) + `data/` in `.gitignore`.
`split-catalog`/`precompress` guard against a missing `data/` so the engine
builds standalone. **FIVE** data-reading tests deleted (they validate the
real corpus → cargo): schema-validation, bible-abbreviations, ephemeris,
**plus catalog-integrity + volume-validator (CI caught these — the agent's
inventory missed them)**. **THREE** engine tests that called the adapter's
real `loadManifest()` were converted to the PD fixture via a new optional
path arg on `loadManifest` (catalog-adapter, pyramid-preview,
focus-ring-layout). Verified the reliable way — `node --test` with `data/`
moved aside: **259 green**; corpus-less `npm run build` also succeeds.
**For Wilbur:** confirm cargo CI covers what catalog-integrity (every
container has children; every country ≥1 manufacturer) and volume-validator
(all four manifests validate) asserted — port if not already covered.
**Operational note (Wilbur):** the LOCAL `data/` left on disk is the STALE
pre-split public copy (no Douay, old flags). For local dev and for
`sync-data-to-server.sh` to ship CURRENT data, `data/` should be re-sourced
as a checkout of `wheel-cargo`. Confirm the data sync reads the cargo
checkout, not this stale copy. The licensing letters are now unblocked
(data/ is off the public HEAD).
*Original entry:*
The public repo has hosted third-party copyrighted scripture (NAB/CEI/VAT_ES
in data/gutenberg) since 2025-12-21. Ruling: repo architecture now matches
the Gillette model — **private repo `mmdm-it/wheel-cargo` now holds all of
data/** (LIVE as of 2026-07-26: full data-only history via `git subtree
split`, 53 commits, pushed by Howell; verified private; README + .gitignore
in place; note the cargo repo roots at gutenberg/, mmdm/… with NO data/
prefix). Public repo keeps the engine + a small PD-only fixture set so
tests/CI run. **Your half:** (a) point tests/CI/build at a fixture dataset
(PD text only — e.g. Vulgate sample chapters + a synthetic catalog stub);
(b) after fixtures land, the coordinated commit removing data/ from public
HEAD. **Wilbur's half:** cargo-repo upkeep; sync-data-to-server.sh reads
from the cargo checkout; fixture generation if you want it data-authored.
NOT in scope: history purge of the public repo (Howell ruled deferred; zero
forks). Side benefit: future Zenodo release archives stop carrying cargo.
NOTICE §2 needs the third-party-rights paragraph before licensing letters go
out (the corrected Zenodo records link to NOTICE as their rights statement).

### W-11 · pendingLicense editions — the shelf shows them, the vault holds them
**Raised:** 2026-07-26 by Wilbur · **Status: DONE (Orville, 2026-07-28) — UX
RE-RULED at the bench 2026-07-27:** the seated-but-unselectable draft (and
its licensing notice) is OUT — "it doesn't concern the user, too inside
baseball." Final shape: **the tertiary seats ONLY servable editions**; a
language whose every edition is held (italian, spanish) behaves exactly
like a placeholder tongue — browsable, native "coming soon" in the lens
(O-10 asks you for the missing phrases; "…" until then), display-only, the
reader keeps reading what it had. `setLanguage` commits only servable
defaults; `setTranslation` refuses non-servable keys as belt. English
seats Douay alone. Your original entry below, kept for the record:
Howell's ruling: copyrighted texts must not be SERVED, not merely not shown
(a UI gate in front of already-fetched JSON is a curtain, not a wall). Data
side is DONE: `translations.json` now carries `"pendingLicense": true` on
**NAB, CEI, VAT_ES, POR** and `"comingSoon": true` on DRA (PD, text not yet
sourced) — note these are the first edition-level flags; W-4's filter
previously had nothing to read. New `scripts/deploy-pd-filter.mjs` (Wilbur's,
per the scripts/ function seam) builds a PD-only deploy copy of gutenberg
(strips 90,296 verse-texts, hard-fails the sync if one survives); the sync
script deploys gutenberg ONLY from that staging copy. After next sync the
server carries zero copyrighted verses.
**Your half (the UX):** render `pendingLicense` editions in the tertiary as
visible-but-unselectable, labeled per Howell roughly "This translation not
available pending licensing from the copyright holder." Design consequence:
english/italian/spanish then have NO selectable edition → needs a language-
level pending state in the secondary. Also: with NAB/CEI/VAT_ES text gone
from deployed chapters, W-6's fallback engages for ALL former NAB readers —
flagged-Latin becomes the whole English experience until DRA text lands
(Wilbur's sourcing queue, top priority).

### W-12 · Two findings from the Esther pass, both needing Howell (FYI to you)
**Raised:** 2026-07-28 by Wilbur · **Status: OPEN (Howell's ruling; no engine
work asked of you — recorded here because both touch things you can see)**
1. **78 phantom verse slots.** Baruch (37) and Judith (29) declare verses that
   exist in no edition — Baruch chapter 5 has 44 slots where the Vulgate has
   9. Not missing text: wrong skeleton, from an early import. Removing slots
   re-cuts the continuous verse chain and changes `verse_count`, so it waits
   on a ruling. Pinned in cargo CI at the current count, so a NEW hole still
   fails while the backlog stays visible. **Reader-visible today** as verses
   that render the honest-empty state you built for W-6.
2. **50 stale remote branches carry the copyrighted corpus.** 51 of 53
   branches on the public repo still hold `data/` with NAB/CEI/VAT_ES text at
   their tips; 50 of those are already merged into `main`, so deleting them
   loses no work and removes 50 public copies. Not done unilaterally — that's
   a lot of deletion on shared infrastructure, and some may be yours. Flagging
   for Howell; say if any branch there is still live for you.

### W-13 · The purchase mechanism, and its demonstration on the tertiary
**Raised:** 2026-07-28 by Wilbur · **Status: OPEN (Howell's design; engine work
is yours — flagged now because it partly REVERSES W-11)**
Context: the licensing letters must show publishers not just that we intend to
pay them, but the machinery that would pay them. Howell's ruling 2026-07-28:
a demonstration belongs **in the tertiary stratum**, so a letter can say "open
the app, find your own translation, and see where it would sit."

**The reversal:** W-11's final shape unseats held editions entirely ("too
inside baseball"). For the demonstration, a `pendingLicense` edition needs a
seat again — but a narrow, honest one. Wilbur's recommendation (Howell to
rule): selecting it does NOT offer a live purchase, because we cannot deliver
text we have no rights to and a dead "Buy" button reads as presumption.
Instead the lens says roughly *"This translation is under copyright by
[holder]. We are seeking a licence; when it is agreed it unlocks here"* above
a real payment sheet shown INERT. That demonstrates the whole flow, is true in
every particular, and flatters the rights holder rather than presuming on them.

**The happy architectural fact:** Apple Pay / Google Pay / PayPal One Touch are
OS-level sheets confirmed by biometric. **A purchase needs no keyboard** — the
premise survives intact ([[the-premise]]: a reader, never an editor). Worth
knowing before you design the flow; it is also going in the letters.

**Commercial constraints that shape what you build** (recorded so the engine
doesn't get designed around the wrong model):
- Native iOS/Android would FORCE store IAP at 15-30%; web via Stripe/PayPal is
  ~3%. The website is therefore the intended storefront, not just the shop
  window. Anything you build should not assume a native IAP surface.
- **Per-edition unlock, not subscription** — a subscription would require
  tracking which edition each reader actually used in order to split revenue,
  i.e. usage surveillance inside a reading instrument. One-time unlock per
  edition attributes revenue exactly and records nothing about the reader.
  Please don't add per-edition usage telemetry; the business model is
  deliberately built to not need it.
- Royalty base is **75% of NET receipts** to the publisher (gross less
  processing, store commission, refunds — a closed list). No cash up front;
  Howell earns only after a rights holder does.
Non-code long poles (Howell's, not ours): legal entity, merchant account, EU
VAT via OSS, contracts, reporting. Dossier: LICENSING.local.md.
**Addendum (Wilbur, 2026-07-28 evening) — the strategy moved; read before
building.** Howell's ruling after surveying the field: the primary offer to
bishops' conferences is now the ENGINE (their text + their domain + our
instrument — no rights negotiation in that deal), with cargo licensing kept
only for commercial publishers (DLT, Crossway). Consequences for you:
(1) "sell the instrument" argues for an INSTALLABLE artifact — Howell wants
Android sooner; the affordable form is a TWA wrapper of the existing engine
(Play Store presence, one codebase, doesn't fork you), ground-up native stays
Phase F gated on feel-ceiling evidence; (2) an installed instrument implies
OFFLINE, and offline copies are legally distributions — the PD corpus can
ship offline freely today, but design any offline caching so licensed
editions can be excluded per-edition; (3) B2B deployments are invoiced, not
IAP — no store-commission constraint on the engine-licensing track. W-13's
inert-payment-sheet demo is unchanged; it now demonstrates the CONSUMER
track only.

### W-14 · bibliacatholica.com — the Bible gets its own front door, then a wrapper
**Raised:** 2026-07-28 by Wilbur · **Status: OPEN (Howell's three-step plan;
engine half is yours, sequenced before the letters)**
Howell's plan of record: (1) launch **bibliacatholica.com** serving the Bible
volume as a standalone site — every PD Catholic edition, no marine catalog
dressing, no Gutenberg easter-egg entry: the reader lands IN the Bible.
(2) Then wrap it as a **TWA for the Play Store**, app name **"Biblia Rota"**
(checked free; package it.mmdm.wheel already reserved to Howell). (3) Then
the letters, pointing at both.
**Your half, step 1:** whatever the bible deployment needs to stand alone at
a root domain with its own identity (front door, branding, entry chain —
Howell rules the design with you at the bench). The .com/.org/.net DNS and
hosting are Howell+Wilbur's.
**Your half, step 2:** TWA packaging (manifest, icons, asset-links) and — the
differentiator — a **service worker for full offline**: Oremus, the biggest
Catholic app on Play, is clunky and single-translation; a fully-offline
seven-edition reader beats it structurally. Offline is LEGAL today because
the deployed corpus is 100% PD (offline copies are distributions — fine for
PD, and cache design should be able to exclude licensed editions later,
per W-13 addendum).
Not yours: the corpus completeness (Wilbur: Wujek next, rights pending),
colophon data (Wilbur), letters (Wilbur+Howell).


### W-15 · Substitution notices move to the registry (closes O-7's notice half)
**Raised:** 2026-07-28 by Wilbur · **Status: DONE (Orville, 2026-07-29)**
`substitutionNotice()` reads `languageEntry(id)?.substitutionNotice` first
and keeps the engine map only as a belt — a newly imported language now
arrives already speaking. Verified German, Finnish, Dutch. **I applied the
same cure a third time, pre-emptively:** the reading VOCABULARY (the words
for "chapter" and "verse", the era marks) was another engine-hardcoded list
of nine tongues, so German read "Chapter 3" under a German shelf. The engine
now reads `vocabulary` from the registry first — see O-11 for the data.
Howell found it in the field: reading GERMAN, a stood-in verse showed its
footer in ENGLISH. Cause is structural, not a typo — `SUBSTITUTION_NOTICES`
in `dimension-bridge.js` is an engine-hardcoded map of 8 languages, and I had
just added a 9th. **Every language I import from now on silently regresses to
the English notice until you patch your map** — and Hungarian, Romanian,
Czech, Dutch, Armenian, Korean and Japanese are queued behind German.
**DONE on my side:** `languages.json` now carries **`substitutionNotice`** per
language — the 8 already in your map (copied verbatim, so no wording changes)
plus german: `lateinischer Text · Übersetzung nicht verfügbar`. Registry
`_description` documents the field.
**Your half:** have `substitutionNotice()` read `languageEntry(id)?.substitutionNotice`
first and fall back to the hardcoded map (belt), so a new language arrives
already speaking. This is the notice half of O-7, now unblocked.
**Note on quality:** those 8 strings are engine-authored and mine is too —
German is sound, but the Hebrew and Greek still want a native eye before they
travel far, exactly as you flagged.

### W-16 · Book and testament names freeze at their boot language
**Raised:** 2026-07-29 by Wilbur · **Status: DONE (Orville, 2026-07-29)**
Your diagnosis was exact, and there was a second freeze beneath it: the label
formatter had hoisted its own lookup table OUTSIDE its returned closure, so
even a live table could not have reached it. **The cure is deliberately not a
rebuild.** `namesMap` now keeps a stable IDENTITY and has its CONTENTS
replaced on a language change, so every consumer that reads it at call time —
the parent button, the testaments builder, the pyramid's chapters,
getBibleChapters — follows for free. The chain is never rebuilt and the
reader keeps their exact place; only the words change. The locale rides along
with the names, so the vocabulary AND the numerals travel too (`Capitulum
III` → `Κεφάλαιον γʹ` → `פֶּּרֶק ג`). Regression guards added — this bug class
has now bitten three times, so the tests build the formatter BEFORE the
switch, exactly as boot does.
**One thing your ten languages exposed the moment names started moving:** the
child pyramid's label law vetoes a star whose name would collide with its
neighbours', and Finnish's 30-character titles ("Evankeliumi Johanneksen
mukaan") emptied the book sky to a single node. Two interim fixes shipped —
languages without their own short forms borrow the LATIN abbreviations, and a
tier-1 favorite keeps its full name only when it fits (≤18 chars, since the
favorites rule was crowding out the books it meant to introduce). Both retire
when O-12's data lands.
Reported by Howell: switching language on the secondary stratum repaints the
verse TEXT but leaves the book and testament names in the boot language.

**Not a data gap — the data is complete.** All ten servable languages carry
full `names` blocks in `translations.json`: 2 testaments, 8 sections, 67 books
each. German `Offenbarung des Johannes`, Finnish `Ensimmäinen Mooseksen
kirja`, Hungarian `Mózes I. könyve. Genezis`, Dutch `Apokalyps`. Verified.

**The engine builds `namesMap` once at boot and never rebuilds it** —
`src/main.js` ~1761-1774 derives it from the boot-time language, then passes
it by value into `config.buildChain`, `config.createHandlers` and
`makeLabelFormatter`, each of which captures it. Your own comment there names
the deferral: *"boot-time derivations (namesMap, labels) still use the boot
value — swapping those live is D.6's work, not D.2's."* Verse text survives
the switch because it is fetched per-render; names do not because they were
baked at construction.

**Needs:** namesMap rederived when `dimensionBridge` reports a language
change, and the chain/handlers/labels refreshed from it. How deep that repaint
goes is yours to judge — the parent button, the magnifier and the pyramid all
read names.
**Verify:** boot in Latin, switch to German at a book ring, confirm
`Offenbarung des Johannes` replaces `Apocalypsis` without a reload.
**Note:** this now blocks a visible payoff. Eight languages are on the shelf
and three more are queued, so the names campaign (O-7) has real content behind
it — but a reader cannot see any of it until the switch repaints.

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

### O-4 · W-10 cargo split — the data-validation tests move to cargo CI
**Raised:** 2026-07-26 by Orville · **Status: DONE (Wilbur, 2026-07-26)**
Wilbur built `wheel-cargo`'s validation CI (`.github/workflows/ci.yml`) —
ported schema-validation, bible-abbreviations, ephemeris + the `schemas/`,
and added `bible-corpus-invariants` + `calendar-invariants` for the
real-scale checks I relaxed. Both cargo-ci runs GREEN. That green was the
gate on W-10's removal commit, now done.
The public engine tests are DONE on my side: the nine tests that read real
`data/` for ENGINE logic now read a small synthetic PD fixture set under
`test/fixtures/data/` (calendar, gutenberg [5 books / 80 ch / 149 verses,
Vulgate + Douay-Rheims only — zero copyrighted text], mmdm two-maker stub,
places). Full suite 290 green with `data/` still present. Where a test
asserted a REAL-CORPUS fact, I relaxed it to fixture scale and left the
real-scale check for you — those checks must live in the **cargo repo's own
CI** (they validate the real data, which is leaving this repo):
- **schema-validation.test.js** → cargo. Validates the four real manifests
  against `schemas/` (which should MOVE to cargo with it). Pure data, no
  engine import — ports cleanly.
- **bible-abbreviations.test.js** → cargo. `translations.json` `names.latin`:
  `book_abbreviations` key-set ≡ `books` key-set; GENE→GN, NUME→NM,
  II_COR→2 COR. Pure data — ports cleanly.
- **ephemeris.test.js** → cargo, BUT it imports the engine's `localSunTimes`
  (and `catalogDetailFor`) to check the real ephemeris against the sun model.
  Cargo CI will need the engine available — either a dev-dependency on the
  public repo/package, or vendor the sun formula. Your call on mechanism.
- **New pure-data checks to add in cargo** (the invariants I relaxed on the
  fixtures): calendar = 6000 years, no year zero, spans −3000..3000, current
  year present, Gregorian seam (no 1582-10-05..14); months chain = 6000×12;
  bible = 67 books / 1215 chapters / 31,345 verses, GENE first / APOC last.
**Coordinated final step (do NOT do solo, either side):** once these live in
cargo CI, one commit removes `data/` from the public HEAD (git rm --cached +
`.gitignore data/`; the local files stay, sourced from a cargo checkout) AND
deletes the three tests above from the public suite. That commit is the
actual W-10 close — it waits on your cargo CI being green and on Howell.
The fixtures + test conversions ship first as their own PR (engine-only,
safe against live data).

### O-5 · App-sync data leak — found and closed (W-11 hardening)
**Raised:** 2026-07-26 by Orville · **Status: DONE (Orville, 2026-07-26)**
Heads-up, since this touches your PD-filter guarantee. The **app** sync
`sync-to-server.sh` shipped the LOCAL (unfiltered) `data/` — gutenberg
included — with `--delete-excluded`. W-11's filter lives only in
`sync-data-to-server.sh`, so running the app sync would have **overwritten
the filtered corpus on the server with copyrighted text** — a total end-run
around W-11. **Fixed:** the app sync now excludes ALL of `data/` and
protects it from deletion; data reaches the server ONLY through your filtered
`sync-data-to-server.sh`. Verified live: deployed W-9's robots.txt + noindex
through the patched sync and re-checked mmdm.it — filtered gutenberg stayed
filtered (no NAB), robots.txt 200, `X-Robots-Tag: noindex` present.
**Full script audit (Howell asked):** only two scripts push to the server
(this one, now safe; yours, filtered). Orville's build writes into `data/`
only gitignored derived artifacts (`split-catalog` → catalog-lite/prose;
`precompress` → `.gz`) — non-shipping. **Residual for your awareness:**
`precompress-json.mjs` still gz's the unfiltered gutenberg chapters locally
(harmless — never shipped — but the local `.gz` are copyrighted; no future
ship-path may grab `data/*.gz` raw). None of your data-authoring tools are
invoked by any Orville build/test/deploy path.

### O-6 · Native-script abbreviations for translations (`nativeAbbrev`)
**Raised:** 2026-07-26 by Orville · **Status: OPEN (Wilbur's data half)**
Howell 2026-07-26: on the tertiary stratum a foreign edition's UNSELECTED
node must show its abbreviation in its OWN script, not the Latin key — Greek
editions read `LXX`/`BYZ` today; they should read a Greek abbreviation, just
as the magnified node already shows the Greek `nativeName`. **Engine is
DONE:** `dimension-bridge.translationAbbrev(key)` now returns
`translations[key].nativeAbbrev || key` (falls back to the key, so no
regression before the field exists). **Your half:** add a `nativeAbbrev`
field to each translation in `translations.json` (cargo) — the native-script
abbreviation is an editorial/scholarly choice (e.g. Greek LXX → `Οʹ`?
Byzantine → `Βυζ.`?; Hebrew WLC → ?), so it's yours + Howell's to set, not
mine to invent. Latin/English editions can keep their existing keys (VUL,
DRA) or gain a native form as you see fit. The magnified node already reads
`nativeName`; this makes the unselected nodes match.

### O-7 · The names campaign — testaments, books, and the title in every tongue
**Raised:** 2026-07-27 by Orville · **Status: OPEN (Wilbur's data half; engine half SHIPPED)**
Howell's feature ruling 2026-07-27: the dimension globe now shows at the
Bible's FRONT DOOR (gateway entry: MMdM CATALOGO in the parent, BIBLIA SACRA
LATINA magnified, testaments in the pyramid) as well as at a leaf — the two
moments where language is a live question — and hides while drilling
between them. Engine half is DONE (adapter hook `showsDimensionAt`; host
stays volume-agnostic). **Your half:** a reader who switches language at the
door must see the WHOLE shelf speak that language — so the campaign is:
- **testament names**, **book names** (+ abbreviations where the pyramid
  wants them), and **the volume title itself** (what stands in for "BIBLIA
  SACRA LATINA") — in **every language of the registry**, Hebrew to Bahasa
  Indonesia.
- **Howell ruled: NO Latin fallback** — this differs from W-6's flagged-
  Latin doctrine for verse TEXT; navigation names must be fully covered per
  language, not substituted. Practical order: start with the edition-
  bearing languages (Hebrew, Greek, Latin, English, Russian), then the
  pendingLicense tongues, then the placeholder registry.
- Schema is yours to design (the engine's namesMap/localized-name hooks
  exist from the early era; `translations.json` carries `names.latin`
  today). A new-shape proposal gets a CONTRACT entry and I adapt the
  engine's readers to it. Ties into O-6 (nativeAbbrev) — one campaign
  could populate both.

### O-10 · comingSoonText for every language that can stand shelf-less
**Raised:** 2026-07-27 by Orville · **Status: DONE (Wilbur, 2026-07-28)**
Added to all EIGHT edition-bearing languages, not just the two shelf-less
ones — any of them could join italian and spanish if its editions are ever
all held, and you asked for exactly that. Hebrew בקרוב · Greek Σύντομα ·
Latin Mox · English "Coming soon" · Italian Prossimamente · French Bientôt ·
Spanish Próximamente · Russian Скоро. (Portuguese already had "Em breve".)
Ships with the 2026.07.28 data sync; the "…" placeholder should stop
appearing for italian/spanish the moment it lands.
*Original entry:*
Howell's final W-11 ruling: the tertiary shows ONLY servable editions —
no pendingLicense seats, no notices ("too inside baseball") — and a
language with nothing servable shows its native "coming soon", exactly
like the placeholder tongues. Consequence: **italian and spanish** (all
editions held for licensing) now stand shelf-less, and neither carries
`comingSoonText` in languages.json (they had editions when the registry
was populated; english/russian/french are servable and fine, portuguese
already has "Em breve"). The engine shows "…" until the data lands —
please add native phrases for italian and spanish, and for any language
that could join them if its editions are ever all held.

### O-8 · Catalog sort-field audit — the data behind the coming sort stratum
**Raised:** 2026-07-27 by Orville · **Status: OPEN (no rush — gates a future
engine feature, not current work)**
Howell's ruling 2026-07-27 (the strata-everywhere program, see
docs/ROADMAP.md): the catalog will grow a SECONDARY STRATUM choosing the
ring's ordering — horsepower, displacement, year of introduction… — and
the strike wheel later becomes "jump-to-value in the chosen ordering."
A sort ring can only offer a criterion the data actually carries. **Your
half, before the engine work starts:** audit model-level field coverage in
the catalog — which of `year_introduced` / horsepower / displacement /
(any other orderable spec in `data`) exist, on what fraction of the 1,000+
models, and under what key names/units. Report coverage per candidate
field; Howell picks the launch criteria from what's real. Sparse fields
raise a design question (where do unknown-value models sit in a sorted
ring?) — flag the counts, Howell rules.

### O-9 · Calendar voice — month and weekday names per language
**Raised:** 2026-07-27 by Orville · **Status: OPEN (small; sequenced after
O-6/O-7)**
Same program: the calendar becomes the second dimensions consumer — a
language stratum for its month/weekday names (the engine's weekday/month
readers already flow through one source each). Data ask is tiny: 12 month
names + 7 weekday names per language, reusing O-7's language registry.
No ruling yet on which languages; likely the same edition-bearing set
first. Engine half rides the strata-everywhere program in the roadmap.

---

## CONTRACT

- **Single-owner rule (Howell, 2026-07-26):** only ONE session open at a
  time; Howell closes a session before switching tabs. Adopted after
  simultaneous sessions caused a concurrent HANDOFF.md rewrite that silently
  dropped W-9/W-10 (restored same day) and left Orville holding on an
  ambiguous tree. The ledger's write protocol handles sequential handoffs,
  not simultaneous editors.

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

### O-11 · The reading vocabulary belongs in the registry
**Raised:** 2026-07-29 by Orville · **Status: OPEN**
The third instance of W-15's disease, found while fixing W-16. The words a
reader sees around a citation — "chapter", "verse", and the era marks — live
in an engine table (`VOCAB` in volume-configs) covering nine languages. Every
tongue you import beyond them falls to ENGLISH: German currently reads
"Chapter 3" under a fully German shelf.
**DONE on my side:** the formatter reads `vocabulary` from the language
registry first and keeps the engine table only as a belt, exactly as
`substitutionNotice` now works.
**Your half:** add `vocabulary` per language in `languages.json` —
`{ chapter, verse, bc, ad }`. German `{ "chapter": "Kapitel", "verse": "Vers",
"bc": "v. Chr.", "ad": "n. Chr." }`. The nine already in my table are Latin,
Greek, Hebrew, French, Spanish, English, Italian, Portuguese, Russian —
copy them verbatim if you like, they are engine-authored and want the same
native eye you gave the notices.
**Related and worth a thought when you get there:** `numerals` per language
would finish the job — the engine currently *decides* that Latin gets Roman,
Greek gets Greek and Hebrew gets Hebrew numerals with an `if` in the
formatter. The converters are algorithms and belong to me; the CHOICE is
yours. Howell's ruling 2026-07-28 is the standard: the engine holds no human
language at all.

### O-12 · Book abbreviations per language — the sky needs them
**Raised:** 2026-07-29 by Orville · **Status: OPEN — now blocking, not polish**
Only Latin carries `book_abbreviations` (67); every other tongue has zero.
This stopped being cosmetic the moment your names started moving: the child
pyramid seats stars under a LABEL LAW that vetoes a candidate whose name
would collide with its neighbour's, so Finnish's titles — "Evankeliumi
Johanneksen mukaan", 30 characters — emptied the entire book sky to a single
node. Howell saw it on the phone within a minute of the names working.
**Interim shipped, so nothing is broken today:** a language without its own
short forms borrows the LATIN abbreviations (wayfinding, not scripture — the
ring and magnifier still show the reader's full localized name), and a tier-1
favorite keeps its full name only when it fits (≤18 chars). A Finnish sky is
therefore a mix of *Psalmit* and *GN, EX, MT* — honest, but visibly interim.
**Your half:** `book_abbreviations` for each language, 67 keys, keyed by book
id exactly as Latin's are. These are compilation, not invention — standard
scholarly forms exist for every one of these tongues (Finnish `1. Moos.`,
German `1. Mose`, Hungarian `1Móz`, Dutch `Gen.`). Twelve languages × 67 is
real work; it need not arrive all at once, and each language lights up the
moment it lands.
**Verify:** add Finnish's 67, boot Finnish, magnify a testament — the sky
fills with Finnish short forms instead of borrowed Latin.

### O-13 · Versification — the numbering keeps faith with the edition
**Raised:** 2026-07-29 by Orville · **Status: OPEN (Howell ruled 2026-07-29)**
**The ruling, which is a genuinely new feature and not a fix:** when a reader
switches edition, the address must change with it. A Hebrew reader standing
at Vulgate Malachi 4:1 should see the receded primary rotate to **verse 19**
and its parent button become **MALACHI III** — because that is where those
words live in the Masoretic reckoning. Howell: *"we put the dimension mode
feature to its fullest use yet, visualizing versification."*
**Why it is not a fourth stratum, and why the wheel must genuinely turn:**
versification is not a choice — it is a property of the edition already
chosen, so it applies automatically. And it moves more than labels: Hebrew
Malachi has no chapter 4, so those verses join chapter 3, which means chapter
MEMBERSHIP changes and the chain's cousin GAPS move with it. Merely
relabelling would leave a chapter-boundary gap between canonical 3:18 and 4:1
that does not exist in Hebrew — a lie told in the instrument's own grammar.
So the chapter re-forms (a 24-verse Hebrew Malachi 3) and the reader's verse
necessarily lands at seat 19 of 24 instead of 1 of 6. The rotation is the
truth moving, not decoration.
**Storage does not change:** canonical Vulgate-normalized ids stay the single
address space for text, search and navigation. Reckoning is a DISPLAY and
GROUPING layer over it, driven entirely by data — the engine will hold no
offsets, exactly as it now holds no language.
**Your half, two pieces:**
1. **Restore the Hebrew of Malachi 4.** Those six verses (MT 3:19–24) are
   absent from the corpus entirely — not misfiled in chapter 3, not present
   unlabelled in chapter 4; dropped at import, the same shape as W-12's
   phantom slots. Seat them in the canonical Malachi 4:1–6 slots (and the
   Greek too, which is likewise missing). Until then a Hebrew reader there
   sees flagged Latin, which is exactly what the feature must not show.
2. **The mapping tables** — canonical↔MT and canonical↔LXX, verse-granular,
   keyed off the `versification` field each edition already declares. The
   Psalter is the deep water (the ±1 offset from Ps 9 onward, superscriptions
   counted as verse 1 in Hebrew, and four merge seams where Vulgate 9 = MT
   9+10, 113 = 114+115, and 116 and 147 merge the other way).
**Build order agreed with Howell: Malachi first, as the proof** — one book,
a pure six-verse offset, no boundary ambiguity — before the Psalms.
**Then mine:** reckoning-aware chapter membership, gaps and labels from your
tables, plus the animated re-seat that lands the reader on the same canonical
verse at its new address. A bench session with Howell will settle how a
chapters ring labels the four Psalter seams.

### O-14 · Breadth or depth? — the sequencing question before the next import
**Raised:** 2026-07-29 by Orville · **Status: OPEN — Howell's call, recorded
here so it isn't decided by default**
You ended your last session ready to import Romanian, or to hold. That
decision changed this morning, so here is the tradeoff in one place.

**A complete language now needs FOUR data pieces, and imports currently
supply two:**

| piece | status |
|---|---|
| `names` — testaments, sections, 67 books | ✅ you already author these |
| `substitutionNotice` | ✅ you already author these |
| `vocabulary` — chapter/verse/era words (O-11) | ❌ new |
| `book_abbreviations` — 67 short forms (O-12) | ❌ new |

**DEPTH (keep importing):** the shelf grows, which is the visible win, and
nothing is broken — an incomplete language falls back gracefully now (English
vocabulary, borrowed Latin abbreviations). But each import adds to a backlog
that is already the largest item on your board, and every language then needs
three separate visits instead of one.

**BREADTH (backfill first):** bring the ten existing tongues to complete, then
resume importing with a four-piece recipe so each new language lands finished
in a single pass. Slower to show new flags on the shelf; cheaper per language
forever after.

*Orville's lean is BREADTH — mostly because O-12 is the one that visibly
degrades (a Finnish sky of borrowed Latin abbreviations reads as unfinished
in a way a missing vocabulary word does not). But the counter-argument is
real: more tongues on the shelf is the better story, and the fallbacks hold.*
**Howell rules; neither of us should decide it by momentum.**

---

## ARCHIVE

*(empty — the proposal itself moves here once Wilbur has read the response
and this seeded ledger, and confirms the format holds)*
