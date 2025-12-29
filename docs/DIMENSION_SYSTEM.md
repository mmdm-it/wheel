# Dimension System Specification

## Overview

The **Dimension System** provides alternate views of the hierarchical data. The Focus Ring rotates across items at the current level, while the Parent Button and Child Pyramid move IN/OUT through the hierarchy from top level to leaf; dimensions offer fundamentally different ways to **view and navigate the same structure**.

**Core Principle**: A dimension must **transcend the hierarchy** - it applies to all (or most) levels, providing a parallel navigation system through the same data space.

**Example**: Language dimension for Bible - every level can be translated (Old Testament→Vetus Testamentum, Genesis→Γένεσις, Chapter 1→Κεφάλαιον Α). You're viewing the **same structure** through a different linguistic lens.

### Dimension Mode UI (Strata)

- **Primary stratum**: the main Focus Ring, Parent Button, and Child Pyramid. When dimension mode is toggled on, this stratum stays visible but is blurred and non-interactive.
- **Secondary stratum**: a second Focus Ring rendered on a mirrored layer at the same radius (reflected vertically). This stratum shows the dimension values (e.g., languages) while the primary remains blurred beneath; its sole purpose is to choose a dimension value.
- **Toggle**: the dimension button (bottom-center) only enters/exits dimension mode; it does not switch dimensions. Selecting a value on the secondary stratum exits dimension mode, and the newly selected dimension becomes visible/applied back on the primary stratum while keeping the hierarchy position unchanged.
- **Interaction feel**: no fades; elements pop between states. Tab order remains: dimension button → secondary ring nodes → back to normal after selection.
- **Absent dimensions**: when a volume declares no dimensions, the dimension button is hidden and dimension mode is unavailable.
- **Portals/strata count**: volumes may declare zero, one, or two portals. That yields up to three strata total: Primary (hierarchy), Secondary (first portal), and Tertiary (second portal). The dimension button simply cycles strata in order for the portals that exist.
- **Bible example**: Primary = Testament/Book/Chapter/Verse; Secondary = Language portal; Tertiary = Translation portal (e.g., RSV-CE, NABRE, ESV-CE). MMdM has no portals (Primary only).

---

## What Qualifies as a Dimension?

### The Litmus Test

**"Can I navigate the ENTIRE hierarchy through this lens?"**

A true dimension must:
1. Apply to **all or most levels** in the hierarchy
2. Provide a **fundamentally different view** of the same data
3. Help the user **find what they need** by offering an alternate navigation paradigm

### Examples of True Dimensions

**Bible + Language Dimension** ✅:
- Every level translates: Testament, Book, Chapter, Verse
- Structure remains identical across languages
- Same Genesis 1:1 viewed in Latin, Hebrew, Greek, English
- Helps user: "I want to read the Bible in French"

**Catalog + Time Dimension** ✅:
- Every product has a manufacturing year
- Can view: All Years → Decade → Year → Products
- Filters across manufacturers/categories
- Helps user: "I know my Caterpillar engine was built in the 80s"

**Music Library + Genre Dimension** ✅:
- Artists span multiple genres
- Albums span multiple genres  
- Can view: All Genres → Genre → Artists → Albums
- Helps user: "Show me all Jazz from my library"

### What Does NOT Qualify

**Market as "Dimension"** ❌:
- Manufacturers belong to one or two markets
- This is a **property** of the manufacturer level only
- Doesn't transcend the hierarchy
- Better as: navigation choice (fork at manufacturer level)

**Currency as "Dimension"** ❌:
- Only applies to leaf level (product price)
- "How much do 8 cylinders cost?" makes no sense
- This is a **unit conversion**, not an alternate view
- Better as: display preference, not navigation dimension

**Price Range as "Dimension"** ❌:
- Only applies to products (leaves)
- Doesn't help navigate through manufacturers/categories
- Better as: filter within current view

### The Distinction

**Property/Filter**: Reduces or modifies the dataset at specific levels
**Dimension**: Provides a parallel coordinate system for navigating the entire space

---

## Core Concepts

### Dimensions vs Hierarchy

