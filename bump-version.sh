#!/bin/bash
# bump-version.sh
# Increment semantic version across wheel-v4 project files
# Usage: ./bump-version.sh [major|minor|patch] ["Optional changelog entry"]
# Default bump: patch

set -euo pipefail

PACKAGE_FILE="package.json"
README_FILE="README.md"
CHANGELOG_FILE="CHANGELOG.md"

# Ensure changelog exists with Unreleased header
if [ ! -f "$CHANGELOG_FILE" ]; then
  cat > "$CHANGELOG_FILE" <<'EOF'
# Changelog

## [Unreleased]
EOF
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

echo "Bumping version: $CURRENT_VERSION → $NEW_VERSION"

echo "Updating $PACKAGE_FILE..."
TMP_PKG="${PACKAGE_FILE}.tmp"
sed "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_FILE" > "$TMP_PKG"
mv "$TMP_PKG" "$PACKAGE_FILE"

if grep -q "Current Version" "$README_FILE"; then
  echo "Updating $README_FILE..."
  TMP_README="${README_FILE}.tmp"
  # Replace the version marker on the Current Version line while preserving any date text
  sed "s/- v[0-9.\-]*/- v$NEW_VERSION/" "$README_FILE" > "$TMP_README"
  mv "$TMP_README" "$README_FILE"
fi

echo "Updating $CHANGELOG_FILE..."
NEW_ENTRY="## [$NEW_VERSION] - $CURRENT_DATE\n\n### Changed\n"
if [ -n "$CHANGELOG_NOTE" ]; then
  NEW_ENTRY+="- $CHANGELOG_NOTE\n\n"
else
  NEW_ENTRY+="- (Add changes here)\n\n"
fi

TMP_CL="${CHANGELOG_FILE}.tmp"
awk -v new_entry="$NEW_ENTRY" '
  BEGIN { inserted=0 }
  /^## \[Unreleased\]/ {
    print; next
  }
  inserted==0 && /^## \[/ {
    print new_entry; inserted=1
  }
  { print }
  END { if (inserted==0) print "\n" new_entry }
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
