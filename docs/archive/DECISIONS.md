# ARCHIVED 2026-08-09 under H-7 — historical record, not a live document

**This file is superseded by the H- series and is kept as the dated record of
one attempt, not as a source of truth. Do not cite it; do not add to it.**

H-7 retired the catch-all: every ruling now gets its number, its attribution
and its **landing address at birth**, so a general decisions table has no
remaining function. It also had a live defect — headings here read `RULED`
over propositions Howell has since denied in his own words, further down the
same page.

**Its contents were swept before it moved, per H-7's archive precondition.**
Every item was sorted three ways — already true in a blueprint (struck), dead
or denied (buried here), or still live and homeless (rehoused first). **The
item-by-item sweep list is in the ledger under H-7, where Wilbur verifies it.**
Where things went:

- **`docs/PREMISE.md`** — the no-telemetry commitment, as a held value
  (H-7 names this home); and *the engine holds no human language.*
- **`docs/FEEL.md`** — the shipped interaction rulings: the front-door globe,
  the mid-wipe icon swap, the desktop splash, substring search, *fewer
  dramatic visuals*, the 18-character favorites rule, the borrowed Latin
  abbreviations, the deferred catalog home icon, *no engine UI for empty
  chapters*, and *no licensing notices in the interface.*
- **`docs/VERSIFICATION-MODEL.md`** — versification auto-corrects per edition,
  numbering keeps faith with each tradition, and versification is not a fourth
  stratum.
- **The ledger** — the overture requirement, which Howell upgraded from
  spitballing to owed work and which had no number: now **O-36**.

**What died here, deliberately.** The TWA/wrapper items — *"I never approved
or asked for a wrapper. I prefer to do things right and do everything the hard
way"* — buried citing H-1 phase 5, the port being native. And the
monetization and licensing terms, all of them, on Howell's own note below:
*"All monetization and licensing items are spitballing. None of us have any
idea when, or how, or if this thing will ever make money."* The what-ifs died
as what-ifs, which is what they always were.

**Read the note at line 8 with that in mind:** the labels below were Orville's
first pass, pending Howell's correction. Howell's corrections arrived inline,
dated 2026-07-30, and several of them contradict the heading above them. That
was the file's disease and the reason it is here.

---

# DECISIONS — what is ruled, what is speculation, what we assumed

A register of every standing proposition, with its **provenance** and its
**status**. Its purpose is to stop assumptions from hardening into doctrine by
repetition, and to make prioritisation honest — you cannot sequence a plan
whose items you cannot tell apart.

Drafted by Orville 2026-07-29 at Howell's instruction; **the labels below are
Orville's first pass and are pending Howell's correction.** Evidence is cited
for each so a wrong label is visible rather than plausible.

## The two axes

**Provenance**
- **RULED** — Howell decided it, in words, on a date.
- **WHAT-IF** — Howell raised it as speculation, thinking aloud. Not a
  commitment. Several of these are excellent; none of them are promises.
- **ASSUMED** — Orville or Wilbur proposed it, or inferred it, and it has been
  operating as though settled. **These are the ones to check.**

**Status**
- **SHIPPED** — built, released, live.
- **OPEN** — not built.

> The dangerous quadrant is **ASSUMED · SHIPPED**: something already built on a
> premise Howell never actually stated. Those are listed first.

---

## ⚠ ASSUMED · SHIPPED — check these first

| # | Item | Evidence | Note |
|---|---|---|---|
| 5 | Corner icons swap mid-wipe, as part of the image | Howell: *"shouldn't the wipe switch that icon the same way it switches the colors and labels"* — but he then said *"I actually think I'm wrong"* about his own prior instruction, and Orville proposed the crossing-time implementation | RULED in principle, ASSUMED in mechanism. The timed-swap-at-crossing was Orville's design |
| A1 | Favorites keep full names only if ≤18 chars | Orville amended Howell's 2026-07-19 favorites rule when Finnish broke the sky; Howell approved after the fact (*"That all looks good"*) | An amendment to a Howell ruling, made by Orville and ratified retroactively. The 18 is arbitrary |
| A2 | Languages without abbreviations borrow the **Latin** ones | Orville's interim choice; Howell saw the result and approved | Reasonable, but never proposed by Howell. Alternative was truncation or full names | 
| A3 | Testament-scope ruling framed as two options; Howell picked (a) | Orville framed the choice and recommended (a); Howell: *"go with your suggestion a"* | RULED — but the option set was Orville's. A third option was never offered |
| A4 | Engine notice/vocabulary strings are *provisional* pending a native eye | Orville flagged own Hebrew as engine-authored | Correct instinct, but nobody has ruled what happens if a native eye never arrives |

