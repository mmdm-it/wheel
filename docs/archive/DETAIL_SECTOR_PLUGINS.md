# Detail Sector Plugins Specification

## Overview

The **Detail Sector** is the expanding circular region that displays leaf-level content (Bible verses, catalog products, song lyrics, social media posts). Because different volumes have fundamentally different content types, the Detail Sector uses a **plugin system** to render content appropriately.

**Core Principle**: The Detail Sector provides geometry and lifecycle management. Plugins provide content-specific rendering logic.

---

## What is a Plugin?

A **plugin** is a self-contained renderer for a specific content type:

**Bible Text Plugin**:
- Renders verse text with proper line wrapping
- Handles multi-line layout along the Detail Sector arc
- Adjusts font size based on content length
- Supports language-specific typography (Hebrew right-to-left, etc.)

**Catalog Card Plugin**:
- Renders product information (name, description, specs)
- Displays product images
- Shows price and availability
- Includes action buttons (view details, add to cart)

**Music Player and Lyrics Plugin** (Future):
- Self contained audio player
- Renders song lyrics with verse/chorus structure
- Syncs with audio playback
- Handles translations and annotations

**Social Post Plugin** (Future):
- Renders post text with formatting
- Displays embedded media (images, videos)
- Shows metadata (timestamp, likes, comments)

---

## Plugin Interface

Every plugin must implement this interface:

```javascript
class Plugin {
    /**
     * Can this plugin handle the given item?
     * @param {Object} item - The item to render
     * @returns {boolean} - True if plugin can render this item
     */
    canHandle(item) {
        throw new Error('Plugin.canHandle must be implemented');
    }
    
    /**
     * Render the item into the provided bounds
     * @param {Object} item - The item to render
     * @param {Object} bounds - Available geometry from DetailSectorGeometry
     * @returns {HTMLElement|SVGElement} - DOM element(s) to display
     */
    render(item, bounds) {
        throw new Error('Plugin.render must be implemented');
    }
    
    /**
     * Handle viewport resize
     * @param {Object} bounds - New geometry bounds
     */
    onResize(bounds) {
        // Optional: Re-layout content for new bounds
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        // Optional: Remove event listeners, clear caches, etc.
    }
    
    /**
     * Get plugin metadata
     * @returns {Object} - { name, version, contentTypes }
     */
    getMetadata() {
        return {
            name: 'UnknownPlugin',
            version: '1.0.0',
            contentTypes: []
        };
    }
}
```

---

## Plugin Registry

The **PluginRegistry** manages available plugins and selects the appropriate one for each item.

```javascript
class PluginRegistry {
    constructor() {
        this.plugins = [];
        this.cache = new Map(); // itemType → plugin
    }
    
    /**
     * Register a plugin
     * @param {Plugin} plugin - Plugin instance
     */
    register(plugin) {
        if (!(plugin instanceof Plugin)) {
            throw new Error('PluginRegistry.register: plugin must implement Plugin interface');
        }
        
        const metadata = plugin.getMetadata();
        console.log(`Registered plugin: ${metadata.name} v${metadata.version}`);
        
        this.plugins.push(plugin);
        this.cache.clear(); // Invalidate cache
    }
    
    /**
     * Unregister a plugin
     * @param {string} pluginName - Name of plugin to remove
     */
    unregister(pluginName) {
        this.plugins = this.plugins.filter(p => {
            return p.getMetadata().name !== pluginName;
        });
        this.cache.clear();
    }
    
    /**
     * Get appropriate plugin for item
     * @param {Object} item - Item to render
     * @returns {Plugin|null} - Plugin that can handle item, or null
     */
    getPlugin(item) {
        if (!item || !item.type) {
            console.warn('PluginRegistry.getPlugin: item missing type');
            return null;
        }
        
        // Check cache first
        if (this.cache.has(item.type)) {
            return this.cache.get(item.type);
        }
        
        // Find first plugin that can handle this item
        for (const plugin of this.plugins) {
            if (plugin.canHandle(item)) {
                this.cache.set(item.type, plugin);
                return plugin;
            }
        }
        
        console.warn(`PluginRegistry.getPlugin: no plugin for type "${item.type}"`);
        return null;
    }
    
    /**
     * List all registered plugins
     * @returns {Array} - Array of plugin metadata
     */
    list() {
        return this.plugins.map(p => p.getMetadata());
    }
}
```

