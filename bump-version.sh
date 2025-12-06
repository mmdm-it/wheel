#!/bin/bash
# bump-version.sh
# Automatically increment semantic version across all project files
# Usage: ./bump-version.sh [major|minor|patch] ["Optional changelog entry"]
# Default: patch

set -e  # Exit on error

CONFIG_FILE="mobile/mobile-config.js"
README_FILE="README.md"
CHANGELOG_FILE="CHANGELOG.md"

# Extract current semantic version
CURRENT_SEMANTIC=$(grep "semantic:" "$CONFIG_FILE" | sed "s/.*'\([0-9.]*\)'.*/\1/")

# Parse semantic version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_SEMANTIC"

# Handle semantic version bump
BUMP_TYPE="${1:-patch}"  # Default to patch
CHANGELOG_NOTE="${2:-}"   # Optional changelog entry

if [ "$BUMP_TYPE" == "major" ]; then
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
elif [ "$BUMP_TYPE" == "minor" ]; then
    MINOR=$((MINOR + 1))
    PATCH=0
elif [ "$BUMP_TYPE" == "patch" ]; then
    PATCH=$((PATCH + 1))
else
    echo "Error: Invalid bump type. Use 'major', 'minor', or 'patch'"
    exit 1
fi

NEW_SEMANTIC="$MAJOR.$MINOR.$PATCH"
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_MONTH=$(date +"%B %Y")

echo "Bumping version: $CURRENT_SEMANTIC → $NEW_SEMANTIC"
echo "Date: $CURRENT_DATE"

# 1. Update mobile-config.js
echo "Updating $CONFIG_FILE..."
TEMP_FILE="${CONFIG_FILE}.tmp"
sed "s/semantic: '[0-9.]*'/semantic: '$NEW_SEMANTIC'/" "$CONFIG_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CONFIG_FILE"

# 2. Update README.md (both occurrences)
echo "Updating $README_FILE..."
TEMP_FILE="${README_FILE}.tmp"
sed "s/\*\*Version [0-9.]*\*\* |/\*\*Version $NEW_SEMANTIC\*\* |/" "$README_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$README_FILE"

# 3. Add entry to CHANGELOG.md
echo "Updating $CHANGELOG_FILE..."
# Create the new changelog entry
NEW_ENTRY="## [$NEW_SEMANTIC] - $CURRENT_DATE\n\n"
if [ -n "$CHANGELOG_NOTE" ]; then
    NEW_ENTRY="${NEW_ENTRY}### Changed\n- $CHANGELOG_NOTE\n\n"
else
    NEW_ENTRY="${NEW_ENTRY}### Changed\n- (Add changes here)\n\n"
fi

# Insert after the [Unreleased] section
TEMP_FILE="${CHANGELOG_FILE}.tmp"
awk -v new_entry="$NEW_ENTRY" '
    /^## \[Unreleased\]/ {
        print;
        # Skip blank lines and content until next ## heading
        while (getline > 0 && !/^## \[/) {
            print;
        }
        # Print the new entry
        printf "%s", new_entry;
        # Print the line we read (next version heading)
        if (NF > 0) print;
        next;
    }
    { print }
' "$CHANGELOG_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CHANGELOG_FILE"

echo ""
echo "✅ Version bumped to v$NEW_SEMANTIC"
echo ""
echo "Updated files:"
echo "  - $CONFIG_FILE"
echo "  - $README_FILE"
echo "  - $CHANGELOG_FILE"
echo ""
echo "⚠️  Next steps:"
if [ -z "$CHANGELOG_NOTE" ]; then
    echo "  1. Edit $CHANGELOG_FILE to add detailed changes for v$NEW_SEMANTIC"
fi
echo "  2. Review the changes: git diff"
echo "  3. Commit: git add -A && git commit -m 'Bump version to v$NEW_SEMANTIC'"
echo ""
