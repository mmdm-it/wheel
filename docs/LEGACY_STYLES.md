# Legacy v1 Styles Reference

Reference for visual styling from wheel v1. All four volumes used distinct color schemes but shared common structural styles.

---

## Volume Color Schemes

### 1. Gutenberg Bible (data/gutenberg/)

**Source**: `wheel/data/gutenberg/manifest.json`

```json
"color_scheme": {
    "background": "#d4a574",        // Tan parchment
    "nodes": "#8b6f47",             // Brown leather
    "detail_sector": "#362e6a",     // Deep purple
    "detail_sector_opacity": "0.5",
    "text_primary": "#000000",      // Black
    "text_secondary": "#ffffff"     // White
}
```

**Visual Theme**: Parchment and leather - medieval manuscript aesthetic

---

### 2. Fairhope Social Media (fairhope.json)

**Source**: `wheel/fairhope.json`

```json
"color_scheme": {
    "background": "#e8f4f8",        // Light blue sky
    "nodes": "#4a90a4",             // Teal water
    "detail_sector": "#362e6a",     // Deep purple
    "detail_sector_opacity": "0.5",
    "text_primary": "#000000",      // Black
    "text_secondary": "#ffffff"     // White
}
```

**Visual Theme**: Beach/sky - light and airy social platform

**Special**: `"hide_circle": true` - Detail Sector circle hidden

---

### 3. HG Music Library (hg_mx.json)

**Source**: `wheel/hg_mx.json`

**No explicit color_scheme block** - Uses hierarchy level colors:
- Artist: `#9b59b6` (Purple)
- Album: `#3498db` (Blue)
- Song: Colors defined per album/track

**Background**: Default gray `#868686` (from wheel/manifest.json)

**Visual Theme**: Music player aesthetic with vibrant per-level colors

---

### 4. MMdM Catalog (mmdm_catalog.json)

**Source**: `wheel/mmdm_catalog.json`

**No explicit color_scheme block** - Uses hierarchy level colors:
- Market: `#f1b800` (Yellow/gold)
- Country: `#f1b800` (Yellow/gold)
- Manufacturer: `#ff0000` (Red)
- Engine Family: `#ff9900` (Orange)
- Engine: `#ff9900` (Orange)
- Model: Colors defined per product

**Background**: Default gray `#868686` (from wheel/manifest.json)

**Visual Theme**: Industrial catalog with bold primary colors

---

## Typography

### Focus Ring Text

**Source**: `wheel/mobile/catalog_mobile.css`

```css
text { 
    font-size: 15px; 
    font-family: 'Montserrat', sans-serif; 
    text-transform: uppercase; 
}
```

**All volumes**: Montserrat, uppercase, 15px base size

---

### Detail Sector Text

**Source**: `wheel/mobile/catalog_mobile.css`

```css
/* Bible verses and content-heavy text */
text.detail-body-text {
    font-family: 'EB Garamond', Georgia, serif;
    text-transform: none;
}

/* Two-tier system based on word count */
text.detail-body-text.big-font {
    font-size: 30px;  /* ≤30 words */
}

text.detail-body-text.small-font {
    font-size: 22px;  /* 31+ words */
}
```

**Verse/Content Display**: Serif font (EB Garamond), dynamic sizing

**Logo Placeholder**:
```css
text.logo-placeholder {
    font-size: 16px;
    font-family: 'Montserrat', sans-serif;
    font-weight: 500;
    fill: #666666;
}
```

---

## Structural Styles

### Body

```css
body { 
    background-color: #868686;  /* Default gray - overridden by volume color */
    overflow: hidden;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
}
```

### SVG Canvas

```css
svg { 
    width: 100vw;
    height: 100vh;
    touch-action: none;  /* Critical for custom touch handling */
}
```

### Nodes

```css
.node { 
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
```

---

## Detail Sector Opacity

All volumes used **50% opacity** for Detail Sector circle:
- `"detail_sector_opacity": "0.5"`

