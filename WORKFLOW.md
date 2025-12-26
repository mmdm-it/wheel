# Workflow Agreement

You asked for a structured flow where every change, no matter how small, bumps the patch version, and we only commit/push after you sync and test. Here is the agreed process:

1. **Change + Patch Bump**
   - For each change (even trivial), update `package.json` patch version (x.y.z → x.y.(z+1)).
   - Apply the code/doc change in the same working set.

2. **Sync & Test (your step)
   - You sync the workspace to the server and run your tests/validation.
   - You confirm results back here.

3. **Commit & Push (my step)**
   - After your confirmation, I create a commit including the version bump and the change.
   - Push the commit and tag if appropriate.

Notes
- I will describe changes clearly so you can validate outcomes.
- No commits are made until you confirm tests have passed.
- Each subsequent change repeats this cycle with another patch bump.
