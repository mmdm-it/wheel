# Workflow Agreement

Every change — code or JSON data — goes through the gate sequence below
before the version is bumped or anything is committed. The version bump marks
a *verified* state, not an attempted one.

**How this document stays current.** It contains only principles and
procedure, layered by how fast they change:

- The **gate sequence, smoke checklist, and rules** are near-permanent and
  volume-agnostic. If a line here names a specific dataset, device, or bug,
  that line is in the wrong place.
- **Decisions, and how they become work** is likewise near-permanent. The gate
  sequence governs a *change*; that section governs a *decision* — how a ruling
  becomes work and how work stays visible until it is done.
- **Environment specifics** (LAN server commands, IPs, URLs, the device
  roster) live in `TESTINGSETUP.local.md` — untracked, private, expected to
  change freely.
- **Regression watchpoints** (below) are explicitly temporal. Each entry is
  pruned once it is covered by an automated test or has stayed clean for
  three consecutive releases. That section is *supposed* to shrink.

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

- **Push and PR are one action.** Never push a branch without opening its PR in
  the same breath. A branch with no PR is invisible: it cannot be reviewed,
  cannot be merged, and does not appear on any list either session reads. This
  is the single cheapest rule here and it prevents the worst failure.
  (Who may merge, and branch shape: `docs/GIT-ROUTINE.md`.)

- **A ruling gets a number the hour it is made.** Every decision earns a W- or
  O- number and a line in the handoff ledger at the moment it is ruled, before
  any document is edited. Specifications then describe the end state; the
  numbered item is what makes someone responsible for reaching it. Numbered
  work survives here. Unnumbered decisions evaporate, and a specification
  section describing something unimplemented with no numbered item behind it is
  an orphan by definition.

- **A deferral must name what it makes provisional.** "Not yet" is only half a
  ruling. The other half is what the ruling has *already invalidated* in the
  meantime. A deferred decision that does not name its casualties silently
  authorises work it has superseded, and that work will look productive right
  up until the moment it is discarded.

- **Every session opens with the board.** Before any work: open PRs oldest
  first, and branches carrying commits with no PR. One command, read aloud in
  the first response. Idle PRs are not merely slow — they go stale in the wrong
  order and are superseded by later idle PRs.

- **A PR that supersedes another says so in its first line.** Supersession is
  invisible in a list of PR titles, which is exactly what lets them be merged in
  an order that makes no sense.

- **The read-back.** When a ruling is made, it is read back with its number and
  its provisional casualties named, and confirmed, before work continues. The
  first two rules are mechanical and belong to whoever is at the keyboard; this
  one needs both parties, because it happens at the moment of the decision.

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
