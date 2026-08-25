# Workflow Agreement

Every change — code or JSON data — goes through the gate sequence below
before the version is bumped or anything is committed. The version bump marks
a *verified* state, not an attempted one.

**How this document stays current.** It contains only principles and
procedure, layered by how fast they change:

- The **gate sequence, smoke checklist, and rules** are near-permanent and
  volume-agnostic. If a line here names a specific dataset, device, or bug,
  that line is in the wrong place.
- **What our documents are** and **Decisions, and how they become work** are
  likewise near-permanent. The first says which documents are authoritative and
  which are not; the second governs a *decision* — how a ruling becomes work and
  how work stays visible until it is done. The gate sequence governs a *change*.
- **Environment specifics** (LAN server commands, IPs, URLs, the device
  roster) live in `TESTINGSETUP.local.md` — untracked, private, expected to
  change freely.
- **Regression watchpoints** (below) are explicitly temporal. Each entry is
  pruned once it is covered by an automated test or has stayed clean for
  three consecutive releases. That section is *supposed* to shrink.

---

## What our documents are

Howell's taxonomy, 2026-08-06. Two categories, five kinds. The question it
answers, which a flat list did not, is **is this authoritative?**

**1. RECORDS — read as reference or as backup.**

- **a. Blueprints** — defining documents. What is *true*. **Every live
  document under `docs/` is a Blueprint unless it is named an SOP below or
  sits in `docs/archive/`.** Named examples, not the whole list:
  `ARCHITECTURE.md`, `PREMISE.md`, `FEEL.md`.
  *(`THE-PLAYLIST.md` was named here until 2026-08-18, when Howell moved it
  to cargo under W-89 — it is a Blueprint still, but not one this repository
  holds or audits.)*
  *(`WILBUR-FORMAT.md` was named here until 2026-08-19, when W-100 withdrew
  the format as a separate intellectual property and this repository's copy
  was deleted. Cargo's copy is the working spec and audits there.)*
  *(The rule is stated as a default because the old form named six documents
  while thirteen live ones had no category at all — including `PREMISE.md`,
  which is "above architecture and above every phase" — while WF-13 claimed
  its rotation "covers every live document." A taxonomy with holes in it
  cannot be the thing a rotation iterates over. `DECISIONS.md` was named here
  and is archived under H-7: a general decisions table has no function once
  every ruling carries its landing address at birth, and a catch-all is where
  homeless decisions go to look housed.)*
- **b. SOPs** — standard operating procedures. How we *work*. This document,
  `docs/GIT-ROUTINE.md`.
- **c. GitHub** — safety net and history. Backup against a dead laptop,
  verification of the GPL claim, and a reliable undo. **A commit message is a
  record too** — authoritative about its own diff and about nothing else. *"If
  you ever wonder 'what was I thinking?', read the commit messages."*

**2. COMMUNICATION — for exchanging ideas, never relied on as definitive.**
*These are the Federalist Papers, not the Constitution.*

- **a. The ledger, `LEDGER.md`** — one line per number: id, status, date,
  title. What is *owed*, and where each ruling's substance actually lives.
  In `team_communication/`, outside both repositories — it was put there so
  two sessions could file numbers without crossing the wall between them, and
  it stays there because it belongs to neither repository rather than to
  both. Each carries a verified copy at `docs/LEDGER-INDEX.md`, written and
  checked by `scripts/build-ledger-index.mjs`.
  *(Was `HANDOFF.md`, 13,322 lines of prose, until W-139 ruled it retired on
  2026-08-23. That file is now a tombstone pointing here and its history
  stays in `team_communication`'s git.)*
- **b. Sidebars** — retired with the second session (O-99). Howell may still
  convene one for a genuinely contested design question; it names where its
  conclusions land, and it closes on a date he sets.

**The corpus and the engine are neither.** They may be documents; they are not
*documentation*. They are the thing itself — defined in a blueprint, tested by an
SOP. Anyone reading only those files to build or improve the program is reverse
engineering.

**The consequence that makes this taxonomy load-bearing rather than tidy.**
Because communication is explicitly not definitive, **a decision that never
reaches a Blueprint or an SOP has no authoritative home at all.** It is not
"recorded in the ledger" — the ledger only says someone owes it. That is the
exact failure this taxonomy was written after: a ruling that lived in a
specification and a branch, and in no queue.

*(This document is an SOP, and therefore classifies itself. That is intended:
where the categories live is itself a matter of how we work.)*

### The ledger's lifecycle

- **Archive when the closed and superseded entries outnumber the open ones.**
  Not at a fixed length: three thousand lines of open items and three thousand
  lines of closed ones are different situations. That threshold is the moment the
  document stops being an agenda and becomes a history — which, by the taxonomy
  above, is the moment it is in the wrong category. Archives go to
  `team_communication/handoff_archives/`.
- At the boundary, **OPEN migrates forward; CLOSED and SUPERSEDED stay behind.**
- **Before an item is left behind, its conclusion exists in a Blueprint or an
  SOP.** Mandatory, not hygiene: nothing in an archive is authoritative, so an
  item closed without its conclusion written somewhere permanent is not archived,
  it is forgotten.
- **The numbering never restarts.** W- and O- numbers are append-only across
  every archive, forever. The ledger is archived; the sequence is not. If
  numbering reset, `W-12` would mean four different things by September and every
  reference made in the meantime would silently rot.

---

## Gate Sequence

### 1. Make the Change
- Edit source files or volume data as needed.
- Run `npm run build` to produce a fresh `dist/app.js`.
- Run `npm test` — all tests must pass before proceeding.

### 2. Laptop Browser Test (Live Server)
- Start the LAN server (commands in `TESTINGSETUP.local.md`).
- Open the local URL in the laptop browser.
- Run the smoke checklist below on the volume(s) affected by the change
  (the default volume at minimum).

### 3. Phone Test
- Open the LAN URL on the phones (force-refresh to clear the cached
  bundle). Device roster and per-device browsers: `TESTINGSETUP.local.md`.
- **Tier by bump type:**
  - **Patch:** smoke checklist on the primary browser of each engine —
    one WebKit device, one Blink device.
  - **Minor (feature boundary), or any bump that will be deployed:** full
    device matrix.
  - **Data-only change:** patch tier, on the affected volume.
- Run the current regression watchpoints (below) on the WebKit device.
- Stop here and fix if anything fails. Do not bump.

### 4. Bump Version
- Once all gates pass:
  ```
  ./bump-version.sh [patch|minor|major] "<one-line description>"
  ```
- The script asks for a per-gate attestation (tiered to the bump type)
  before touching any files. Answer `n` to any and it aborts — go fix the
  gap and re-run.
- After the bump, run `npm run build` once more so `dist/app.js` embeds
  the new version.

### 5. Commit
- Stage only the intended files (never `git add .` blindly):
  ```
  git add <changed files> package.json README.md CHANGELOG.md
  git commit -m "<type>: <summary>"
  ```
- Repeat gates 1–5 for the next change. Accumulate commits locally.

### 6. Push and Merge (once or twice daily)
- Push a branch and open a PR (see `TESTINGSETUP.local.md` for the
  PR-first routine and repo URLs).
- Wait for the `test` CI check to go green, then merge.
- Pull locally to sync: `git checkout main && git pull --ff-only origin main`.

### 7. Sync to Server
- **Deploying is Howell's, at a keyboard, and it names its target** (O-60):
  `./sync-to-server.sh <catalog|bible|calendar|places|staging|all>`, then type
  the target back when asked. There is no default, and the script refuses
  outright without a terminal — so no session, script, cron or CI run can
  publish, by accident or by being told to.
- The corpus goes separately, through the public-domain filter:
  `./sync-data-to-server.sh <volume>`. **`--dry-run` needs no terminal and no
  confirmation** — inspecting what would ship is free, on purpose.
- Spot-check the production URL on at least one phone.

  *This step used to read "Deploy after pulling: `./sync-to-server.sh`". Bare,
  that meant `all` — four deployments to production with `rsync --delete`, no
  confirmation, no dry run. The procedure named the most destructive command
  in the repository, which is how a routine becomes an accident.*

---

## Smoke Checklist (volume-agnostic)

Every item must hold for whichever volume is under test. None of these
lines may name a specific dataset, item, or level.

- [ ] App loads — themed background visible, focus ring nodes rendered
      (no black screen)
- [ ] Magnifier shows the volume's configured start item
- [ ] Ring rotates under drag; momentum carries after release; selection
      snaps to the magnifier
- [ ] Tapping a node with children navigates IN — next level appears
- [ ] Parent button is visible and tapping it navigates OUT
- [ ] IN/OUT migration animation plays (nodes slide; no pop or jump)
- [ ] With a leaf item at the magnifier, the Detail Sector opens and
      shows content

---

## Regression Watchpoints (temporal — prune aggressively)

Manual checks for recently fixed bugs that automated tests cannot yet
cover. **Pruning rule:** each entry is either promoted to an automated
test or deleted after three consecutive releases passing clean. If this
section exceeds five entries, stop adding features and convert the oldest
to tests.

| Watchpoint | Origin | Added |
|---|---|---|
| iOS WebKit: migration translate + rotate stay synchronized (no lag between the two) | v3.8.34 rAF timing fix | 2026-02 |
| iOS WebKit: no "pop" to final position at animation end | v3.8.34 rAF timing guard | 2026-02 |
| Tap-to-magnify works immediately after an IN migration | v3.8.38 pointerup/click race | 2026-02 |
| Android: parent-button tap and OUT migration work on touch (no duplicate-touch swallow) | v3.8.39 | 2026-02 |

---

## Decisions, and how they become work

The gate sequence above governs a *change*. This section governs a *decision* —
how a ruling becomes work, and how work stays visible until it is done. The two
failures below are the ones this section exists to prevent, and both are
procedural rather than technical.

**The distinction everything here rests on:** a specification says what is
**true**; the handoff ledger says what is **owed**. A decision about the future
written only into a specification schedules nothing and is owed by nobody. That
is the category error, and every rule below is a guard against a version of it.

- **WF-1. Push and PR are one action.** Never push a branch without opening its PR in
  the same breath. A branch with no PR is invisible: it cannot be reviewed,
  cannot be merged, and does not appear on any list either session reads. This
  is the single cheapest rule here and it prevents the worst failure.
  (Who may merge, and branch shape: `docs/GIT-ROUTINE.md`.)

- **WF-2. A ruling gets a number the hour it is made**, before any document is
  edited. Numbered work survives here; unnumbered decisions evaporate, and a
  specification section describing something unimplemented with no numbered
  item behind it is an orphan by definition. Two homes, by kind:
  - a ruling about **the app or the data** earns a W-/O- number and a line in
    the handoff ledger;
  - a ruling about **how we work** earns a numbered rule in this section.

  The ledger is for the app and the data structure and nothing else, so a
  procedural ruling filed there would be lost among things it does not
  resemble.

- **WF-3. A deferral must name what it makes provisional.** "Not yet" is only half a
  ruling. The other half is what the ruling has *already invalidated* in the
  meantime. A deferred decision that does not name its casualties silently
  authorises work it has superseded, and that work will look productive right
  up until the moment it is discarded.

- **WF-4 (amended under W-46, W-115 and O-99). Every session opens with the
  board — as a GATE, not a report.** Before any work: open PRs oldest first,
  branches carrying commits with no PR, and **main green in BOTH
  repositories**. Clearing the board IS the work until it is done. The board
  also names the next audit under WF-13 — the stalest document and the
  question due against it. Idle PRs are not merely slow — they go stale in
  the wrong order and are superseded by later idle PRs.

  **main's own CI is part of the gate** (W-115). Open PRs and unclaimed
  branches are both work IN FLIGHT; neither sees the branch that work lands
  on, and the corpus repository's main once sat red for eleven hours behind a
  clean board. Both repositories are checked, and a check that cannot READ a
  repository says so rather than reporting green — "I could not tell" and
  "it is broken" are different answers and both stop the board.

  **THE CANARIES ARE GONE, and so is the second credential** (O-99,
  2026-08-25). Both were instruments of the wall between two sessions: the
  canary proved a guard was firing, and the two fine-grained tokens existed
  so neither session could reach the other's repository. One session needs
  neither. What survives is the part that was never about the wall — that a
  board line asserting a state carries a date and a source (WF-7), and that
  a gate which cannot go green is a gate that gets skimmed past.
- **WF-5. A PR that supersedes another says so in its first line.** Supersession is
  invisible in a list of PR titles, which is exactly what lets them be merged in
  an order that makes no sense.

- **WF-6. A ruling that supersedes an earlier one names the number it retires, in the
  same breath** — and the retired entry is marked `SUPERSEDED BY <number>`, not
  left OPEN. This is the ledger twin of the rule above, and it closes the gap
  every other rule leaves: they all move decisions *into* the queue and none
  governs how anything leaves it. An entry marked OPEN with no date reads as
  current advice forever, which is how a superseded recommendation goes on being
  followed. **A green light is a decision too** — "X is safe to do" can be true
  when written and false a day later, and it is retracted the same way. The
  problem is never that an entry is wrong; it is that nothing makes a stale one
  stop looking live. *(Raised by Orville on review, 2026-08-06.)*

- **WF-7 (narrowed under H-10). A status line or board entry asserting a state
  carries a date and a source.** These are the shapes a script can check and a
  reader can re-run: a PR's state, a ledger entry's status, a board line's
  claim. Each says when it was true and how it was measured, so it can be
  re-run and shown false.

  **Prose is deliberately NOT covered here.** A specification sentence stating
  something checkable — counts, coverage, "no view is the hub" — goes stale
  exactly as a status does, but no gate can see it, and a rule claiming to bind
  what it cannot reach teaches its readers that the rule is decorative. Undated
  prose assertions are WF-13's business, under a standing question of their
  own, one document per sitting.

- **WF-8. The read-back.** When a ruling is made, it is read back with its number and
  its provisional casualties named, and confirmed, before work continues. The
  first two rules are mechanical and belong to whoever is at the keyboard; this
  one needs both parties, because it happens at the moment of the decision.

- **WF-9. A commit message describes the change it is attached to.** GitHub is
  never a line of communication between collaborators, so there is no audience to
  weigh — a commit explains its own diff, for whoever runs `git blame` on that
  line in a year. *"If you ever wonder 'what was I thinking?', read the commit
  messages."* What does NOT belong there is a **state assertion** — "X is safe to
  do", "the corpus holds Y" — because an explanation is anchored to a diff and a
  later diff supersedes it, while an assertion is anchored to nothing and no
  commit can retract it. Assertions go where WF-6 can reach them.

- **WF-10. No PR is ever left pending, and no work resumes while one is open.**
  Blocking across BOTH sessions, not merely within one — and only one session
  runs at a time. A PR should be open for minutes.
  *"GitHub is not a trailer that we pull behind us. It is a kill switch that I
  must constantly reset, and that's ok."* — Howell, 2026-08-06.
  The one exception is a blocker that is not ours: if an outage or an external
  service holds a check open, the PR waits and work may continue on that PR's own
  branch. Finishing the open PR is not resuming work; starting something else is.

- **WF-11. These rules carry stable `WF-` ids**, assigned at creation, never
  reordered, never reused. Position in this document is free to change; the id is
  not. Exactly how W- and O- numbers already behave, applied to a place we forgot
  to. This rule exists because two rules were once inserted ahead of WF-8 and
  silently renumbered it, which falsified a written review without a word of it
  changing.
  **Stable is not opaque.** Opacity is forced only where more than one view must
  name a thing differently — a corpus has many traditions, so any readable leaf id
  privileges one. These rules have exactly one view, so they need permanence and
  nothing more. `WF-7` is sufficient; `x7f3a` would be a cost with no benefit.

- **WF-12. A sidebar names its landing addresses when it opens.** "Decisions here
  go to WORKFLOW.md and the ledger." Then it cannot be closed without somewhere to
  close it into, and the split between the argument and the conclusion has a
  destination rather than an intention.

- **WF-13. An audit reads ONE document against ONE question, once a session.**
  Not a sweep. The board names which document and which question is next, so
  skipping is visible rather than silent.

  **Why not a periodic sweep:** we ran one on 2026-08-02 — seven documents
  archived, two renamed, links repointed — and four days later
  `WILBUR-FORMAT.md` was found asserting *"no view is the hub"* on line 56 and
  *"the spine follows the Clementine Vulgate"* on line 283. The sweep was not
  done badly; *read everything and look for contradictions* is a task where
  attention runs out before the document does, and the contradictions that
  survive are exactly the ones that read naturally.

  Both defects we did catch were found by a **targeted question with a
  hypothesis**: line 56 fell out of asking *does this contradict itself?* while
  writing an unrelated ruling, and `VISUAL-VERSIFICATION.md`'s abolished
  vocabulary fell out of asking *what does the migration invalidate?*

  **The standing questions**, one per audit:
  1. Does this document contradict **itself**?
  2. Does it contradict **another** document?
  3. Does it assert a **state** that is now false? *(WF-7 makes these
     re-runnable where the source is a command.)*
  4. Does it use **vocabulary a later ruling abolished**?
  5. Does it describe something **unimplemented with no numbered item** behind
     it? *(WF-2: an orphan by definition.)*
  6. Does its prose carry **undated state assertions**? Date them or strike
     them. *(WF-7 binds status lines and board entries, which a script can see;
     this is where the same disease is caught in prose, which nothing can.)*

  **The rotation** covers every live document under `docs/` — archived ones are
  excluded, and SOPs are included, since they go stale exactly as blueprints do.
  Each carries `Last audited: <date> by <session> — Q<n>`, which is WF-7 applied
  to the document itself and is what lets the board sort by staleness.

  A finding is not fixed in place: it earns a number under WF-2 like any other
  ruling, and the stale claim is marked under WF-6 rather than quietly deleted.

- **WF-14. Nothing published carries corpus content** — the text itself, or the
  editorial work product that established it — unless it has been deliberately
  granted. Structure is given away on purpose; content is not.

  **The distinction cuts THROUGH documents rather than around them**, so it
  cannot be enforced by which repository a file sits in: a public document
  describing how a reading was established leaks the same work product as the
  reading would. This is the standard the `docs/` audit measures against, and
  the rights posture that follows from it is in `NOTICE` §0 and §1b.

  **The standard is the granted fixture set** *(H-5)*: a public document's
  worked examples quote Genesis 1 (Douay-Rheims, Vulgate) and nothing else.

- **WF-16. A commit that changes a document under `docs/` cites a number, and
  the number must exist.** `H-`, `W-`, `O-` or `WF-`; `WF-` ids pass on sight,
  since they are rules in this document rather than ledger entries. No number,
  no commit.

  This is the direct fix for the failure that opened the 2026-08-06 sidebar: a
  ruling written into a blueprint, never entered in any queue, so nobody owed
  the work. Enforced twice — a `commit-msg` hook so it fails at the keyboard,
  and a test so a missing hook cannot skip the rule silently.

  **The ledger lives outside both repositories and is invisible to git**, so
  existence is checked against `docs/LEDGER-INDEX.md` — a PROJECTION of the
  ledger, generated by `scripts/build-ledger-index.mjs` and never hand-edited,
  on the same principle as a seating chart: a projection that can be edited
  independently of its source is a lie waiting.

  **CI must check out with `fetch-depth: 0`.** The gate walks
  `origin/main..HEAD`, and a shallow clone has neither ref — it degrades to
  checking the tip alone and says so, rather than crashing or passing quietly,
  but a narrower check is still narrower.

- **WF-19 (ruled 2026-08-17). Obsolete means dead.** Howell's motivation, in
  his words, is tokens rather than architecture: for too long both sessions
  spent *"hours and days trying to make old code and old data work"* after he
  had considered it obsolete — the lingering attachment to the Vulgate, then
  to the pre-doctrine editions. Three clauses:

  - **No session spends effort making obsolete code or data work.** Once
    Howell has ruled a thing obsolete, verifying it, measuring it, reconciling
    against it, and preserving its provenance are all the same expenditure in
    different clothes. The class of task is closed, not the day's instance.
    The day this was ruled, both sessions had spent hours measuring deleted
    editions to argue about a boolean H-21 had already settled.
  - **A document never overrules Howell.** A README, blueprint, or SOP that
    contradicts his current word is WRONG, and gets fixed — not obeyed, not
    cited back at him. The last straw was literal: a request of his was
    refused because it contradicted `sources/README.md`, a file presenting a
    retracted 2026-07-30 acceptance as current advice. Documents are the
    record of his rulings, never the authority over them.
  - **Breakage from deleting the obsolete is acceptable.** His words: *"if
    deleting the old Greek breaks the Hebrew, so be it. We will fix it."* A
    deletion does not owe a proof of safety before it may proceed; asking for
    one is the attachment wearing a seatbelt.

  **Old commits are a LAST RESORT, and the history stays** (O-64, ruled the
  same day). No rewrite: Howell values the archive and the undo button. But
  reaching into superseded history — for content, for evidence, for
  provenance — comes only after the live corpus, the open web, and both
  sessions' own reasoning are exhausted. *"What ends today is the idea that
  the future progress of this project is hidden somewhere in my laptop."*

  This rule takes WF-19 because it is RULED; the four rules PROPOSED in O-58
  remain proposals and take later numbers if and when they are ruled (WF-11:
  ids are assigned at creation, and a proposal is not yet a rule).

- **WF-21 (ruled 2026-08-22, the same word). A correction is not done until
  it has swept everywhere the claim lives.** A false claim is not a place in
  a file; it is a sentence that may have been copied anywhere — both
  repositories, documents AND source comments — and fixing it where it was
  NOTICED leaves every other copy teaching the retired thing with fresh
  authority, because a reader who finds one copy corrected assumes the rest
  were too.

  **The correction therefore names the claim it retires** — as a searchable
  phrase or a described assertion, not merely a diff — **sweeps both
  repositories for it, and STATES WHAT THE SWEEP COVERED** in the commit or
  the entry, so a partial sweep is visible instead of silent. "Swept docs/
  and src/ in the engine; cargo not swept" is a legitimate report; an
  unstated scope is not, because it reads as "everywhere."

  **What paid for it, in one week:** the O-37 correction was applied where
  the defect was caught and carried its own confession — *"this file was
  never brought into line"* — for eleven days while `src/main.js` held a
  third copy. O-82 then found and fixed two homes, swept the OTHER
  repository, and concluded *"the claim had three homes and no fourth."* It
  had six: O-88's audit found three more in a single further document. Two
  corrections, each complete in form, each leaving live copies behind — and
  the second one's sweep looked rigorous precisely because it crossed the
  wall while skipping its own yard.

  **The sweep is textual, not clairvoyant.** A grep is the floor, not the
  proof: O-88's own check showed the same words carrying a DIFFERENT, true
  claim in a dated shipping record — so hits are READ before they are
  struck, and a copy in version-stamped history is left standing, because
  WF-7 is already satisfied there. What the rule forbids is closing a
  correction whose sweep never ran or never said where it looked.

*Origin, 2026-08-06.* A major revision to the corpus's identity model was ruled,
written into a specification, pushed to a branch, and never given a PR or a
number. Two days of work then proceeded on the superseded model — plausible,
careful, and provisional without anyone saying so — until a single sentence in
conversation exposed it. In the same stretch, PRs accumulated unmerged until one
suspended another's subject. Both halves of the project had independently
reached the same design conclusion and neither knew, because the conclusion
lived in a document rather than in the queue.

---

## Rules

- **Commit per change, push once or twice daily.** Each verified change
  gets its own commit immediately. Push accumulates to a branch PR once
  or twice a day to avoid redundant CI runs and branch merges.
- **Test before you bump.** A version number marks a verified state.
- **One topic per commit.** Code fix, data change, and doc update can be
  separate commits if they're independent.
- **Both engines, every UI change.** One WebKit device catches Safari/iOS
  regressions; one Blink device catches Android/Chrome regressions. A fix
  that breaks one of them is not done. (Current roster:
  `TESTINGSETUP.local.md`.)
- **JSON data changes follow the same gates** as code changes — a bad
  volume file can cause a black screen just as surely as bad JS.
- **Versioning policy** (what gets a number, tags, majors):
  `docs/VERSIONING.md`. Minor bumps mark feature boundaries; patch bumps
  cover everything else.
