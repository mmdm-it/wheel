# CLAUDE.md — wheel (the engine)

**This is the ENGINE repository. It belongs to the Orville session** (WF-15:
do not commit to your brother's repository; commits here require
`WHEEL_SESSION=orville`). The data repository is Wilbur's, `data/` is a
read-only window into it, and access across the wall is READ ONLY, both ways.

**Authority: `WORKFLOW.md` in this repository is the standing operating
procedure. This file is a generated projection of its rules** — the copy that
cannot go unread, not a second authority. If they disagree, WORKFLOW.md is
right and this file needs regenerating:
`node scripts/build-claude-md.mjs`. The suite fails on drift.

**Open every session with the board (WF-4):** open PRs oldest first, branches
carrying commits with no PR, in BOTH repositories, and the canaries green —
and if anything is open, clearing it IS the work. The ledger lives at
`/media/howell/dev_workspace/team_communication/HANDOFF.md`, outside both
repositories; its index projection is `docs/LEDGER-INDEX.md` (regenerate
with `node scripts/build-ledger-index.mjs` after any ledger change).

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

- **WF-4 (amended under W-46). Every session opens with the board — as a
  GATE, not a report.** Before any work: open PRs oldest first, branches
  carrying commits with no PR, **and the canaries green** — one Write aimed
  at `.claude/canary/probe.txt` (expect refusal naming the deny rule) and
  one command carrying the wall's canary token (expect the hook's canary
  refusal). A canary that does not refuse — or refuses from a layer we do
  not configure — is a finding, and clearing the board IS the work until it
  is done. The board also names the next audit under WF-13 — the stalest
  document and the question due against it. Idle PRs are not merely slow —
  they go stale in the wrong order and are superseded by later idle PRs.

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

- **WF-16. A commit that changes a document under `docs/` cites a number, and
  the number must exist.** `W-`, `O-` or `WF-`; `WF-` ids pass on sight, since
  they are rules in this document rather than ledger entries. No number, no
  commit.

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
<!-- WF-RULES:END -->
