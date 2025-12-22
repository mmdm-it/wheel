#!/bin/bash

# Sync wheel-v3 to catalog, bible, and calendar deployments
# Usage: ./sync-to-server.sh [catalog|bible|calendar|both|all]

SERVER="namecheap"
REMOTE_BASE="~/public_html/mmdm/wheel-v3"
LOCAL_PATH="/media/howell/dev_workspace/wheel-v3/"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to sync to a specific deployment
sync_deployment() {
    local deployment=$1
    local remote_path="${REMOTE_BASE}/${deployment}/"
    
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
        "$LOCAL_PATH" "$SERVER:$remote_path"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${deployment} sync complete!${NC}"
        echo -e "   URL: https://howellgibbens.com/mmdm/wheel-v3/${deployment}/"
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
        echo "Usage: ./sync-to-server.sh [catalog|bible|calendar|both|all]"
        echo ""
        echo "Examples:"
        echo "  ./sync-to-server.sh            # Sync all (default)"
        echo "  ./sync-to-server.sh catalog    # Sync MMdM catalog only"
        echo "  ./sync-to-server.sh bible      # Sync Bible only"
        echo "  ./sync-to-server.sh calendar   # Sync Calendar dev dataset only"
        echo "  ./sync-to-server.sh both       # Sync MMdM catalog and Bible"
        echo "  ./sync-to-server.sh all        # Sync catalog, Bible, and calendar"
        exit 1
        ;;

esac

echo ""
echo "════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Deployment complete!${NC}"
echo "════════════════════════════════════════════════════"
echo ""
echo "URLs:"
echo "  📚 Bible:   https://howellgibbens.com/mmdm/wheel-v3/bible/"
echo "  ⚙️  Catalog: https://howellgibbens.com/mmdm/wheel-v3/catalog/"
echo "  📅 Calendar: https://howellgibbens.com/mmdm/wheel-v3/calendar/"
echo ""
