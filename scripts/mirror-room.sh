#!/usr/bin/env bash
# THE ROOM'S MIRROR (O-137, O-211).
#
# The screening room at mmdm.it/wheel-v3/ is the LAN reached over the
# internet: a mirror of this tree, no filter, no exclusion list beyond the
# public deploy's own (the Italian is withheld in the corpus, W-266, so the
# two trees are the same tree). It has TWO DOORS (O-211), each a full copy
# of the engine with the one volume's data beside it:
#
#     bible/      the Bible      data/gutenberg/
#     calendar/   the calendar   data/calendar/
#
# Both are pushed by this one script from this one tree, so they can never
# again drift apart as they did between July and October 2026, when only
# the Bible's door was in the routine and the calendar's bundle sat three
# months behind. A room sync runs on Howell's word ("you may sync to server
# at any time upon my command", O-137), the target named back first.
#
# The public deploy's script (sync-to-server.sh) is NOT this: its lock
# guards Leicester Square and the catalog; this is the room alone.
#
#     scripts/mirror-room.sh -n      dry run, both doors, itemised
#     scripts/mirror-room.sh         the mirror
#     scripts/mirror-room.sh bible   one door
#
# Data goes by CHECKSUM (-c): build-volume and precompress rewrite every
# .gz's mtime, and a plain -a would re-send the whole corpus each time.
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${ROOM_REMOTE:-namecheap:~/public_html/mmdm/wheel-v3}"
DRY=()
DOORS=(bible calendar)
for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRY=(-n) ;;
    bible|calendar) DOORS=("$arg") ;;
    *) echo "mirror-room: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

# The public deploy's excludes, kept in step with sync-to-server.sh, plus:
# no data in the engine pass (it goes by door below), and the data already
# there is protected from --delete-excluded.
EX=(
  --exclude='.git' --exclude='.gitignore' --exclude='.claude/' --exclude='node_modules'
  --exclude='.DS_Store' --exclude='*.swp' --exclude='*.log'
  --exclude='docs/' --exclude='art/' --exclude='src/' --exclude='*.map'
  --exclude='sync-to-server.sh' --exclude='bump-version.sh'
  --exclude='CHANGELOG.md' --exclude='README.md'
  --exclude='data/' --filter='P data/'
)

if [[ ! -f dist/app.js || dist/app.js -ot src/main.js ]]; then
  echo "mirror-room: dist/app.js is missing or older than src/main.js — run npm run build first" >&2
  exit 1
fi

for door in "${DOORS[@]}"; do
  echo "== $door: engine → $REMOTE/$door/"
  rsync -az -i --delete --delete-excluded "${DRY[@]}" "${EX[@]}" ./ "$REMOTE/$door/"
  case "$door" in
    bible)
      echo "== $door: data/gutenberg/ (checksum)"
      rsync -azc -i --delete "${DRY[@]}" data/gutenberg/ "$REMOTE/$door/data/gutenberg/" ;;
    calendar)
      echo "== $door: data/calendar/ (checksum, without sources/)"
      rsync -azc -i --delete "${DRY[@]}" --exclude='sources/' data/calendar/ "$REMOTE/$door/data/calendar/" ;;
  esac
done

if [[ ${#DRY[@]} -eq 0 ]]; then
  local_sha=$(sha256sum dist/app.js | cut -c1-16)
  for door in "${DOORS[@]}"; do
    served=$(curl -s "https://mmdm.it/wheel-v3/$door/dist/app.js" | sha256sum | cut -c1-16)
    [[ "$served" == "$local_sha" ]] && echo "== $door serves the local bundle ($local_sha)" || { echo "== $door serves $served, local is $local_sha — NOT the same" >&2; exit 1; }
  done
fi
