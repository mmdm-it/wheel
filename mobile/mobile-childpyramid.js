/**
 * Mobile Child Pyramid Module
 * Handles the concentric arc display for hierarchical child items
 * 
 * This module manages the dynamic positioning and interaction of the Child Pyramid,
 * which displays hierarchical data in three concentric arcs with responsive layout.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Manages the Child Pyramid display with dynamic arc positioning
 */
class MobileChildPyramid {
    constructor(viewportManager, dataManager, renderer) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.renderer = renderer; // Reference to parent renderer for migration callbacks
        
        // DOM element cache
        this.childRingGroup = null;
        
        // Cache for node positions (used by fan lines)
        this.nodePositions = [];
    this.currentItems = [];
    this.currentItemType = '';
        
        // Pyramid arc configuration - all relative to focus ring radius
        // Fill order: chpyr_70 (middle), chpyr_55 (inner), chpyr_85 (outer)
        this.pyramidArcs = [
            { name: 'chpyr_70', radiusRatio: 0.75, maxNodes: 7 },
            { name: 'chpyr_55', radiusRatio: 0.65, maxNodes: 4 },
            { name: 'chpyr_85', radiusRatio: 0.85, maxNodes: 8 }
        ];
    }
    
    /**
     * Initialize the Child Pyramid with DOM element
     */
    initialize(childRingGroup) {
        this.childRingGroup = childRingGroup;
        Logger.debug('MobileChildPyramid initialized');
    }
    
    /**
     * Show Child Pyramid with given items
     */
    showChildPyramid(items, itemType) {
        if (!items || items.length === 0) {
            Logger.warn(`🔺 No items provided for child pyramid (${itemType})`);
            return;
        }
        
        Logger.debug(`🔺 Showing child pyramid with ${items.length} ${itemType}`);
    this.currentItems = [...items];
    this.currentItemType = itemType;
        
        // Sort items based on type
        const sortedItems = this.sortChildPyramidItems(items, itemType);
        Logger.debug(`🔺 Sorted items:`, sortedItems.map(item => item.name));
        
        // Clear child ring group and reset caches
        this.childRingGroup.innerHTML = '';
        this.nodePositions = [];
        this.childRingGroup.classList.remove('hidden');
        
        // Create pyramid arcs
        this.createChildPyramidArcs(sortedItems);
        
        // Draw fan lines from magnifier to each pyramid node
        this.createFanLines();
        
        Logger.debug(`🔺 Child pyramid created successfully`);
    }
    
    /**
     * Sort items for Child Pyramid display
     */
    sortChildPyramidItems(items, itemType) {
        if (!items || items.length === 0) {
            return items;
        }

        // Pure universal approach: Use metadata to determine sort behavior
        const firstItem = items[0];
        if (!firstItem.__level) {
            Logger.warn('Items missing __level metadata, returning unsorted');
            return items;
        }

        const levelConfig = this.dataManager.getHierarchyLevelConfig(firstItem.__level);
        const sortType = levelConfig && levelConfig.sort_type || 'alphabetical';

        const sorted = [...items];
        
        switch(sortType) {
            case 'numeric_desc':
                // Sort numerically descending (e.g., "12" > "9" > "6")
                return sorted.sort((a, b) => {
                    const numA = parseFloat(a.name);
                    const numB = parseFloat(b.name);
                    return numB - numA;
                });
            
            case 'numeric_asc':
                // Sort numerically ascending
                return sorted.sort((a, b) => {
                    const numA = parseFloat(a.name);
                    const numB = parseFloat(b.name);
                    return numA - numB;
                });
            
            case 'alphabetical':
            default:
                // Sort alphabetically
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
    }
    
    /**
     * Create the three concentric pyramid arcs
     */
    createChildPyramidArcs(items) {
        const arcParams = this.viewport.getArcParameters();
        const focusRingRadius = arcParams.radius;
        
        Logger.debug(`🔺 Focus ring radius: ${focusRingRadius}px`);
        
        // Use the SAME center as the focus ring
        const pyramidCenterX = arcParams.centerX;
        const pyramidCenterY = arcParams.centerY;
        
        // Calculate magnifier angle once (used by all arcs)
        const magnifierAngle = this.viewport.getCenterAngle();
        
        Logger.debug(`🔺 Pyramid center: (${pyramidCenterX}, ${pyramidCenterY}), magnifier angle: ${(magnifierAngle * 180 / Math.PI).toFixed(1)}°`);
        
        // Distribute items across arcs (sequential fill)
        let itemIndex = 0;
        
        this.pyramidArcs.forEach(arc => {
            // Calculate actual radius (don't mutate config)
            const actualRadius = focusRingRadius * arc.radiusRatio;
            
            const arcItems = items.slice(itemIndex, itemIndex + arc.maxNodes);
            Logger.debug(`🔺 Processing ${arc.name}: ${arcItems.length} items`);
            if (arcItems.length > 0) {
                this.createPyramidArc(arc, arcItems, pyramidCenterX, pyramidCenterY, actualRadius, magnifierAngle);
                itemIndex += arcItems.length;
            }
        });
        
        Logger.debug(`🔺 Created ${this.childRingGroup.children.length} pyramid nodes`);
    }
    
    /**
     * Create a single pyramid arc
     * Items are placed from center outward to the ends of the arc
     * Arc is centered on the magnifier angle (half nodes above, half below)
     */
    createPyramidArc(arcConfig, items, centerX, centerY, actualRadius, magnifierAngle) {
        const angleStep = 8 * Math.PI / 180; // 8 degrees for all arcs
        
        // Calculate start angle so arc is centered on magnifier
        // For odd count: middle node at magnifier angle
        // For even count: magnifier angle is between two middle nodes
        const startAngle = magnifierAngle - ((items.length - 1) / 2) * angleStep;
        
        Logger.debug(`🔺 Creating ${arcConfig.name} arc: radius=${actualRadius}px, ${items.length} items, start angle: ${(startAngle * 180 / Math.PI).toFixed(1)}°`);
        
        // Calculate center-outward placement order
        const placementOrder = this.getCenterOutwardOrder(items.length);
        
        items.forEach((item, index) => {
            // Use placement order to position from center outward
            const positionIndex = placementOrder[index];
            const angle = startAngle + positionIndex * angleStep;
            const x = centerX + actualRadius * Math.cos(angle);
            const y = centerY + actualRadius * Math.sin(angle);
            
            // Cache node position for fan lines
            this.nodePositions.push({ x, y });
            
            const element = this.createChildPyramidElement(item, x, y, arcConfig.name, angle);
            this.childRingGroup.appendChild(element);
        });
    }
    
    /**
     * Calculate center-outward placement order
     * Returns array of position indices that fill from center outward
     * Example: for 7 nodes -> [3, 4, 2, 5, 1, 6, 0] (middle first, then alternating)
     */
    getCenterOutwardOrder(count) {
        const order = [];
        const middle = Math.floor(count / 2);
        
        // Start with the middle position
        order.push(middle);
        
        // Alternate between right and left of center
        for (let offset = 1; offset <= middle; offset++) {
            // Add position to the right of center
            if (middle + offset < count) {
                order.push(middle + offset);
            }
            // Add position to the left of center
            if (middle - offset >= 0) {
                order.push(middle - offset);
            }
        }
        
        return order;
    }
    
    /**
     * Create a single Child Pyramid element
     */
    createChildPyramidElement(item, x, y, arcName, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('child-pyramid-item', arcName);
        g.setAttribute('data-key', item.key);
        
        // Store essential item data - pure metadata approach
        const itemData = {
            name: item.name,
            key: item.key,
            __level: item.__level,
            __levelDepth: item.__levelDepth,
            __path: item.__path
        };
        
        g.setAttribute('data-item', JSON.stringify(itemData));
        
        // Create generous hit zone (invisible circle 1.5x larger than visual node)
        const hitRadius = MOBILE_CONFIG.RADIUS.CHILD_NODE * 1.5;
        const hitZone = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        hitZone.setAttribute('cx', x);
        hitZone.setAttribute('cy', y);
        hitZone.setAttribute('r', hitRadius);
        hitZone.setAttribute('fill', 'transparent');
        hitZone.setAttribute('stroke', 'none');
        hitZone.classList.add('hit-zone');
        hitZone.style.cursor = 'pointer';
        
        // Create visual circle with configurable color
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.CHILD_NODE);
        circle.setAttribute('fill', this.getItemColor(item));
        circle.classList.add('node');
        
        // Create text with configurable formatting
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        text.textContent = this.formatItemText(item);
        
        // Calculate text rotation (same logic as focus ring text)
        const textX = x;
        const textY = y + 4;
        let rotation = angle * 180 / Math.PI;
        let textAnchor = 'middle';
        
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.setAttribute('text-anchor', textAnchor);
        text.setAttribute('fill', 'black');
        text.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        
        // Append in correct order: visual elements first, then hit zone on top to catch events
        g.appendChild(circle);
        g.appendChild(text);
        g.appendChild(hitZone);
        
        // Single event handler on hit zone (most efficient approach)
        hitZone.addEventListener('click', (e) => {
            e.stopPropagation();
            Logger.debug(`🔺 Child Pyramid item clicked: ${item.name}`);
            this.handleChildPyramidClick(item, e);
        });
        
        // Touch handler for mobile devices
        hitZone.addEventListener('touchend', (e) => {
            // Only handle if this was a tap, not the end of a drag
            if (e.changedTouches.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                Logger.debug(`🔺 Child Pyramid item touched: ${item.name}`);
                this.handleChildPyramidClick(item, e);
            }
        });
        
        return g;
    }
    
    /**
     * Handle Child Pyramid item clicks (nzone migration)
     */
    handleChildPyramidClick(item, event) {
        Logger.debug(`🔺 Child pyramid item clicked: ${item.name}, initiating nzone migration`);
        
        // Delegate to renderer for migration logic
        this.renderer.handleChildPyramidClick(item, event);
    }
    
    /**
     * Create fan lines from magnifier to each Child Pyramid node
     * Uses cached node positions instead of DOM queries for better performance
     */
    createFanLines() {
        // Get magnifier position
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const magnifierX = magnifierPos.x;
        const magnifierY = magnifierPos.y;
        
        Logger.debug(`🔺 Creating fan lines from magnifier at (${magnifierX.toFixed(1)}, ${magnifierY.toFixed(1)})`);
        
        // Get pathLinesGroup from renderer
        const pathLinesGroup = this.renderer.elements.pathLinesGroup;
        if (!pathLinesGroup) {
            Logger.error('pathLinesGroup not found in renderer');
            return;
        }
        
        // Clear existing lines
        pathLinesGroup.innerHTML = '';
        
        // Draw lines using cached node positions
        this.nodePositions.forEach(pos => {
            const line = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
            line.setAttribute('x1', magnifierX.toString());
            line.setAttribute('y1', magnifierY.toString());
            line.setAttribute('x2', pos.x.toString());
            line.setAttribute('y2', pos.y.toString());
            line.setAttribute('stroke', 'black');
            line.setAttribute('stroke-width', '1');
            line.classList.add('fan-line');
            
            pathLinesGroup.appendChild(line);
        });
        
        Logger.debug(`🔺 Created ${this.nodePositions.length} fan lines`);
    }
    
    /**
     * Hide the Child Pyramid
     */
    hide() {
        if (this.childRingGroup) {
            this.childRingGroup.classList.add('hidden');
        }
        
        // Clear fan lines and cached positions
        if (this.renderer && this.renderer.elements && this.renderer.elements.pathLinesGroup) {
            this.renderer.elements.pathLinesGroup.innerHTML = '';
        }
        this.nodePositions = [];
        this.currentItems = [];
        this.currentItemType = '';
    }

    handleViewportChange() {
        if (!this.childRingGroup || this.childRingGroup.classList.contains('hidden')) {
            return;
        }

        if (!this.currentItems || this.currentItems.length === 0) {
            return;
        }

        Logger.debug('🔺 Viewport change detected - re-rendering Child Pyramid');
        // Re-render using stored items to adapt to new viewport dimensions
        this.showChildPyramid([...this.currentItems], this.currentItemType || 'items');
    }
    
    /**
     * Get configurable color for an item based on its type
     */
    getItemColor(item) {
        // Pure metadata-based approach
        const levelConfig = this.dataManager.getHierarchyLevelConfig(item.__level);
        return levelConfig && levelConfig.color || '#f1b800'; // Default to yellow
    }
    
    /**
     * Format item text based on configurable rules
     */
    formatItemText(item) {
        // Pure metadata-based approach
        const levelConfig = this.dataManager.getHierarchyLevelConfig(item.__level);
        const textFormat = levelConfig && levelConfig.text_format || 'title_case';
        return this.applyTextFormat(item.name, textFormat);
    }

    /**
     * Apply text formatting rules
     */
    applyTextFormat(text, format) {
        let formattedText = text;
        
        switch (format) {
            case 'uppercase':
                formattedText = formattedText.toUpperCase();
                break;
            case 'lowercase':
                formattedText = formattedText.toLowerCase();
                break;
            case 'title_case':
                formattedText = formattedText.replace(/\b\w/g, l => l.toUpperCase());
                break;
            case 'append_suffix':
                // Remove unit suffix if present (e.g., " Items", " Units")
                formattedText = formattedText.replace(/\s+\w+s?$/, '');
                break;
            default:
                // No transformation
                break;
        }
        
        return formattedText;
    }
}

export { MobileChildPyramid };