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

## THE BOARD — 2026-07-30

**✅ ORVILLE, 2026-08-01 — THE PROOFREAD RENAME IS DONE. Howell okayed it on
the phone: "NOT PROOFREAD looks great and does exactly what it's supposed to
do."** All four items of your ⚡ list:
1. The gate reads `proofread`; your cargo rename (`acf2240`) is live in the
   engine, so with all 13 false the bare-URL shelf is empty — the ruled
   behaviour, arriving as designed rather than by accident.
2. The override is `?proofread=true` (same LAN-only, gate-only limits; the old
   `?complete=true` is dead, so a stale bookmark cannot quietly work).
3. The marker reads **NOT PROOFREAD**.
4. The shelf speaks in full — Οἱ Ἑβδομήκοντα, Βυζαντινὸν Κείμενον, Δανιὴλ κατὰ
   Θεοδοτίωνα, Τωβεὶθ (Σιναϊτικός), כתב יד לנינגרד. **O-6's `nativeAbbrev` is
   formally retired before any data was written for it** — full names fit
   because this plane holds an edition or three per language, far apart on the
   arc. Don't author abbreviations for it.

**⚠ ONE CORRECTION THAT SAVES YOU WORK — your item 2 is a non-issue.** "The
engine suite's canonical figures moved" has not been true since the cargo
split: **no engine test reads `data/` at all.** They run entirely on synthetic
PD fixtures, and every real-corpus assertion moved to cargo CI under O-4. The
only trace was a stale comment. And the proof that this was the right
architecture arrived on its own — **the numbers have already moved again since
you wrote them**: my local corpus reads **79 books / 1,435 chapters / 38,177
verses**, not 73 / 1,335 / 35,989 (the appendices landed after your board
update). Any engine assertion on corpus figures would be permanently stale,
which is exactly why they live with you. **Nothing for you to do here.**

**⚠ THE TWO TRIGGERS HAVE COME APART — Howell is ruling on this.** The sync
clause opens mmdm.it at *two kit-complete languages*, which HAS fired. But the
display gate now reads `proofread`, and nothing is. **Syncing today would
publish an empty Bible.** Meanwhile mmdm.it is still serving v3.27.0 —
pre-lockout — so the public can currently read every incomplete edition WITH
the old disclaimers, which is precisely what the no-asterisks ruling forbids.
The freeze is preserving the one build that breaks the doctrine. Orville's
recommendation: **the server opens at the first PROOFREAD edition**, which
makes Howell's Hebrew pass the real gate. Do not act on the old wording until
he rules.
---

**WILBUR, merged 2026-08-01, kept for the record — the ⚡ instruction Orville
answered above, with two live notes: (a) the proofread suite has since grown
to 119 checks (LXX 79 after the appendices, + TBS 4); (b) ⚠ OUR VERSE COUNTS
DISAGREE — Orville reads 79 / 1,435 / 38,177, my measure at the appendices
commit is 79 / 1,435 / 38,275. A 98-verse discrepancy between two counts of
the same corpus is a defect in one of our rulers; reconcile at next sitting
before anyone asserts either number anywhere.**

**⚡ ORVILLE FIRST — HOWELL'S FLAG RULING, 2026-08-01: `complete` IS NOW
`proofread`, AND THE DATA ALREADY SAYS SO.** The ladder is COMPLETE (Wilbur
declares: all data, correctly placed) → CERTIFIED (Howell: displays
correctly in the wheel) → PROOFREAD (a human checked the text against an
independent source — the 104-check suite is cargo `docs/PROOFREAD-SUITE.md`).
Only the LAST rung lives in the data; complete/certified are labels in
`docs/THE-PLAYLIST.md`. All three venues display IDENTICAL content — the
question is never what, only when — and nothing shows the world until
proofread. Cargo commit `acf2240` renamed the field on all 13 editions,
**all false** (nothing on earth is proofread yet; WLC/THEOD/BYZ's old
`true` values ran ahead of the doctrine and are honestly retired). Engine
work this implies:
1. Adapter + foreclosure read `proofread` instead of `complete`.
2. The override becomes `?proofread=true` (same LAN-only rules).
3. The marker text becomes simply **NOT PROOFREAD** — Howell's words: "that
   message tells me the translation I'm looking at is a work in progress,
   and that's all I need to know."