**Hierarchy** = the structure OF the data itself
```
Testament (OT/NT) → Book (Genesis/Exodus) → Chapter (1/2/3) → Verse (1/2/3)
```

**Dimension** = alternate VIEW of the SAME structure
```
Language Dimension:
  English: Old Testament → Genesis → Chapter 1 → Verse 1
  Latin:   Vetus Testamentum → Genesis → Capitulum I → Versus 1
  Hebrew:  תנ״ך → בראשית → פרק א → פסוק א

(Same structure, different linguistic representation)
```

Both can be active simultaneously:
```
Navigate to: Genesis Chapter 1 (hierarchy position)
Dimension: Latin (linguistic view)
Result: Genesis Capitulum I displayed with Latin text
```

### Dimensions as Lenses

Think of dimensions as **viewing the same 3D object from different angles**:

- **No dimension**: View the Bible as structured by canonical order
- **Language dimension**: View the same structure through a linguistic lens
- **Time dimension** (catalog): View products through a chronological lens
- **Genre dimension** (music): View albums through a stylistic lens

The underlying data doesn't change - your **perspective** changes.

---

## State Machine

The Dimension System has **two modes**:

### Normal Mode (Default)

- Focus Ring shows hierarchy items (Books, Chapters, etc.)
- Child Pyramid shows children
- Dimension Button visible at bottom center
- User navigates through hierarchy

### Dimension Mode (Activated)

- Focus Ring shows available dimensions
- Child Pyramid hidden
- Detail Sector hidden
- Parent Button hidden
- User selects dimension value, then returns to Normal Mode

**Mode Transition**:
```
Normal Mode
    ↓ (tap Dimension Button)
Dimension Mode
    ↓ (select dimension value)
Normal Mode (with new dimension applied)
```

**Portal count and cycling**: Volumes can have zero, one, or two portals (never more). That yields up to three strata: Primary (hierarchy), Secondary (first portal), and Tertiary (second portal). The Dimension Button is the sole control and cycles strata in order through the portals that exist; with no portals it is hidden/inactive.
**Portal roles**: Secondary is typically the language selector; Tertiary is the edition/translation selector within a chosen language. Manifests list available languages; edition metadata (per-language translations) lives in the translation registry.
**Per-secondary tertiary availability**: Tertiary only appears when the currently selected Secondary value exposes multiple Tertiary options. Examples: a genre with subgenres (Jazz → Bebop/Cool/Latin), a time slice with sub-places (1970s → US/EU/JP plants), or a language with multiple editions (English → DRB/NJB/NCB). If the chosen Secondary has a single or no Tertiary option (e.g., Greek with only LXX), the Dimension Button skips Tertiary and returns directly to Primary.

### v3.7 Contracts (language + edition portals)

- **Secondary portal (language)**: Declared in `display_config.languages` with `available` (array), `default` (string), and `labels` (map of language → label). This portal is always the first portal when present.
- **Tertiary portal (edition/translation)**: Declared in `display_config.editions` with `registry` (path to translation registry), `available` (map language → [edition ids]), `default` (map language → edition id), and `labels` (map edition id → label). Availability is per-language; if a selected language lists only one edition, the tertiary portal is skipped.
- **Cycling rule**: Dimension button cycles Primary → Secondary → Tertiary (only if multiple editions for selected language) → Primary.
- **Defaulting rule**: Switching language resets edition to that language’s `editions.default[language]` or its first available edition. Edition changes never change language.
- **ARIA/labels**: UI labels for portals use `languages.labels` and `editions.labels`; button aria-labels must reflect the target portal (e.g., "Select language", "Select edition for English").

---

## Candidate Dimensions by Volume

### Bible

**Language** ✅:
- Applies to: Testament, Book, Chapter, Verse names and content
- Values: Latin, Hebrew, Greek, English, Russian, French, Spanish, Italian, Portuguese
- Use case: "I want to read the Bible in French"

**Textual Tradition** (Future) 🤔:
- Applies to: All levels, but only for books with variant traditions
- Values: Masoretic, Septuagint, Vulgate, Dead Sea Scrolls
- Use case: "Show me the Septuagint version"
- **Question**: Does this transcend enough levels? Needs evaluation.

