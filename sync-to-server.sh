#!/bin/bash

# Sync wheel (v3) to catalog, bible, calendar, and places deployments
# Catalog deploys to mmdm.it root (public_html/mmdm/)
# Other volumes deploy to wheel-v3 subdirectories
# Usage: ./sync-to-server.sh [catalog|bible|calendar|places|both|all]
#
# Note: this script was temporarily locked on 2026-02-26 while a black-screen
# regression (commit 52cb891) was diagnosed and reverted. Unlocked at v3.8.41.

SERVER="namecheap"
REMOTE_BASE="~/public_html/mmdm/wheel-v3"
REMOTE_CATALOG="~/public_html/mmdm"
LOCAL_PATH="$(pwd)/"

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
    
    # Sync files (excluding git, node_modules, docs, etc.)
    rsync -avz --delete \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='node_modules' \
        --exclude='.DS_Store' \
        --exclude='*.swp' \
        --exclude='*.log' \
        --exclude='docs/' \
        --exclude='sync-to-server.sh' \
        --exclude='bump-version.sh' \
        --exclude='CHANGELOG.md' \
        --exclude='README.md' \
        --exclude='src/' \
        --exclude='*.map' \
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
    both)
        sync_deployment "catalog"
        echo ""
        echo "────────────────────────────────────────────────────"
        echo ""
        sync_deployment "bible"
        ;;
    *)
        echo -e "${RED}❌ Invalid deployment: $DEPLOYMENT${NC}"
        echo ""
        echo "Usage: ./sync-to-server.sh [catalog|bible|calendar|places|both|all]"
        echo ""
        echo "Examples:"
        echo "  ./sync-to-server.sh            # Sync all (default)"
        echo "  ./sync-to-server.sh catalog    # Sync MMdM catalog only"
        echo "  ./sync-to-server.sh bible      # Sync Bible only"
        echo "  ./sync-to-server.sh calendar   # Sync Calendar dev dataset only"
        echo "  ./sync-to-server.sh places     # Sync Deep Places test volume"
        echo "  ./sync-to-server.sh both       # Sync MMdM catalog and Bible"
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
