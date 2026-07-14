#!/bin/bash
# bump-data-version.sh
# Bump version fields inside a volume's JSON catalog or manifest file.
#
# Usage:
#   ./bump-data-version.sh <volume> <field> [major|minor|patch] ["note"]
#
#   volume : mmdm | gutenberg | calendar | places | all
#   field  : data   → sets volume_data_version to today's date (YYYY.MM.DD)
#            schema → bumps volume_schema_version semantically
#   For field=schema a bump type (major|minor|patch) is required.
#   note   : optional changelog entry
#
# Examples:
#   ./bump-data-version.sh mmdm data
#   ./bump-data-version.sh gutenberg schema minor
#   ./bump-data-version.sh all data "Added Ford models"

set -euo pipefail

# ── Volume → file path lookup ─────────────────────────────────────────────────
declare -A VOLUME_FILE=(
  [mmdm]="data/mmdm/mmdm_catalog.json"
  [gutenberg]="data/gutenberg/manifest.json"
  [calendar]="data/calendar/manifest.json"
  [places]="data/places/manifest.json"
)
ALL_VOLUMES=(mmdm gutenberg calendar places)

# ── Argument parsing ──────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  echo "Usage: ./bump-data-version.sh <volume> <field> [major|minor|patch] [\"note\"]" >&2
  echo "  volume : mmdm | gutenberg | calendar | places | all" >&2
  echo "  field  : data | schema" >&2
  exit 1
fi

VOLUME="$1"
FIELD="$2"
BUMP_TYPE="${3:-patch}"
CHANGELOG_NOTE="${4:-}"

if [[ "$FIELD" != "data" && "$FIELD" != "schema" ]]; then
  echo "Error: field must be 'data' or 'schema'." >&2
  exit 1
fi

if [[ "$FIELD" == "schema" ]]; then
  case "$BUMP_TYPE" in
    major|minor|patch) ;;
    *)
      echo "Error: bump type must be 'major', 'minor', or 'patch' when field=schema." >&2
      exit 1 ;;
  esac
fi

# Build list of volumes to process
if [[ "$VOLUME" == "all" ]]; then
  TARGETS=("${ALL_VOLUMES[@]}")
else
  if [[ -z "${VOLUME_FILE[$VOLUME]+x}" ]]; then
    echo "Error: unknown volume '$VOLUME'. Use: mmdm | gutenberg | calendar | places | all" >&2
    exit 1
  fi
  TARGETS=("$VOLUME")
fi

# ── Helper: read a version field from a JSON file ────────────────────────────
get_version() {
  local file="$1"
  local key="$2"
  grep "\"$key\"" "$file" | head -n1 | sed 's/.*: "\([^"]*\)".*/\1/'
}

# ── Helper: bump a semantic version string ───────────────────────────────────
bump_semver() {
  local version="$1"
  local bump="$2"
  # Strip any non-numeric suffix (e.g. "-dev") for arithmetic, warn if present
  local base="${version%%-*}"
  local suffix="${version#"$base"}"
  if [[ -n "$suffix" ]]; then
    echo "  Note: stripping non-release suffix '$suffix' from '$version'" >&2
  fi
  IFS='.' read -r major minor patch <<<"$base"
  major="${major:-0}"; minor="${minor:-0}"; patch="${patch:-0}"
  case "$bump" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac
  echo "$major.$minor.$patch"
}

# ── Helper: in-place replace a JSON string value (preserves file formatting) ─
set_json_string() {
  local file="$1"
  local key="$2"
  local newval="$3"
  python3 - "$file" "$key" "$newval" <<'PYEOF'
import sys, re

filepath, key, newval = sys.argv[1], sys.argv[2], sys.argv[3]
with open(filepath, 'r', encoding='utf-8') as fh:
    content = fh.read()

pattern = r'("' + re.escape(key) + r'"\s*:\s*)"[^"]*"'
replacement = r'\g<1>"' + newval + '"'
new_content, count = re.subn(pattern, replacement, content, count=1)

if count == 0:
    print(f"ERROR: key '{key}' not found in {filepath}", file=sys.stderr)
    sys.exit(1)

with open(filepath, 'w', encoding='utf-8') as fh:
    fh.write(new_content)
PYEOF
}