### Catalog (MMdM)

**Time** ✅:
- Applies to: Product manufacturing dates across all manufacturers/categories
- Values: All Years → Decade (1970s, 1980s, etc.) → Year (1985, 1986, etc.)
- Use case: "I know my Caterpillar engine was built in the 80s"

**Language** (Maybe) 🤔:
- Applies to: Product names and descriptions
- Values: English, Italian, Spanish
- Use case: "Show product information in Italian"
- **Question**: Do users read manifold descriptions? If not, dimension not useful.

### Music Library (Future)

**Genre** ✅:
- Applies to: Artists, Albums, Songs (artists/albums often span multiple genres)
- Values: Classical, Jazz, Rock, Blues, Electronic, etc.
- Use case: "Show me all Jazz in my library"

**Era** ✅:
- Applies to: Composition/recording dates across all artists/albums
- Values: Renaissance, Baroque, Classical, Romantic, 20th Century, Contemporary
- Use case: "I want to hear Baroque music"

**Language** ✅:
- Applies to: Song lyrics, liner notes, artist names
- Values: English, Italian, French, German, Latin, etc.
- Use case: "Show me all Italian opera"

### Social Media Archive (Future)

**Time** ✅:
- Applies to: All posts regardless of author/topic
- Values: Year → Month → Day
- Use case: "What was I posting about in January 2020?"

**Person** (Maybe) 🤔:
- Applies to: Posts authored by or mentioning specific people
- Values: List of people in your network
- Use case: "Show me all posts about Alice"
- **Question**: Is this navigation or search? Needs evaluation.

---

## Non-Dimensions (Properties/Filters)

These look like dimensions but fail the litmus test:

**Market** ❌:
- Only applies to manufacturer level
- "USA vs Europe" is a fork in the road, not a parallel view
- Better as: navigation choice at manufacturer level

**Currency** ❌:
- Only applies to product prices (leaf level)
- Unit conversion, not alternate navigation
- Better as: display preference (show prices in EUR)

**Price Range** ❌:
- Only applies to products
- Doesn't help navigate through hierarchy
- Better as: filter within product list view

**Availability** ❌:
- Only applies to products
- "In Stock vs Out of Stock" doesn't transcend levels
- Better as: filter or sort option

**Mood/Tempo** (Music) ❌:
- Subjective, applies only to songs
- Doesn't help navigate artists/albums
- Better as: tags or search criteria

---

## The Subtle Distinction

Remember: **Hundreds of hierarchies, handful of dimensions.**

If you find yourself thinking "this would be useful", ask:
1. Does it apply to **most/all levels** of the hierarchy?
2. Does it provide a **fundamentally different view** of the same data?
3. Does it help the user **navigate**, not just **filter**?

If any answer is "no", it's probably a property, filter, or alternate hierarchy - not a dimension.

---

## User Interface

### Dimension Button

**Location**: Bottom center of viewport, above copyright notice

**Visual States**:
- **Normal Mode**: Shows current dimension value (e.g., "Latin", "1980s")
- **Dimension Mode**: Highlighted/selected appearance
- **Default**: Shows volume default (e.g., "Latin" for Bible)
- **No Dimensions**: Button hidden if volume has no dimensions defined

**Interaction**:
- Tap → Enter Dimension Mode (Focus Ring shows dimension values)
- (In Dimension Mode, selecting dimension value returns to Normal Mode automatically)

**Appearance**:
- Circular button, consistent with Focus Ring aesthetic
- Icon or text indicating current dimension value
- Pop on/off (no fade transitions)
- Colors set per volume, never change

### Focus Ring in Dimension Mode

When Dimension Mode is active, Focus Ring **repurposes** to show dimension values:

**Content**: Shows available dimension values instead of hierarchy items
- Bible Language dimension: "Latin", "Hebrew", "Greek", "English", etc.
- Catalog Time dimension: "1970s", "1980s", "1990s", etc.
- Music Genre dimension: "Classical", "Jazz", "Rock", etc.

