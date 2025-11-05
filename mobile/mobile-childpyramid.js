/**
 * Mobile Child Pyramid Module
 * Handles the concentric arc display for cylinders, families, and models
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
        
        // Pyramid arc configuration - all relative to focus ring radius
        this.pyramidArcs = [
            { name: 'chpyr_85', radiusRatio: 0.90, maxNodes: 8, startAngleDegrees: 122 },
            { name: 'chpyr_70', radiusRatio: 0.80, maxNodes: 7, startAngleDegrees: 126 },
            { name: 'chpyr_55', radiusRatio: 0.70, maxNodes: 4, startAngleDegrees: 142 }
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
        
        // Sort items based on type
        const sortedItems = this.sortChildPyramidItems(items, itemType);
        Logger.debug(`🔺 Sorted items:`, sortedItems.map(item => item.name));
        
        // Clear and show child ring group
        this.childRingGroup.innerHTML = '';
        this.childRingGroup.classList.remove('hidden');
        
        // FORCE visibility for debugging
        this.childRingGroup.style.display = 'block';
        this.childRingGroup.style.visibility = 'visible';
        this.childRingGroup.style.opacity = '1';
        
        Logger.debug(`🔺 childRingGroup visibility forced - classList: ${this.childRingGroup.classList.toString()}`);
        Logger.debug(`🔺 childRingGroup parent:`, this.childRingGroup.parentElement?.id);
        Logger.debug(`🔺 childRingGroup in DOM:`, document.contains(this.childRingGroup));
        
        // Create pyramid arcs
        this.createChildPyramidArcs(sortedItems);
        Logger.debug(`🔺 Child pyramid created successfully`);
    }
    
    /**
     * Sort items for Child Pyramid display
     */
    sortChildPyramidItems(items, itemType) {
        const sorted = [...items];
        
        switch(itemType) {
            case 'cylinders':
                // Sort numerically (High to Low)
                return sorted.sort((a, b) => parseInt(b.name) - parseInt(a.name));
            
            case 'families':
                // Sort chronologically (assuming families have a date field or use alphabetical as proxy)
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
            
            case 'models':
                // Sort by displacement (assuming models have displacement data)
                return sorted.sort((a, b) => {
                    const dispA = parseFloat(a.data?.displacement || a.name.match(/[\d.]+/)?.[0] || 0);
                    const dispB = parseFloat(b.data?.displacement || b.name.match(/[\d.]+/)?.[0] || 0);
                    return dispA - dispB;
                });
            
            default:
                return sorted;
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
        
        const viewportInfo = this.viewport.getViewportInfo();
        Logger.debug(`🔺 Viewport: ${viewportInfo.width}x${viewportInfo.height}`);
        Logger.debug(`🔺 Pyramid center in SVG coords: (${pyramidCenterX}, ${pyramidCenterY})`);
        Logger.debug(`🔺 Focus ring center: (${arcParams.centerX}, ${arcParams.centerY}), radius: ${arcParams.radius}`);
        
        // Distribute items across arcs (sequential fill)
        let itemIndex = 0;
        
        this.pyramidArcs.forEach(arc => {
            // Calculate actual radius based on focus ring radius
            arc.actualRadius = focusRingRadius * arc.radiusRatio;
            
            const arcItems = items.slice(itemIndex, itemIndex + arc.maxNodes);
            Logger.debug(`🔺 Processing ${arc.name}: ${arcItems.length} items (slice ${itemIndex} to ${itemIndex + arc.maxNodes})`);
            Logger.debug(`🔺 ${arc.name} gets items:`, arcItems.map(item => item.name));
            if (arcItems.length > 0) {
                this.createPyramidArc(arc, arcItems, pyramidCenterX, pyramidCenterY);
                itemIndex += arcItems.length;
            } else {
                Logger.debug(`🔺 No items for ${arc.name} - skipping`);
            }
        });
        
        // Verify elements were actually added to DOM
        const totalElements = this.childRingGroup.children.length;
        Logger.debug(`🔺 Total elements in childRingGroup after creation: ${totalElements}`);
        Logger.debug(`🔺 childRingGroup HTML:`, this.childRingGroup.outerHTML.substring(0, 200) + '...');
    }
    
    /**
     * Create a single pyramid arc
     */
    createPyramidArc(arcConfig, items, centerX, centerY) {
        const angleStep = 8 * Math.PI / 180; // 8 degrees for all arcs
        
        const startAngle = arcConfig.startAngleDegrees * Math.PI / 180; // Convert to radians
        
        Logger.debug(`🔺 Creating ${arcConfig.name} arc: radius=${arcConfig.actualRadius}px, center=(${centerX}, ${centerY}), ${items.length} items`);
        Logger.debug(`🔺 ${arcConfig.name} start angle: ${arcConfig.startAngleDegrees}° (${(startAngle * 180 / Math.PI).toFixed(1)}° in radians)`);
        
        items.forEach((item, index) => {
            const angle = startAngle + index * angleStep;
            const x = centerX + arcConfig.actualRadius * Math.cos(angle);
            const y = centerY + arcConfig.actualRadius * Math.sin(angle);
            
            if (arcConfig.name === 'chpyr_85') {
                Logger.debug(`🔺 ${arcConfig.name} item ${index}: "${item.name}" at angle ${(angle * 180 / Math.PI).toFixed(1)}° → (${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
            
            const element = this.createChildPyramidElement(item, x, y, arcConfig.name, angle);
            this.childRingGroup.appendChild(element);
            
            // Verify element was actually appended
            Logger.debug(`🔺 Appended element to childRingGroup. Total children now: ${this.childRingGroup.children.length}`);
        });
    }
    
    /**
     * Create a single Child Pyramid element
     */
    createChildPyramidElement(item, x, y, arcName, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('child-pyramid-item', arcName);
        g.setAttribute('data-key', item.key);
        g.setAttribute('data-item', JSON.stringify({
            name: item.name,
            cylinderCount: item.cylinderCount,
            market: item.market,
            country: item.country,
            manufacturer: item.manufacturer,
            key: item.key
        }));
        
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
        circle.setAttribute('fill', this.getItemColor(item)); // Use configurable color
        circle.classList.add('node');
        
        Logger.debug(`🔺 Created ${arcName} element "${item.name}" at (${x}, ${y}) with visual radius ${MOBILE_CONFIG.RADIUS.CHILD_NODE} and hit radius ${hitRadius}`);
        
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
        
        // Add generous click handler to the hit zone
        hitZone.addEventListener('click', (e) => {
            console.log('🔺🔺🔺 HIT ZONE CLICKED!', item.name);
            e.stopPropagation();
            Logger.debug('🔺 Hit zone clicked for:', item.name);
            this.handleChildPyramidClick(item, e);
        });
        
        // Also add click handler to visual elements as backup
        circle.addEventListener('click', (e) => {
            console.log('🔺🔺🔺 CIRCLE CLICKED!', item.name);
            e.stopPropagation();
            Logger.debug('🔺 Circle clicked for:', item.name);
            this.handleChildPyramidClick(item, e);
        });
        
        // Also add click handler to text element since it's on top
        text.addEventListener('click', (e) => {
            console.log('🔺🔺🔺 TEXT CLICKED!', item.name);
            e.stopPropagation();
            Logger.debug('🔺 Text clicked for:', item.name);
            this.handleChildPyramidClick(item, e);
        });
        
        // Add touch handlers as additional backup for mobile
        hitZone.addEventListener('touchstart', (e) => {
            console.log('🔺🔺🔺 HIT ZONE TOUCHED START!', item.name);
        });
        
        hitZone.addEventListener('touchend', (e) => {
            console.log('🔺🔺🔺 HIT ZONE TOUCHED END!', item.name);
            // Only handle if this was a tap, not the end of a drag
            if (e.changedTouches.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                Logger.debug('🔺 Hit zone touched for:', item.name);
                this.handleChildPyramidClick(item, e);
            }
        });
        
        // Add touch handlers to text as well
        text.addEventListener('touchend', (e) => {
            console.log('🔺🔺🔺 TEXT TOUCHED END!', item.name);
            if (e.changedTouches.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                Logger.debug('🔺 Text touched for:', item.name);
                this.handleChildPyramidClick(item, e);
            }
        });
        
        // Verify element structure
        Logger.debug(`🔺 Created element structure: g(${g.children.length} children) -> hitZone(r=${hitRadius}) + circle(${circle.getAttribute('cx')},${circle.getAttribute('cy')}) + text`);
        
        return g;
    }
    
    /**
     * Handle Child Pyramid item clicks (nzone migration)
     */
    handleChildPyramidClick(item, event) {
        console.log('🔺🔺🔺 HANDLE CHILD PYRAMID CLICK CALLED!', item.name);
        Logger.debug('🔺 Child pyramid item clicked:', item.name, 'implementing nzone migration');
        
        // Delegate to renderer for migration logic
        this.renderer.handleChildPyramidClick(item, event);
    }
    
    /**
     * Hide the Child Pyramid
     */
    hide() {
        if (this.childRingGroup) {
            this.childRingGroup.classList.add('hidden');
        }
    }
    
    /**
     * Update pyramid layout for viewport changes
     */
    handleViewportChange() {
        // Recalculate positions if currently visible
        if (this.childRingGroup && !this.childRingGroup.classList.contains('hidden')) {
            // This would trigger a re-layout if items are currently displayed
            Logger.debug('Child Pyramid viewport change detected - re-layout needed');
        }
    }
    
    /**
     * Get configurable color for an item based on its type
     */
    getItemColor(item) {
        // Determine item type from properties
        let levelType = 'model'; // Default
        
        if (item.cylinderCount !== undefined) {
            levelType = 'cylinder';
        } else if (item.familyCode !== undefined) {
            levelType = 'family';
        } else if (item.manufacturer) {
            levelType = 'manufacturer';
        } else if (item.country) {
            levelType = 'country';
        } else if (item.market) {
            levelType = 'market';
        }
        
        // Get color from display config
        const levelConfig = this.dataManager.getHierarchyLevelConfig(levelType);
        return levelConfig?.color || '#f1b800'; // Default to yellow
    }
    
    /**
     * Format item text based on configurable rules
     */
    formatItemText(item) {
        // Determine item type from properties
        let levelType = 'model'; // Default
        
        if (item.cylinderCount !== undefined) {
            levelType = 'cylinder';
        } else if (item.familyCode !== undefined) {
            levelType = 'family';
        } else if (item.manufacturer) {
            levelType = 'manufacturer';
        } else if (item.country) {
            levelType = 'country';
        } else if (item.market) {
            levelType = 'market';
        }
        
        // Get text format from display config
        const levelConfig = this.dataManager.getHierarchyLevelConfig(levelType);
        const textFormat = levelConfig?.text_format || 'title_case';
        
        let formattedText = item.name;
        
        switch (textFormat) {
            case 'uppercase':
                formattedText = formattedText.toUpperCase();
                break;
            case 'lowercase':
                formattedText = formattedText.toLowerCase();
                break;
            case 'title_case':
                formattedText = formattedText.replace(/\b\w/g, l => l.toUpperCase());
                break;
            case 'append_cylinders':
                // Remove " Cylinders" suffix if present (for cylinder display)
                formattedText = formattedText.replace(' Cylinders', '');
                break;
            default:
                // No transformation
                break;
        }
        
        return formattedText;
    }
}

export { MobileChildPyramid };