# Plan: Make v3 the primary codebase

This repo has two unrelated histories: legacy v1/v2 on `main` and the new v3 code on branch `v3` (directory `wheel-v3/`). Use this plan to move `main` to v3 while keeping history.

## Steps (local git)
1. Ensure you have both histories:
   ```bash
   git fetch origin main v3
   ```
2. Create a merge branch that bridges the histories:
   ```bash
   git checkout -b merge/v3-into-main origin/main
   git merge --allow-unrelated-histories origin/v3
   ```
   - If you want main to exactly match v3, prefer "theirs" on conflicts: `git checkout --theirs .` then `git add .`.
3. Resolve any remaining conflicts, then commit:
   ```bash
   git commit
   ```
4. Push and open a PR into `main`:
   ```bash
   git push -u origin merge/v3-into-main
   # Open PR: base=main, compare=merge/v3-into-main
   ```
5. After merge, retag v3 release (currently 3.0.2) on `main` and delete the merge branch.

## Repo settings (GitHub)
- Switch default branch to `v3` (or to `main` after it matches v3).
- Optionally lock/archive the legacy state (tag `legacy-v2`) before merge.

## Optional: keep `main` archived
If you prefer not to merge histories, keep `main` as legacy and set default branch to `v3`. Add a repository topic/tag noting v3 is the active branch.