**Behavior**:
- Rotation works identically to Normal Mode
- Magnifier highlights selected dimension value
- Selecting dimension (tap or gesture) applies it and exits to Normal Mode
- Child Pyramid hidden during Dimension Mode
- Detail Sector hidden during Dimension Mode
- Parent Button hidden during Dimension Mode

**Visual**: Same Focus Ring geometry and styling, different content

**Key Point**: This is **temporary repurposing**, not a permanent change. Exiting Dimension Mode restores Focus Ring to showing hierarchy items at current navigation position.

---

## Dimension Registry

The Dimension System maintains a registry of available dimensions for each volume.

### Schema Definition

Dimensions are defined in the volume schema:

```javascript
{
    "name": "Bible",
    "dimensions": [
        {
            "id": "language",
            "name": "Language",
            "type": "translation",
            "default": "latin",
            "values": [
                { "id": "latin", "name": "Latin", "abbreviation": "LA" },
                { "id": "hebrew", "name": "Hebrew", "abbreviation": "HE" },
                { "id": "greek", "name": "Greek", "abbreviation": "GR" },
                { "id": "english", "name": "English", "abbreviation": "EN" },
                { "id": "russian", "name": "Russian", "abbreviation": "RU" },
                { "id": "french", "name": "French", "abbreviation": "FR" },
                { "id": "spanish", "name": "Spanish", "abbreviation": "ES" },
                { "id": "italian", "name": "Italian", "abbreviation": "IT" },
                { "id": "portuguese", "name": "Portuguese", "abbreviation": "PT" }
            ]
        }
    ]
}
```

### Runtime Registry

The DimensionSystem class manages the registry:

```javascript
class DimensionSystem {
    constructor(volume) {
        this.volume = volume;
        this.activeDimensions = new Map(); // dimensionId → valueId
        this.mode = 'normal'; // 'normal' | 'dimension'
        this.observers = [];
        
        // Initialize with defaults
        this.loadDefaults();
    }
    
    loadDefaults() {
        const schema = this.volume.getSchema();
        schema.dimensions.forEach(dim => {
            this.activeDimensions.set(dim.id, dim.default);
        });
    }
    
    // Mode management
    isActive() {
        return this.mode === 'dimension';
    }
    
    activate() {
        this.mode = 'dimension';
        this.notifyObservers({ type: 'modeChange', mode: 'dimension' });
    }
    
    deactivate() {
        this.mode = 'normal';
        this.notifyObservers({ type: 'modeChange', mode: 'normal' });
    }
    
    // Dimension management
    setDimension(dimensionId, valueId) {
        const oldValue = this.activeDimensions.get(dimensionId);
        this.activeDimensions.set(dimensionId, valueId);
        
        this.notifyObservers({
            type: 'dimensionChange',
            dimensionId,
            oldValue,
            newValue: valueId
        });
        
        // Exit dimension mode after selection
        this.deactivate();
    }
    
    getDimension(dimensionId) {
        return this.activeDimensions.get(dimensionId);
    }
    
    getAllDimensions() {
        return Array.from(this.activeDimensions.entries()).map(([id, value]) => ({
            id,
            value
        }));
    }
    
    clearDimension(dimensionId) {
        const schema = this.volume.getSchema();
        const dimension = schema.dimensions.find(d => d.id === dimensionId);
        if (dimension) {
            this.setDimension(dimensionId, dimension.default);
        }
    }
    
    clearAll() {
        this.loadDefaults();
        this.notifyObservers({ type: 'dimensionReset' });
    }
    
    // Available dimensions
    getDimensions() {
        const schema = this.volume.getSchema();
        return schema.dimensions.map(dim => ({
            id: dim.id,
            name: dim.name,
            type: dim.type,
            values: dim.values,
            current: this.activeDimensions.get(dim.id)
        }));
    }
    
    // Observer pattern
    onChange(callback) {
        this.observers.push(callback);
    }
    
    offChange(callback) {
        this.observers = this.observers.filter(cb => cb !== callback);
    }
    
    notifyObservers(event) {
        this.observers.forEach(cb => cb(event));
    }
}
```

---

