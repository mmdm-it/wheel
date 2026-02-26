# Branching and Versioning Strategy

## Overview
The active GitHub repository is `mmdm-it/wheel`, with v3.x on `main` and releases tracked by tags.

## Branches
- `main`: active development for the current major (v3.x).
- Feature branches: short-lived branches opened as pull requests into `main`.
- No `master` branch and no long-lived `archive/v*` branches in the active repo.
- Future: when v4 starts, branch from the final v3 tag and continue release tags on the new line.

## Tags
- Release tags use SemVer: `v3.4.13`, `v3.4.0`, etc.
- Old releases remain discoverable by tag history.

## Folder Layout
- Repo root contains the active codebase (no versioned subfolders).
- Historical majors (v0/v1/v2) are maintained outside the active v3 repo (archived folders/repos), not as active branches.

## Docs
- Forward-looking specs (e.g., `ARCHITECTURE_V4.md`) remain as future plans even while the repo ships v3.x.
- Roadmap tracks the current major in `docs/ROADMAP.md`.

## CI/CD
- CI validates pull requests and `main`; required checks gate merges to protected `main`.
- Deploy scripts should reference repo-root paths and the current major’s public endpoint (now `wheel-v3`).

## Migration Notes
- Package name is `wheel`; current version is on the v3.x track (see `package.json`).
- Deploy script `sync-to-server.sh` uses `wheel-v3` endpoints; adjust hosting paths when v4 begins.
