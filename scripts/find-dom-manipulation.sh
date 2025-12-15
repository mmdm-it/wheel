#!/bin/bash
# Find which modules manipulate specific DOM elements

echo "=== DOM Element Ownership Analysis ==="
echo ""

# Critical DOM elements and their intended owners
declare -A elements=(
    ["magnifier"]="magnifier-manager.js"
    ["parentButtonGroup"]="navigation-view.js"
    ["detailSectorCircle"]="mobile-detailsector.js"
    ["detailSectorLogo"]="mobile-detailsector.js"
    ["focusRingGroup"]="focus-ring-view.js"
    ["childRingGroup"]="mobile-childpyramid.js"
)

for element in "${!elements[@]}"; do
    owner="${elements[$element]}"
    echo "Element: #$element (owner: $owner)"
    
    # Find files that manipulate this element
    violations=()
    for file in mobile/*.js; do
        if [ ! -f "$file" ]; then continue; fi
        basename=$(basename "$file")
        
        # Skip the owner file
        if [ "$basename" = "$owner" ]; then continue; fi
        
        # Check for getElementById, querySelector, or direct manipulation
        if grep -q "getElementById.*$element\|querySelector.*$element\|$element\.setAttribute\|$element\.classList" "$file" 2>/dev/null; then
            violations+=("$basename")
        fi
    done
    
    if [ ${#violations[@]} -gt 0 ]; then
        echo "  ⚠️  VIOLATIONS found in:"
        printf '    - %s\n' "${violations[@]}"
    else
        echo "  ✅ Clean (only manipulated by owner)"
    fi
    echo ""
done
