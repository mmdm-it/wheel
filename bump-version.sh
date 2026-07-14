#!/bin/bash
# bump-version.sh
# Increment semantic version across wheel project files
# Usage: ./bump-version.sh [major|minor|patch] ["Optional changelog entry"]
# Default bump: patch

set -euo pipefail

PACKAGE_FILE="package.json"
README_FILE="README.md"
CHANGELOG_FILE="CHANGELOG.md"

# Ensure changelog exists with the house header
if [ ! -f "$CHANGELOG_FILE" ]; then
  printf '# Changelog\n' > "$CHANGELOG_FILE"
fi

# Extract current version from package.json
CURRENT_VERSION=$(grep '"version"' "$PACKAGE_FILE" | head -n1 | sed 's/.*"version": "\([0-9.]*\)".*/\1/')

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

BUMP_TYPE="${1:-patch}"
CHANGELOG_NOTE="${2:-}"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor)
    MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch)
    PATCH=$((PATCH + 1)) ;;
  *)
    echo "Error: Invalid bump type. Use 'major', 'minor', or 'patch'" >&2
    exit 1 ;;

esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
CURRENT_DATE=$(date +%Y-%m-%d)

# ── Pre-release checklist ─────────────────────────────────────────────────────
ask() {
  local prompt="$1"
  local answer
  printf "%s [y/n] " "$prompt"
  read -r answer
  case "$answer" in
    [Yy]) return 0 ;;
    *)
      echo "Aborted. Re-run after completing all checks."
      exit 1 ;;
  esac
}

echo ""
echo "── Pre-release gates (v$CURRENT_VERSION → v$NEW_VERSION, $BUMP_TYPE) ──"
echo "   Gate details: WORKFLOW.md · device roster: TESTINGSETUP.local.md"
ask "1. Laptop live server: smoke checklist passed on the affected volume(s)?"
ask "2. WebKit device (primary browser): smoke checklist + regression watchpoints passed?"
ask "3. Blink device (primary browser): smoke checklist passed?"
if [ "$BUMP_TYPE" != "patch" ]; then
  ask "4. Full device matrix (all browsers per TESTINGSETUP.local.md) passed?"
fi
echo "All gates attested. Bumping version..."
echo ""
# ─────────────────────────────────────────────────────────────────────────────

echo "Bumping version: $CURRENT_VERSION → $NEW_VERSION"

echo "Updating $PACKAGE_FILE..."
TMP_PKG="${PACKAGE_FILE}.tmp"
sed "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_FILE" > "$TMP_PKG"
mv "$TMP_PKG" "$PACKAGE_FILE"

if grep -q "Current Version" "$README_FILE"; then
  echo "Updating $README_FILE..."
  TMP_README="${README_FILE}.tmp"
  # Replace only the version line directly under "## Current Version".
  # (An unanchored sed here once rewrote every "- v*" line in the README.)
  awk -v ver="$NEW_VERSION" -v date="$CURRENT_DATE" '
    prev == "## Current Version" && /^- v/ { print "- v" ver " (" date ")"; prev = $0; next }
    { print; prev = $0 }
  ' "$README_FILE" > "$TMP_README"
  mv "$TMP_README" "$README_FILE"
fi

echo "Updating $CHANGELOG_FILE..."
# Insert the new entry directly under the "# Changelog" header, newest first,
# in the hand-maintained house style: "## X.Y.Z — title".
# (The old version keyed on "## [X.Y.Z]" headings, which no longer exist at
# the top of the file, so entries were appended to the bottom.)
TMP_CL="${CHANGELOG_FILE}.tmp"
awk -v ver="$NEW_VERSION" -v note="${CHANGELOG_NOTE:-(describe this release)}" '
  { print }
  !inserted && /^# Changelog/ {
    print ""
    print "## " ver " \342\200\224 " note
    inserted = 1
  }
' "$CHANGELOG_FILE" > "$TMP_CL"
mv "$TMP_CL" "$CHANGELOG_FILE"

echo ""
echo "✅ Version bumped to v$NEW_VERSION"
echo "Updated files: $PACKAGE_FILE, $CHANGELOG_FILE${CHANGELOG_NOTE:+ (with note)}${README_FILE:+, $README_FILE}"
echo "Next steps:"
echo "  - Review changes: git diff"
echo "  - Commit: git add -A && git commit -m 'v$NEW_VERSION: ${CHANGELOG_NOTE:-Version bump}'"
echo "  - Tag: git tag v$NEW_VERSION"
echo ""