# ── Confirmation helper ───────────────────────────────────────────────────────
ask() {
  local prompt="$1"
  local answer
  printf "%s [y/n] " "$prompt"
  read -r answer
  case "$answer" in
    [Yy]) return 0 ;;
    *)
      echo "Aborted."
      exit 1 ;;
  esac
}

# ── Compute new values and show preview ──────────────────────────────────────
TODAY=$(date +%Y.%m.%d)
echo ""
echo "── Data version bump ──────────────────────────────────────────────────────"
echo "  Volume(s) : ${TARGETS[*]}"
echo "  Field     : $FIELD"
[[ "$FIELD" == "schema" ]] && echo "  Bump type : $BUMP_TYPE"
echo ""

declare -A NEW_VERSIONS=()
for vol in "${TARGETS[@]}"; do
  file="${VOLUME_FILE[$vol]}"
  if [[ ! -f "$file" ]]; then
    echo "Warning: file not found for volume '$vol': $file — skipping." >&2
    continue
  fi

  if [[ "$FIELD" == "data" ]]; then
    current=$(get_version "$file" "volume_data_version")
    new_ver="$TODAY"
    json_key="volume_data_version"
  else
    current=$(get_version "$file" "volume_schema_version")
    new_ver=$(bump_semver "$current" "$BUMP_TYPE")
    json_key="volume_schema_version"
  fi

  NEW_VERSIONS[$vol]="$new_ver"
  printf "  %-12s  %s  →  %s\n" "$vol" "$current" "$new_ver"
done

echo ""

# ── Checklist ────────────────────────────────────────────────────────────────
ask "1. Has the updated data been validated against the schema?"
ask "2. Has the app been tested with this volume loaded on the Live Server?"
ask "3. Is the change ready to commit?"
echo ""

# ── Apply changes ─────────────────────────────────────────────────────────────
CHANGELOG_FILE="CHANGELOG.md"
if [[ ! -f "$CHANGELOG_FILE" ]]; then
  printf "# Changelog\n\n## [Unreleased]\n" > "$CHANGELOG_FILE"
fi

CURRENT_DATE=$(date +%Y-%m-%d)

for vol in "${TARGETS[@]}"; do
  file="${VOLUME_FILE[$vol]:-}"
  new_ver="${NEW_VERSIONS[$vol]:-}"
  [[ -z "$file" || -z "$new_ver" ]] && continue

  echo "Updating $file ..."
  set_json_string "$file" "$json_key" "$new_ver"
done

# ── CHANGELOG update ──────────────────────────────────────────────────────────
FIELD_LABEL="$json_key"
VOL_LABEL="${TARGETS[*]}"
DEFAULT_NOTE="$FIELD_LABEL bump for: $VOL_LABEL"
ENTRY_NOTE="${CHANGELOG_NOTE:-$DEFAULT_NOTE}"

NEW_ENTRY="## [data-$TODAY] - $CURRENT_DATE\n\n### Data\n- $ENTRY_NOTE\n\n"
TMP_CL="${CHANGELOG_FILE}.tmp"
awk -v new_entry="$NEW_ENTRY" '
  BEGIN { inserted=0 }
  /^## \[Unreleased\]/ { print; next }
  inserted==0 && /^## \[/ { print new_entry; inserted=1 }
  { print }
  END { if (inserted==0) print "\n" new_entry }
' "$CHANGELOG_FILE" > "$TMP_CL"
mv "$TMP_CL" "$CHANGELOG_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "✅ Done. Updated field '$json_key' in: ${TARGETS[*]}"
[[ -n "$CHANGELOG_NOTE" ]] && echo "   Changelog note: $CHANGELOG_NOTE"
echo ""
echo "Next steps:"
echo "  git diff"
echo "  git add -A && git commit -m 'data($VOL_LABEL): $ENTRY_NOTE'"
echo ""
