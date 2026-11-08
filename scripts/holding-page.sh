#!/usr/bin/env bash
# THE HOLDING PAGE at bibliacatholica.com (Howell 2026-11-08: "I'm not ready
# to sync the app, but I don't want to see an empty root directory ... It can
# simply be the splash page from the app itself. The portrait page with the
# crown of thorns and the name.") One static page — scripts/holding/index.html,
# the app's own card at the overture's proportions — and the two images it
# needs, copied from the corpus's served assets (the crown, the home-screen
# icon as favicon). Nothing else goes up. `mirror-room.sh public` replaces it
# with the app itself the day Howell says so.
#
#     scripts/holding-page.sh        put the page up (or refresh it)
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="${PUBLIC_REMOTE:-namecheap:~/bibliacatholica.com}"
ASSETS="$(ls -d data/gutenberg/2*/assets | tail -1)"
rsync -az -i scripts/holding/index.html "$ASSETS/crown_of_thorns.png" "$ASSETS/icon-192.png" "$REMOTE/"
curl -s -o /dev/null -w "https://bibliacatholica.com/ %{http_code} %{size_download} bytes\n" https://bibliacatholica.com/
