# Workflow Agreement

Every change — code or JSON data — goes through the full gate sequence below
before the version is bumped or anything is committed.  The version bump marks
a *verified* state, not an attempted one.

---

## Gate Sequence

### 1. Make the Change
- Edit source files or `data/mmdm/mmdm_catalog.json` as needed.
- Run `npm run build` to produce a fresh `dist/app.js`.
- Run `npm test` — all tests must pass before proceeding.

### 2. Laptop Browser Test (Live Server)
- Start the LAN server if not already running:
  ```
  nohup python3 -m http.server 8080 --bind 0.0.0.0 \
    --directory /media/howell/dev_workspace/wheel-v3 \
    >/tmp/wheelv3-http.log 2>&1 &
  ```
- Open `http://127.0.0.1:8080/` in the laptop browser.
- Verify: page loads (no black screen), wheel renders, magnifier visible,
  basic navigation works.

### 3. LAN Phone Test (iPhone X + Moto G 2025)
- On both devices open `http://192.168.88.167:8080/`
  (force-refresh to clear cached bundle: long-press reload or hard-refresh).
- **Minimum checklist — must pass on both phones:**
  - [ ] Page loads — gray background visible, wheel nodes rendered
  - [ ] Magnifier shows correct initial item (Volvo Penta)
  - [ ] Tap a manufacturer → navigates IN (cylinder level appears)
  - [ ] Parent button visible and tap navigates OUT
  - [ ] IN/OUT migration animation plays (nodes slide, no pop/jump)
  - [ ] Detail sector opens when a leaf node is at the magnifier
- **iPhone X extras** (WebKit-specific regressions):
  - [ ] Animation translates + rotates in sync (no lag between the two)
  - [ ] No "pop" to final position (rAF timing guard)
- Stop here and fix if anything fails.  Do not bump.

### 4. Bump Version
- Once all gates pass:
  ```
  ./bump-version.sh patch "<one-line description of change>"
  ```
- The script will ask **9 yes/no questions** before touching any files.
  Answer `n` to any of them and it aborts — go fix the gap and re-run.
  The questions mirror the gate sequence above:
  1. Live Server (laptop browser)
  2. Chrome on iPhone X — LAN URL
  3. Opera on iPhone X — LAN URL
  4. DuckDuckGo on iPhone X — LAN URL
  5. Safari on iPhone X — LAN URL
  6. Chrome on Moto G 2025 — LAN URL
  7. Firefox on Moto G 2025 — LAN URL
  8. DuckDuckGo on Moto G 2025 — LAN URL
  9. Browser on Kyocera E4830NC — LAN URL
- After all 9 `y` answers the script updates `package.json`, `README.md`,
  and `CHANGELOG.md`.
- Run `npm run build` once more so `dist/app.js` embeds the new version.

### 5. Commit and Push
- Stage only the intended files (never `git add .` blindly):
  ```
  git add <changed files> package.json README.md CHANGELOG.md dist/app.js
  git commit -m "<type>: <summary>"
  git push origin HEAD
  ```
- Open a pull request into `main`; merge after required checks pass.

### 6. Sync to Server
- Pull latest `main` after merge:
  ```
  git checkout main && git pull --ff-only origin main
  ```
- Deploy:
  ```
  ./sync-to-server.sh
  ```
- Spot-check at `https://howellgibbens.com/mmdm/` on at least one phone.

---

## Rules

- **Test before you bump.** A version number marks a verified state.
- **One topic per commit.** Code fix, data change, and doc update can be
  separate commits if they're independent.
- **Both phones, every UI change.** iPhone X catches WebKit regressions.
  Moto G catches Android/Chrome regressions.  A fix that breaks one of them
  is not done.
- **JSON data changes follow the same gates** as code changes — a bad
  catalog can cause a black screen just as surely as bad JS.
- Minor bumps (e.g., 3.8 → 3.9) mark feature boundaries; patch bumps
  cover everything else.
