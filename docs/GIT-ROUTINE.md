# The git routine

*Last audited: 2026-08-25 by Orville — Q4 (does it use vocabulary a later
ruling abolished?). One finding, applied: this document was written for two
sessions and half its front matter was corrections about the wall between
them. Howell retired the second session on 2026-08-25 (O-99), so the wall
paragraphs are struck rather than re-corrected — they described a mechanism
that no longer exists. The history stays in this file's git log, which is
where a retired mechanism belongs. The routine itself is unchanged: it was
always good git practice that happened to be written in coordination
language.*

**Ruled by Howell, 2026-08-02:** *"I like the way you handle commits and
merges... Let's make your routine standard across both sessions."* It now
runs in one session across both repositories, which changes nothing about
the steps.

> **THE WALL BETWEEN THE SESSIONS IS GONE (O-99, 2026-08-25).** This section
> carried three layers of correction about who could commit where, when the
> engine was Orville's and the data repository was Wilbur's and access
> between them was read-only. None of that binds any more. **One session
> commits to both repositories.**
>
> What survives, because it was never about the sessions: the two
> repositories are still separate, one public and one not, and that boundary
> is enforced by what gets committed where. And the sharpest thing the old
> correction taught, kept because it generalises — a local guard judges the
> SPELLING of a command, not the act, so it stops a habit and never a
> determination. Anything that must actually be prevented is prevented
> server-side or not at all.

The routine exists because two repositories move together and Howell owns the
tree. None of it is git advice; it is coordination doctrine that happens to
run through git.
doctrine that happens to run through git.

## The shape of the routine

1. **Sync before touching anything.** `git fetch --all --prune`, read what
   moved, and read the ledger before designing. Work begun on a stale tip is
   work that collides with what has already landed.
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

- **Never `git branch -D`. Only `-d`.** When `-d` refuses, the refusal is
  telling you something is unmerged that you have forgotten — read it, never
  override it. This rule was paid for: twelve commits survived a `-D` only
  because the object store had not been pruned yet (see the W-29 recovery
  note). One session makes this MORE dangerous, not less: there is no longer
  a second party who would notice their work missing.
- **The stranded-work rule.** If commits sit unmerged on a local branch and
  your work builds on them, branch FROM that tip so one PR carries both to
  main. They ride your PR unaltered and are named in its body. Never leave
  earlier work stranded; never rebase, squash, amend, or otherwise rewrite a
  commit you did not author — which now includes every commit the retired
  session left behind.
- **A disagreeing number is evidence.** A test count, a verse total, a file
  count that does not match what a document or an earlier report says means
  one of them knows something you do not — stop and find out which, before
  committing anything on top of the discrepancy.
- **No commits outside the task's mandate.** A standing "proceed" on a task
  covers branch commits for that task and nothing else. When the tree holds
  changes you did not make, they are Howell's — hands off, and say so if
  they block you. The untracked file in the working tree is not yours to
  commit, move, or tidy.

## Why this routine and not another

The PR is where an agent working unattended becomes safe. Work arrives as a
reviewable, revertible unit with its reasoning attached; Howell rules on the
merge with the whole story in front of him, the same way he rules at the
bench; and main only ever moves by his hand.

**This matters MORE now, not less.** The old argument for it was that two
sessions might collide. That reason is gone and the better one remains: the
PR is the only place a human sees what an agent decided before it becomes
the project's history. One session working across both repositories with no
peer looking over its shoulder is exactly the arrangement in which nothing
should reach main unread.