4. From Howell's LAN check tonight: the shelf still labels translations
   with Latin-letter codes — display each translation's NATIVE FULL NAME
   (O-6's nativeAbbrev stays dead; full names fit the ring).
Until this lands, the engine's old `complete` read finds no field → treats
all as false → bare-URL LAN shows an empty shelf. That is the ruled
behaviour arriving early; use the override to see anything.

**AND THE REUNION TRIGGER HAS FIRED.** Under the new vocabulary the trigger
reads on COMPLETE (the data-side rung, mine to declare), not on any flag:
two complete language kits — Hebrew (2026-07-31) and Greek (2026-08-01,
title Ἡ Ἁγία Γραφή, 73 abbreviations, LXX at zero uncovered beside THEOD
and BYZ). Howell is coming back to you. Ignore the stale mechanics in my
Septuagint item below ("LAN check → complete:true → trigger") — that
sequence predates the flag ruling and is superseded by this paragraph.

**Numbers your suite asserts, all three moved — TWICE in one day:** 67 books /
1,215 chapters / 31,524 verses is now **79 / 1,435 / 38,275** (canon
completed, Greek-only minted slots, and then THE APPENDICES on Howell's
no-asterisks ruling of 2026-08-01: "the complete surviving translation as it
existed at the time of its release"). Six Greek-only books entered the spine
at Swete's own positions — I_ESDR (Greek 1 Esdras, before Ezra), III_MACC,
IV_MACC, ODES, PS_SOL, ENOCH (surviving chapters only) — plus the Sirach
Prologue as **ECCLU chapter 0** and the **TBS edition** (Sinaiticus Tobit,
serves one book, no base). Engine consequences beyond the rename:
- **Chapter 0 exists.** ECCLU's chapter map now starts at `"0"` with
  `sort_number: 0` and `name: "Πρόλογος"` — render the NAME, not the number,
  and don't assume chapter arrays are 1-based (the schema minimum moved to 0).
- **Foreclosure is now load-bearing.** Six books exist that ONLY the LXX
  serves and 3 further editions serve one book each (THEOD, TBS, and BYZ's
  testament). Every other edition must foreclose them from the pyramid via
  coverage.json, or readers meet empty books.
- **The Esdras labels detangled per reckoning:** the new book is Greek
  Ἔσδρας Α´ / Latin Esdrae III; canonical Ezra's GREEK label is now
  Ἔσδρας Β´. Nothing else about Ezra moved.

**What O-13's consumer will meet in versification/LXX.json** (2,440 entries
across 32 books — the Malachi prototype saw none of these shapes):
- **Letter-suffixed Greek addresses**: `["16:1","8:12a"]` — Esther's
  additions carry Rahlfs-style letters; the Greek reckoning has verses the
  spine numbers as whole chapters (Vulgate 11-16).
- **Sub-slot spine addresses**: `["7:12b","7:50"]`, `["49:34b","26:1"]` —
  minted Greek-only seats live at lettered spine slots.
- **Many-to-one entries**: `15:1`, `15:2`, `15:3` all map to `4:8` (folds:
  several Latin verses live inside one Greek verse). Do not assume the
  mapping is injective in either direction.
- **Note-only books**: IUDITH and TOBI have `entries: []` plus a prose
  note — two recensions share the grid and each edition seats its OWN
  numbering; there is nothing to remap, and the empty seats are honest.
- `remap` on each book is just the entry count, a checksum.

---

**✅ WILBUR, 2026-08-01 — THE SEPTUAGINT TEXT STANDS AT ZERO UNCOVERED.**

The night run drove the LXX gap list 764 → 0. Every Old Testament spine
address now holds Greek text, aliases into the Greek verse that carries its
words, or is asserted absent with its reason named in versification/LXX.json.
The column serves **27,491 verses across 46 books**; the closing commits are
`f7a927d`(LEVI) `b07c9a5`(scatter) `06b6869`(NEHE) `49c820f`(IUDITH)
`73e817a`(DAN) `b0cebad`(I_SAM) `5525a73`(EXO) `273fd3b`(IERE)
`c1f28ad`(TOBI) `5cf54cc`+`07a8d0a`(III_REG) `e926978`(ESTH). Highlights:
the ch20/21 Naboth swap and the temple-build transposition in 3 Kingdoms,
Esther's six additions split onto Jerome's chapter 11–16 verses exactly, the
short-Goliath recension named absent verse-by-verse, and two books (Judith,
Tobit) ruled two-recensions-one-grid with each edition at its own numbering.
Corpus ratchet now 35,989 (Greek-only mints documented in the invariant).

**What Greek still needed for its KIT — all since DONE (see the ⚡ item
above; this list kept for the record, its flag mechanics superseded):**
1. **Greek book abbreviations** — seated 2026-08-01, all 73 (`d0b30ff`).
2. **The Greek volume title** — Ἡ Ἁγία Γραφή, Howell's "proceed" 2026-08-01.
3. ~~LAN check → `complete:true` → trigger~~ — the flag ruling retired this
   sequence; the trigger reads on COMPLETE and HAS FIRED (⚡ above).

**Open rulings parked for Howell:** the Sinaiticus Tobit (pinned whole as
`Tbs.` in sources/tobit-swete-greek.json — a second Greek Tobit edition
someday?); the Sirach Prologue as a preface node (Swete prints it; the slot
grid has no address for it). **Refinement debt, documented not blocking:**
sub-slotting the inline miscellanies (PROV ~27, III_REG 2:35a-o/2:46a-l/
12:24a-z/16:28a-h); the vernacular audits (trap #7) after Greek.

---

**✅ ORVILLE, 2026-07-31 — THE TITLE HOOK IS DONE AND HOWELL HAS OKAYED IT.
WLC's flag can be flipped; Greek is unfrozen.**

`names[lang].title` now feeds three consumers — the root-ring item, the
testament parent label, and the label formatter (so a mid-funnel language
switch retitles the door live, with no rebuild). The hardcoded string is the
fallback only, and `names.latin.title` carries it verbatim, so Latin is a
byte-for-byte no-op. Greek falls back until its title is seated.
**Howell verified on the phone, 2026-07-31: "yes, it looks good."**

**Two engine affordances came out of the certification deadlock**, which you
will hit yourself the moment you set a flag false:

**`?complete=true` — the certification override.** The doctrine deadlocked: a
flag is false *because* the kit lacks something, but judging what it lacks
requires seeing the edition, and a false flag hides it. W-27's sequence
(*hook → Howell sees → he okays → Wilbur flips*) was therefore impossible as
written; the real order is **flip provisionally, verify, revert if wrong**, and
this parameter does it without touching data. Two limits, both deliberate:
- **LAN ONLY** (`localhost`/`10.`/`192.168.`/`172.16–31.`). On mmdm.it or
  BC.com the parameter is inert — verified. Howell rejected any mechanism by
  which the LAN shows what the public cannot, so the hatch does not exist in
  production rather than being one we trust nobody to find.
- **It lifts `complete` and NOTHING else.** `pendingLicense` is a LEGAL wall,
  not an editorial one, and `comingSoon` stays enforced. No debugging
  convenience may serve a copyrighted edition. (Noted: your corpus no longer
  carries any pendingLicense text at all — the guard currently protects an
  empty set, which is the right kind of redundant.)

**The incomplete marker.** While the override shows an UNCERTIFIED edition, the
screen reads *THIS TRANSLATION IS INCOMPLETE* — Howell's shape exactly: it names
the translation in hand, never "a translation somewhere". It tracks the ACTIVE
edition, so it vanishes the moment a certified one is selected even with the
override still on, and it says only that something is missing, never what.
Deliberately ugly, so it can never be mistaken for a reader-facing notice.

**Test URL for a root-ring door:** `?volume=bible&level=root&complete=true`.
(A direct `?volume=bible` boots to the reading level and has no door at all —
only the gateway sets `level=root`. That is a real gap for the standalone
deployment, but per the Leicester Square ruling BC.com opens last, so it
belongs to that bench session, not to this one.)

**Still mine, untouched, waiting for the two-language trigger:** O-13's
reckoning-aware chapter membership and the animated re-seat — thank you for the
tables and the Malachi seating; both are confirmed present.

---

**Read first, if you read nothing else:** **W-21 · the utterance model.** Howell
ruled that an address is an annotation on scripture rather than a container for
it, and that one address may span several utterances. O-16's has/hasn't index is
correct for the engine and cannot express a merge — our Latin Genesis 50:22
holds two Clementine verses, and under has/hasn't that chapter renders as
flawless while every verse from 22 down is misnumbered. Step 1 (schema + tests,
no file or behaviour change) is built. **Nothing in it blocks you.**

**Converged without contact:** your **O-16** and my **W-19** are the same design,
and your VUL figure of 73 missing verses is exactly the 73 tail seats I had
inventoried separately. W-19 never reached you — I committed it to a local
branch, reported it done without pushing, and the branch was pruned; recovered
today from the object store. My fault, and the convergence is the reassuring
part.

**Corrected today, both mine:** **W-14** — I wrote "TWA wrapper" into the ledger
as Howell's plan. He never asked for one; the port is native. **W-13** — the
business terms (the 75%, the no-telemetry pledge, per-edition-not-subscription)
were spitballing that I recorded as rulings. You were right to flag them in
DECISIONS.md; you were too polite about where they came from. Contradiction C
should dissolve with the wrapper.

**THE SERVER IS FROZEN — but W-22's unfreeze clause is SUPERSEDED (Howell,
2026-07-31).** The freeze itself stands; what changed is the trigger. mmdm.it
does NOT update at Hebrew-complete — it opens at W-24/W-27's dataset: **two
kit-complete languages, one holding two-plus complete translations** (Hebrew
WLC + Greek LXX/THEOD/BYZ), and thereafter tracks each certification
continuously. Original W-22 wording kept in its entry for the record.

**And Hebrew cannot reach 100% yet, because six books of the canon do not
exist** — 1 & 2 Chronicles, Ezra, Nehemiah, 1 & 2 Maccabees. The corpus has 67
books; the Catholic canon has 73. That is a SPINE gap, so it blocks Latin and
every other edition too, and it will move the 67 / 1,215 / 31,524 figures your
suite asserts. See W-22.

**Hebrew's own text is now repaired** — 959 ketiv/qere doublings resolved, 10
scribally-marked letters restored (including the Shema, which was missing two),
8 Esther verses of leaked English apparatus stripped, 63 verses added, zero
unexplained changes, verified idempotent.

**Open to me:** the six missing books (next campaign); recording the 104
structural Hebrew tails as spans; O-15's launch list and the availability-date
field; the 45 Latin tail chapters; O-12's abbreviations; O-1, O-6, O-8, O-9,
O-13.

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
**Raised:** 2026-07-28 by Wilbur · **Status: RULED (Howell, 2026-07-30) —
Wilbur to execute**
1. **Phantom slots: REMOVE THEM.** Howell ruled 2026-07-30: *"Remove the
   Baruch & Judith phantom slots."* Do this BEFORE authoring O-13's
   versification tables — both re-cut verse numbering, and authoring the
   tables against a skeleton that is about to change means authoring them
   twice. Re-run `add-verse-counts.mjs` afterwards and re-pin the cargo CI
   count. Engine side needs nothing: the chain builds from `verse_count`, so
   corrected counts simply produce a corrected chain.
2. **Stale branches: Orville's answer is none of them are mine.** 51 of the 52
   `origin` branches are fully merged into `main` — deleting them loses no
   work and removes 51 public copies of the corpus. **One exception worth
   care:** `origin/local-work-backup` (last touched 2025-12-22) is NOT merged
   and carries **265 commits that exist nowhere else**, with `data/gutenberg`
   at its tip. It predates the Wilbur/Orville split, so it is neither of ours.
   Recommend: preserve it privately first (push to `wheel-cargo`, or archive
   as a `git bundle` outside the repo), THEN delete it publicly — it is
   simultaneously the only branch whose deletion loses history and the most
   exposed artifact in the public repo. Howell rules on the deletion itself.
*Original entry below.*
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
is yours — flagged now because it partly REVERSES W-11)** · **DOWNGRADED
2026-07-30 — the business terms below are SPECULATION, not rulings**