---

## Bible Text Plugin

The reference implementation for text-heavy content.

### Requirements

**Text Wrapping**:
- Wrap text along Detail Sector arc boundary
- No wasted space (maximize line usage)
- No text overflow (truncate or adjust font size)

**Font Sizing**:
- Dynamic: short verses use large font, long verses use small font
- CSS-controlled tiers (e.g., 4.5% SSd, 4% SSd, 3.5% SSd, 3% SSd)
- All sizes expressed as percentage of SSd (shorter side dimension)
- Never use inline font calculations in JS

**Language Support**:
- Left-to-right (Latin, English, Greek, Russian)
- Right-to-left (Hebrew, Arabic)
- Proper character spacing for each language

**Line Positioning**:
- Use line table from DetailSectorGeometry
- Each line positioned along arc at calculated Y position
- Text left-aligned to arc boundary (calculated X position per line)

### Implementation Sketch

```javascript
class BibleTextPlugin extends Plugin {
    canHandle(item) {
        return item.type === 'verse';
    }
    
    render(item, bounds) {
        const container = document.createElement('div');
        container.className = 'detail-sector-content bible-text';
        
        // Get verse text (dimension-filtered by Volume)
        const text = item.text;
        if (!text) {
            console.warn('BibleTextPlugin: item missing text');
            return container;
        }
        
        // Determine font size tier based on text length
        const fontClass = this.selectFontTier(text, bounds);
        container.classList.add(fontClass);
        
        // Get line table from bounds (provided by DetailSectorGeometry)
        const lineTable = bounds.lineTable;
        
        // Wrap text into lines
        const lines = this.wrapText(text, lineTable);
        
        // Create text elements for each line
        lines.forEach((lineText, index) => {
            const lineInfo = lineTable[index];
            if (!lineInfo) return; // No more space
            
            const span = document.createElement('span');
            span.className = 'bible-text-line';
            span.textContent = lineText;
            span.style.position = 'absolute';
            span.style.left = `${lineInfo.leftX}px`; // Geometry-provided absolute coordinate
            span.style.top = `${lineInfo.y}px`;       // Geometry-provided absolute coordinate
            
            container.appendChild(span);
        });
        
        return container;
    }
    
    selectFontTier(text, bounds) {
        const charCount = text.length;
        const availableLines = bounds.lineTable.length;
        
        // Estimate: can we fit this text at each tier?
        // Tiers defined in CSS: font-tier-1 (4.5% SSd), font-tier-2 (4% SSd), etc.
        
        if (charCount < 100 && availableLines >= 3) return 'font-tier-1'; // 4.5% SSd
        if (charCount < 200 && availableLines >= 5) return 'font-tier-2'; // 4% SSd
        if (charCount < 400 && availableLines >= 8) return 'font-tier-3'; // 3.5% SSd
        return 'font-tier-4'; // 3% SSd
    }
    
    wrapText(text, lineTable) {
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';
        let lineIndex = 0;
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const lineInfo = lineTable[lineIndex];
            
            if (!lineInfo) {
                // No more lines available - text overflow
                lines.push(currentLine + '...');
                break;
            }
            
            // Check if testLine fits in available width
            if (this.textFits(testLine, lineInfo.maxChars)) {
                currentLine = testLine;
            } else {
                // Word doesn't fit, start new line
                lines.push(currentLine);
                currentLine = word;
                lineIndex++;
            }
        }
        
        // Push final line
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    textFits(text, maxChars) {
        // Simple character count check
        // Could be enhanced with actual text measurement
        return text.length <= maxChars;
    }
    
    onResize(bounds) {
        // Re-render with new bounds
        // Typically handled by DetailSectorView calling render() again
    }
    
    cleanup() {
        // No resources to clean up for basic text plugin
    }
    
    getMetadata() {
        return {
            name: 'BibleTextPlugin',
            version: '1.0.0',
            contentTypes: ['verse']
        };
    }
}
```

