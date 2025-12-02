#!/bin/bash
# Sync local wheel directory to Namecheap server
# Usage: ./sync-to-server.sh [--dry-run]

LOCAL_DIR="/media/howell/dev_workspace/wheel/"
REMOTE_HOST="namecheap"
REMOTE_DIR="~/public_html/mmdm/wheel/"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for dry-run flag
DRY_RUN=""
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN="--dry-run"
    echo -e "${YELLOW}DRY RUN - No files will be transferred${NC}"
fi

echo -e "${GREEN}Syncing to howellgibbens.com/mmdm/wheel...${NC}"

rsync -rltvz $DRY_RUN \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'git_token' \
    --exclude '*.sh' \
    --exclude 'old/' \
    --exclude 'archive/' \
    --exclude '*.xcf' \
    --exclude '.DS_Store' \
    "$LOCAL_DIR" "${REMOTE_HOST}:${REMOTE_DIR}"

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}Sync complete!${NC}"
    echo "View at: https://howellgibbens.com/mmdm/wheel/"
else
    echo "Sync failed!"
    exit 1
fi
