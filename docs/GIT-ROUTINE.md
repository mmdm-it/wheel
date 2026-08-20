# The git routine — standard for both sessions

*Last audited: 2026-08-20 by Orville — Q3 (does it assert a state that is now
false?). One finding, struck below: the wall paragraph claimed the crossing was
"refused locally", which is what W-117 rules it is not. Also observed and NOT
changed, because it is not a Q3 finding and not this sitting's to rule: step 8
tells a session to assume a merge happened, while WF-7 forbids asserting a
state without a source. Both are right and they govern different acts —
proceeding, and reporting. Orville conflated them on 2026-08-20, wrote "the
amendment is landed" about an open PR, and was corrected by Wilbur. If that
recurs it wants a ruling, not an audit.*

**Ruled by Howell, 2026-08-02:** *"I like the way you handle commits and
merges... Let's make your routine standard across both sessions."* Written
by Orville; binding on Orville and Wilbur alike, each in his own repository.

> **CORRECTED 2026-08-09 (WF-15; night audit §8).** This line read *"in this
> repo and in cargo"* — written before the wall existed, and it instructs a
> session to do the one thing WF-15 forbids. **Neither of us commits to the
> other's repository.** The engine is Orville's, the data repository is
> Wilbur's, and access across the wall is READ ONLY in both directions.
>
> **AMENDED 2026-08-20 (W-117; the Q3 audit above).** This read *"enforced
> server-side since O-32 by per-repository tokens, and refused locally by the
> deny layer and the guard hook"* — and the second half of that is struck,
> because it claims something the local layers cannot do. They refuse
> SPELLINGS, not actions, so the same crossing is refused written one way and
> allowed written another. The sentence named two mechanisms and was true of
> one of them.
>
> **What is actually true, in four rungs rather than one clause:**
> **Server-side** the crossing is genuinely PREVENTED — GitHub refuses it,
> where neither `--no-verify` nor a crashed hook can reach (O-32). **The file
> tools** refuse by resolving the path, so a Write into the other tree is
> stopped every time, within the scope of those tools. **A shell command** is
> judged on its spelling, so it stops a habit and not a determination.
> **A subprocess** is not constrained at all once it is running, which is
> H-9's whole reason for existing.
>
> So the local wall ANNOUNCES; it does not prevent. WF-15 has said as much
> since 2026-08-07 — *"the filesystem wall remains a convention"* — and both
> sessions spent 2026-08-20 acting as though it were solid, which is what this
> correction is for. Howell ruled the same day: keep the alarm, fix the words.
> The routine below is the same
> routine for both of us; it is simply run twice, once in each repository, by
> its owner. Where a document governs BOTH sessions, its owner commits it from
> the other's draft.

The routine exists because we are three: two sessions that cannot see each
other's benches, and Howell, who owns the tree. Every rule below is a
consequence of that shape. None of it is git advice; it is coordination
doctrine that happens to run through git.

## The shape of the routine

1. **Sync before touching anything.** `git fetch --all --prune`, read what
   moved, and read the ledger before designing. Work begun on a stale tip is
   work that collides with the other session.
2. **Never work on main.** Branch for every task, named for the work
   (`w21-seating-chart`, `the-proofread-gate`), cut from the tip the work
   actually builds on — see the stranded-work rule below.
3. **Green before every commit.** The full suite plus the guards, and the
   count goes in the commit message. A red suite is not a checkpoint; it is
   a conversation that has not finished.
4. **Commit in small, coherent units.** Docs separate from code when they
   can stand alone. Each commit is one decision executed, not one sitting
   flushed.
5. **The message tells the story.** A subject in the house voice, then a
   body that records what changed, *why*, what was measured (counts,
   rulings, test totals), and what was deliberately left undone. Commit
   messages are the third place history lives, after the ledger and the
   docs — and they are the only one that cannot be edited later. Rulings
   are quoted, not paraphrased. End with the session's co-author trailer.
6. **Push the branch and open a PR.** The PR body says what it carries and
   why — every commit accounted for, especially ones that are not yours
   (see below). Then stop.
7. **Howell merges. Howell deletes branches. Howell syncs to server.**
   The sessions never merge, never push to main, never deploy, never delete
   a branch. A PR is a message TO Howell; the merge is his reply. Server
   sync happens only on his explicit word, and it is his word per-instance —
   approval of one sync approves nothing later.
8. **Assume the merge happened** (Howell, 2026-08-02: *"I usually merge and
   close your PRs as soon as you give me the link. It's unusual if I don't,
   so you can generally assume that I have."*). So do not stall waiting for
   confirmation, and do not ask whether to continue — carry on with the next
   piece of work. Still SYNC before building on it (step 1): assuming the
   merge is not the same as knowing the tip, and a `git pull` costs nothing.

## The rules with teeth

- **Never `git branch -D`. Only `-d`.** When `-d` refuses, that refusal is
  information about the other session's unmerged work — read it, never
  override it. This rule was paid for: twelve of Wilbur's commits survived
  a `-D` only because the object store had not been pruned (see the W-29
  recovery note).
- **The stranded-work rule.** If another session's commits sit unmerged on
  a local branch and your work builds on them, branch FROM their tip so one
  PR carries both to main. Their commits ride your PR unaltered and are
  named in its body. Never leave a sibling's work stranded; never rebase,
  squash, amend, or otherwise rewrite a commit you did not author.
- **A disagreeing number is evidence.** A test count, a verse total, a file
  count that does not match the other session's report means one of you
  knows something — stop and find out which, before committing anything on
  top of the discrepancy.
- **No commits outside the task's mandate.** A standing "proceed" on a task
  covers branch commits for that task and nothing else. When the tree holds
  changes you did not make, that is the other session's bench — hands off,
  and say so in the ledger if it blocks you.

## Why this routine and not another

The PR is where the two-session model becomes safe. Each session's work
arrives as a reviewable, revertible unit with its reasoning attached;
Howell rules on the merge with the whole story in front of him, the same
way he rules at the bench; and main only ever moves by his hand. The
alternative — sessions committing to main, or merging each other — has a
failure mode we have already met once, and once was enough.
