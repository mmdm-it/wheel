#!/bin/bash
# sync-data-to-server.sh
# Push a volume's DATA to every deployment that carries it — without touching
# the engine. The data-side counterpart to sync-to-server.sh, in the same way
# bump-data-version.sh is the counterpart to bump-version.sh.
#
# Usage:
#   ./sync-data-to-server.sh <volume> [--dry-run]
#
#   volume : mmdm | gutenberg | calendar | places | all
#
# Examples:
#   ./sync-data-to-server.sh gutenberg --dry-run
#   ./sync-data-to-server.sh gutenberg
#   ./sync-data-to-server.sh all
#
# Env:
#   INCLUDE_STAGING=1   also push to the staging deployment
#
# What this does NOT do, on purpose: no esbuild bundle, no dist/app.js, no
# index.html, no src/. Deploying the engine stays with sync-to-server.sh.
# It also does not archive a Save Page Now snapshot — that ritual is tied to a
# released app version, not to a data edit.

set -euo pipefail

# Pin the project's node (system node is v10 and cannot run the ESM build
# scripts — this bit the C.2 deploy).
export PATH="$HOME/.nvm/versions/node/v18.20.8/bin:$PATH"

SERVER="namecheap"
# Anchored to the script's directory — running from elsewhere must not sync
# a different tree (Phase B audit, M2).
LOCAL_PATH="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ── Volume → the deployments whose data/ carries it ──────────────────────────
# A volume can live in more than one deployment. The Bible is the case that
# bites: data/gutenberg ships to the catalog too, because the Gutenberg easter
# egg (gateway to the Bible volume) runs from the catalog site and fetches
# gutenberg data relative to it. A stale excluded copy caused English testament
# names in production (v3.10.0 era). Syncing by VOLUME rather than by
# deployment is what keeps those copies from drifting apart.
declare -A VOLUME_DEPLOYMENTS=(
  [mmdm]="catalog"
  [gutenberg]="catalog bible"
  [calendar]="catalog calendar"
  [places]="places"
)
ALL_VOLUMES=(mmdm gutenberg calendar places)

# ── Deployment → remote data directory ───────────────────────────────────────
# Note these point at <deployment>/data, never at the deployment root. The
# catalog deploys to the PARENT of the other deployments (~/public_html/mmdm/),
# so a root-level --delete there once wiped the bible/calendar/places
# deployments (2026-07-17). Targeting data/<volume>/ directly puts that
# accident out of reach: wheel-v3/ is never inside the transfer.
declare -A DEPLOY_DATA_DIR=(
  [catalog]="~/public_html/mmdm/data"
  [bible]="~/public_html/mmdm/wheel-v3/bible/data"
  [calendar]="~/public_html/mmdm/wheel-v3/calendar/data"
  [places]="~/public_html/mmdm/wheel-v3/places/data"
  [staging]="~/public_html/mmdm/wheel-v3/staging/data"
)

# ── Argument parsing ─────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Usage: ./sync-data-to-server.sh <volume> [--dry-run]" >&2
  echo "  volume : mmdm | gutenberg | calendar | places | all" >&2
  exit 1
fi

VOLUME="$1"; shift
DRY_RUN=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    *) echo "Error: unknown option '$arg'." >&2; exit 1 ;;
  esac
done

if [[ "$VOLUME" == "all" ]]; then
  TARGETS=("${ALL_VOLUMES[@]}")
elif [[ -n "${VOLUME_DEPLOYMENTS[$VOLUME]+x}" ]]; then
  TARGETS=("$VOLUME")
else
  echo "Error: unknown volume '$VOLUME'. Use: mmdm | gutenberg | calendar | places | all" >&2
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  Wheel v3 — Data Sync${DRY_RUN:+  (DRY RUN)}"
echo "════════════════════════════════════════════════════"
echo ""

