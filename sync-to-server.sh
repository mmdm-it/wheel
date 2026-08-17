#!/bin/bash

# Sync wheel (v3) to catalog, bible, calendar, and places deployments
# Catalog deploys to mmdm.it root (public_html/mmdm/)
# Other volumes deploy to wheel-v3 subdirectories
# Usage: ./sync-to-server.sh [catalog|bible|calendar|places|staging|all]
#
# Note: this script was temporarily locked on 2026-02-26 while a black-screen
# regression (commit 52cb891) was diagnosed and reverted. Unlocked at v3.8.41.

# ─── PUBLISHING IS HOWELL'S ACT, AND ONLY HIS (O-60, 2026-08-15) ────────────
#
# This script puts files on a public web server. It had no confirmation, no
# dry run, and — worst — NO REQUIRED ARGUMENT: a bare `./sync-to-server.sh`
# meant `all`, which built and rsync'd four deployments to production with
# --delete. Our own WORKFLOW.md recommended exactly that bare form. One stray
# invocation — a tab-complete and a return, a script, an agent session doing
# as it was told — published.
#
# Three locks, cheapest first:
#
#   1. A TERMINAL IS REQUIRED. An agent session, a cron job, a pipeline and a
#      CI runner all have no tty; a person at a keyboard does. This is the
#      lock that needs nobody to remember anything, and it is checked before
#      the build so a refusal costs nothing.
#   2. THE TARGET MUST BE NAMED. No argument is now usage-and-exit. The old
#      default was the most destructive option available, which is exactly
#      backwards.
#   3. THE TARGET MUST BE TYPED BACK. Deployment is not a thing to agree to
#      by reflex, and a prompt answered `y` out of habit is not a decision.
#
# None of this defends against someone determined to publish — that is not the
# threat. The threat is publishing by accident, and accident is what these
# three refuse.
if [ ! -t 0 ] || [ ! -t 1 ]; then
    echo "REFUSING: no terminal." >&2
    echo "  Publishing is a human act performed at a keyboard (O-60)." >&2
    echo "  This script will not run from an agent session, a script, cron or CI." >&2
    echo "  If you meant to deploy, run it yourself in a terminal." >&2
    exit 1
fi

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

# The build used to run HERE, before the target was even named. It now runs
# after confirmation (O-60): nothing should happen — not even a local
# rebuild — until a person has said which deployment they mean and typed it
# back. Ordering a script so its cheapest refusal comes first is free.

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
    
    # THE APP SYNC SHIPS NO DATA (2026-07-26, W-11 leak fix). The common rsync
    # below excludes ALL of data/ and PROTECTS it from deletion. Data — the
    # copyrighted-text-stripped gutenberg included — reaches the server ONLY
    # through sync-data-to-server.sh, which runs the PD deploy filter. Before
    # this, the app sync shipped the LOCAL (unfiltered) data/ with
    # --delete-excluded and would OVERWRITE the filtered corpus with
    # copyrighted text — an end-run around the whole W-11 protection.
    # The per-deployment excludes below are now redundant for data (data/ is
    # globally excluded) but the catalog's wheel-v3 PROTECT stays: it guards
    # the sibling deployments from --delete-excluded when the catalog syncs to
    # their parent dir (~/public_html/mmdm/).
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
        # art/ is WORKING MATERIAL and never reached the app (2026-08-17).
        # It was rsync'd to the web root by omission: 4.6MB of sketches and
        # source files publicly fetchable, including a watermarked stock
        # image that had no business being served. The app needed exactly
        # one file from here — the QR — which now lives in assets/ with the
        # other runtime art. Same reasoning as the data sync's drafts
        # exclusion: reserved working material has no business on a public
        # server, and the way to guarantee that is to not send it.
        --exclude='art/' \
        --exclude='data/calendar/sources/' \
        --exclude='data/' \
        --filter='P data/' \
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

# Parse command line argument. NO DEFAULT (O-60): the old `${1:-all}` made a
# bare invocation deploy everything.
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ No deployment named.${NC}" >&2
    echo "" >&2
    echo "Usage: ./sync-to-server.sh <catalog|bible|calendar|places|staging|all>" >&2
    echo "" >&2
    echo "There is deliberately no default — this script publishes to a public" >&2
    echo "server, and the target is stated rather than assumed (O-60)." >&2
    exit 1
fi
DEPLOYMENT=$1

# THE TARGET IS TYPED BACK, not agreed to. A y/n prompt is answered by reflex;
# typing "bible" is not something a hand does on the way past.
echo ""
echo -e "${YELLOW}About to publish '${DEPLOYMENT}' to the PUBLIC server (${SERVER}).${NC}"
echo    "This overwrites what is live and deletes what is not in the local tree."
printf  "Type the deployment name to confirm: "
read -r CONFIRM
if [ "$CONFIRM" != "$DEPLOYMENT" ]; then
    echo -e "${RED}❌ Not confirmed ('${CONFIRM}' ≠ '${DEPLOYMENT}'). Nothing was sent.${NC}" >&2
    exit 1
fi

# Build only now — confirmed target, then work.
echo ""
echo -e "${BLUE}📦 Building dist/app.js ...${NC}"
if ! npm run build 2>&1; then
    echo -e "${RED}❌ Build failed. Aborting sync.${NC}" >&2
    exit 1
fi
echo -e "${GREEN}✅ Build complete${NC}"

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