---

## RULED · SHIPPED — settled, built, needs no attention

| # | Item | Evidence |
|---|---|---|
| 2 | Book/testament names follow the reader's language | Howell reported the freeze; W-16; v3.26.0 |
| 3 | Search matches any part of a name | *"I'd like the search logic to search for any string not just the first letters"* — v3.23.0 |
| 4 | The globe appears at a volume's front door | *"I would like to have the globe icon visible when we first enter the Bible gateway"* — v3.24.0 |
| 11 | Desktop splash with QR | *"I want to put up a desktop only splash page"* — v3.21.1 |
| 18 | `data/` left the public repo for private cargo | W-10, ruled 2026-07-26 |
| 32 | No licensing-pending notices in the UI | *"it doesn't concern the user, and it's too inside baseball"* |
| 33 | The shelf shows only editions that open | Same conversation; v3.25.0 |
| 34 | Testament scope is not filtered from the rings | *"go with your suggestion a"* (see A3) |
| 35 | No engine UI for empty chapters — fix the data | *"we shouldn't spend too much time writing code for a problem that can be, must be, and will be fixed somewhere else"* |
| 37 | Test from the bare URL, not deep links | *"I like testing it from the shortest URL possible"* | 
      Howell explains 2026-07-30 - I do all LAN tests using two phones, each with bookmarks for "http://192.168.88.167:8080/". I don't object to deeper links for testing, I just don't have bookmarks for them. If a deep link is needed for a particular test, give me the link to click. I will also create bookmarks for "http://192.168.88.167:8080/?volume=bible", since that is the focus of our work for now. 
| 38 | One session open at a time | Adopted after the concurrent-rewrite incident |

---

## RULED · OPEN — decided, not yet built

| # | Item | Evidence | Blocked by |
|---|---|---|---|
| 1 | Versification auto-corrects per edition | *"she should also see the blurry primary stratum focus ring rotate to verse 19"* | Wilbur's tables + Malachi Hebrew text (O-13) |
| 13 | The engine holds no human language | *"the hard coded list of languages in the engine is very troubling... Manifolds don't have languages"* | Registry fields (O-11, O-12) |
| 15 | Versification is **not** a fourth stratum | *"I'm not sure I see the need a fourth stratum"* | — |
| 36 | Keep verse numbering true to each tradition | *"I am considering Keeping the numbering true"* → then ruled by the Malachi design | Same as #1 |
| 19 | bibliacatholica.com serves the Bible standalone | W-14, Howell's three-step plan | Front-door design (bench) |
| 20 | TWA wrapper for Play Store — "Biblia Rota" | W-14 step 2 | **Contradiction C** |
| 21 | Full offline via service worker | W-14 step 2 | **Contradiction B** |
| 24 | Primary offer to bishops' conferences is the engine | W-13 addendum, *"Howell's ruling after surveying the field"* | **Contradiction D** |
| 25 | Cargo licensing kept only for commercial publishers | Same | — |
| 31 | Android sooner via wrapper; native gated on evidence | Same | Contradiction C |
      Howell adds 2026-07-30 I never approved or asked for a wrapper. I prefer to do things right and do everything the hard way. The path I have mapped for the Bible app is -
      1) Get bibliacatholica.com up with as many PD translations as possible.
      2) Port to android, test and release in Play store with PD translations. All free, no ads, no data havesting.
      3) Write letters to every copyright holder in the world. Ask for license deal? Offer app? I don't know. Let's build it, build a user base (I want to first introduce it in Finland,small, tight Catholic community, tech savvy), and the letters will write themselves.

---

## RULED · OPEN — business terms (recorded via Wilbur; **verify these are yours**)

      Howell adds 2026-07-30 - All monitization and licensing items are spitballing. None of us have any idea when, or how, or if this thing will ever make money. The idea of us switching from being a licensee to being a licensor only arose after being told that the Bishop Conferences were unlikely to license their translations. My thought was, "If they're not selling, maybe they'll buy". And this reframe applies to any license holder equally, commercial or ecclesiastical. My primary goal is to get as many Catholic Bible translations as possible into our database, and to get this engine and database into as many phones as possible. Ultimately, monetization may come from selling the company. The WhatsApp model. Facebook paid $19B for a list of phone numbers. That's an exaggeration, and we're not collecting phone numbers, but a big enough user base must have value to someone. As I said, none of us have any idea when, or how, or if this thing will ever make money.

