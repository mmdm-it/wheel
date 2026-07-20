#!/bin/bash

# Sync wheel (v3) to catalog, bible, calendar, and places deployments
# Catalog deploys to mmdm.it root (public_html/mmdm/)
# Other volumes deploy to wheel-v3 subdirectories
# Usage: ./sync-to-server.sh [catalog|bible|calendar|places|staging|all]
#
# Note: this script was temporarily locked on 2026-02-26 while a black-screen
# regression (commit 52cb891) was diagnosed and reverted. Unlocked at v3.8.41.

# Pin the project's node (system node is v10 and cannot run the ESM build
# scripts — this bit the C.2 deploy).
export PATH="$HOME/.nvm/versions/node/v18.20.8/bin:$PATH"

SERVER="namecheap"
REMOTE_BASE="~/public_html/mmdm/wheel-v3"
REMOTE_CATALOG="~/public_html/mmdm"
# Anchored to the script's directory — running from elsewhere must not sync
# a different tree (Phase B audit, M2).
LOCAL_PATH="$(cd "$(dirname "$0")" && pwd)/"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build the bundle before syncing
echo -e "${BLUE}📦 Building dist/app.js ...${NC}"
npm run build 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Aborting sync.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build complete${NC}"

# Function to sync to a specific deployment
sync_deployment() {
    local deployment=$1
    local remote_path
    local url
    
    # Catalog deploys to mmdm.it root, others to wheel-v3 subdirectories
    if [ "$deployment" = "catalog" ]; then
        remote_path="${REMOTE_CATALOG}/"
        url="https://mmdm.it/"
    else
        remote_path="${REMOTE_BASE}/${deployment}/"
        url="https://mmdm.it/wheel-v3/${deployment}/"
    fi
    
    echo -e "${BLUE}🚀 Syncing to ${deployment} deployment...${NC}"
    echo "   Local:  $LOCAL_PATH"
    echo "   Remote: $SERVER:$remote_path"
    echo ""
    
    # Per-deployment data exclusions — only ship the data that volume needs.
    # NOTE: the catalog deployment MUST include data/gutenberg — the Gutenberg
    # easter egg (gateway to the Bible volume) runs from the catalog site and
    # fetches gutenberg data relative to it. A stale excluded copy caused
    # English testament names in production (v3.10.0 era).
    local data_excludes=()
    case "$deployment" in
        catalog)
            # calendar data ships with the catalog: the Gregorio XIII gateway needs it.
            # The catalog syncs to the PARENT of the other deployments
            # (~/public_html/mmdm/): wheel-v3/ must be protected or
            # --delete/--delete-excluded wipes the bible/calendar/places
            # deployments (this happened, 2026-07-17). 'P' = protect from
            # deletion; the exclude keeps it out of the transfer.
            data_excludes=(--exclude='data/places/' --exclude='wheel-v3/' --filter='P wheel-v3/') ;;
        bible)
            data_excludes=(--exclude='data/mmdm/' --exclude='data/places/' --exclude='data/calendar/') ;;
        calendar)
            data_excludes=(--exclude='data/mmdm/' --exclude='data/gutenberg/' --exclude='data/places/') ;;
        places)
            data_excludes=(--exclude='data/mmdm/' --exclude='data/gutenberg/' --exclude='data/calendar/') ;;
        staging)
            # Full tree, every volume's data: the Phase C server-feel test bed.
            data_excludes=() ;;
    esac

    # Sync files (excluding git, node_modules, docs, etc.)
    rsync -avz --delete --delete-excluded \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='node_modules' \
        --exclude='.DS_Store' \
        --exclude='*.swp' \
        --exclude='*.log' \
        --exclude='docs/' \
        --exclude='data/calendar/sources/' \
        --exclude='sync-to-server.sh' \
        --exclude='bump-version.sh' \
        --exclude='CHANGELOG.md' \
        --exclude='README.md' \
        --exclude='src/' \
        --exclude='*.map' \
        "${data_excludes[@]}" \
        "$LOCAL_PATH" "$SERVER:$remote_path"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${deployment} sync complete!${NC}"
        echo -e "   URL: $url"
        return 0
    else
        echo -e "${RED}❌ ${deployment} sync failed!${NC}"
        return 1
    fi
}

