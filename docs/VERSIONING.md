# Versioning Policy

This document is the single source of truth for how the Wheel project names
versions, directories, and releases. It exists because the project's early
history produced an off-by-one confusion between directory names and the
version names used *inside* those directories. That confusion ends here.

---

## The three rules

1. **Directories are eras, not versions — and the archives are frozen.**
   `wheel-v0/`, `wheel-v1/`, and `wheel-v2/` are read-only archives. They are
   never edited, and no new versioned directory (`wheel-v4/`, etc.) will ever
   be created. `wheel-v3/` is the active repository, permanently.

2. **"Shipped" means a git tag.**
   A version exists when the full gate sequence in `WORKFLOW.md` has passed
   and `bump-version.sh` has run. The version bump marks a *verified* state,
   not an attempted one. Tags are `v3.*` on the current line; a future major
   line is tagged `v4.*` in this same repository, branched from the final
   `v3.*` tag.

3. **"Working on" has no version name.**
   Work in progress is simply `main` ahead of the last tag. A change earns
   its version number when it ships, not while it is being built. Never name
   a directory, branch-folder, or document after a version that has not
   shipped.

---

## Archive decoder ring

The archive directories predate these rules, and each one's internal
documentation refers to itself by a *different* version name than the
directory carries. When reading archived docs, translate as follows:

| Directory | Its docs call it | What it actually is |
|---|---|---|
| `wheel-v0/` | "v1" (the app), "v2" (the specs), "v3" (the seed) | The ancestral monorepo: the shipped v0.7–v0.8 mobile app (the 12,628-line monolith targeted at the bibliacatholica.org launch, Dec 2025), plus the v2 clean-rewrite specification effort, plus the initial v3 scaffold. `TODO.md` here is the legacy launch tracker referenced by `ROADMAP.md`. |
| `wheel-v1/` | "v2" (calls the v0 app "v1") | The first clean-rewrite attempt (Dec 16–21, 2025). Reached Phase 1 of 4 (Focus Ring only) before being abandoned. Contains the rotation-model experiments and the Hub-formula comparison docs. |
| `wheel-v2/` | "v3" (checked out on a `v3` branch) | The v2 design specs imported as the v3 baseline, plus the earliest v3 implementation (v3.0.1 → v3.2.16), including the v3.1 blur/secondary-stratum dimension experiment. The active repo was seeded from here at v3.2.17. |
| `wheel-v3/` | v3 | The active repository. Current line `v3.*`; see `README.md` for the current version. |

Rule of thumb: **every archive directory's internal version names are one
generation behind the directory number.** The "villain" of the rewrite
story (33 `!important` flags, "Strategy 1/2/3" patterns) is the shipped app
inside `wheel-v0/`, which its contemporaries called "v1".

---

## What "v4" means (and does not mean)

- The scaffolding in `src/core/` (interaction store, store-navigation
  bridge) and `src/adapters/types.js` is labeled "v4 architecture" in
  comments. This refers to the **next architecture generation**, not to a
  future directory or repository.
- When that architecture fully lands and ships, it is tagged as the next
  major version in this repository. No new folder, no new repo, no
  reseeding.
- **The `v4.*` tag namespace is already occupied by a historical artifact.**
  Between 2025-12-25 and 2025-12-27 the repo was briefly renumbered to 4.x
  ("initialize v4 data-agnostic fork", tags `v4.0.1` … `v4.2.11`) and then
  reverted ("Align repo to v3 naming and branching"). Those ten tags remain
  in `main`'s history between `v3.2.13` and `v3.4.12`. A future `v4.0.0`
  would sort below the existing `v4.2.11` and corrupt version ordering.
  Therefore: **the next major line is tagged `v5.*`**, unless the stale
  `v4.*` tags are first deliberately deleted from local and remote (a
  disruptive, opt-in cleanup — do not assume it has happened).
- Until then, "v4" appears only in architecture documents
  (`docs/ARCHITECTURE_V4.md`) as a design target for the architecture
  generation, detached from any future tag number.

---

## Historical note

Earlier majors were maintained as separate directories because the project
restarted its implementation twice (see the decoder ring above). Both clean
restarts proved costly — the first one failed outright — and the pattern of
reseeding from working code is what succeeded. The no-new-folders rule
exists so that future major versions evolve inside the living repository,
where the tests, workflow gates, and history come along for free.
