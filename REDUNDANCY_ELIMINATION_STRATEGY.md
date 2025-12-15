# Redundancy Elimination & Prevention Strategy

## Current Redundancies Found

### 1. **Duplicate Method Definitions**
```javascript
// mobile-renderer.js has TWO identical methods:
initializeTranslationButton()  // Line 284
initializeTranslationButton()  // Line 427  ❌ DUPLICATE
```

### 2. **Logic Duplication Across Modules**
- Hierarchy navigation in BOTH renderer and data manager
- Parent button updates in renderer (should only be in NavigationView)
- Detail Sector animations in renderer (should only be in DetailSector)
- Focus Ring positioning in renderer (should only be in FocusRingView)

### 3. **Incomplete Extractions**
Modules were created but original code wasn't removed:
- `NavigationView` exists, but renderer still has parent button code
- `FocusRingView` exists, but renderer still has positioning logic
- `DetailSector` exists, but renderer still has expand/collapse animations

---

## Detection Strategy: Find All Redundancies Now

### Step 1: Automated Detection Tools

#### A. Find Duplicate Methods (5 min)
```bash
#!/bin/bash
# save as: scripts/find-duplicate-methods.sh

echo "=== Checking for duplicate method names ==="
for file in mobile/*.js; do
    echo "Checking: $file"
    grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
    awk -F: '{print $2}' | \
    awk '{print $1}' | \
    sort | uniq -d | \
    while read method; do
        echo "  ⚠️  DUPLICATE: $method"
        grep -n "^    $method" "$file"
    done
done
```

#### B. Find Similar Code Blocks (10 min)
```bash
#!/bin/bash
# save as: scripts/find-similar-code.sh

# Look for common patterns that might be duplicated
echo "=== Searching for potential code duplication ==="

patterns=(
    "getHierarchyLevel"
    "parentButton"
    "DetailSector"
    "FocusRing"
    "magnifier"
    "translation"
    "getColor"
    "viewport"
)

for pattern in "${patterns[@]}"; do
    echo ""
    echo "Pattern: $pattern"
    grep -l "$pattern" mobile/*.js | while read file; do
        count=$(grep -c "$pattern" "$file")
        if [ $count -gt 2 ]; then
            echo "  ⚠️  $file: $count occurrences"
        fi
    done
done
```

#### C. Find Cross-Module Dependencies (15 min)
```bash
#!/bin/bash
# save as: scripts/find-cross-dependencies.sh

echo "=== Finding methods called from multiple modules ==="

# Extract all method definitions
for file in mobile/*.js; do
    basename=$(basename "$file")
    grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
    awk -F: '{print $2}' | \
    awk '{print $1}' | \
    sed "s/^/$basename:/"
done > /tmp/all-methods.txt

# For each method, see where it's called
while read line; do
    file=$(echo "$line" | cut -d: -f1)
    method=$(echo "$line" | cut -d: -f2 | sed 's/(.*//')
    
    # Count how many files call this method
    callers=$(grep -l "\.$method(" mobile/*.js 2>/dev/null | wc -l)
    
    if [ $callers -gt 2 ]; then
        echo "⚠️  $method (defined in $file) called from $callers files"
        grep -l "\.$method(" mobile/*.js
    fi
done < /tmp/all-methods.txt
```

### Step 2: Manual Code Review Checklist

#### Pre-Refactoring Audit (30 min)
Run before each extraction:

```markdown
## Module Extraction Checklist

- [ ] Does this functionality exist elsewhere?
  - [ ] Check for similar method names in other modules
  - [ ] Check for similar logic patterns
  - [ ] Search for same DOM element IDs being manipulated

- [ ] What are all the callers?
  - [ ] grep -r "methodName" mobile/
  - [ ] List all files that call this method
  - [ ] Verify each caller will work after extraction

- [ ] What are the dependencies?
  - [ ] What does this method call?
  - [ ] What state does it access?
  - [ ] Can it be truly independent?

- [ ] Is extraction complete?
  - [ ] Original code removed from source?
  - [ ] All calls updated to use new module?
  - [ ] Tests verify functionality?
```

### Step 3: Static Analysis (Ideal)