### How Dimensions Affect Views

When a dimension is set, it changes **how the data is presented**, not which data exists:

**Bible + Language Dimension**:
```javascript
// User navigates to: Genesis Chapter 1
// Dimension: Latin

Volume.getItem('genesis-1-1') returns:
{
    id: 'genesis-1-1',
    book: 'Genesis',          // English name (structural)
    chapter: 1,
    verse: 1,
    text: 'In principio creavit Deus caelum et terram'  // Latin content
}

// User changes dimension to Hebrew
// Still at: Genesis Chapter 1

Volume.getItem('genesis-1-1') returns:
{
    id: 'genesis-1-1',
    book: 'Genesis',          // English name (structural)
    chapter: 1,
    verse: 1,
    text: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ'  // Hebrew content
}
```

**Catalog + Time Dimension**:
```javascript
// User at: Manufacturers (showing all manufacturers)
// Dimension: 1980s

FocusRing shows: Only manufacturers with products from 1980-1989
ChildPyramid shows: Product categories that existed in 1980s

// User changes dimension to 1990s
// Still at: Manufacturers

FocusRing shows: Only manufacturers with products from 1990-1999
ChildPyramid shows: Product categories that existed in 1990s
```

**Key Insight**: Dimension changes your VIEW of the data, navigation determines your POSITION in the data. Both are independent but combined determine what you see.

```javascript
class Volume {
    constructor(data, schema) {
        this.data = data;
        this.schema = schema;
        this.dimensionFilters = new Map(); // dimensionId → valueId
    }
    
    applyDimension(dimensionId, valueId) {
        this.dimensionFilters.set(dimensionId, valueId);
    }
    
    getItem(id) {
        const item = this.data[id];
        if (!item) return null;
        
        // Apply dimension filters to item content
        return this.applyFilters(item);
    }
    
    applyFilters(item) {
        // Clone item to avoid mutation
        const filtered = { ...item };
        
        // Apply language dimension (if active)
        const language = this.dimensionFilters.get('language');
        if (language && item.text) {
            // If item has text in multiple languages, select the active one
            if (typeof item.text === 'object') {
                filtered.text = item.text[language] || item.text[this.schema.dimensions[0].default];
            }
        }
        
        // Apply other dimensions (market, currency, etc.)
        // ...dimension-specific filtering logic...
        
        return filtered;
    }
}
```

**Key Points**:
- Dimensions filter **at read time**, not stored in state
- Original data never mutates
- Each `getItem()` call applies active dimensions
- Performance: cache filtered results per dimension combination

---

## Data Structure

### Item Data with Dimensions

Items can have dimension-specific content:

**Bible Verse Example**:
```javascript
{
    "id": "genesis-1-1",
    "type": "verse",
    "book": "genesis",
    "chapter": 1,
    "verse": 1,
    "text": {
        "latin": "In principio creavit Deus caelum et terram",
        "hebrew": "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ",
        "greek": "Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν",
        "english": "In the beginning God created the heavens and the earth",
        "russian": "В начале сотворил Бог небо и землю"
    }
}
```

**Catalog Product Example**:
```javascript
{
    "id": "product-12345",
    "type": "product",
    "name": {
        "english": "Marble Statue",
        "italian": "Statua di Marmo",
        "spanish": "Estatua de Mármol"
    },
    "description": {
        "english": "A beautiful hand-carved marble statue...",
        "italian": "Una bellissima statua di marmo scolpita a mano...",
        "spanish": "Una hermosa estatua de mármol tallada a mano..."
    },
    "price": {
        "USD": 1200,
        "EUR": 1100,
        "GBP": 950
    },
    "market": {
        "USA": { "available": true, "shipping": "5-7 days" },
        "Europe": { "available": true, "shipping": "3-5 days" },
        "Asia": { "available": false, "shipping": null }
    }
}
```

### Flattened vs Nested

Items can store dimension values in two ways:

**Nested (Multi-dimensional)**:
```javascript
{
    "id": "genesis-1-1",
    "text": {
        "latin": "In principio...",
        "hebrew": "בְּרֵאשִׁית...",
        "english": "In the beginning..."
    }
}
```