### CSS Contract

```css
/* Detail Sector container (provided by DetailSectorView) */
.detail-sector-content {
    position: absolute;
    overflow: hidden;
    /* Geometry set by DetailSectorView */
}

/* Bible text plugin styles */
.detail-sector-content.bible-text {
    color: var(--text-color); /* Volume-specific color */
    font-family: var(--text-font); /* Language-specific font */
}

/* Font size tiers (CSS controls fonts, not JS) */
/* All sizes as % of SSd (shorter side dimension) */
.bible-text.font-tier-1 { font-size: 4.5%; line-height: 1.4; }
.bible-text.font-tier-2 { font-size: 4%; line-height: 1.4; }
.bible-text.font-tier-3 { font-size: 3.5%; line-height: 1.4; }
.bible-text.font-tier-4 { font-size: 3%; line-height: 1.4; }

/* Individual text lines */
.bible-text-line {
    display: block;
    white-space: nowrap;
}

/* Right-to-left languages */
.bible-text[lang="he"],
.bible-text[lang="ar"] {
    direction: rtl;
    text-align: right;
}
```

---

## Catalog Card Plugin

For product information display.

### Requirements

**Layout**:
- Product image (if available)
- Product name and description
- Technical specifications
- Price and availability
- Action buttons (view details, add to cart)

**Responsive**:
- Adjust layout based on available bounds
- Scale image to fit
- Truncate description if too long

**Interactivity**:
- Buttons must be tappable
- Links to external product pages
- Add to cart functionality (volume-specific)

### Implementation Sketch

```javascript
class CatalogCardPlugin extends Plugin {
    canHandle(item) {
        return item.type === 'product';
    }
    
    render(item, bounds) {
        const container = document.createElement('div');
        container.className = 'detail-sector-content catalog-card';
        
        // Product image
        if (item.image) {
            const img = document.createElement('img');
            img.src = item.image;
            img.className = 'catalog-card-image';
            img.alt = item.name;
            container.appendChild(img);
        }
        
        // Product info section
        const info = document.createElement('div');
        info.className = 'catalog-card-info';
        
        // Product name
        const name = document.createElement('h3');
        name.className = 'catalog-card-name';
        name.textContent = item.name;
        info.appendChild(name);
        
        // Product description
        if (item.description) {
            const desc = document.createElement('p');
            desc.className = 'catalog-card-description';
            desc.textContent = this.truncateText(item.description, 200);
            info.appendChild(desc);
        }
        
        // Specifications
        if (item.specs) {
            const specs = document.createElement('ul');
            specs.className = 'catalog-card-specs';
            Object.entries(item.specs).forEach(([key, value]) => {
                const li = document.createElement('li');
                li.textContent = `${key}: ${value}`;
                specs.appendChild(li);
            });
            info.appendChild(specs);
        }
        
        // Price
        if (item.price) {
            const price = document.createElement('div');
            price.className = 'catalog-card-price';
            price.textContent = this.formatPrice(item.price);
            info.appendChild(price);
        }
        
        container.appendChild(info);
        
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'catalog-card-actions';
        
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'catalog-card-button';
        detailsBtn.textContent = 'View Details';
        detailsBtn.onclick = () => this.onViewDetails(item);
        actions.appendChild(detailsBtn);
        
        const cartBtn = document.createElement('button');
        cartBtn.className = 'catalog-card-button primary';
        cartBtn.textContent = 'Add to Cart';
        cartBtn.onclick = () => this.onAddToCart(item);
        actions.appendChild(cartBtn);
        
        container.appendChild(actions);
        
        return container;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    formatPrice(price) {
        // Format based on current dimension (currency)
        // For now, simple USD formatting
        return `$${price.toFixed(2)}`;
    }
    
    onViewDetails(item) {
        // Open product detail page
        window.open(item.detailUrl, '_blank');
    }
    
    onAddToCart(item) {
        // Add to cart functionality
        console.log('Add to cart:', item);
        // Would dispatch event to app-level cart manager
    }
    
    getMetadata() {
        return {
            name: 'CatalogCardPlugin',
            version: '1.0.0',
            contentTypes: ['product']
        };
    }
}
```

