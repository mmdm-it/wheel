# Version Management

## Overview

Wheel uses semantic versioning (MAJOR.MINOR.PATCH) synchronized across three files:
- `mobile/mobile-config.js` - Source of truth for the version number
- `README.md` - User-facing documentation (2 locations)
- `CHANGELOG.md` - Version history with detailed changes

## Bumping Versions

Use the `bump-version.sh` script to automatically update all version references:

```bash
# Bump patch version (0.8.106 → 0.8.107)
./bump-version.sh patch

# Bump patch with changelog note
./bump-version.sh patch "Fixed rotation bug"

# Bump minor version (0.8.106 → 0.9.0)
./bump-version.sh minor "Added new animation system"

# Bump major version (0.8.106 → 1.0.0)
./bump-version.sh major "First stable release"
```

## What the Script Does

1. **Increments version** in `mobile/mobile-config.js`
2. **Updates README.md** version strings (both header and footer)
3. **Adds new entry** to CHANGELOG.md with current date
4. **Prompts you** to add detailed changes if not provided

## Manual Workflow (Not Recommended)

If you need to manually update versions:

1. Edit `mobile/mobile-config.js`:
   ```javascript
   const VERSION = {
       semantic: '0.8.XXX',
   ```

2. Edit `README.md` (2 places):
   ```markdown
   **Version 0.8.XXX** | December 2025
   ```

3. Add to `CHANGELOG.md`:
   ```markdown
   ## [0.8.XXX] - 2025-12-06
   
   ### Changed
   - Your changes here
   ```

## After Bumping

1. **Review changes**: `git diff`
2. **Edit CHANGELOG**: Add detailed change notes if you only provided a quick note
3. **Commit**: `git add -A && git commit -m "Bump version to vX.X.X"`
4. **Tag** (optional): `git tag v0.8.XXX && git push --tags`

## Version Drift Prevention

The script prevents version drift by updating all three files atomically. Never manually edit version numbers in individual files - always use the script to keep them synchronized.

## Current Version

Check current version:
```bash
grep "semantic:" mobile/mobile-config.js
```

Or in the browser console when running the app:
```javascript
console.log(VERSION.display());
```