# Parse command line argument
DEPLOYMENT=${1:-all}

echo ""
echo "════════════════════════════════════════════════════"
echo "  Wheel v3 - Server Sync"
echo "════════════════════════════════════════════════════"
echo ""

case $DEPLOYMENT in
    catalog)
        sync_deployment "catalog"
        ;;
    bible)
        sync_deployment "bible"
        ;;
    calendar)
        sync_deployment "calendar"
        ;;
    places)
        sync_deployment "places"
        ;;
    staging)
        sync_deployment "staging"
        ;;
    all)
        sync_deployment "catalog"
        echo ""
        echo "────────────────────────────────────────────────────"
        echo ""
        sync_deployment "bible"
        echo ""
        echo "────────────────────────────────────────────────────"
        echo ""
        sync_deployment "calendar"
        echo ""
        echo "────────────────────────────────────────────────────"
        echo ""
        sync_deployment "places"
        ;;
    *)
        echo -e "${RED}❌ Invalid deployment: $DEPLOYMENT${NC}"
        echo ""
        echo "Usage: ./sync-to-server.sh [catalog|bible|calendar|places|staging|all]"
        echo ""
        echo "Examples:"
        echo "  ./sync-to-server.sh            # Sync all (default)"
        echo "  ./sync-to-server.sh catalog    # Sync MMdM catalog only"
        echo "  ./sync-to-server.sh bible      # Sync Bible only"
        echo "  ./sync-to-server.sh calendar   # Sync Calendar dev dataset only"
        echo "  ./sync-to-server.sh places     # Sync Deep Places test volume"
        echo "  ./sync-to-server.sh all        # Sync catalog, Bible, calendar, and places"
        exit 1
        ;;

esac

echo ""
echo "════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Deployment complete!${NC}"
echo "════════════════════════════════════════════════════"
echo ""
echo "URLs:"
echo "  ⚙️  Catalog: https://mmdm.it/"
echo "  📚 Bible:    https://mmdm.it/wheel-v3/bible/"
echo "  📅 Calendar: https://mmdm.it/wheel-v3/calendar/"
echo "  🧭 Places:   https://mmdm.it/wheel-v3/places/"
echo ""

# Prior-art evidence trail: archive the public deployments ONCE PER RELEASED
# VERSION (Howell 2026-07-20) — each capture is an edition, not a redeploy,
# so the archive's timeline stays one layer per version for future
# archaeology (and we lean on Save Page Now no more than we release).
# Non-fatal; SNAPSHOT=0 skips, SNAPSHOT=force re-snapshots a same-version
# redeploy. State lives in .snapshot-version (untracked, local).
SNAPSHOT_STATE="${LOCAL_PATH}.snapshot-version"
DEPLOYED_VERSION=$(grep '"version"' "${LOCAL_PATH}package.json" | head -n1 | sed 's/.*"version": "\([0-9.]*\)".*/\1/')
LAST_SNAPSHOT_VERSION=""
[ -f "$SNAPSHOT_STATE" ] && LAST_SNAPSHOT_VERSION=$(cat "$SNAPSHOT_STATE")
if [ "${SNAPSHOT:-1}" != "0" ] && { [ "$DEPLOYMENT" = "catalog" ] || [ "$DEPLOYMENT" = "all" ]; }; then
    if [ "$DEPLOYED_VERSION" != "$LAST_SNAPSHOT_VERSION" ] || [ "${SNAPSHOT:-1}" = "force" ]; then
        bash "$(dirname "$0")/scripts/archive-snapshot.sh" || true
        echo "$DEPLOYED_VERSION" > "$SNAPSHOT_STATE"
    else
        echo "📸 Snapshot skipped — v$DEPLOYED_VERSION already archived (SNAPSHOT=force to override)"
    fi
fi
