#!/bin/bash

# archive-snapshot.sh — request Wayback Machine (Save Page Now) captures of
# the public Wheel deployments and the repository page.
#
# Why: third-party timestamps are the evidentiary backbone of the prior-art
# strategy (see docs/prior-art/). Each capture is an independent, dated
# record of what was public and when.
#
# Usage: ./scripts/archive-snapshot.sh
# Called automatically by sync-to-server.sh on catalog/all deploys
# (set SNAPSHOT=0 to skip). Anonymous SPN requests are rate-limited;
# failures are non-fatal by design — a missed snapshot never blocks a deploy.

URLS=(
    "https://mmdm.it/"
    "https://howellgibbens.com/mmdm/wheel-v3/bible/"
    "https://howellgibbens.com/mmdm/wheel-v3/calendar/"
    "https://github.com/mmdm-it/wheel"
)

echo "📸 Requesting Wayback Machine snapshots..."
for url in "${URLS[@]}"; do
    # SPN returns the capture page; we only care that the request landed.
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 \
        "https://web.archive.org/save/${url}")
    if [ "$http_code" = "200" ] || [ "$http_code" = "302" ]; then
        echo "   ✅ ${url}"
    else
        echo "   ⚠️  ${url} (HTTP ${http_code} — try again later, non-fatal)"
    fi
    sleep 5   # be polite; anonymous SPN throttles aggressively
done
echo "📸 Snapshot requests done. Verify at https://web.archive.org/web/*/mmdm.it"