# ── Regenerate derived data artifacts ────────────────────────────────────────
# Two kinds of data in this tree are BUILD OUTPUT, gitignored, and must never
# ship stale next to a hand-edited source:
#   - data/mmdm/catalog-lite.json + catalog-prose.json  (split-catalog.mjs)
#   - *.json.gz siblings, which .htaccess serves in place of the .json to any
#     client that accepts gzip (precompress-json.mjs)
# A stale .gz is the dangerous one: the server would keep serving yesterday's
# verses to every real browser while curl showed today's. precompress skips
# files under 2048 bytes, so a .json that SHRANK past that line would keep an
# orphaned .gz forever. Deleting every .gz before regenerating makes the set
# provably consistent rather than incrementally correct.
echo -e "${BLUE}🧮 Regenerating derived data (splits + gzip siblings)...${NC}"
node "$LOCAL_PATH/scripts/split-catalog.mjs"
find "$LOCAL_PATH/data" -name '*.json.gz' -delete
node "$LOCAL_PATH/scripts/precompress-json.mjs"
echo -e "${GREEN}✅ Derived data current${NC}"
echo ""

# ── Helper: report what version is about to ship ─────────────────────────────
declare -A VOLUME_FILE=(
  [mmdm]="data/mmdm/mmdm_catalog.json"
  [gutenberg]="data/gutenberg/manifest.json"
  [calendar]="data/calendar/manifest.json"
  [places]="data/places/manifest.json"
)

sync_volume() {
  local volume=$1
  local manifest="$LOCAL_PATH/${VOLUME_FILE[$volume]}"
  local data_version="(unknown)"
  [[ -f "$manifest" ]] && data_version=$(grep '"volume_data_version"' "$manifest" | head -n1 | sed 's/.*: *"\([^"]*\)".*/\1/')

  # Per-volume exclusions.
  #   calendar/sources — 31MB of scanned wall-calendar source material, never fetched.
  #   mmdm/drafts      — 194 unreviewed manufacturer drafts (1.3MB) read only by
  #                      scripts/merge-mmdm-manufacturer.mjs. The engine never
  #                      fetches them; they are reserved working material and
  #                      have no business on a public server.
  local excludes=()
  case "$volume" in
    calendar) excludes=(--exclude='sources/') ;;
    mmdm)     excludes=(--exclude='drafts/') ;;
  esac

  echo -e "${YELLOW}▸ ${volume}${NC}  volume_data_version: ${data_version}"

  local deployments="${VOLUME_DEPLOYMENTS[$volume]}"
  [[ "${INCLUDE_STAGING:-0}" == "1" ]] && deployments="$deployments staging"

  for deployment in $deployments; do
    local remote="${DEPLOY_DATA_DIR[$deployment]}/${volume}/"
    echo -e "${BLUE}  🚀 → ${deployment}${NC}  ${SERVER}:${remote}"

    # --delete --delete-excluded is scoped to this one volume directory, so the
    # blast radius is data/<volume>/ and nothing else.
    rsync -avz --delete --delete-excluded $DRY_RUN \
      --exclude='.DS_Store' \
      --exclude='*.swp' \
      "${excludes[@]}" \
      "$LOCAL_PATH/data/${volume}/" "$SERVER:$remote"

    if [ $? -eq 0 ]; then
      echo -e "${GREEN}  ✅ ${volume} → ${deployment}${NC}"
    else
      echo -e "${RED}  ❌ ${volume} → ${deployment} FAILED${NC}"
      return 1
    fi
    echo ""
  done
}

for volume in "${TARGETS[@]}"; do
  sync_volume "$volume"
done

echo "════════════════════════════════════════════════════"
if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}🔍 Dry run — nothing was transferred.${NC}"
else
  echo -e "${GREEN}✨ Data sync complete!${NC}"
fi
echo "════════════════════════════════════════════════════"
echo ""
echo "URLs:"
echo "  ⚙️  Catalog: https://mmdm.it/"
echo "  📚 Bible:    https://mmdm.it/wheel-v3/bible/"
echo "  📅 Calendar: https://mmdm.it/wheel-v3/calendar/"
echo "  🧭 Places:   https://mmdm.it/wheel-v3/places/"
echo ""
echo "Data only — the engine on those URLs is whatever sync-to-server.sh last shipped."
echo ""