#### Option A: ESLint with Custom Rules
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Detect duplicate method definitions
    'no-dupe-class-members': 'error',
    
    // Detect unused methods (potential redundancy)
    'no-unused-vars': ['error', { 
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_'
    }],
    
    // Complexity limits (catch god objects)
    'complexity': ['warn', 20],
    'max-lines': ['warn', 1000],
    'max-lines-per-function': ['warn', 100],
    'max-statements': ['warn', 30]
  }
};
```

Run:
```bash
npm install eslint --save-dev
npx eslint mobile/*.js
```

#### Option B: JSInspect (Find Copy-Paste)
```bash
npm install -g jsinspect

# Find duplicated code blocks (30+ lines)
jsinspect -t 30 mobile/

# Find similar code blocks (70% match)
jsinspect -t 30 -m 0.7 mobile/
```

---

## Prevention Strategy: Stop Future Redundancies

### 1. **Ownership Documentation**

Create `OWNERSHIP.md`:
```markdown
# Module Ownership & Responsibilities

## Core Principle: Single Source of Truth
Each responsibility has ONE owner module.

### Hierarchy Navigation
**Owner:** mobile-hierarchy.js
**Responsibilities:**
- Level traversal (next/prev/depth)
- Item relationships (parent/child/cousin)
- Level metadata (names, labels, config)

❌ DO NOT add hierarchy logic to: renderer, data, app

### Parent Button
**Owner:** navigation-view.js  
**Responsibilities:**
- Position calculation
- Show/hide/update text
- Parent line drawing

❌ DO NOT manipulate parentButtonGroup outside NavigationView

### Magnifier
**Owner:** magnifier-manager.js
**Responsibilities:**
- Create magnifier element
- Position at magnifier angle
- Handle magnifier clicks
- Advance to next item

❌ DO NOT manipulate #magnifier outside MagnifierManager

### Detail Sector
**Owner:** mobile-detailsector.js
**Responsibilities:**
- Expand/collapse animations
- Circle/logo creation and positioning
- Content rendering
- Bounds calculations

❌ DO NOT manipulate #detailSectorCircle or #detailSectorLogo outside DetailSector

### Focus Ring
**Owner:** focus-ring-view.js
**Responsibilities:**
- Background band creation
- Focus item positioning
- Text layout and rotation
- Viewport filtering

❌ DO NOT manipulate #focusRingGroup outside FocusRingView

### Translation
**Owner:** translation-toggle.js
**Responsibilities:**
- Button creation/positioning
- Language switching
- Current language tracking
- Translation text lookup

❌ DO NOT duplicate translation logic

### Theme/Colors
**Owner:** theme-manager.js
**Responsibilities:**
- Color scheme loading
- Color lookup by type
- Theme switching (future)

❌ DO NOT hardcode colors outside ThemeManager

### Data Loading
**Owner:** mobile-data.js
**Responsibilities:**
- JSON loading and caching
- IndexedDB persistence
- Split structure handling
- Data validation

❌ DO NOT load data outside DataManager

### Rendering Coordination
**Owner:** mobile-renderer.js
**Responsibilities:**
- Initialize all modules
- Coordinate module interactions
- Handle high-level navigation flow
- Manage rendering lifecycle

✅ DOES delegate to specialized modules
❌ DOES NOT implement specialized logic itself
```

### 2. **Code Review Checklist**

Add to `.github/PULL_REQUEST_TEMPLATE.md`:
```markdown
## Redundancy Check ✅

Before merging, verify:

- [ ] No duplicate method definitions (run: `./scripts/find-duplicate-methods.sh`)
- [ ] No similar code blocks >20 lines (run: `jsinspect -t 20 mobile/`)
- [ ] Follows ownership rules (see OWNERSHIP.md)
- [ ] Extracted code removed from original location
- [ ] Only ONE module manipulates each DOM element
- [ ] Module size stays under 1,000 lines

### If you added logic to mobile-renderer.js:
- [ ] Can this be in a specialized module instead?
- [ ] Is this coordination or implementation?
- [ ] Does this follow the "orchestrator" pattern?

### If you duplicated existing logic:
- [ ] Why wasn't the existing implementation used?
- [ ] Can the existing code be extracted to a shared utility?
- [ ] Have you updated OWNERSHIP.md?
```

### 3. **Pre-Commit Hooks**

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash

echo "🔍 Checking for redundancies..."

# Check file sizes
oversized=$(find mobile -name "*.js" -size +1000k -o -size +500k)
if [ -n "$oversized" ]; then
    echo "⚠️  Warning: Large files detected:"
    echo "$oversized"
    echo "Consider refactoring files over 1,000 lines"
fi

# Check for duplicate method definitions in staged files
for file in $(git diff --cached --name-only | grep "mobile/.*\.js$"); do
    duplicates=$(grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
                 awk -F: '{print $2}' | \
                 awk '{print $1}' | \
                 sort | uniq -d)
    
    if [ -n "$duplicates" ]; then
        echo "❌ ERROR: Duplicate methods found in $file:"
        echo "$duplicates"
        echo ""
        echo "Remove duplicate method definitions before committing."
        exit 1
    fi
done

# Check for common redundancy patterns
if git diff --cached | grep -q "initializeTranslationButton.*initializeTranslationButton"; then
    echo "⚠️  Warning: Possible duplicate method definition"
fi

echo "✅ No redundancies detected"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 4. **Testing Strategy**

#### Unit Tests for Each Module
```javascript
// tests/magnifier-manager.test.js
describe('MagnifierManager', () => {
    it('should be the ONLY module creating magnifier element', () => {
        // If this test fails, check for redundant magnifier creation
        const magnifiers = document.querySelectorAll('#magnifier');
        expect(magnifiers.length).toBe(1);
    });
    
    it('should be called by renderer, not implemented in renderer', () => {
        // Verify renderer delegates, doesn't implement
        const rendererSource = fs.readFileSync('mobile/mobile-renderer.js', 'utf8');
        expect(rendererSource).toContain('this.magnifier.create()');
        expect(rendererSource).not.toContain('createElementNS'); // Don't create SVG in renderer
    });
});
```

#### Integration Tests for Ownership
```javascript
// tests/ownership.test.js
describe('Module Ownership Rules', () => {
    const ownershipRules = {
        '#magnifier': ['magnifier-manager.js'],
        '#parentButtonGroup': ['navigation-view.js'],
        '#detailSectorCircle': ['mobile-detailsector.js'],
        '#focusRingGroup': ['focus-ring-view.js']
    };
    
    Object.entries(ownershipRules).forEach(([elementId, allowedModules]) => {
        it(`${elementId} should only be manipulated by ${allowedModules.join(', ')}`, () => {
            // Scan all modules for direct DOM manipulation
            const violators = findDOMManipulation(elementId)
                .filter(file => !allowedModules.includes(file));
            
            expect(violators).toEqual([]);
        });
    });
});
```

### 5. **Documentation in Code**

Add warning comments in renderer:
```javascript
// mobile-renderer.js

class MobileRenderer {
    constructor() {
        // ⚠️  RENDERER RESPONSIBILITY: Orchestration ONLY
        // 
        // This class coordinates specialized modules.
        // DO NOT implement specialized logic here.
        // 
        // ✅ DO: this.magnifier.create()
        // ❌ DON'T: createElement(), setAttribute(), animation logic
        //
        // See OWNERSHIP.md for module responsibilities.
        
        this.magnifier = new MagnifierManager(...);
        this.hierarchy = new HierarchyService(...);
        // ...
    }
    
    expandDetailSector() {
        // ✅ GOOD: Delegate to specialized module
        this.detailSector.expand(this.selectedFocusItem);
        
        // ❌ BAD: Implement animation here
        // const circle = document.getElementById('detailSectorCircle');
        // circle.animate(...);  // NO! This belongs in DetailSector
    }
}
```

### 6. **Continuous Monitoring**

#### Weekly Code Metrics Report
```bash
#!/bin/bash
# save as: scripts/weekly-metrics.sh

echo "=== Code Metrics Report ==="
echo "Date: $(date)"
echo ""

echo "Module Sizes:"
wc -l mobile/*.js | sort -rn | head -10

echo ""
echo "Method Counts:"
for file in mobile/*.js; do
    count=$(grep -c "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file")
    printf "%-30s %3d methods\n" "$(basename $file)" "$count"
done | sort -k2 -rn

echo ""
echo "⚠️  Files over 1,000 lines:"
find mobile -name "*.js" -exec wc -l {} \; | awk '$1 > 1000 {print $2, $1}'

echo ""
echo "⚠️  Duplicate method names:"
for file in mobile/*.js; do
    dupes=$(grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
            awk -F: '{print $2}' | \
            awk '{print $1}' | \
            sort | uniq -d)
    if [ -n "$dupes" ]; then
        echo "  $(basename $file): $dupes"
    fi
done
```

Run weekly and track trends.

---

## Immediate Action Plan

### Phase 0: Setup Detection (Today, 1 hour)

1. **Create detection scripts** (30 min)
```bash
mkdir -p scripts
# Copy the 3 detection scripts above
chmod +x scripts/*.sh
```

2. **Run initial scan** (15 min)
```bash
./scripts/find-duplicate-methods.sh > redundancy-report.txt
./scripts/find-similar-code.sh >> redundancy-report.txt
./scripts/find-cross-dependencies.sh >> redundancy-report.txt
```

3. **Create OWNERSHIP.md** (15 min)
```bash
# Copy ownership documentation from above
```

### Phase 1: Eliminate Current Redundancies (Week 1)

**Before each extraction:**
1. Run detection scripts
2. Document what you're moving in commit message
3. Verify original code is removed
4. Run scripts again to confirm

**Example workflow:**
```bash
# Before: Extract MagnifierManager
./scripts/find-duplicate-methods.sh

# Create new module
touch mobile/magnifier-manager.js

# Move code + update calls + test

# After: Verify redundancy eliminated
./scripts/find-duplicate-methods.sh  # Should show fewer duplicates
git diff --stat  # Should show removals from renderer
```

### Phase 2: Prevent Future Redundancies (Week 2)

1. **Setup pre-commit hook** (10 min)
2. **Add ESLint** (30 min)
3. **Update PR template** (10 min)
4. **Document ownership rules** (30 min)

### Phase 3: Continuous Improvement (Ongoing)

1. **Weekly metrics review** (15 min/week)
2. **Monthly architecture review** (1 hour/month)
3. **Update ownership docs** (as needed)

---

## Success Metrics

Track these metrics weekly:

```markdown
### Week Starting: Dec 14, 2025

**Code Size:**
- mobile-renderer.js: 3,073 lines → Target: <1,000
- Largest module: 2,559 lines (mobile-data.js)
- Average module size: 641 lines

**Redundancies:**
- Duplicate methods: 1 (initializeTranslationButton)
- Incomplete extractions: 3 (NavigationView, FocusRingView, DetailSector)
- Cross-module logic: ~1,200 lines

**Goals Next Week:**
- [ ] Eliminate duplicate initializeTranslationButton
- [ ] Extract MagnifierManager (eliminate 150 lines redundancy)
- [ ] Setup detection scripts
- [ ] Create OWNERSHIP.md
```

---

## Tool Installation Guide

### Quick Setup (5 min)
```bash
# Create scripts directory
mkdir -p scripts

# Create all detection scripts
cat > scripts/find-duplicate-methods.sh << 'EOF'
#!/bin/bash
echo "=== Checking for duplicate method names ==="
for file in mobile/*.js; do
    echo "Checking: $file"
    grep -n "^    [a-zA-Z_][a-zA-Z0-9_]*(" "$file" | \
    awk -F: '{print $2}' | \
    awk '{print $1}' | \
    sort | uniq -d | \
    while read method; do
        echo "  ⚠️  DUPLICATE: $method"
        grep -n "^    $method" "$file"
    done
done
EOF

chmod +x scripts/*.sh

# Run first scan
./scripts/find-duplicate-methods.sh
```

### ESLint Setup (10 min)
```bash
npm init -y  # If no package.json
npm install --save-dev eslint
npx eslint --init

# Add to package.json:
# "scripts": {
#   "lint": "eslint mobile/*.js",
#   "lint:fix": "eslint mobile/*.js --fix"
# }

npm run lint
```

---

## Summary: Your Defense Strategy

**Detection (Find existing):**
1. ✅ Automated scripts find duplicates
2. ✅ Manual checklist for each extraction
3. ✅ Static analysis tools (ESLint/JSInspect)

**Prevention (Stop new ones):**
1. ✅ OWNERSHIP.md documents responsibility
2. ✅ Pre-commit hooks block duplicates
3. ✅ Code review checklist enforces rules
4. ✅ Tests verify single ownership

**Monitoring (Continuous improvement):**
1. ✅ Weekly metrics track progress
2. ✅ Module size limits enforced
3. ✅ Complexity metrics watched

**Start here:** Run the duplicate methods script right now to see your current state!
