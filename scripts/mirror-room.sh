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
#     scripts/mirror-room.sh public  LEICESTER SQUARE — see below
#     scripts/mirror-room.sh root    THE CALENDAR'S PUBLIC DOOR — see below
#
# THE THIRD DOOR IS NOT THE ROOM (2026-11-08). bibliacatholica.com is the
# Bible's public address (O-137's Leicester Square; the engine's VENUES table
# already names it as a door at the bare slash). It is the same copy the
# room's bible door gets — the engine and the filtered corpus, nothing else —
# sent to that domain's document root instead. It is never in the default
# run: a public deploy is deliberate, named on the command line, on Howell's
# word, the target said back first. Its document root keeps cPanel's cgi-bin
# and the certificate client's .well-known, which the sync must not delete.
#
# THE PUBLIC DOOR'S OWN HEAD. The tree's index.html carries the catalog's
# title, description and link-preview tags, written for the root of mmdm.it;
# the app retitles the tab once it runs, but a crawler and a share card read
# the static head. The public door therefore gets the page stamped by
# scripts/stamp-door-head.mjs, sent over the tree's copy after the engine
# pass. The root keeps the page's own head: it is that site's.
#
# THE FOURTH DOOR IS THE ROOT OF mmdm.it (O-211; opened 2026-11-10 on
# Howell's "I'm ready to go live with the calendar on mmdm.it"). The calendar
# stands at the root of its server, where the archival catalog stood from
# July to November 2026 (a copy of that is kept on the server at
# ~/site-backups/mmdm-root-2026.11.10, and it lives in git). The root is the
# PARENT of the room: wheel-v3/ must be protected or --delete wipes the room's
# doors (this happened on 2026-07-17). The catalog's own data folders
# (data/mmdm, data/gutenberg's old layout) are removed by name once the
# calendar's data is in place — the engine pass protects data/ as a whole.
#
# The Bible's data goes through scripts/deploy-pd-filter.mjs first (O-231).
# Data goes by CHECKSUM (-c): build-volume and precompress rewrite every
# .gz's mtime, and a plain -a would re-send the whole corpus each time.
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${ROOM_REMOTE:-namecheap:~/public_html/mmdm/wheel-v3}"
PUBLIC_REMOTE="${PUBLIC_REMOTE:-namecheap:~/bibliacatholica.com}"
ROOT_REMOTE="${ROOT_REMOTE:-namecheap:~/public_html/mmdm}"
DRY=()
DOORS=(bible calendar)
for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRY=(-n) ;;
    bible|calendar|public|root) DOORS=("$arg") ;;
    *) echo "mirror-room: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

# A PUBLIC ROOT NEEDS HOWELL'S SAFE WORD (2026-11-11, his ruling: "I want
# deploys to the public server that is the root for each website (I'm not
# talking about the screening room) to be a decision made by me and
# authorized by me using a unique safe word"). The word lives outside both
# repositories in ~/.config/wheel/public-word, his to set; the public and
# root doors refuse without PUBLIC_WORD=<word> on the command, and refuse
# everything while the file is missing or empty. The room's doors need none.
WORD_FILE="${HOME}/.config/wheel/public-word"
for door in "${DOORS[@]}"; do
  if [[ "$door" == public || "$door" == root ]]; then
    if [[ ! -s "$WORD_FILE" ]]; then echo "mirror-room: $door REFUSED — Howell's safe word is not set ($WORD_FILE)" >&2; exit 3; fi
    if [[ "${PUBLIC_WORD:-}" != "$(head -n1 "$WORD_FILE" | tr -d '\r\n')" ]]; then echo "mirror-room: $door REFUSED — a public root is Howell's decision, spoken in his safe word (PUBLIC_WORD)" >&2; exit 3; fi
  fi
done

# Where each door lives and the address that proves what it serves.
target() { case "$1" in public) echo "$PUBLIC_REMOTE/" ;; root) echo "$ROOT_REMOTE/" ;; *) echo "$REMOTE/$1/" ;; esac; }
address() { case "$1" in public) echo "https://bibliacatholica.com/" ;; root) echo "https://mmdm.it/" ;; *) echo "https://mmdm.it/wheel-v3/$1/" ;; esac; }

# The public deploy's excludes, kept in step with sync-to-server.sh, plus:
# no data in the engine pass (it goes by door below), and the data already
# there is protected from --delete-excluded.
EX=(
  --exclude='.git' --exclude='.gitignore' --exclude='.claude/' --exclude='node_modules'
  --exclude='.DS_Store' --exclude='*.swp' --exclude='*.log'
  --exclude='docs/' --exclude='art/' --exclude='src/' --exclude='*.map'
  --exclude='sync-to-server.sh' --exclude='bump-version.sh'
  --exclude='CHANGELOG.md' --exclude='README.md' --exclude='scripts/.scratch/'
  --exclude='data/' --filter='P data/'
  --exclude='crops'   # a workspace symlink, not the app's
)

if [[ ! -f dist/app.js || dist/app.js -ot src/main.js ]]; then
  echo "mirror-room: dist/app.js is missing or older than src/main.js — run npm run build first" >&2
  exit 1
fi

