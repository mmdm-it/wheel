# CLAUDE.md — wheel (the engine)

**This is the ENGINE repository — the app.** The corpus lives in the data
repository beside it, and `data/` is a window into that tree. The two are kept
apart because one is public and the other is not: the engine ships under an
open licence, the corpus does not. THAT boundary is enforced by what gets
committed where, and it is the only wall left.

**There used to be a second wall, between two SESSIONS** — Orville held the
engine, Wilbur held the corpus, and neither could write to the other's tree.
Howell ended that on 2026-08-25 (O-99), after the project had spent months at
roughly 95% housekeeping: one session now works in both repositories. The
guard hook, the acceptance matrix, the canaries and the second credential are
gone. If you find an instruction anywhere telling you not to commit to "your
brother's repository", it is a leftover and it is wrong.

**Authority: `WORKFLOW.md` in this repository is the standing operating
procedure. This file is a generated projection of its rules** — the copy that
cannot go unread, not a second authority. If they disagree, WORKFLOW.md is
right and this file needs regenerating:
`node scripts/build-claude-md.mjs`. The suite fails on drift.

**Open every session with the board (WF-4):** open PRs oldest first, branches
carrying commits with no PR, and main green — in BOTH repositories. If
anything is open, clearing it IS the work. The ledger lives at
`/media/howell/dev_workspace/team_communication/LEDGER.md` — one line per
number — outside both repositories; each carries a verified copy at
`docs/LEDGER-INDEX.md` (refresh it with
`node scripts/build-ledger-index.mjs` after any ledger change; `--check`
proves the copy has not drifted).

**Say the thing, not the number.** Howell asked for this on 2026-08-24: the
`W-`, `O-` and `WF-` ids mean nothing to him, and citing one at him makes him
open a file to follow his own project. They belong in commits and code
comments, where they are for whoever runs `git blame` in a year. In
conversation with him, write the sentence out.

## The rules

<!-- WF-RULES:BEGIN — generated from WORKFLOW.md by scripts/build-claude-md.mjs. Do not hand-edit this block. -->
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

- **WF-22 (ruled 2026-08-28). The board NAMES the document, and a stamp older
  than the edit is a claim nobody has checked.**

  WF-13 already says an audit reads one document against one question once a
  session, and that the board names which is next so skipping is visible rather
  than silent. **The board never had anything to name it with.** The choice was
  made by eye and by eye it drifted: the document read on 2026-08-27 had been
  waiting fourteen days. `node scripts/audit-board.mjs [repo]` now lists every
  document under `docs/` with the date it was read, the question it was read
  against, and the date it was last committed.

  **A DOCUMENT EDITED SINCE IT WAS READ IS FLAGGED** — not because the edit was
  wrong, but because the stamp has become a claim about a document nobody has
  read in that state. This is the mechanism behind both contradictions found
  that week: the corpus's proofread suite was stamped the 13th and rewritten on
  the 26th, and this repository's `ARCHITECTURE.md` was stamped the 20th while
  its far end still asked for a file deleted months before. Both read perfectly
  well alone. Both contradicted their own other halves, because **an edit
  corrects where the writer is looking and leaves the far end teaching the
  retired thing with fresh authority.**

  **And it counted a backlog nobody could see: 21 of 25 documents across the
  two repositories have never been audited against any standing question.**
  That is not a backlog anyone decided to accept.

  Generated projections are excluded — the ledger index is regenerated and
  verified by its builder, and reading it against a standing question would be
  reading the ledger, which is not a document under `docs/`.
<!-- WF-RULES:END -->
