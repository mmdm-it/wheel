# Workflow Agreement

Every change, no matter how small, bumps the patch version. The process:

1. **Change + Patch Bump**
   - Apply the code/doc change.
   - Run `./bump-version.sh patch "<message>"` to bump `package.json` version and create a git commit + tag.

2. **Sync & Test**
   - Run `./sync-to-server.sh` to deploy to production (rsync to howellgibbens.com).
   - Test on the live URL or local dev server (`python3 -m http.server 8080`).

3. **Iterate**
   - Each subsequent change repeats this cycle with another patch bump.
   - Minor bumps (e.g., 3.7 → 3.8) mark feature boundaries.

Notes
- Changes are described clearly so outcomes can be validated.
- Dev server runs from the workspace root or wheel-v3/ directory.
- Production URLs: `https://howellgibbens.com/mmdm/wheel-v3/{catalog,bible,calendar,places}/`