| # | Item | Evidence | Orville's confidence |
|---|---|---|---|
| 26 | Per-edition unlock, never subscription | W-13, attributed to Howell | Stated as reasoning, not as a quote — **verify** |
| 27 | No per-edition usage telemetry, by design | W-13 | Presented as a consequence of #26 — **verify it is a ruling, not a rationale** |
| 28 | Web is the storefront (3% vs 15–30%) | W-13 | **verify** |
| 29 | 75% of net receipts to the rights holder | W-13 | Specific number — **verify** |
| 30 | B2B deployments invoiced, not IAP | W-13 addendum | **verify** |
| 12 | Inert payment sheet on the tertiary | W-13, *"Howell's ruling 2026-07-28"* — but the *inert* shape is **Wilbur's recommendation, Howell to rule** | The demo is ruled; its shape is not |

> These six came to Orville second-hand through the ledger. Wilbur recorded
> them faithfully, but a ruling relayed is a ruling worth confirming — especially
> the 75% and the no-telemetry commitment, which are the two hardest to reverse.

---

## WHAT-IF · OPEN — spitballing, not commitments

| # | Item | Evidence |
|---|---|---|
| 6 | A sort-criterion stratum for the catalog | *"what if, for example, the primary stratum of the catalog remained the same, but the secondary stratum offered a choice of different sort criteria"* — explicitly a what-if |
| 7 | Search becomes a stratum | *"I'm thinking that the alphanumeric ring (search mode) could simply be another strata"* |
| 9 | Calendar hours ring | *"it would certainly be easier to add an hours of the day wheel"* — conditional |
| 10 | Out-of-band text entry via messaging | *"Might it be possible to..."* — explicitly exploratory; memory records **no ruling** |
| 16 | Every volume gets strata, used differently | *"knowing that every volume will use them differently"* — a direction of travel, not a plan |
| 23 | Fewer dramatic visual environments overall | *"my general point is I want fewer, not more, dramatic visual changes"* — a principle offered, never applied to a specific build |
| 8 | The overture teaches depth | Orville proposed; Howell: *"I'm happy to put the overture animation on the back burner"* — **deferred by Howell, originated by Orville** |
      Howell adds 2026-07-30 - This one in more than spitballing. The bible needs a new overture. It can happen later, or last, but it must be done.

---

## ASSUMED · OPEN — ours, not yours

| # | Item | Origin |
|---|---|---|
| 14 | Storage stays canonical; versification is a display layer | **Orville's architecture.** Howell ruled the *behaviour*; this is Orville's means |
| 17 | The globe returns to dimensions-duty when the catalog gets strata | **Howell raised it** (*"we need to return that globe icon to its rightful place"*) but the *timing rule* — "the moment catalog strata ship" — is Orville's |
| 22 | Offline cache excludable per edition | **Wilbur's constraint**, derived from licensing logic |
      Howell adds 2026-07-30 - I have never had a strong opinion about caching, other than clearing it each time for testing. Any cache design contradictions are your own.
| A5 | The catalog's replacement home icon can wait | Howell: *"a permanent catalog icon for home will be found in due time I'm not worried about that at the moment"* — RULED, actually. Reclassify |

---

## The six contradictions, triaged by what each needs

| | Conflict | Needs |
|---|---|---|
| **A** | W-11 unseats held editions; W-13 needs one seated for the demo | **A ruling** (one line) |
| **B** | Offline caching vs. the no-stale-bundle doctrine and runtime data stamps | **A design session** — Orville brings options |
| **C** | Play Store billing policy vs. web storefront | **A fact.** Research first; rule after |
| **D** | Selling the engine vs. a single private corpus | **A design session** — the largest |
| **E** | Phantom slot removal vs. versification tables — both re-cut numbering | **A sequencing ruling** (one line) |
| **F** | Strata everywhere vs. the globe's single meaning | **Dissolves if #6/#7 are WHAT-IF** — which this draft says they are |

---

## What this draft asserts, so it can be argued with

1. **Contradiction F is already resolved.** Items 6 and 7 are what-ifs, so the
   catalog gets no strata soon, so the globe keeps one meaning. No action.
2. **The business terms (26–30) are the least-verified items on the list** and
   the hardest to walk back. They should be confirmed in Howell's own words
   before they reach a letter.
3. **Item 12's *shape* is unruled.** The demo is Howell's; "inert sheet" is
   Wilbur's proposal awaiting judgement.
4. **A1 and A2 are Orville's amendments to Howell's rules**, ratified only by
   "looks good" after seeing the result. If either is wrong, it is wrong in
   shipped code.