### CSS Contract

```css
.catalog-card {
    display: flex;
    flex-direction: column;
    gap: 2.5%; /* % of SSd */
    padding: 3%; /* % of SSd */
    color: var(--text-color);
}

.catalog-card-image {
    width: 100%;
    max-height: 30%; /* % of SSd */
    object-fit: contain;
    border-radius: 1.2%; /* % of SSd */
}

.catalog-card-info {
    flex: 1;
}

.catalog-card-name {
    font-size: 3.7%; /* % of SSd */
    font-weight: bold;
    margin: 0 0 1.8% 0; /* % of SSd */
}

.catalog-card-description {
    font-size: 2.5%; /* % of SSd */
    line-height: 1.5;
    margin: 0 0 2.5% 0; /* % of SSd */
    color: var(--text-secondary);
}

.catalog-card-specs {
    list-style: none;
    padding: 0;
    margin: 0 0 2.5% 0; /* % of SSd */
    font-size: 2.2%; /* % of SSd */
}

.catalog-card-specs li {
    padding: 0.6% 0; /* % of SSd */
    border-bottom: 0.15% solid var(--border-color); /* % of SSd */
}

.catalog-card-price {
    font-size: 4.3%; /* % of SSd */
    font-weight: bold;
    color: var(--accent-color);
    margin: 2.5% 0; /* % of SSd */
}

.catalog-card-actions {
    display: flex;
    gap: 1.8%; /* % of SSd */
}

.catalog-card-button {
    flex: 1;
    padding: 1.8% 3.7%; /* % of SSd */
    border: 0.15% solid var(--border-color); /* % of SSd */
    border-radius: 1.2%; /* % of SSd */
    background: transparent;
    color: var(--text-color);
    font-size: 2.5%; /* % of SSd */
    cursor: pointer;
}

.catalog-card-button.primary {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
}

.catalog-card-button:hover {
    opacity: 0.8;
}
```

---

## Detail Sector View Integration

The **DetailSectorView** manages the Detail Sector lifecycle and delegates rendering to plugins.

```javascript
class DetailSectorView {
    constructor(container, geometry, pluginRegistry) {
        this.container = container;
        this.geometry = geometry;
        this.pluginRegistry = pluginRegistry;
        this.currentPlugin = null;
        this.contentElement = null;
    }
    
    /**
     * Render item using appropriate plugin
     * @param {Object} item - Item to display
     */
    render(item) {
        // Get plugin for this item type
        const plugin = this.pluginRegistry.getPlugin(item);
        if (!plugin) {
            console.error('DetailSectorView: no plugin for item', item);
            return;
        }
        
        // Clean up previous content
        if (this.currentPlugin) {
            this.currentPlugin.cleanup();
        }
        if (this.contentElement) {
            this.contentElement.remove();
        }
        
        // Get geometry bounds
        const bounds = this.geometry.getContentBounds();
        
        // Render content using plugin
        this.contentElement = plugin.render(item, bounds);
        if (!this.contentElement) {
            console.error('DetailSectorView: plugin.render returned null');
            return;
        }
        
        // Add to container
        this.container.appendChild(this.contentElement);
        this.currentPlugin = plugin;
        
        // Animate expansion (handled by CSS transitions)
        this.expand();
    }
    
    /**
     * Expand Detail Sector circle
     */
    expand() {
        this.container.classList.add('expanded');
        // CSS handles the expansion animation
    }
    
    /**
     * Collapse Detail Sector
     * @param {number} duration - Animation duration in ms
     */
    collapse(duration = 400) {
        this.container.classList.remove('expanded');
        
        // Clean up after collapse animation
        setTimeout(() => {
            if (this.currentPlugin) {
                this.currentPlugin.cleanup();
                this.currentPlugin = null;
            }
            if (this.contentElement) {
                this.contentElement.remove();
                this.contentElement = null;
            }
        }, duration);
    }
    
    /**
     * Handle viewport resize
     */
    onResize() {
        if (this.currentPlugin && this.contentElement) {
            const bounds = this.geometry.getContentBounds();
            this.currentPlugin.onResize(bounds);
            
            // May need to re-render if plugin doesn't handle resize internally
            // For now, trust plugin to update its content
        }
    }
    
    /**
     * Scroll content (if scrollable)
     * @param {number} position - Scroll position
     */
    scrollTo(position) {
        if (this.contentElement) {
            this.contentElement.scrollTop = position;
        }
    }
    
    /**
     * Clean up all resources
     */
    clear() {
        if (this.currentPlugin) {
            this.currentPlugin.cleanup();
            this.currentPlugin = null;
        }
        if (this.contentElement) {
            this.contentElement.remove();
            this.contentElement = null;
        }
        this.container.classList.remove('expanded');
    }
}
```

