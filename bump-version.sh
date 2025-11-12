#!/bin/bash
# bump-version.sh
# Automatically increment semantic version in mobile-config.js
# Usage: ./bump-version.sh [major|minor|patch]
# Default: patch

FILE="mobile/mobile-config.js"

# Extract current semantic version
CURRENT_SEMANTIC=$(grep "semantic:" "$FILE" | sed "s/.*'\([0-9.]*\)'.*/\1/")

# Parse semantic version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_SEMANTIC"

# Handle semantic version bump
BUMP_TYPE="${1:-patch}"  # Default to patch

if [ "$BUMP_TYPE" == "major" ]; then
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
elif [ "$BUMP_TYPE" == "minor" ]; then
    MINOR=$((MINOR + 1))
    PATCH=0
else  # patch (default)
    PATCH=$((PATCH + 1))
fi

NEW_SEMANTIC="$MAJOR.$MINOR.$PATCH"

# Update file using temp file (for filesystems that don't support sed -i)
TEMP_FILE="${FILE}.tmp"
sed "s/semantic: '[0-9.]*'/semantic: '$NEW_SEMANTIC'/" "$FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"

echo "Version bumped to v$NEW_SEMANTIC"