# The Church's volume version is the engine's own declaration, read rather
# than repeated, so a new cargo version cannot leave the mirror behind.
CHURCH_VOLUME_VERSION="$(sed -n "s/^const CHURCH_VOLUME_VERSION = '\([^']*\)';$/\1/p" src/volume-configs.js)"
[[ -n "$CHURCH_VOLUME_VERSION" ]] || { echo "mirror-room: src/volume-configs.js declares no CHURCH_VOLUME_VERSION" >&2; exit 1; }

# The copies that leave — the cleared corpus, the calendar without its
# notes, the public door's page — are made here and gone at exit.
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

for door in "${DOORS[@]}"; do
  DEST="$(target "$door")"
  KEEP=()
  [[ "$door" == public ]] && KEEP=(--exclude='cgi-bin/' --filter='P cgi-bin/' --exclude='.well-known/' --filter='P .well-known/')
  # THE MANIFEST IS THE BIBLE'S (O-285): it names Biblia Catholica and the
  # crown, so the calendar's door does not carry it.
  [[ "$door" == calendar ]] && KEEP+=(--exclude='manifest.webmanifest')
  # THE ROOT IS THE ROOM'S PARENT: the room's directory is protected, and the
  # manifest is the Bible's here too.
  [[ "$door" == root ]] && KEEP+=(--exclude='wheel-v3/' --filter='P wheel-v3/' --exclude='manifest.webmanifest')
  echo "== $door: engine → $DEST"
  rsync -az -i --delete --delete-excluded "${DRY[@]}" "${EX[@]}" "${KEEP[@]}" ./ "$DEST"
  case "$door" in
    bible|public)
      # THE CLEARED GATE (O-231): the room gets the filtered copy, never
      # data/gutenberg itself — only the versioned folder the engine reads,
      # nothing uncleared ("No uncleared edition should ever leave the LAN"),
      # and none of the declaration, naming kits or staging. The filter
      # refuses, and the mirror stops, if an uncleared code survives.
      node scripts/deploy-pd-filter.mjs data/gutenberg "$WORK/gutenberg"
      echo "== $door: the cleared copy of data/gutenberg/ (checksum)"
      # A fresh document root has no data/ yet, and the host's rsync (3.1.3)
      # cannot make two levels at once (the public door's first deploy,
      # 2026-11-10, stopped here with the engine up and no data beside it).
      [[ ${#DRY[@]} -eq 0 ]] && ssh "${DEST%%:*}" "mkdir -p ${DEST#*:}data/gutenberg"
      rsync -azc -i --delete "${DRY[@]}" "$WORK/gutenberg/" "${DEST}data/gutenberg/"
      # THE CHURCH RIDES THE BIBLE'S DOOR (O-292), AND THE CHURCH IS THE
      # CATECHISM (O-299): a second volume of the Bible's own shape, so it
      # leaves through the same cleared gate, from its own root and under its
      # own version (the filter's default is the Bible's). The calendar's
      # days, which this door carried for the Church until then, are removed
      # by name: the Church no longer reads them, and the calendar has a door
      # of its own.
      node scripts/deploy-pd-filter.mjs data/catechism "$WORK/catechism" "$CHURCH_VOLUME_VERSION"
      echo "== $door: the cleared copy of data/catechism/ (checksum)"
      [[ ${#DRY[@]} -eq 0 ]] && ssh "${DEST%%:*}" "mkdir -p ${DEST#*:}data/catechism"
      rsync -azc -i --delete "${DRY[@]}" "$WORK/catechism/" "${DEST}data/catechism/"
      if [[ ${#DRY[@]} -eq 0 ]]; then
        ssh "${DEST%%:*}" "rm -rf ${DEST#*:}data/calendar"
      fi
      if [[ "$door" == public ]]; then
        echo "== $door: the page with the door's own head"
        node scripts/stamp-door-head.mjs public index.html "$WORK/index.html"
        rsync -az -i "${DRY[@]}" "$WORK/index.html" "${DEST}index.html"
      fi ;;
    calendar|root)
      # THE NOTES STAY ON THE LAN (2026-11-10): the calendar's data goes
      # through scripts/scrub-notes.mjs, which drops every `_` key (the
      # corpus's reasons, quoting Howell) and leaves sources/ behind.
      node scripts/scrub-notes.mjs data/calendar "$WORK/calendar"
      echo "== $door: data/calendar/ without its notes (checksum)"
      [[ ${#DRY[@]} -eq 0 ]] && ssh "${DEST%%:*}" "mkdir -p ${DEST#*:}data/calendar"
      rsync -azc -i --delete "${DRY[@]}" "$WORK/calendar/" "${DEST}data/calendar/"
      if [[ "$door" == root && ${#DRY[@]} -eq 0 ]]; then
        echo "== $door: the archival catalog's data folders come down"
        ssh "${ROOT_REMOTE%%:*}" "rm -rf ${ROOT_REMOTE#*:}/data/mmdm ${ROOT_REMOTE#*:}/data/gutenberg"
      fi ;;
  esac
done

if [[ ${#DRY[@]} -eq 0 ]]; then
  local_sha=$(sha256sum dist/app.js | cut -c1-16)
  for door in "${DOORS[@]}"; do
    served=$(curl -s "$(address "$door")dist/app.js" | sha256sum | cut -c1-16)
    [[ "$served" == "$local_sha" ]] && echo "== $door serves the local bundle ($local_sha)" || { echo "== $door serves $served, local is $local_sha — NOT the same" >&2; exit 1; }
  done
fi