**Flattened (Single-dimensional)**:
```javascript
{
    "id": "genesis-1-1",
    "latin": "In principio...",
    "hebrew": "בְּרֵאשִׁית...",
    "english": "In the beginning..."
}
```

Both are valid. Volume normalizer handles both formats.

---

## View Integration

### Phase 2 Implementation

Phase 2 focuses on **state machine only** - no data filtering yet.

**What Works**:
- Dimension Button appears at bottom center
- Tap button → Focus Ring shows dimension values
- Rotate to select dimension
- Tap dimension → Return to Normal Mode
- Dimension Button shows selected dimension

**What Doesn't Work Yet**:
- Data filtering (all content still in default dimension)
- Item content doesn't change based on dimension
- Detail Sector doesn't reflect dimension

**Why**: Prove state machine works before adding complexity.

### Full Implementation (Post Phase 2)

Once state machine is proven:

**Volume Integration**:
- DimensionSystem sends events to Volume
- Volume applies filters to all `getItem()` calls
- Views receive filtered data automatically

**View Updates**:
- NavigationState observes DimensionSystem
- On dimension change, emit state change event
- All views re-render with filtered data

**No View-Specific Logic**:
- Views don't know about dimensions
- Views render whatever data they receive
- Dimension filtering happens in Volume layer

---

## Animation & Transitions

### Mode Transition Animation

**Normal → Dimension Mode**:
1. Focus Ring items swap from hierarchy items to dimension values (instant pop)
2. Child Pyramid disappears (instant pop)
3. Detail Sector disappears (instant pop)
4. Parent Button disappears (instant pop)
5. Dimension Button highlights (instant)

**Dimension → Normal Mode**:
1. Reverse of above

**No fading, no opacity changes** - all transitions are instant pops.

### Dimension Button Animation

**States**:
- **Default**: Shows current dimension icon/text
- **Hover**: (Desktop only) Subtle indication of interactivity
- **Active**: (Dimension Mode) Highlighted appearance

**Transitions**: Instant color/style changes, no fades

---

## Edge Cases

### No Dimensions Defined

If volume schema has no dimensions:
- Dimension Button hidden
- System inactive
- No mode switching possible

### Single Dimension Value

If dimension has only one value (e.g., Language: [English]):
- Dimension Button visible but disabled
- No mode switching needed
- Always uses that single value

### Missing Dimension Data

If item lacks data for selected dimension:
- Fall back to volume default dimension
- Log warning (development mode only)
- Never show "[object Object]" or empty content

### Dimension Change During Navigation

User at: Genesis Chapter 1, Dimension: Latin
User changes dimension to Hebrew

**Behavior**:
1. Stay at Genesis Chapter 1 (same hierarchy position)
2. Content switches to Hebrew
3. All views re-render with Hebrew text
4. Navigation history unchanged

**No re-navigation** - dimensions are orthogonal to hierarchy.

---

## Testing

### Phase 2 Tests

**State Machine**:
```javascript
test('Dimension button activates dimension mode', () => {
    const system = new DimensionSystem(volume);
    expect(system.isActive()).toBe(false);
    
    system.activate();
    expect(system.isActive()).toBe(true);
});

test('Selecting dimension exits dimension mode', () => {
    const system = new DimensionSystem(volume);
    system.activate();
    system.setDimension('language', 'hebrew');
    
    expect(system.isActive()).toBe(false);
    expect(system.getDimension('language')).toBe('hebrew');
});

test('Mode change emits events', () => {
    const system = new DimensionSystem(volume);
    const events = [];
    system.onChange(e => events.push(e));
    
    system.activate();
    expect(events[0].type).toBe('modeChange');
    expect(events[0].mode).toBe('dimension');
});
```

**UI Integration**:
```javascript
test('Focus Ring shows dimensions in dimension mode', () => {
    const app = new App(volume);
    app.dimensionSystem.activate();
    
    const focusRingItems = app.getFocusRingItems();
    expect(focusRingItems[0].id).toBe('latin');
    expect(focusRingItems[1].id).toBe('hebrew');
});

test('Dimension button shows current dimension', () => {
    const app = new App(volume);
    const buttonText = app.getDimensionButtonText();
    expect(buttonText).toBe('Latin'); // Default
    
    app.dimensionSystem.setDimension('language', 'hebrew');
    expect(app.getDimensionButtonText()).toBe('Hebrew');
});
```

