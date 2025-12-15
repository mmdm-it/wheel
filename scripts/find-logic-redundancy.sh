#!/bin/bash
# Find Logic Redundancy in JavaScript Files
# Looks for repeated patterns, similar functions, and potential extraction candidates

MOBILE_DIR="mobile"

echo "=== Logic Redundancy Analysis ==="
echo ""

# 1. Find functions with similar signatures
echo "1. Functions with >10 parameters (complexity candidates):"
grep -rn "function.*(" "$MOBILE_DIR" | awk -F'(' '{print $2}' | grep -o ',' | wc -l | sort -rn | head -10

echo ""
echo "2. Large functions (>50 lines - extraction candidates):"
# Find function definitions and count lines until next function or class end
for file in $(find "$MOBILE_DIR" -name "*.js" -type f); do
    awk '
        /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*\(/ || /^[[:space:]]*(async )?function / {
            if (func_start) {
                lines = NR - func_start
                if (lines > 50) {
                    print FILENAME ":" func_start ":" func_name " (" lines " lines)"
                }
            }
            func_start = NR
            func_name = $0
            gsub(/^[[:space:]]+/, "", func_name)
            gsub(/\{.*$/, "", func_name)
        }
    ' "$file"
done | sort -t':' -k3 -rn | head -20

echo ""
echo "3. Repeated array operations (map/filter/forEach chains):"
grep -rn "\.map(.*\.filter(\|\.filter(.*\.map(" "$MOBILE_DIR" | wc -l
echo "   Found chained array operations"

echo ""
echo "4. Repeated null/undefined checks:"
grep -rn "if (.*!== null.*!== undefined\|!== undefined.*!== null" "$MOBILE_DIR" | wc -l
echo "   Found redundant null checks"

echo ""
echo "5. Duplicate error handling patterns:"
grep -rn "try {" "$MOBILE_DIR" | wc -l
echo "   try-catch blocks"
grep -rn "catch.*{" "$MOBILE_DIR" | wc -l  
echo "   catch blocks"

echo ""
echo "6. Repeated DOM queries (potential cache candidates):"
grep -rn "document\.getElementById\|document\.querySelector" "$MOBILE_DIR" | \
    awk -F'[()]' '{print $2}' | sort | uniq -c | sort -rn | head -10

echo ""
echo "7. Magic numbers (should be constants):"
grep -rn "[^0-9]\([0-9]\{3,\}\)[^0-9]" "$MOBILE_DIR" --include="*.js" | \
    grep -v "^[[:space:]]*//\|/\*" | head -20

echo ""
echo "=== Redundancy Summary ==="
echo "Run 'jscpd mobile/' for detailed copy-paste detection"