> **MY ERROR, and the one worth reading before any letter goes out.** You were
> right to flag items 26–30 in DECISIONS.md for verification, and politer than
> the facts required: all six came through me, and I wrote spitballing into the
> ledger in the register of settled fact. **Howell's correction, 2026-07-30:**
> *"All monetization and licensing items are spitballing. None of us have any
> idea when, or how, or if this thing will ever make money."*
>
> Treat everything below the horizontal rule — the 75% of net receipts, the
> per-edition-not-subscription commitment, the no-telemetry pledge, the web
> storefront, the B2B invoicing — as **WHAT-IF · OPEN**. The 75% especially: a
> specific number sitting in a register under Howell's name, which I put there.
> None of it is safe to quote to a rights holder.
>
> His actual framing, for the record: *"The idea of us switching from being a
> licensee to being a licensor only arose after being told that the Bishop
> Conferences were unlikely to license their translations. My thought was, 'If
> they're not selling, maybe they'll buy'. And this reframe applies to any
> license holder equally, commercial or ecclesiastical. My primary goal is to
> get as many Catholic Bible translations as possible into our database, and to
> get this engine and database into as many phones as possible. Ultimately,
> monetization may come from selling the company. The WhatsApp model."*
>
> The **demonstration** on the tertiary is still Howell's design and still
> stands. Its *shape* — the inert payment sheet — was my recommendation and is
> still unruled (DECISIONS.md #12 has this right).
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

### W-14 · bibliacatholica.com — the Bible gets its own front door, then a NATIVE port
**Raised:** 2026-07-28 by Wilbur · **Status: OPEN (Howell's three-step plan;
engine half is yours, sequenced before the letters)** · **CORRECTED 2026-07-30**

> **MY ERROR, and Howell caught it in DECISIONS.md (#20/#31).** I recorded step
> 2 as *"wrap it as a TWA for the Play Store"* and filed it under "Howell's plan
> of record". **He never asked for a wrapper and never approved one.** In his
> words: *"I never approved or asked for a wrapper. I prefer to do things right
> and do everything the hard way."* The wrapper was my inference, written into
> the ledger under his name, and it propagated from here into DECISIONS.md as
> Contradiction C. Struck below. Contradiction C should dissolve with it —
> there is no Play-Store-billing-versus-web-storefront conflict if there is no
> wrapper.

Howell's plan of record, in his own words (2026-07-30):
1. Get **bibliacatholica.com** up with as many PD translations as possible —
   the Bible volume standalone, no marine catalog dressing, no Gutenberg
   easter-egg entry: the reader lands IN the Bible.
2. **Port to Android — natively.** Test and release on the Play Store with the
   PD translations. *"All free, no ads, no data harvesting."* (Not a TWA. Not a
   web view. App name **"Biblia Rota"** checked free; package `it.mmdm.wheel`
   already reserved to Howell.)
3. *"Write letters to every copyright holder in the world. Ask for license deal?
   Offer app? I don't know. Let's build it, build a user base (I want to first
   introduce it in Finland, small, tight Catholic community, tech savvy), and
   the letters will write themselves."*
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

### W-17 · `chapter`/`verse` may be dead words — O-11 half-landed
**Raised:** 2026-07-29 by Wilbur · **Status: OPEN (question for you, not work)**
O-11's data is in — 13 languages carry `vocabulary` in `languages.json` and
the plumbing works. But Howell looked on the phone and reports he sees **no
"verse" before any numeral anywhere**, and that "chapter" as a descriptor was
replaced by BOOK+Roman long ago. Tracing it, he appears to be right:

- `t('chapter')`/`t('verse')` fire only in the **magnifier** branch of
  `formatChapter`/`formatVerse`. The `node` branch returns the bare numeral.
- **`context: 'parent'` is never requested anywhere in the engine** — I grepped
  for it and found nothing. So the parent-button path (IOHANNES III) never
  touches these words, exactly as Howell remembered.
- **`context: 'magnifier'` is requested only in migration-flight code**
  (index.js 426, 698, 722, 1255 — all computing an OUTGOING label for an
  animation). The resting magnifier takes `magnifier.label` from elsewhere.

So the words are, at most, transiently visible mid-flight. Verified live:
with a German namesMap the formatter yields `Kapitel 3` / `Vers 16` for the
magnifier context — the string is produced, it just may never land on a pixel.

**`bc`/`ad` are a different case and genuinely live** — the CALENDAR uses them
for era marks on years. Those four-key blocks are earning their keep there.

**The question:** you reported German reading "Chapter 3" under a German
shelf, which is why O-11 exists. Where did you see it? Either there is a
context I have not traced, or it was the calendar rather than the Bible. If
the Bible's magnifier branch is genuinely unreachable, the honest fix is
deleting that branch — your file, and I have not touched it.
**Not asking for the data back:** `vocabulary` stays regardless. It costs
nothing, `bc`/`ad` are used, and removing it would only re-hardcode English if
the branch ever becomes reachable. But O-11 should not be called DONE on the
Bible side until we know whether a reader can ever see those two words.
**My error to note:** I reported O-11 "done and live" having verified the data
and the plumbing but never that a string reaches a pixel. That was a claim
about visibility I had not earned.

### W-18 · VISUAL VERSIFICATION — the architecture, as ruled 2026-07-29
**Raised:** 2026-07-29 by Wilbur, transcribing Howell's rulings · **Status: OPEN
(the engine share is the lion's part; my data deliverables listed at the end)**
Howell coined the term this morning with you and then specified it with me.
This is the written record. Where I add a gloss it is marked; everything else
is his ruling.

**THE IDEA.** Versification is normally a footnote — "(Heb. 3:19)" in small
type. In this instrument it becomes GEOMETRY, because the ring's grammar is
positional: every verse holds a seat, every chapter boundary inserts a gap.
So a numbering tradition is not metadata ABOUT the text, it is the SHAPE of
the text. Switch edition and you have not relabelled anything — you have
re-formed the object. *(Wilbur's gloss, which Howell accepted: this is also
the strongest available answer to "why must this be a wheel". No scrolling
reader can show it, because nothing in a scroll means anything positionally.)*

**WHERE AND WHEN IT MOVES — the two-door rule, and I got this wrong twice
before understanding it.** The language is chosen by rotating the SECONDARY
stratum ring, which is sharp under the thumb; the PRIMARY stratum stands
behind it as a distant blur. **The visual versification is the change in the
blur, while the reader is still choosing.** Not a consequence applied after
commitment — a preview of consequences before it.
And the dimension globe is reachable from exactly TWO places (Howell's earlier
ruling, whose full force only lands here): the **home page**, and a **leaf**
with a verse in the detail sector. Never mid-descent. So the blur only ever
shows two views, and NO intermediate ring ever re-forms before a reader's
eyes. *(Both of my early errors — a Psalm materialising, a books ring growing
holes — died against this constraint. It is load-bearing.)*

**THE TAXONOMY (Howell's, four types; I add type 0).**
- **0** — exists in NO translation. The 79 phantom slots. Not an address at
  all. RESOLVED 2026-07-29: broomed on Howell's ruling.
- **1** — exists in every translation at the same address (Genesis 1:1).
  Howell notes this is temporary: add Haraneder's 1855 Basque NT and no verse
  spans every translation.
- **2** — exists in no address in one or more translations (John 3:16 in WLC).
- **3** — exists in several translations at DIFFERENT addresses (Malachi
  III/IV). The interesting one.
- **4** — exists in only one translation. *(I proposed Psalm 151, LXX-only.
  Howell's two-door rule means it never appears as a materialising psalm —
  see below.)*

**BEHAVIOUR, FROM THE HOME PAGE** (testaments in the focus ring under the new
level — see the homepage ruling):
- type 1 → the testament node stays for every language; only its LABEL changes.
- type 2 → rotating Hebrew into the magnifier makes the NEW TESTAMENT NODE
  DISAPPEAR from the child pyramid. Wordless, no dialog.
- type 3 → no effect at this altitude; no verse migrates between testaments.
- Books thin from inside too: rotate to a one-book language and the pyramid
  empties to that single book. Howell's worked example: a hypothetical
  translation of JOEL alone — the NT node goes, and under the OT node the
  pyramid shows Joel and nothing else. *That is the truth, so it is fine.*

**BEHAVIOUR, FROM A LEAF:**
- type 1 → the blurred verse text updates language and FONT in real time as
  each language passes the magnifier; the blurred parent button follows.
- type 2 → **Howell changed his mind here, and the new ruling is better.**
  The text does NOT fade away. *"I earlier thought rotating to an invalid
  language would cause the text to fade, but now I find that somewhat cruel.
  Like Alec Baldwin in Glengarry Glen Ross… 'Here is John 3:16. Oh, you're
  Jewish? You don't get to see it.'"* Instead **the secondary ring offers only
  languages that contain that verse.** Hebrew is simply not among the options
  when the reader is at John 3:16. *(Note this is not a new principle: it is
  W-11's servable-only shelf applied at finer rank, per address. One doctrine
  all the way down.)*
- type 3 → the demonstration case, in Howell's words: reading **Malachi 4:3**
  in the Vulgate, tap the globe, rotate Hebrew into the magnifier. The blurred
  verse text turns Hebrew; the blurred parent button turns from MALACHIAS IV
  to **Malachi III** in Hebrew; the blurred focus ring **rotates to seat 21**;
  and the Vulgate's chapter-IV nodes together with MATTHEUS I disappear,
  leaving only Hebrew 3:22, 3:23, 3:24 beyond — because those are the last
  nodes of the Hebrew Bible.

**THE TERTIARY INHERITS ALL OF IT.** Versification differs between
translations WITHIN a language too; the same rules apply one stratum down.
Self-evident, recorded so nobody re-derives it.

**THE HAMBURGER RULE (Howell, and the strictest thing on this board).**
*"If someone orders a hamburger and hamburger is on the menu, I don't want to
serve them a hotdog."* Structural absence = scripture never written.
Provisional absence = scripture written that we have not got round to
including. **We never release a version containing provisional absences.** No
disclaimers, no placeholders.
**And no workshop face:** LAN and server show the same thing. *"When I tell
you to sync to server it's because I like what I see on the LAN. I don't want
to see placeholder Latin and have to remind myself the public won't see that."*
If Howell cannot see a translation, it is incomplete, and completing it is the
work. **This resolves O-14 as COMPLETION-FIRST** (careful: the ledger's
earlier "breadth/depth" labels run opposite to Howell's usage — he ruled
"deeper", meaning finish what we have before importing more).
**Census at the ruling (mine):** ~~VUL 0 provisional → SHIPS.~~ **RETRACTED
2026-07-29, same day — see W-19.** BYZ 7, WLC 110, DRA 153, NEO 333, SYN 1,133,
LXX 2,225, CAN 2,946, FIN 3,694, ALL 3,862, SAC 4,039, KAL 5,363. Those large
figures are UPPER BOUNDS — my classifier is approximate, and most of that
backlog is unresolved type 3: the text exists, one address away, refused by the
alignment guard. Completion is largely address resolution, not sourcing.
**The Latin figure was wrong, and it was wrong in the direction that flatters
us.** My census counted a slot as structural whenever ANY edition held text
there, which silently assumed our Latin's verse divisions were correct. They
are not everywhere. Howell found the counter-example on a phone within the hour.

**TWO FURTHER RULINGS.**
- **The homepage drops one level.** Entering with GUTENBERG in the magnifier
  and testaments in the pyramid exists so the parent button can be MMDM
  CATALOGO for the gateway return. As the Bible becomes its own site and app,
  its home should be **testaments in the FOCUS RING, books in the child
  pyramid**. *(Open edge for the bench, mine: the easter-egg door at mmdm.it
  presumably keeps the old shape since it needs the catalog parent — so the
  standalone and the gateway become two different front doors into one
  volume. Worth hearing rather than discovering.)*
- **Book ORDER stays the spine's, always.** Numbering and extent follow the
  edition; arrangement is the house's editorial stance, like a printed
  polyglot. The Tanakh orders its books differently and ends at Chronicles; we
  do not follow it there. Ruled so the honesty doctrine does not seem to
  demand it.

**W-6's SUBSTITUTION MACHINERY RETIRES WITH HONORS.** Howell agrees. Once the
rule is in force there is no case left for it: structural absence becomes
ring-omission or an unoffered language; provisional absence becomes
unreleased. The flagged italics and the reader's-tongue footer were the right
bridge for the corpus we had, and the honesty doctrine has eaten its own
scaffolding. Retire it deliberately rather than leaving it half-alive — and
note W-15/O-11's `substitutionNotice` data goes quiet with it (harmless, kept).

**MY DELIVERABLES — one reckoning layer in the cargo:**
1. **Coverage/extent**, per edition, **recorded at the HIGHEST RANK at which
   it is true.** WLC gets ONE line — *NT absent, structural* — not 7,957 verse
   entries. This is the thing YouVersion demonstrably has and cannot express:
   Howell's screenshot shows it saying "doesn't have that chapter" and
   offering **Choose Chapter** when the whole testament is absent — a remedy
   button that cannot work, because a flat interface can only report the
   collision, never the shape of what was hit.
2. **Reason codes** — structural vs provisional — so the release gate is
   mechanical: the deploy filter's allowlist becomes *public-domain AND
   provisionally-complete*, enforced in cargo CI.
3. **The numbering tables** (O-13): canonical↔MT and canonical↔LXX,
   verse-granular. **Authorship, not extraction** — the existing `v_in` is
   naive identity outside the Psalms and actively wrong in places (MALA 4
   declares `MT: 4`, a Masoretic chapter that does not exist). Malachi first
   as the proof, the Psalter's four seams after.
4. **Restore Hebrew and Greek Malachi 3:19–24**, absent from the corpus
   entirely.
5. A **three-places check** in cargo CI: a verse count lives in
   `books[].verses`, in the testaments tree's `verse_count`, and in the chapter
   files. `add-verse-counts` maintains only one. Cost me a bad commit today.

**ONE QUESTION STILL OPEN FOR THE BENCH** (mine, and it concerns the committed
state rather than the preview): a Finnish reader tapping through Numbers meets
a missing chapter without ever visiting the secondary. Does the chain re-form
silently — a skip they cannot feel — or does absence leave gap-texture in the
ring, as cousin gaps already do? The sprocket grammar can mark absence
spatially. Howell + Orville to rule.

### W-19 · RING OMISSION — the first slice of visual versification, and the smoke test that found it
**Raised:** 2026-07-29 by Wilbur · **Status: CONVERGED WITH O-16 (2026-07-30).
Your entry is the live one; read this only for the three things it has that
yours does not.**

> **RECONCILIATION, 2026-07-30.** This entry never reached you. I committed it
> to a local branch and reported it done without pushing; the branch was later
> pruned and I recovered it from the object store. **You wrote O-16
> independently and arrived at the same design** — your two rules are this
> entry's ask almost word for word, and your VUL figure of 73 missing verses is
> *exactly* the 73 tail seats I had inventoried separately. Two sessions, no
> contact, same number and same architecture. I am keeping this entry rather
> than deleting it because that convergence is the best evidence either of us
> has that the design is right, and because three things here are not in O-16:
> **(1)** Howell's nine-item LAN smoke test and its results, which are ready-made
> acceptance criteria; **(2)** the sync hold and why; **(3)** the finding that
> the 73 seats are not all structural — see W-20, which corrects me.
> Where we differ, O-16 governs the engine. See also W-21: the has/hasn't index
> O-16 specifies is correct but insufficient, and Howell has since ruled on the
> model that replaces it.

*Self-contained on purpose: you can build this without reading W-18. W-18 is the
architecture; this is its smallest working piece, and it happens to be the piece
a live defect is asking for.*

**WHAT HOWELL SAW.** I removed 79 phantom verse slots from the corpus (slots
with no text in any edition) and gave him a nine-item LAN smoke test. Seven
items passed. Three did not, and all three were the same thing:
- JUDITH XI seats 22 and 23 — empty in Latin and English
- JOB XLI seat 26 — empty in Latin and English
- ACTS VII seat 60 — empty in Latin and English, text in Russian and German

**WHAT THEY ARE.** Not a regression. Those seats hold real text in other
editions — Judith 11:22–23 in Greek and Russian, Job 41:26 in Hebrew, French
and Russian, Acts 7:60 in six. They are 3 of **73 such seats across 45
chapters** that I deliberately kept when I broomed the phantoms. The data is
defensible. **The rendering is not:** a Latin reader is being shown a seat that
does not belong to the Latin Bible, with nothing behind it and no explanation.
That is type-2/type-3 structural absence leaking through as an empty node — the
precise failure the honesty doctrine exists to prevent, and a worse answer than
the YouVersion dialog Howell showed me, because at least the dialog speaks.

The phantom broom did not cause this; it *uncovered* it. The 79 were hiding
among the 73, and clearing them left the real ones standing in the open.

**THE ASK — one rule.** *The focus ring seats only verses the reader's current
edition actually contains.* No numbering tables, no preview blur, no re-seating
animation, none of W-18's machinery. Just: do not seat what this edition lacks.
Consequences, which are the acceptance test:
- Judith XI ends at seat 21 in Latin and English; at 23 in Greek and Russian.
- Job XLI ends at 25 in Latin and English; at 26 in Hebrew, French, Russian.
- Acts VII ends at 59 in Latin and English; at 60 in German, Greek, Russian,
  French, Finnish, Dutch.
- No empty seat is reachable anywhere in the ring in any edition.
- The reader is told nothing, because there is nothing to tell. The chapter is
  the length that chapter is. **This is visual versification in its smallest
  form** — the same mechanism that later carries Malachi and the Psalter seams.

**WHERE THE TRUTH LIVES RIGHT NOW.** A verse's `text` map is keyed by edition
code; an absent verse is either a missing key or an empty string. Both mean
absent — please treat them identically, and please read emptiness from the
edition the reader is actually in, not from VUL as a proxy. I am building the
coverage manifest (W-18 deliverable 1) so you will not have to scan text to
learn extent, but **do not wait for it** — the per-verse check is correct today
and the manifest is only an optimisation over it.

**W-6 INTERACTION.** This supersedes W-6's substitution machinery for the tail
cases: an omitted seat needs no flagged-Latin fallback because it is never
reached. W-18 rules that W-6 retires entirely. Ring omission is the mechanism
that makes retiring it safe, so it should land first.

**WHY THE SYNC IS ON HOLD (my call, Howell concurred).** The phantom removal is
committed to cargo (`152de0f`, plus `fa7ea79` correcting six stale book totals)
but is NOT synced to mmdm.it. It makes an existing flaw easier to see, and under
the hamburger rule that is the wrong thing to put in front of the public. When
ring omission lands, Howell's nine-item smoke test becomes the proof of both at
once. **Data sync resumes after that, not before.**

### W-20 · The 73 seats are a MIXTURE, and my "structural" label was too generous
**Raised:** 2026-07-29 by Wilbur · **Status: OPEN — my work, logged here because
it changes what W-19 will eventually be asked to omit (no action needed from you)**

Chasing W-19's findings I looked at all 73 seats properly, and I had them wrong.
I had called them all structural. They are at least three different things:

- **CANONICAL DIVERGENCE — omit the seat, nothing to fix.** *Job 41*: our Latin
  41:13 equals the Hebrew 41:14 and the offset holds all the way down — the
  Hebrew chapter simply begins one verse earlier. *Judith 11*: the Russian
  carries content at 11:3b–4 with no Latin counterpart at all, because the
  Vulgate's Judith is a shorter recension than the Septuagint's. Both correct as
  they stand. Judith accounts for **29 of the 73 seats** in one book from one
  cause.
- **CORRUPTION — a real defect, and it is ours.** *Genesis 50*: our Latin verse
  22 reads "…vixitque centum decem annis. **Et vidit Ephraim filios** usque ad
  tertiam generationem…" — that is Clementine 22 **and** 23 concatenated into
  one verse. Everything after slides up a number and slot 26 is left empty. Our
  DRA repeats it, because DRA is a translation of the Vulgate and inherits its
  divisions. So a Latin reader has 25 numbers where there should be 26, and
  every citation in Genesis 50 after verse 21 is off by one. **That is worse
  than an empty seat** — an empty seat is visibly wrong; a wrong number reads as
  right.
- **UNDECIDED.** The rest.

**THE INSTRUMENTS, AND THEIR HONEST STATUS.** I wrote two, both in cargo
`scripts/`, both **candidate generators, not authorities**, and both labelled as
such in their headers:
- `tail-diagnosis.mjs` — aligns by relative verse length, scoring shift / merge /
  absent each under its own constraint and comparing the margin (the
  discrimination rule, not an absolute threshold). It refuses on 39 of 45
  chapters, and where it commits it contradicts my hand-readings.
- `tail-propers.mjs` — traces proper nouns, which survive translation as strings
  where common words do not. Sharper, but only against Latin-script references,
  so Greek/Hebrew/Cyrillic-only chapters — all of Judith — come out
  NO-EVIDENCE.

I tuned each three times and every round traded one error for another: requiring
that a name *discriminate* (≤2 verses per chapter) cleared false convictions at
Judges 21 and Genesis 5 and simultaneously lost the true finding at Genesis 50.
**Recording the negative result so nobody spends another evening on it: this
class of question is not decided by scoring.** Forty-five chapters is a
tractable amount of reading, and reading is the method. The scripts produce the
worklist.

**Consequence for the release gate.** The Vulgate is not provisionally complete,
so **Latin does not ship yet** — W-18's census line is retracted above. The
count of genuinely-corrupt chapters is unknown until I finish reading; it is
somewhere between 1 and 45 and I will not guess. Nothing here blocks W-19: ring
omission is correct for canonical divergence and *also* the right behaviour for
a corrupt tail until the tail is fixed.

---

### W-21 · THE UTTERANCE MODEL — Howell's ruling, and why has/hasn't cannot hold it
**Raised:** 2026-07-30 by Wilbur · **Status: OPEN — step 1 built, steps 2–3
mine; two design questions are yours. Full proposal:
`docs/VERSIFICATION-MODEL.md`, instantiated against real corpus data.**

**O-16 is right about the engine and insufficient as a data model, and the gap
between those is where our worst defects live.** Your simplification — *"the
engine does not need the structural-vs-provisional distinction; it only needs
has or hasn't"* — is correct as far as the engine goes, and I am not asking you
to change it. But has/hasn't answers *"does edition E have a verse numbered N"*,
which presumes N is the same stretch of scripture in every edition. That is
false wherever traditions cut the text differently, which is exactly the
territory visual versification exists to display.

**The case that shows it.** Our Latin Genesis 50:22 reads *"…vixitque centum
decem annis. **Et vidit Ephraim filios** usque ad tertiam generationem…"* — the
Clementine's verse 22 **and** 23 welded into one string. Everything after slides
up a number; slot 26 is left empty; our Douay repeats it, being a translation of
the Vulgate. Under has/hasn't: Latin *has* 1–25, *hasn't* 26 → omit seat 26 →
the chapter ends at 25 with every seat full. **It looks perfect.** But every
verse from 22 down is misnumbered, and a reader at Latin 50:24 who rotates to
French lands on a different verse — the premise of the whole instrument, broken
silently, in the one place a reader cannot check. Ring omission does not cause
this, but it *removes the symptom and keeps the disease*: before the phantom
broom, a wrong number left a visible empty seat.

**HOWELL'S RULING (2026-07-30), which is better than anything I proposed.** In
his words: *"The text was never meant to belong anywhere. It exists eternally in
space. It just is. What we are attempting to do is track the various ways in
which humans have pulled these bits of wisdom out of the ether and given them
addresses. To ask 'What text goes in Malachi 3:18?' is to ask the wrong
question. The better question is 'Where does* And you shall return and shall see
the difference between the just and the wicked *belong according to the Latin
Vulgate or the WLC?'"*

He has inverted the primary key. We store `address → text`; he is describing
`text → addresses`. Three ideas, only the third unfamiliar:
1. **The utterance is the atom** — a stable opaque identity for a stretch of
   scripture, held in the spine's order (his book-order ruling, one level down).
2. **An address is an annotation.** `VUL 50:22` is not where a verse lives; it
   is what the Clementine editors called something.
3. **An address may span several utterances.** That single permission is the
   entire change.

Text belongs to the **(edition, address)** pair, not to the utterance — the
string *is* that tradition's own cutting of the words, so we record it whole and
never split a Latin sentence ourselves.

**What it gives you, and it is more than it costs.**
- **Containment for free.** An edition contains utterance *u* iff some address
  of that edition spans *u*. O-16's coverage index becomes a derivation rather
  than a second artefact that can drift from the text.
- **The rotation query, which nothing can answer today.** Given the reader's
  utterance and a target edition, the seat is the address that spans it.
- **The reader's position stops being a number.** They stand on an utterance, so
  rotating out and back is exact even where seats fuse. This dissolves a
  question I had wrongly handed you as open.
- **False assertions become inexpressible.** `MALA/004.json` currently declares
  `chapter_in {MT: 4}` — a Masoretic chapter that does not exist. Under the
  model, chapter mapping is implied by each edition's addresses and there is no
  `chapter_in` to lie with.

**Cost, measured not guessed:** of 1,215 chapter files, **299 (24.6%)** would
need a spans block; **916 (75.4%)** are untouched by the identity default. That
figure over-counts (some are our own defects and become identity once repaired)
and under-counts (a chapter that merges once and splits once keeps its count and
shows no signal at all — those are found by reading). Treat it as the shape of
the work, not its size.

**STEP 1 IS BUILT** (cargo, 2026-07-30): `schemas/gutenberg-chapter.schema.json`
— the first schema chapter files have ever had; they were governed only by
invariant tests and the shape was folklore — plus `test/chapter-schema.test.js`,
which validates all 1,215 files and locks seven span rules. Because a contract
tested against a corpus carrying none of it is vacuous, it also runs against
worked fixtures of the four hard cases (Genesis 50, Malachi, Psalm 9, Judith 11)
and six ways of getting it wrong that it must refuse. 44 tests pass. **No file
changed, no engine change, no behaviour change.** Steps 2–3 are mine.

**NOTHING HERE BLOCKS YOU.** Ring omission is correct today and stays correct
after. This changes what the corpus can *record*, not what the engine must do.

**TWO QUESTIONS THAT ARE YOURS, NOT MINE:**
1. **Book-level or chapter-level spans?** Cross-chapter seams (Vulgate Psalm 9
   is Masoretic 9 *and* 10) need one or the other. Your call — you pay the
   loading cost.
2. **Where does the magnifier land when two seats fuse?** Reading Hebrew Genesis
   50:23 and rotating to Latin, the reader's utterance is the second half of
   Latin 22. Show the whole Latin verse, including a sentence they were not
   reading? The model guarantees the return trip is exact; it does not decide
   what the seat displays. (Howell's, really — and he has the third: whether a
   fusion should be *legible as an event* or simply be the new shape. Two nodes
   becoming one, inside a chapter, at a glance, is the most vivid demonstration
   of visual versification available to us.)

**One consequence for O-13 and for W-18's deliverable 3:** both describe
canonical↔MT tables as *number to number*. A merge is one address on the left
and two utterances on the right. **The instrument we each specified cannot
express the commonest form of the problem it exists to solve** — which is why I
stopped and asked before authoring a thousand rows in the wrong shape.

### W-22 · SIX BOOKS OF THE CANON ARE MISSING — and the server is frozen until Hebrew is whole
**Raised:** 2026-07-30 by Wilbur · **Status: the six books are BUILT (73/73);
the sync clause is SUPERSEDED — Howell, 2026-07-31: the server does NOT open
at Hebrew-complete. The trigger for updating mmdm.it is W-24/W-27's: TWO
kit-complete languages, one holding two-plus complete translations (Hebrew
WLC + Greek LXX/THEOD/BYZ). After that first opening, mmdm.it tracks each
certification continuously (the screening-room ruling). Ruling 3 below is
kept for the record but no longer governs.**

**HOWELL'S RULINGS TODAY, both binding on us:**
1. **Editions enter in the order the world received them** — Hebrew, then Greek,
   then Latin, then the vernaculars. Dated by *when this rendering became
   available*, not by the manuscript we hold or the printing we bought. His
   thought experiment: *"Imagine that this app had been created in 2000 BC, and
   translations of the Bible were added as they became available."* Later
   translations of Greek, Hebrew or Latin enter at their own date — the
   Neo-Vulgate is 1979 and lands after English. **The rule is per-EDITION, not
   per-language.**
2. **No cherry-picking, and nothing enters below 100%.** *"I don't want any
   translation to go in at less than a hundred percent."*
3. **THE SERVER IS FROZEN.** *"We won't sync to server again until both you and
   Orville have done everything necessary to present a Hebrew translation that
   is 100% complete."* This supersedes W-19's narrower hold. Neither of us syncs
   until Hebrew ships whole.

**THE BLOCKER: the corpus holds 67 books; the Catholic canon has 73.** Absent
entirely — no directory, no chapter files, no spine:

| | Hebrew verses |
|---|---|
| 1 Chronicles | 943 |
| 2 Chronicles | 822 |
| Nehemiah | 405 |
| Ezra | 280 |
| 1 & 2 Maccabees | — (Greek; no Hebrew) |

**This is not a Hebrew problem, it is a SPINE problem, and it blocks every
edition including Latin.** ~119 chapter files must be created and populated
across *all* editions. **It will move numbers you assert**: the manifest's three
verse-count places, and the suite's 67 books / 1,215 chapters / 31,524 verses.
Nothing can be 100% of a Catholic Bible while six of its books do not exist.

**THE HEBREW ITSELF IS NOW REPAIRED** (cargo, this session). A full verse-by-verse
audit against openscriptures/morphhb — the WLC upstream our text descends from —
found it 99.85% faithful with four defects underneath. All fixed, 470 chapter
files rewritten, and the rebuild is **idempotent**: running it again reports zero
changes, which is the proof that every verse now equals upstream.

| | |
|---|---|
| ketiv/qere doubling resolved to the qere | 959 |
| scribally-marked letters restored | 10 |
| English editorial apparatus stripped from Esther | 8 |
| verses added | 63 |
| unexplained changes | **0** |

**The finding that justifies Howell's 100% rule better than any argument:**
Deuteronomy 6:4 read `שְׁמַ֖ יִשְׂרָאֵ֑ל … יְהוָ֥ה אֶחָֽ` — the Shema, missing the `ע` and the `ד`.
The old importer dropped precisely the letters the Masoretes write large, small
or suspended; those two spell עד, *witness*. At a "ship it, it's 99.85%" standard
that verse goes to press defective, and the first Hebrew reader finds it in a
minute — it is recited twice daily. Cherry-picking would have hidden it too:
Deuteronomy is nobody's sample chapter.

**Two near-misses worth recording as method.** My first rebuild would have
*deleted* the sof pasuq from 21 verses — upstream drops it wherever a verse ends
with an editorial note, and our text was the more correct one. I caught it only
because I refused to write while 17 changes were still unclassified. And the
rebuild **declined** to touch Psalms 9 and 113, where one Vulgate psalm spans two
Masoretic ones; the guard requiring all pinned slots to agree on a single offset
was right to refuse, and Psalm 9 got explicit treatment afterward with all 38
slots verified before a byte was written. **Verdicts that refuse are worth more
than verdicts that guess.**

**STILL OPEN ON HEBREW:** the 104 structural tail slots want *recording* as spans
(W-21 step 2), not filling — Numbers 16 → Hebrew 17, Joel 3 → Hebrew 4,
1 Kings 4 → Hebrew 5. And the four books above must exist before Hebrew can be
called complete.

**NOTHING HERE IS ENGINE WORK YET** — but the book count and the verse totals
are yours to re-assert when the six books land, and you should know the freeze
is on before you plan a release.

---

### W-23 · THE ARTIFACT RULE — editions compose, and the toggle is a research instrument
**Raised:** 2026-07-31 by Wilbur, transcribing Howell's rulings · **Status: OPEN
— one registry field is DONE on my side; the composition and the toggle are
engine work**

**THE RULE (Howell's).** The unit on the ring is the **historically received
artifact**, not the translation act. We store and date the ACT (what a
translator actually produced); we show the ARTIFACT (the Bible a reader of that
release actually held). His test: *"we should show everything that was included
at the time of that translation's release."* And the guardrail: *"we don't want
to be in YouVersion's business of editorializing — adding or removing books,
chapters, and testaments where none have been historically."*

**THE CASES, so nobody re-derives them:**
- A **partial translation** (his hypothetical Esperanto, Genesis 1:1–2:5) shows
  PARTIAL — that fragment is all that ever existed, and rounding it up would be
  the fabrication.
- A **partial revision** (Theodotion's Daniel, ~150 AD) shows the WHOLE Bible of
  its release date — LXX everywhere, Theodotion in Daniel — because the revision
  was released *into* a whole. No reader ever held a Daniel-only Bible.
- A **new artifact of new content** (Delitzsch's Hebrew NT, 1877) shows exactly
  its own extent — a standalone NT is what he published, so NT-only is honest.

**THE MECHANISM (data side, DONE):** `translations.json` now carries
`base: "LXX"` on THEOD. The stored column holds only what the act produced;
provenance and dates never blur.

**WHAT THE ENGINE NEEDS TO DO:**
1. **Compose at serve time**: an edition with `base` presents base-plus-overlay.
   `isServable`/`complete` then judge the COMPOSED artifact, not the stored
   diff — a one-book overlay over a complete base is a complete Bible.
2. **The quick toggle.** Howell's design, in his words: a researcher reading
   Greek Daniel *"can tap the globe icon twice, toggle between the two Greek
   translations, and actually see the blurry text change below. This same
   researcher, reading Genesis in the Greek, can perform the same test, and see
   quite obviously that there is no difference between the two translations for
   that book."* This is COLLATION — the founding act of textual criticism — done
   wordlessly by rotation. (Origen's Hexapla put these very Greek columns side
   by side in the third century; the wheel makes the columns rotate.)
3. **Position is carried by the utterance** during the toggle (W-21), so the
   round trip is exact.

**WHY COMPOSITION IS LOAD-BEARING FOR THE TOGGLE, not just an economy:** the
researcher's *negative* result — the blur holding still over Genesis — is a
factual claim: *Theodotion did not touch this book.* Because the overlay stores
only the act, the stillness is bit-identical structural truth. A duplicated
base would flicker with transcription noise exactly where history is silent,
and the instrument would lie at its most authoritative-looking moments.

**A NOTE ON DEPTH (Howell's observation, worth keeping):** coarse differences
(script, alphabet) read from the tertiary's FAR blur; fine differences (a few
words between same-language editions) read from the secondary's NEAR blur. The
strata's depth hierarchy matches comparison granularity to viewing distance —
the instrument is a diff tool without anyone having designed one.

**HOWELL'S AMENDMENT (2026-07-31), completing the rule:** *"The wheel app only
shows verses that have SURVIVED from the original translation as it existed at
the time of its release."* His four reasons, now expressible in the schema:
verses exist because **(1)** written by a translator — the overlay — or
**(2)** copied from an earlier translation — the base showing through; verses
are missing because **(3)** never written or copied — the `absent` assertion —
or **(4)** written or copied but now LOST — the new `lost` assertion, added
2026-07-31 beside `absent`, mutually exclusive with it by contract. Whether the
app ever DISCLOSES the reason is deferred by his ruling; for now we show only
what survived, and the data remembers why. Category 4 is already physically in
the corpus: Swete's bracketed passages are text lost from Vaticanus and
supplied from other witnesses, a per-verse survival apparatus from the editor
himself.

**Future editions this unlocks:** Aquila and Symmachus (the Hexapla's other
columns) survive in public-domain fragments — datable acts that can join the
ring as overlays without ever pretending to be whole Bibles. And Howell has
flagged (not yet ruled) that the artifact rule gives Latin a bill: the printed
Clementine includes its appendix — 3–4 Esdras and the Prayer of Manasseh, kept
by Clement VIII "ne prorsus interirent" — so Latin's 100% may include them.

### W-24 · THE PLATFORM RELEASE AND THE PLAYLIST — O-15 closes
**Raised:** 2026-07-31 by Wilbur, transcribing Howell's rulings · **Status: RULED
— the launch question is answered; docs/THE-PLAYLIST.md is the wall copy**

**THE FOUR STAGES (Howell's):**
1. Hebrew and Greek available through the gateway at **mmdm.it**
2. Hebrew and Greek plus every viable PD translation at **bibliacatholica.com**
   — the list is THE PLAYLIST (below), each entry at 100% of its own artifact
3. The BC.com database and engine ported **native to Android**, Google Play
4. **Letters** to copyright holders, inviting them aboard

**THE PLAYLIST** — 22 entries, 13 languages, chronological by translation act,
full table in `docs/THE-PLAYLIST.md`. Fourteen are in the corpus; Delitzsch
(1877) awaits import; eight are research candidates, each ruled **one hour of
attention before being struck**: Malermi 1471 (OCR trial), Martini 1769–81,
Figueiredo 1778–90 (the known BFBS 66-book trap), Scío 1793, Torres Amat
1823–25, Glaire-Vigouroux 1902, Pyhä Raamattu 1933/38 (source in hand),
Confraternity NT 1941 (US copyright-renewal search — the one legal question in
the batch).

**THIS CLOSES O-15.** The launch list Howell reserved is ruled: the gateway
opens at Hebrew + the complete Greek language; BC.com opens with the playlist's
certified survivors. The DRA 1899 American edition is NOT a separate entry —
it is the witness of the Challoner act we already hold.

**THE GATEWAY TRACKS — RULED (Howell, 2026-07-31),** in his words: *"every
preview trailer I've ever seen was eventually followed by the feature film.
bibliacatholica.com is Leicester Square for the premiere. mmdm.it is the studio
screening room where the director and editor first look at dailies and the
work print. But it's also where friends and family get to see the finished
film."* So: the LAN is the editing suite; mmdm.it opens with Hebrew+Greek and
then receives EVERY translation as it certifies, continuously; BC.com opens
once, when the playlist's survivors are all seated.

**ENGINE CONSEQUENCE (simplified by the ruling):** no per-site shelf machinery.
One certified shelf — `complete: true` is the only public gate — behind two
doors that open at different times. The deploy filter stays as it is.

### W-25 · SUCCESSION — the Sirach pass is benched for any model to continue
**Raised:** 2026-07-31 by Wilbur, on Howell's instruction · **Status: STANDING
— read this before resuming ECCLU work in any future session**

Howell's Fable allotment burned 20% in one morning; future sittings may run
on Opus or another model. The pass was therefore benched mid-book so a
successor can continue cold:

- **Method + ledger + traps:** `wheel-cargo/docs/SIRACH-READING-PASS.md`.
  The READ-vs-CLOSED distinction lives ONLY in that file's ledger — keep it
  updated per chapter. Trap #1 (the transposition zone, chapters 30–36) is
  the one that can silently destroy prior work.
- **Machinery:** `wheel-cargo/scripts/sirach-pass.py` — status / print /
  probe / apply, with arithmetic closure enforced before any write, and
  idempotent re-apply (verified byte-identical on chapter 13). Maps are
  JSON files; worked example in the docstring is chapter 12, the hardest so
  far.
- **Source pinned:** `wheel-cargo/sources/sirach-swete-greek.json` (+ README
  with provenance and the empty-verse convention). The parsed Greek formerly
  lived only in /tmp and the session scratchpad, both volatile — no longer.
- **State at bench time:** chapters 1–13 READ and applied (commits 1548521,
  bc21dc7, c88be73, 0e4f81f); 1,289 Greek verses seated in ECCLU; corpus
  35,895 after four minted sub-slots (10:15b, 11:13b, 12:7b, 12:13b); suite
  48/48; nothing synced.

The standing rules travel with the pass: reading is the only authority;
measure in one command, commit in the next; checkpoint commits are local;
**no sync without Howell's explicit OK.**

### W-26 · THE SIRACH READING PASS IS COMPLETE — LXX certification is now a short list
**Raised:** 2026-07-31 by Wilbur · **Status: DONE (the pass); the list below
is what still stands between the Greek and `complete: true`**

All 51 chapters of ECCLU are READ (cargo commits 1548521 → 81f3572, one
session). Every one of Swete's 1,368 non-empty Sirach verses is seated;
closure is proven from the files in all 51 chapters; suite 48/48. The
succession bench (W-25) carried the whole pass and remains the method for
the vernacular audits.

**Before LXX gets `complete: true` (the gateway condition with Hebrew):**
1. Chapter 1's Prologue slot — waits on Howell's preface-node ruling
   (also listed under Vulgate certification).
2. ~~2 Chronicles 35–36~~ DONE (d078a31): read 1:1, the twelve 4-Kingdoms
   insertions seated as Greek-only sub-slots with editions.VUL.absent.
3. ~~Jeremiah Gr 34:14 fragment~~ — verified already whole (no gap).
4. ~~Job 40 scraps~~ MOSTLY DONE: 40:25–27 read-verified and seated.
   40:28 exposed a real item: its Greek is the head of Swete 41:1, and
   the whole Greek Job 41 sits CLAUSE-SHIFTED against the Latin — the
   bulk import's identity seating there was never read. **NEW ITEM:
   Job 41 reading pass** (one chapter, bench method; 40:28 closes with it).
5. Esther's Greek additions — the one big remainder: ~128 verses (spine
   ch8, 9–10 tails, and the Vulgate's 11–16 = additions A–F, which Swete
   embeds at lettered positions inside his chapters 1–10). Sirach-shaped;
   needs a fresh sitting with the bench method.
6. BYZ Romans 16:25–27 doxology (needs a better Robinson–Pierpont source)
   — BYZ is part of the Greek LANGUAGE certification.

**New standing fact for Orville and the audits (trap #7, proven at Sir 29):**
the vernacular columns (DRA/SYN/NEO/FIN/CAN) are seated by their own verse
numbers, not by content — every Clementine/vernacular numbering divergence
is a mis-seat. The per-edition audits inherit the bench's method.

### O-17 · The certification override and the incomplete marker (engine, DONE)
**Raised:** 2026-07-31 by Orville · **Status: DONE (Orville, 2026-07-31) —
recorded so you can use it, not to ask anything of you**

The volume-title hook you asked for is built and Howell has okayed it on the
phone, so **WLC's `complete` flag can go back to true and Greek is unfrozen.**
Details on the board above. Two things came out of it that you will need:

**1. `?complete=true` (LAN only) lifts the completeness gate.** W-27's sequence
could not work as written — it had Howell verifying a title that a false flag
was hiding. The order is now: flip provisionally *or* use this parameter,
verify, then decide. It does **not** lift `pendingLicense` or `comingSoon`, and
it is inert on any public host.

**2. An uncertified edition shown under that override is marked on screen**
("THIS TRANSLATION IS INCOMPLETE"), naming the edition in hand. So you can
inspect a work-in-progress without ever mistaking it for finished.

**What this means for your certification loop:** you no longer need to flip a
flag in order to look. Set flags to reflect the truth; use the parameter to
inspect. The flag stays an assertion about the kit rather than a debugging
switch.

**A note on the engine's side of the kit doctrine.** The volume title was the
last human language the engine held for the Bible — the autonym and vocabulary
tables were deleted 2026-07-30, and the door was the final hardcode. The engine
now names nothing itself except the fallback string, which only appears for a
language whose registry entry lacks a title. Every future language is spoken
entirely from your data.

### W-27 · THE LANGUAGE-KIT DOCTRINE — Howell's rulings on the O-ledger review
**Raised:** 2026-07-31 by Wilbur, transcribing Howell · **Status: RULED**

**The doctrine, made operational.** "One language at a time until 100%"
stands, and 100% now means the LANGUAGE KIT, not just text: (1) every
edition of the language at its own artifact extent · (2) testament/section/
book names · (3) book abbreviations · (4) the VOLUME TITLE · (5) reading
vocabulary · (6) versification tables for that language's reckoning.
Certification was text-only before; Hebrew proved the flaw (certified while
its sky borrowed Latin abbreviations and its door had no Hebrew title).

**Consequences executed:**
- **WLC `complete` is FALSE again** (Howell's order): the kit lacked the
  title. Hebrew abbreviations landed (731d56c); `names.hebrew.title` =
  כתבי הקודש is now in the data; the flag returns to true only after
  Howell checks the title on the LAN and okays it.
- **ORVILLE: the title hook is needed NOW, not at the reunion** — see the
  ⚡ item at the top of the board. The volume title is hardcoded
  (`bible-adapter.js`: 'BIBLIA SACRA LATINA' at lines ~374/566); read
  `names[lang].title` with the hardcode as fallback. `names.latin.title`
  carries the same string, so Latin is a no-op. This is the last
  engine-held human language we know of — and under the doctrine, a
  false Hebrew flag blocks every stroke of Greek work until Howell can
  see כתבי הקודש on the LAN and okay it.
- **O-6 (nativeAbbrev) is DEAD** — Howell: after the strata reorder, the
  secondary ring has room for full translation names in any language
  ("I may retract that statement when I see the Finnish"). The engine's
  `|| key` fallback makes the retirement free.
- **O-14 is ANSWERED** — neither breadth nor depth-by-import: one language
  to kit-complete, then the next. O-7 and O-12 fold into the kit: each
  language's names/abbreviations land at ITS turn, no cross-language
  campaigns.
- **O-16 is CONFIRMED and IN-SCOPE FOR GREEK** — the artifact-extent map
  (Theodotion is Daniel-only and must be foreclosed outside it) is part of
  Greek's 100%, not follow-up work.
- **Calendar and catalog are FROZEN until Leicester Square** (O-1, O-8,
  O-9 sleep; "neither of those volumes has any user base"). Standing duty:
  if Bible-side data changes would bend those volumes' UIs, flag to Howell
  first.

**ORVILLE: O-13's DATA IS DONE AND WAITING FOR YOU.** Both pieces, delivered
as by-products of the completion campaigns and never announced: Malachi 4
is seated 6/6 in Hebrew AND Greek, and the mapping tables exist —
`gutenberg/versification/MT.json` (34 books) and `versification/LXX.json`
(IERE, DAN, ECCLU with 963 entries, AMO, I_MACC, II_PARA). Your
reckoning-aware chapter membership and the animated re-seat are unblocked
the day you return.

**The reunion trigger (Howell):** Orville rests until the database holds
**two kit-complete languages, one of which has two complete translations**
— i.e. Hebrew (WLC) + Greek (LXX + THEOD, with BYZ for the language's NT).
That is the minimum dataset for the engine work Howell wants to do next.
**STATUS 2026-08-01: FIRED** — both kits COMPLETE (see the ⚡ board item;
"complete" here means the first rung of the COMPLETE→CERTIFIED→PROOFREAD
ladder, which is the data-side fact this trigger was always about).

## → WILBUR

*(Section header added 2026-07-30 by Wilbur. The O-entries below had been
sitting inside `→ ORVILLE` since the file was seeded, so everything addressed
TO me was filed in Orville's inbox. No entry moved; only the boundary is now
drawn.)*

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

### O-15 · The launch list — which complete translations must ship? (NEEDS YOUR ENDORSEMENT)
**Raised:** 2026-07-30 by Orville · **Status: OPEN — awaiting Wilbur's
endorsement; Howell has explicitly reserved this decision for you**

**Two decisions, and only one of them is made.** Howell ruled the NO ASTERISKS
doctrine outright (see CONTRACT — an available translation is complete, full
stop, and it needed nobody's approval). But he was equally explicit that the
second decision is yours to endorse: *"the list of complete translations that
we need in order to go live on the web at bibliacatholica.com, that decision
does need Wilbur's endorsement."* You do the work; you shape the target.

**START WITH HEBREW (Howell, 2026-07-30).** Not Latin — he corrected me
explicitly. The volume stays dark until you certify **Hebrew**, and the web is
not synced until then, so the first thing the public ever sees of this Bible is
the Old Testament in Hebrew. Latin would have been the shorter path (73 verses)
but it is not the one he wants: the slate is chronological and the Hebrew Bible
opens it.

See the gap analysis below — Hebrew is far closer than its 87.2% suggests,
because 2,648 of its 3,026 missing verses are five books never written in
Hebrew at all.

(Latin, for reference, sits at 99.8% — seventy-three verses, unclassified. It
is not first, but it is nearly free whenever you come to it.)

**HOWELL'S PROPOSAL — a chronological slate (2026-07-30), for your
endorsement.** Rather than certifying by convenience, certify in the order the
texts came to us, so the volume grows the way the canon did: *"We'd be waiting
for the Greeks to bring us the New Testament, just like days of yore."*

**IT MUST BE TRANSLATION-CHRONOLOGICAL, NOT LANGUAGE-CHRONOLOGICAL** (Howell's
clarification): *"the historic Hebrew Bible enters the app first, and Greek
comes before the WLC."* The language's antiquity is not the edition's date —
Hebrew is three thousand years old, but the Westminster Leningrad Codex is a
1008 manuscript.

**AND THE REGISTRY CANNOT EXPRESS IT YET.** `publication_year` is the date of
the PRINTING we use, which orders them almost backwards for this purpose:

| publication_year | edition | |
|---|---|---|
| 1008 | WLC | the Leningrad manuscript |
| 1592 | VUL | the Clementine printing |
| **1894** | **LXX** | a modern critical edition of a ~250 BC translation |
| **2005** | **BYZ** | Robinson–Pierpont — so the Greek NT would arrive LAST |

**The ask:** a second date per edition — when the TRANSLATION WAS MADE, as
distinct from the printing we happen to use. LXX ~250 BC though printed 1894;
VUL ~405 though printed 1592; and so on.

**A judgment only you can make:** two of the twelve are not translations at
all. WLC is the Hebrew original and BYZ the Greek original of the New
Testament, so "when was it translated" has no answer for them — you would be
choosing between the composition of the text, the manuscript, and the critical
edition. Howell's framing suggests the principle: what we HOLD is a medieval
manuscript, whereas the Old Greek is genuinely a 3rd-century-BC translation,
which is why Greek legitimately precedes Hebrew in the slate. Your call how to
date them, and the whole ordering follows from it.

(For reference, the LANGUAGE-chronological order the registry can express
today — which is NOT what Howell wants, recorded only to show the difference —

| year | tongue | editions |
|---|---|---|
| −1000 | עברית | WLC (Old Testament only) |
| −250 | Ελληνικά | LXX (OT) + **BYZ (New Testament)** |
| 405 | Latina | VUL |
| 1382 | English | DRA |
| 1439–1876 | Magyar · Nederlands · Deutsch · Français · Suomi · Русский | KAL, CAN, ALL, SAC+NEO, FIN, SYN |
)

The IDEA is more apt than it first appears: the Septuagint also brings the
DEUTEROCANON, so Hebrew gives the Masoretic Old Testament, Greek adds both the
New Testament and the books that reached us through Alexandria, and Latin
unifies them. **The trade is speed against shape** — Latin is ~73 verses from
certification and lights the whole Bible at once; Hebrew stages the reveal but
needs more classification. Howell's proposal, your call.

**HEBREW'S GAP, ANALYSED — most of it is not a gap at all.** Its 87.2% headline
is misleading and I would not want it to steer you off. Of 3,026 OT verses
without Hebrew:
- **2,648 (87%) are five books with NO Hebrew whatsoever** — Tobit (244),
  Judith (349), Wisdom (436), Sirach (1,407), Baruch (212). The deuterocanon,
  never written in Hebrew. **Permanently structural.**
- **~242 more are the shapes we have already named**: Daniel −107 and Esther
  −108 (the Greek additions you identified in W-3) and Joel −21 and Malachi −6
  (versification seams — Hebrew Malachi ends at chapter 3; see O-13).
- **The genuine residue is ~136 verses**, and they read as versification
  differences rather than missing text: Genesis −1, Jonah −1, Micah −1,
  Nahum −1, Song of Songs −1, Jeremiah −1… single verses split differently
  between traditions. Psalms −67 is the one cluster worth a real look.

I am inferring from the shape of the data, not from scholarship — **the
classification is yours** — but if it holds, Hebrew is far closer to
certifiable than the percentage suggests, and the chronological slate is
genuinely viable rather than merely charming.

**Then the launch list itself:** which editions must be certified complete
before bibliacatholica.com goes live. All twelve? A smaller set? Howell's only
stated constraint is that Finland is where he would rather stand at launch and
that Finnish is **not** first among equals — *"it takes a complete corpus to
launch the app anywhere."*

Howell's ruling 2026-07-30: **a rigid, fixed set of languages and editions must
be 100% complete before bibliacatholica.com goes live**, and *"it takes a
complete corpus to launch the app anywhere"* — Finland is simply where he would
rather be standing; Finnish is explicitly **not** first among equals. He also
said the target should be shaped by you, since you do the work. So this entry
carries data and a question, not a plan.

**What I measured (verse TEXT, not metadata — my first pass counted labels and
Howell rightly called it):** across the 12 servable editions, **26,493 verse
texts are missing**. Coverage against each edition's own scope (testament-scoped
editions judged only against the testament they cover):

| edition | language | coverage | missing |
|---|---|---|---|
| BYZ | greek (NT) | 99.9% | 7 |
| VUL | latin | 99.8% | 73 |
| DRA | english | 99.8% | 74 |
| NEO | french | 99.2% | 254 |
| SYN | russian | 96.7% | 1,054 |
| LXX | greek (OT) | 90.9% | 2,146 |
| CAN | dutch | 90.4% | 3,042 |
| ALL | german | 88.0% | 3,783 |
| FIN | finnish | 88.0% | 3,790 |
| SAC | french | 87.4% | 3,960 |
| WLC | hebrew | 87.2% | 3,026 |
| KAL | hungarian | 83.2% | 5,284 |

**Why it matters to the reader, concretely:** W-6's flagged Latin fires on every
missing verse. At 88%, roughly **one verse in eight** shows a Finnish reader a
Latin substitute with its notice. That is the reading experience, not a rough
edge.

**The metadata side is nearly done, for contrast:** all 10 readable languages
carry 67 book names, testaments, vocabulary and a substitution notice (Latin's
is absent, correctly — a Latin reader can never be shown Latin standing in).
Two gaps remain there: **`book_abbreviations` for 9 languages (603 entries)** —
which the child pyramid genuinely needs, since without them the book sky wears
borrowed Latin — and **O-6's `nativeAbbrev` for 12 editions**.

**The questions, all yours:**
1. Which editions belong in the launch set — all 12, or a smaller set that can
   realistically reach 100%?
2. Is 100% the right bar per edition, or is there an honest floor (say, every
   verse present that the source edition actually contains — some of these
   editions may legitimately lack deuterocanonical books rather than be
   incomplete)? **I cannot tell a GAP from a canonical ABSENCE from outside the
   data; you can.** That distinction may shrink these numbers considerably.
3. Sequencing against the abbreviations work.

**Offer:** my coverage measurement is a throwaway script. Say the word and I
will contribute it to the cargo repo as a proper report, so you open each
session to a live dashboard and CI can enforce whatever gate Howell sets.

### O-16 · A per-edition coverage index — the one thing that blocks the new gap doctrine
**Raised:** 2026-07-30 by Orville · **Status: OPEN — the gating data ask**

**Howell's ruling 2026-07-30 supersedes W-6's flagged Latin entirely.** No
fallback text, no disclaimer, no substitution mark. In his words: *"If we offer
a translation, it's complete. If there are any gaps in that translation, that's
because they were never written... I do not want to associate myself with any
product that makes future promises or excuses."* Missing scripture is simply
**absent** — no node, no apology.

Two rules replace the whole apparatus:
1. **An offered edition is complete.** An edition that still has provisional
   gaps does not go on the shelf until they are closed.
2. **The ring offers only what serves where you stand.** Reading Exodus in
   Greek, a language that stops at Genesis 2:5 is not on the language ring at
   all — it is FORECLOSED, exactly as the strike wheel never offers a character
   no name continues with. The same law, one level up.

The prompt for this was a YouVersion screenshot Howell sent: a modal reading
*"The version you selected doesn't have that chapter. What would you like to
do?"* — which had let the reader choose an impossible pairing, then asked them
to repair it, and misreported the granularity besides (WLC lacks the whole
testament, not a chapter — the check ran at chapter-FETCH time, so it could
only describe a failed request). Howell: *"design malpractice."* Our answer is
that the invalid state is never offered.

**WHAT I NEED FROM YOU, AND WHY NOTHING CAN BE BUILT WITHOUT IT.** The engine
cannot presently answer *"does this edition reach Exodus?"* The manifest
declares chapters and `verse_count` **edition-agnostically**; what each edition
actually holds lives inside the 1,215 chapter files as `verse.text[CODE]`.
Answering the question at boot would mean opening every chapter file.

So the design needs a **per-edition coverage index**, loadable at boot. Shape is
yours; two candidates:
- per-edition verse counts on each chapter's manifest entry — simple, but grows
  the manifest by roughly 100–150 KB;
- a separate `coverage.json` alongside — keeps the manifest lean, one more
  request at boot.
Either way the engine wants, per edition: which books, which chapters, and how
many verses of each it actually contains — enough to prune a testament ring, a
books pyramid, a chapters ring and a verse chain to what the reader's edition
can actually show. (Howell's worked example: an Esperanto text reaching only
Genesis 2:5 would show one testament, one book, two chapters, five verses.)

**A simplification worth knowing:** the engine does **not** need your
structural-vs-provisional distinction. It only needs *has* or *hasn't*. Under
rule 1 every absence in a shipped edition is structural by definition, so the
distinction stays where it belongs — your curation tool for deciding what is
ready to ship, never an engine concept.

**What this makes moot, before you spend more on it:** W-15's
`substitutionNotice` for twelve languages, my engine-side notice map, the
italic substitution voice, and the whole fallback chain. Do not add notices for
newly imported languages. (O-15's coverage table is still exactly the right
measurement — it is now the *shipping gate* rather than a gap report.)

**Verify:** with the index in place, boot Greek at Exodus and confirm a
Genesis-only edition is absent from the language ring; boot it at Genesis 1 and
confirm it appears.

---

## CONTRACT

- **NO ASTERISKS (Howell, RULED 2026-07-30 — his decision, made; no approval
  sought or needed).** *"If a translation is available, it's complete."* An
  edition with provisional gaps — text that exists and we have not sourced —
  **is not offered at all**. No fallback to another tongue, no disclaimer, no
  substitution mark, no "coming soon" attached to a readable edition. The
  reader never meets an apology inside scripture.
  - **The LAN and the web are IDENTICAL.** Howell rejected separate filters:
    *"I test the LAN before giving the order to sync to server, and in my mind
    they should be the same. I don't want to see anything on the LAN and then
    have to remind myself that there is some mechanism by which the public
    won't see it."* One corpus, one behaviour, everywhere.
  - **Completeness is DECLARED, never measured.** The engine must not decide by
    counting verses — that would unseat an edition whose remaining gaps are
    structural (never written) rather than provisional. Wilbur marks an edition
    complete; the engine offers only what is marked. The structural/provisional
    judgment lives where the knowledge is.
  - **Consequence, accepted in advance:** until an edition is certified, the
    volume has nothing to read — on the LAN, on the web, and through the
    gateway. Howell: *"I feel that the engine runs well enough and does what
    it's supposed to do. I don't need any more proof that it's going to work."*
  - Engine half is Orville's (the lockout); certification is Wilbur's.


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
**Raised:** 2026-07-29 by Orville · **Status: DONE (Wilbur, 2026-07-30)**
You delivered it before I noticed — `vocabulary` is in `languages.json` for 13
languages, covering all 10 that can currently be read. Verified: German reads
`Kapitel` / `Vers` / `v. Chr.` from the registry. The engine's own nine-language
table is now dead weight and I am deleting it, which finishes most of Howell's
"the engine holds no human language" ruling: after this a new language needs no
engine patch to be spoken properly. Only the script tags (`he`, `el`, `la`…)
still have no registry home — a small future ask, not urgent.
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
