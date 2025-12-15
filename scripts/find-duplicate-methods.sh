#!/bin/bash
# Find duplicate method definitions within each file

echo "=== Checking for duplicate method names ==="
echo ""

found_duplicates=false

for file in mobile/*.js; do
    if [ ! -f "$file" ]; then continue; fi
    
    duplicates=$(grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
                 awk -F: '{print $2}' | \
                 awk '{print $1}' | \
                 sed 's/(.*//' | \
                 sort | uniq -d)
    
    if [ -n "$duplicates" ]; then
        found_duplicates=true
        echo "📁 $(basename $file)"
        echo "$duplicates" | while read method; do
            echo "  ⚠️  DUPLICATE: $method"
            grep -n "^    $method(" "$file" | head -5
        done
        echo ""
    fi
done

if [ "$found_duplicates" = false ]; then
    echo "✅ No duplicate methods found!"
else
    echo "❌ Fix duplicate methods before proceeding"
    exit 1
fi
