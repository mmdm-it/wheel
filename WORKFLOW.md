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

- **a. Blueprints** — defining documents. What is *true*. `ARCHITECTURE.md`,
  `DECISIONS.md`, `THE-PLAYLIST.md`, `WILBUR-FORMAT.md`.
- **b. SOPs** — standard operating procedures. How we *work*. This document,
  `docs/GIT-ROUTINE.md`.
- **c. GitHub** — safety net and history. Backup against a dead laptop,
  verification of the GPL claim, and a reliable undo. **A commit message is a
  record too** — authoritative about its own diff and about nothing else. *"If
  you ever wonder 'what was I thinking?', read the commit messages."*

**2. COMMUNICATION — for exchanging ideas, never relied on as definitive.**
*These are the Federalist Papers, not the Constitution.*

- **a. The ledger, `HANDOFF.md`** — the channel between Orville and Wilbur. What
  is *owed*. Lives in `team_communication/`, outside both repositories.
- **b. Sidebars** — three-way conferences between Howell, Orville and Wilbur, one
  topic each. Deleted once their conclusions are documented **and verified by all
  parties** — verification, not documentation, is the trigger.

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
- Deploy after pulling: `./sync-to-server.sh`
- Spot-check the production URL on at least one phone.

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

- **WF-4. Every session opens with the board — as a GATE, not a report.** Before
  any work: open PRs oldest first, and branches carrying commits with no PR. One
  command, read aloud in the first response. **If anything is open, clearing it
  IS the work** until it is done. The board also names the next audit under
  WF-13 — the stalest document and the question due against it. Idle PRs are not merely slow — they go stale in
  the wrong order and are superseded by later idle PRs.

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

- **WF-7. Anything asserting a state carries a date and a source.** Three surfaces go
  stale and only two of them are covered above: PRs, ledger entries, and the
  claims inside specifications. A specification sentence stating something
  checkable about the corpus or the engine — counts, coverage, "no view is the
  hub" — is dated and says how it was measured, so it can be re-run and shown
  false. Stated as timeless fact, it cannot be, and it will quietly outlive its
  truth.

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

- **WF-15. Do not commit to your brother's repository.** Howell's ruling,
  2026-08-06, in those words. The engine repository is Orville's and the data
  repository is Wilbur's; access across the wall is READ ONLY, both ways,
  symmetrically.

  **A document that governs both sessions — an SOP — is committed by the
  repository's owner from the other's draft.** Case by case as to who writes and
  who lands it.

  **NOT YET ENFORCED, and this line stays until it is.** Both sessions run as the
  same Unix user, from the same clones, with the same GitHub token, so neither
  the filesystem nor the server can tell them apart. What exists today is a
  `pre-commit` hook in each repository that refuses any session but the owner's
  and refuses when none is declared, plus a `commit-msg` hook stamping
  `Session:` — identity that names the ROLE, not the model. That is a tripwire:
  it makes the wrong move fail loudly and leaves a mark when it succeeds, and
  `--no-verify` bypasses it by design. Real enforcement needs separate Unix
  users, which also makes separate credentials possible. Until then this is a
  convention with an alarm on it.

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
