#!/bin/bash
# Check module sizes and warn about large files

echo "=== Module Size Report ==="
echo ""

echo "All modules (sorted by size):"
wc -l mobile/*.js 2>/dev/null | sort -rn | head -20

echo ""
echo "⚠️  Modules over 1,000 lines (need refactoring):"
find mobile -name "*.js" -exec sh -c '
    lines=$(wc -l < "$1")
    if [ "$lines" -gt 1000 ]; then
        printf "  %-35s %5d lines\n" "$(basename "$1")" "$lines"
    fi
' _ {} \;

echo ""
echo "📊 Method counts per module:"
for file in mobile/*.js; do
    if [ ! -f "$file" ]; then continue; fi
    count=$(grep -c "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" 2>/dev/null || echo 0)
    lines=$(wc -l < "$file")
    printf "  %-35s %3d methods, %5d lines\n" "$(basename $file)" "$count" "$lines"
done | sort -k2 -rn
