# The git routine — standard for both sessions

**Ruled by Howell, 2026-08-02:** *"I like the way you handle commits and
merges... Let's make your routine standard across both sessions."* Written
by Orville; binding on Orville and Wilbur alike, in this repo and in cargo.

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