### Full System Tests (Post Phase 2)

**Data Filtering**:
```javascript
test('Dimension filters item content', () => {
    const volume = new Volume(bibleData, bibleSchema);
    volume.applyDimension('language', 'hebrew');
    
    const verse = volume.getItem('genesis-1-1');
    expect(verse.text).toBe('בְּרֵאשִׁית בָּרָא...');
});

test('Dimension change updates all views', () => {
    const app = new App(volume);
    app.navigateTo('genesis-1');
    app.dimensionSystem.setDimension('language', 'greek');
    
    // All views should now show Greek text
    const detailContent = app.getDetailSectorContent();
    expect(detailContent).toContain('Ἐν ἀρχῇ');
});
```

---

## Performance Considerations

### Caching Strategy

**Problem**: Applying dimensions on every `getItem()` call is expensive.

**Solution**: Cache filtered results per dimension combination:

```javascript
class Volume {
    constructor(data, schema) {
        this.data = data;
        this.schema = schema;
        this.dimensionFilters = new Map();
        this.filterCache = new Map(); // cacheKey → filtered item
    }
    
    getCacheKey(itemId) {
        const filters = Array.from(this.dimensionFilters.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join('|');
        return `${itemId}|${filters}`;
    }
    
    getItem(id) {
        const cacheKey = this.getCacheKey(id);
        
        if (this.filterCache.has(cacheKey)) {
            return this.filterCache.get(cacheKey);
        }
        
        const item = this.data[id];
        if (!item) return null;
        
        const filtered = this.applyFilters(item);
        this.filterCache.set(cacheKey, filtered);
        
        return filtered;
    }
    
    applyDimension(dimensionId, valueId) {
        this.dimensionFilters.set(dimensionId, valueId);
        this.filterCache.clear(); // Invalidate cache
    }
}
```

**Cache Invalidation**: Clear cache when any dimension changes.

### Memory Management

**Max Cache Size**: Limit cache to 1000 items (configurable)

**LRU Eviction**: When cache exceeds limit, evict least recently used items

**Memory Target**: < 10MB cache size for typical volumes

---

## Future Extensions

### Multiple Dimensions

Currently Phase 2 supports single dimension (Language).

Future phases can support multiple dimensions:

**Bible Example**:
- Language: Latin
- Time: Historical (original) vs Modern (updated)
- Tradition: Catholic vs Protestant vs Orthodox

**Catalog Example**:
- Language: English
- Market: USA
- Currency: USD
- Availability: In Stock

**UI Challenge**: How to display multiple active dimensions?
- Dimension Button shows primary dimension only
- Secondary dimensions shown in... Parent Button? New UI element?
- To be designed when needed.

### Dimension Hierarchies

Some dimensions have hierarchical values:

**Place Example**:
- World → Continent → Country → City

**Time Example**:
- Millennium → Century → Decade → Year

For now, dimensions are **flat** (no hierarchy). Future extension if needed.

### Dimension Presets

Save/load dimension combinations:

**Bible Presets**:
- "Latin Scholar": Latin + Historical + Catholic
- "Modern Reader": English + Modern + Interdenominational
- "Polyglot Study": All languages visible simultaneously

Not in Phase 2. Future enhancement.

---

## Conclusion

The Dimension System provides:

1. **Meta-navigation** across hierarchical data
2. **Volume-level filtering** (not item-specific)
3. **Simple state machine** (Normal ↔ Dimension mode)
4. **Orthogonal to hierarchy** (dimensions + navigation independent)
5. **Extensible** (easy to add new dimensions per volume)

**Phase 2 Goal**: Prove state machine works - button, mode switching, Focus Ring repurposing.

**Post-Phase 2**: Add data filtering so dimension changes affect content.

**No compromises**: Build it right or start over.