---

## Geometry Contract

The **DetailSectorGeometry** module provides bounds and line tables for plugins.

### Bounds Object

```javascript
{
    // Usable rectangle (conservative estimate inside arc)
    topY: -200,              // Top edge Y coordinate
    bottomY: 300,            // Bottom edge Y coordinate
    leftX: -150,             // Left edge X coordinate (constrained by arc)
    rightX: 250,             // Right edge X coordinate
    
    // Arc parameters (for advanced positioning)
    arcCenterX: 593.19,      // Arc center X
    arcCenterY: -333.5,      // Arc center Y
    arcRadius: 780.69,       // Arc radius (inner edge)
    
    // Viewport info
    viewportWidth: 650,
    viewportHeight: 650,
    SSd: 650,                // Shorter side dimension
    
    // Line table (for text wrapping plugins)
    lineTable: [
        { y: -180, leftX: -145, rightX: 245, availableWidth: 390, maxChars: 55 },
        { y: -155, leftX: -143, rightX: 245, availableWidth: 388, maxChars: 54 },
        { y: -130, leftX: -140, rightX: 245, availableWidth: 385, maxChars: 54 },
        // ... more lines
    ]
}
```

### Line Table Format

Each line provides:
- `y`: Vertical position for this line
- `leftX`: Left boundary (calculated from arc intersection)
- `rightX`: Right boundary (with padding)
- `availableWidth`: Total width available for text
- `maxChars`: Estimated character capacity (based on font size)

**Usage**: Text plugins use line table to wrap text along the arc boundary.

---

## Plugin Development Guidelines

### Do's ✅

**Pure Rendering**:
- Plugins render based on provided item and bounds
- No navigation state management
- No touch handling (except scroll within content)

**CSS for Styling**:
- Use semantic CSS classes
- Let CSS define fonts, colors, spacing
- No inline styles (except positioning from geometry)

**Responsive**:
- Implement `onResize()` to handle viewport changes
- Use relative units where possible
- Test on square, portrait, landscape viewports

**Clean Up**:
- Implement `cleanup()` to remove event listeners
- Clear any caches or timers
- Remove any global state

### Don'ts ❌

**No Navigation**:
- Don't implement back/forward buttons
- Don't change hierarchy position
- Don't trigger migrations

**No State**:
- Don't store navigation state
- Don't cache items (Volume does this)
- Don't manage dimension values

**No Hardcoded Geometry**:
- Don't assume viewport size
- Use bounds object for all positioning
- No pixel values in JS (use CSS)

**No Defensive Programming**:
- If item is invalid, throw error
- If bounds are invalid, throw error
- Trust the contract, don't work around it

---

## Testing

### Unit Tests

```javascript
test('BibleTextPlugin handles verse items', () => {
    const plugin = new BibleTextPlugin();
    const verse = { type: 'verse', text: 'In the beginning...' };
    
    expect(plugin.canHandle(verse)).toBe(true);
});

test('BibleTextPlugin renders text with correct font tier', () => {
    const plugin = new BibleTextPlugin();
    const shortVerse = { type: 'verse', text: 'Jesus wept.' };
    const bounds = mockBounds({ lineTable: Array(10).fill({}) });
    
    const element = plugin.render(shortVerse, bounds);
    expect(element.classList.contains('font-tier-1')).toBe(true);
});

test('CatalogCardPlugin handles product items', () => {
    const plugin = new CatalogCardPlugin();
    const product = { type: 'product', name: 'Widget', price: 99.99 };
    
    expect(plugin.canHandle(product)).toBe(true);
});
```

