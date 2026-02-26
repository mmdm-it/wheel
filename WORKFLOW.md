# Workflow Agreement

Every change, no matter how small, bumps the patch version. The process:

1. **Change + Patch Bump**
   - Apply the code/doc change.
   - Run `./bump-version.sh patch "<message>"` to bump `package.json` version and create a git commit + tag.

2. **Local Verify**
   - Run `npm test` (and `npm run build` when relevant).
   - Test on local dev server (`python3 -m http.server 8080`) when UI behavior changed.

3. **GitHub PR Flow**
   - Push your feature branch.
   - Open a pull request into `main`.
   - Merge only after required checks pass (protected `main`).

4. **Sync & Test**
   - Pull latest `main` after merge.
   - Run `./sync-to-server.sh` to deploy using local team config.
   - Test on the live URL.

5. **Iterate**
   - Each subsequent change repeats this cycle with another patch bump.
   - Minor bumps (e.g., 3.7 → 3.8) mark feature boundaries.

Notes
- Changes are described clearly so outcomes can be validated.
- Dev server runs from the workspace root or wheel-v3/ directory.
- Production URLs are maintained in local team runbooks.
