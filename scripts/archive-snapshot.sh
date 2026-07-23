#!/bin/bash

# archive-snapshot.sh — request Wayback Machine (Save Page Now) captures of
# the public Wheel deployments and the repository page.
#
# Why: third-party timestamps are the evidentiary backbone of the prior-art
# strategy (see docs/prior-art/). Each capture is an independent, dated
# record of what was public and when.
#
# Usage: ./scripts/archive-snapshot.sh
# Called automatically by sync-to-server.sh on catalog/all deploys, once
# per released version — a capture is an edition, not a redeploy (SNAPSHOT=0
# skips, SNAPSHOT=force re-snapshots). Anonymous SPN requests are
# rate-limited; failures are non-fatal by design — a missed snapshot never
# blocks a deploy. Note: SPN sometimes reports an error (000/520) yet
# captures anyway — verify via the availability API before retrying.

URLS=(
    "https://mmdm.it/"
    "https://howellgibbens.com/mmdm/wheel-v3/bible/"
    "https://howellgibbens.com/mmdm/wheel-v3/calendar/"
    "https://github.com/mmdm-it/wheel"
)

# Prior-art documents, captured at the CURRENT tag so the archived copy is
# pinned to an immutable ref. Use raw.githubusercontent URLs, NOT blob pages:
# blob pages are JS-rendered and SPN silently fails on them (observed
# 2026-07-22 — the blob request returned 302 but archived nothing, while the
# raw request captured cleanly). Raw URLs archive the literal document text,
# which is the evidence that actually matters.
TAG="$(git -C "$(dirname "$0")/.." describe --tags --abbrev=0 2>/dev/null)"
if [ -n "$TAG" ]; then
    RAW="https://raw.githubusercontent.com/mmdm-it/wheel/${TAG}/docs/prior-art"
    # Only queue documents that actually exist at this tag. Paths change over
    # time (files get consolidated), and a tag cut before a move still holds
    # the old layout — requesting a 404 would raise a false "NOT archived".
    for doc in "${RAW}/DEFENSIVE_PUBLICATION_V1_2025.md" \
               "${RAW}/DEFENSIVE_PUBLICATION_V2_2026.md" \
               "${RAW}/SEARCH_ENTRY_DISCLOSURE_2026.md"; do
        if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$doc")" = "200" ]; then
            URLS+=("$doc")
        fi
    done
    URLS+=("https://github.com/mmdm-it/wheel/releases/tag/${TAG}")
else
    echo "   ⚠️  no git tag found — skipping prior-art document captures"
fi

echo "📸 Requesting Wayback Machine snapshots..."
for url in "${URLS[@]}"; do
    # The SPN status code is NOT trustworthy in either direction: it reports
    # errors on successful captures and success on failed ones. Request, then
    # ask the availability API what actually landed.
    curl -s -o /dev/null --max-time 90 "https://web.archive.org/save/${url}"
    sleep 5   # give the capture a moment to register
    stamp=$(curl -s --max-time 30 "http://archive.org/wayback/available?url=${url}" \
        | grep -o '"timestamp": *"[0-9]*"' | grep -o '[0-9]\{14\}' | head -1)
    if [ -n "$stamp" ]; then
        echo "   ✅ ${url}  (archived ${stamp})"
    else
        echo "   ⚠️  ${url} — NOT archived; retry later (non-fatal)"
    fi
    sleep 5   # be polite; anonymous SPN throttles aggressively
done
echo "📸 Snapshot pass done. Browse captures at https://web.archive.org/web/*/mmdm.it"