### Integration Tests

```javascript
test('DetailSectorView uses correct plugin for item type', () => {
    const registry = new PluginRegistry();
    registry.register(new BibleTextPlugin());
    registry.register(new CatalogCardPlugin());
    
    const view = new DetailSectorView(container, geometry, registry);
    const verse = { type: 'verse', text: 'Test verse' };
    
    view.render(verse);
    
    expect(container.querySelector('.bible-text')).not.toBeNull();
});

test('Plugin content cleans up on collapse', () => {
    const view = new DetailSectorView(container, geometry, registry);
    const verse = { type: 'verse', text: 'Test verse' };
    
    view.render(verse);
    expect(container.children.length).toBe(1);
    
    view.collapse(0);
    expect(container.children.length).toBe(0);
});
```

### Visual Tests

**Bible Text Plugin**:
- Short verse (10 words) → Large font, 2-3 lines
- Medium verse (40 words) → Medium font, 6-8 lines
- Long verse (80 words) → Small font, 12-15 lines
- Hebrew text → Right-to-left, proper character spacing
- Greek text → Proper diacritics, no overlap

**Catalog Card Plugin**:
- Product with image → Image scales to fit
- Product without image → Layout adjusts gracefully
- Long description → Truncates with ellipsis
- Action buttons → Tappable, proper hit targets

---

## Future Plugins

### Music Lyrics Plugin

**Features**:
- Verse/chorus structure highlighting
- Sync with audio playback
- Translation toggle
- Annotation support

**Challenges**:
- Real-time sync with audio
- Handling variable verse lengths
- Multi-language support

### Social Post Plugin

**Features**:
- Rich text formatting (bold, italic, links)
- Embedded media (images, videos, GIFs)
- Metadata display (timestamp, likes, comments)
- Reply threading

**Challenges**:
- Variable content types (text, image, video, poll)
- Responsive media sizing
- Loading performance for media

### Map Plugin

**Features**:
- Interactive map centered on location
- Markers for related items
- Zoom/pan controls
- Location metadata

**Challenges**:
- Map library integration
- Touch gesture conflicts with navigation
- Loading performance

### Timeline Plugin

**Features**:
- Chronological visualization
- Event markers
- Date range filtering
- Narrative flow

**Challenges**:
- Scaling time axis
- Variable event density
- Linking to hierarchy positions

---

## Plugin Distribution

### Phase 4 Scope

Phase 4 includes:
1. Plugin interface definition
2. PluginRegistry implementation
3. BibleTextPlugin (reference implementation)
4. CatalogCardPlugin (demonstrates interactivity)
5. DetailSectorView integration

### Post-Launch

After Phase 4 proves the plugin system:
- Document plugin API
- Create plugin development guide
- Publish example plugins
- Support community plugins (if volume types expand)

---

## Performance Considerations

### Rendering Performance

**Target**: Render plugin content in < 50ms

**Strategies**:
- Minimize DOM operations (batch updates)
- Use document fragments for multi-element plugins
- Cache expensive calculations (font metrics, line wrapping)
- Lazy load images and media

### Memory Management

**Target**: Plugin memory < 5MB per item

**Strategies**:
- Clean up resources in `cleanup()`
- Remove event listeners
- Clear image caches
- Avoid storing references to large objects

### Resize Performance

**Target**: Handle resize in < 100ms

**Strategies**:
- Debounce resize events (wait for user to finish)
- Only re-layout if bounds significantly change
- Cache previous bounds, diff before re-rendering

---

## Conclusion

The plugin system provides:

1. **Extensibility**: Easy to add new content types
2. **Separation of Concerns**: Plugins handle content, Detail Sector handles geometry/lifecycle
3. **Volume-Specific Rendering**: Each volume can have custom plugins
4. **Clean Contracts**: Clear interface, no cross-layer violations
5. **Performance**: Render and cleanup lifecycle prevents memory leaks

**Phase 4 Goal**: Prove plugin system works with Bible text and catalog cards.

**Post-Phase 4**: Document plugin API, support community plugins.

**No compromises**: Build it right or start over.
