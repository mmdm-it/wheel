# Branching and Versioning Strategy

## Overview
We keep one repo with branches and tags per major. Old majors are archived; the active major lives on the default branch.

## Branches
- `main` (or `master`): active development for the current major (now v3.x).
- `archive/v0`, `archive/v1`, `archive/v2`: frozen branches holding historical majors.
- `v3-main` (optional alias): tracks the v3 line if you prefer a dedicated branch name.
- Future: when v4 starts, branch from the last v3 tag to `v4-main` (or keep using `main` after tagging `v3.last`).

## Tags
- Release tags use SemVer: `v3.4.11`, `v3.4.0`, etc.
- Old releases keep their tags on the archive branches (`v1.4.2`, etc.).

## Folder Layout
- Repo root contains the active codebase (no versioned subfolders).
- Historical branches keep their own layouts as imported; no new versioned folders will be created.

## Docs
- Forward-looking specs (e.g., `ARCHITECTURE_V4.md`) remain as future plans even while the repo ships v3.x.
- Roadmap tracks the current major in `docs/ROADMAP.md`.

## CI/CD
- CI runs on `main` only; archive branches are excluded or marked skip.
- Deploy scripts should reference repo-root paths and the current major’s public endpoint (now `wheel-v3`).

## Migration Notes
- Package name is `wheel`; current version is `3.4.11` (v3.x track).
- Deploy script `sync-to-server.sh` uses `wheel-v3` endpoints; adjust hosting paths when v4 begins.