Exception: Fairhope had `"hide_circle": true`

### Detail Sector Expansion Animation

**Source**: `wheel/mobile/detailsector-animation.js`

The Detail Sector circle animated from the upper-right corner to the Focus Ring center:

**Animation Sequence** (600ms duration, ease-in-out):
1. **Position**: Upper-right corner → Focus Ring center
2. **Radius**: Small starting radius → 99% of Focus Ring radius (matches inner band edge)
3. **Opacity**: 0.5 → Volume config value (typically 0.5)
   - As circle expands, it becomes MORE transparent (0.5 → 0.5 maintained)
   - Logo inside fades: 0.5 → 0.10 (nearly invisible when fully expanded)

**Key Detail**: The circle opacity animation went from `startOpacity = 0.5` to `circleEndOpacity = parseFloat(detailOpacity)` (config value, typically 0.5). So the circle stayed at 50% opacity throughout, but as it grew larger, it appeared more transparent due to increased surface area.

The **logo** inside the circle faded significantly: `0.5 → 0.10` (90% fade).

---

## Focus Ring Band

**Source**: `wheel/mobile/focus-ring-view.js`

A subtle **darker gray band** was drawn BEHIND the Focus Ring to create visual separation from the background:

```javascript
// Annular ring (donut shape) at Focus Ring radius
innerRadius = arcParams.radius * 0.99;  // 99% of Focus Ring radius
outerRadius = arcParams.radius * 1.01;  // 101% of Focus Ring radius

fill = '#7a7979ff';  // Slightly darker gray than background (#868686)
fill-rule = 'evenodd';  // Creates hole in center
```

**Purpose**: Creates a subtle "track" or "rail" effect where Focus Ring nodes sit on a slightly darker band that follows the arc path.

**Implementation**: SVG path with two circles (outer clockwise, inner counter-clockwise) to create an annular ring. Inserted BEFORE focus nodes so nodes appear on top.

---

## Font Loading

**External fonts used**:
- Montserrat (sans-serif) - Focus Ring text
- EB Garamond (serif) - Bible verses and content

**Loading source**: Google Fonts or local

---

## v2 Migration Notes

### What v2 Should Inherit:

1. **Volume-specific color schemes** from manifest JSON
2. **Typography system**:
   - Montserrat uppercase for Focus Ring
   - EB Garamond serif for Detail Sector
   - Dynamic font sizing (30px/22px tiers)
3. **Touch interaction styles**:
   - `touch-action: none`
   - `-webkit-tap-highlight-color: transparent`
4. **Detail Sector opacity**: 0.5 default

### What v2 Should NOT Inherit:

1. **Hardcoded px values** - Convert to % of SSd
2. **!important flags** - CSS should own presentation naturally
3. **Inline styles** - All styling via classes
4. **Fixed 15px text** - Dynamic based on viewport

### Color Application Strategy:

```javascript
// v2 approach: Read from manifest, apply to CSS custom properties
const colorScheme = volume.display_config.color_scheme;

document.documentElement.style.setProperty('--color-bg', colorScheme.background);
document.documentElement.style.setProperty('--color-nodes', colorScheme.nodes);
document.documentElement.style.setProperty('--color-detail', colorScheme.detail_sector);
// etc.
```

---

## Summary

**Common Across All Volumes**:
- Montserrat uppercase 15px for Focus Ring
- EB Garamond serif for content text
- 50% Detail Sector opacity (except Fairhope)
- Gray #868686 default background
- Black text primary, white text secondary

**Unique Per Volume**:
- Background color (tan/blue/gray)
- Node colors (brown/teal/purple/yellow/red)
- Detail Sector color (purple for Bible/Fairhope)
- Hierarchy level colors (HG Music, MMdM)

**v2 Implementation**: Load volume manifest → extract color_scheme → apply via CSS custom properties → maintain v1 visual identity with clean architecture.
