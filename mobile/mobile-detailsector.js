/**
 * Mobile Detail Sector Module
 * Displays catalog information within the expanded Detail Sector area
 *
 * This module manages the display of detailed product information,
 * including descriptions, specifications, pricing, and media content
 * within the expanded blue circle area when a leaf item is selected.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Manages the Detail Sector content display
 */
class MobileDetailSector {
    constructor(viewportManager, dataManager, renderer) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.renderer = renderer; // Reference to parent renderer

        // DOM element cache
        this.detailItemsGroup = null;

        // Current state
        this.currentItem = null;
        this.isVisible = false;
    }

    /**
     * Initialize the Detail Sector with DOM element
     */
    initialize(detailItemsGroup) {
        this.detailItemsGroup = detailItemsGroup;
        Logger.debug('MobileDetailSector initialized');
    }

    /**
     * Show detail content for a selected item
     * Called after the Detail Sector expansion animation completes
     */
    showDetailContent(item) {
        if (!item) {
            Logger.warn('No item provided for detail display');
            return;
        }

        Logger.debug('📋 Showing detail content for item:', item.name);
        this.currentItem = item;
        this.isVisible = true;

        // Clear any existing content
        if (this.detailItemsGroup) {
            this.detailItemsGroup.innerHTML = '';
            this.detailItemsGroup.classList.remove('hidden');
        }

        // Create and display the detail content
        this.renderDetailContent(item);
    }

    /**
     * Hide the detail content
     * Called when collapsing the Detail Sector
     */
    hideDetailContent() {
        Logger.debug('📋 Hiding detail content');
        this.currentItem = null;
        this.isVisible = false;

        if (this.detailItemsGroup) {
            this.detailItemsGroup.innerHTML = '';
            this.detailItemsGroup.classList.add('hidden');
        }
    }

    /**
     * Render the detailed content for an item
     */
    renderDetailContent(item) {
        if (!this.detailItemsGroup) {
            Logger.error('Detail items group not initialized');
            return;
        }

        // Get the expanded circle parameters for positioning
        const arcParams = this.viewport.getArcParameters();
        const circleCenterX = arcParams.centerX;
        const circleCenterY = arcParams.centerY;
        const circleRadius = arcParams.radius * 0.98; // Same as expanded circle

        // Create a group for the detail content
        const contentGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentGroup.setAttribute('class', 'detail-content');

        // Position content within the circle area
        // Use a smaller area to leave margins
        const contentRadius = circleRadius * 0.85;
        const contentCenterX = circleCenterX;
        const contentCenterY = circleCenterY;

        // Add the poem at viewport center (0, 0)
        const poemLines = [
            "IN THE ELDER DAYS OF ART,",
            "BUILDERS WROUGHT WITH GREATEST CARE,",
            "EACH MINUTE AND UNSEEN PART,",
            "FOR THE GODS SEE EVERYWHERE."
        ];
        
        const poemLineHeight = 22;
        const totalPoemHeight = poemLines.length * poemLineHeight;
        const poemStartY = -(totalPoemHeight / 2) + 11; // Center vertically around y=0, +11 to adjust baseline
        
        Logger.debug(`📋 Rendering poem at viewport center (0, 0)`);
        
        poemLines.forEach((line, index) => {
            const yPos = poemStartY + (index * poemLineHeight);
            const poemText = this.createTextElement(
                line,
                0, // x = 0 (viewport center)
                yPos,
                'middle',
                '16px',
                '#ffd700', // Bright gold color for visibility
                'italic'
            );
            poemText.setAttribute('font-family', 'serif'); // Add serif font for classic look
            poemText.setAttribute('font-weight', 'bold'); // Make it bold for visibility
            contentGroup.appendChild(poemText);
            Logger.debug(`📋 Poem line ${index + 1}: "${line}" at (0, ${yPos.toFixed(1)})`);
        });
        
        // Create title text
        const titleText = this.createTextElement(
            item.name,
            contentCenterX,
            contentCenterY - contentRadius * 0.15,
            'middle',
            '18px',
            '#ffffff',
            'bold'
        );
        contentGroup.appendChild(titleText);

        // Get item details from the data structure
        const itemDetails = this.extractItemDetails(item);

        // Create description text if available
        if (itemDetails.description) {
            const descText = this.createTextElement(
                itemDetails.description,
                contentCenterX,
                contentCenterY - contentRadius * 0.15,
                'middle',
                '12px',
                '#cccccc'
            );
            descText.setAttribute('textLength', contentRadius * 1.5); // Allow text wrapping
            descText.setAttribute('lengthAdjust', 'spacingAndGlyphs');
            contentGroup.appendChild(descText);
        }

        // Create specifications list
        const specsY = contentCenterY - contentRadius * 0.05;
        const specs = this.createSpecificationsList(itemDetails, contentCenterX, specsY, contentRadius);
        specs.forEach(spec => contentGroup.appendChild(spec));

        // Create pricing information if available
        if (itemDetails.price) {
            const priceText = this.createTextElement(
                `Price: ${itemDetails.price}`,
                contentCenterX,
                contentCenterY + contentRadius * 0.15,
                'middle',
                '14px',
                '#ffff00',
                'bold'
            );
            contentGroup.appendChild(priceText);
        }

        // Create alternatives section if available
        if (itemDetails.alternatives && itemDetails.alternatives.length > 0) {
            const altY = contentCenterY + contentRadius * 0.25;
            const altTitle = this.createTextElement(
                'Alternatives:',
                contentCenterX,
                altY,
                'middle',
                '12px',
                '#ffffff',
                'bold'
            );
            contentGroup.appendChild(altTitle);

            itemDetails.alternatives.slice(0, 3).forEach((alt, index) => {
                const altText = this.createTextElement(
                    `• ${alt}`,
                    contentCenterX,
                    altY + 20 + (index * 15),
                    'middle',
                    '11px',
                    '#cccccc'
                );
                contentGroup.appendChild(altText);
            });
        }

        // Add the content group to the detail items group
        this.detailItemsGroup.appendChild(contentGroup);

        Logger.debug(`📋 Detail content rendered for ${item.name} with ${specs.length} specifications`);
    }

    /**
     * Create a text element with specified properties
     */
    createTextElement(text, x, y, anchor, fontSize, color, weight = 'normal') {
        const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', anchor);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('fill', color);
        
        // Handle font-weight and font-style
        if (weight === 'italic') {
            textElement.setAttribute('font-style', 'italic');
            textElement.setAttribute('font-weight', 'normal');
        } else {
            textElement.setAttribute('font-weight', weight);
        }
        
        textElement.textContent = text;
        return textElement;
    }

    /**
     * Extract detailed information from an item
     */
    extractItemDetails(item) {
        const details = {
            description: null,
            specifications: [],
            price: null,
            alternatives: []
        };

        // Extract description
        if (item.description) {
            details.description = item.description;
        } else if (item.long_description) {
            details.description = item.long_description;
        }

        // Extract specifications from various possible fields
        const specFields = ['specifications', 'specs', 'technical_specs', 'details'];
        for (const field of specFields) {
            if (item[field]) {
                if (Array.isArray(item[field])) {
                    details.specifications = item[field];
                } else if (typeof item[field] === 'object') {
                    // Convert object to array of key-value pairs
                    details.specifications = Object.entries(item[field]).map(([key, value]) => `${key}: ${value}`);
                } else if (typeof item[field] === 'string') {
                    details.specifications = item[field].split(',').map(s => s.trim());
                }
                break;
            }
        }

        // Extract price information
        if (item.price) {
            details.price = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : item.price;
        } else if (item.cost) {
            details.price = typeof item.cost === 'number' ? `$${item.cost.toFixed(2)}` : item.cost;
        }

        // Extract alternatives
        if (item.alternatives) {
            if (Array.isArray(item.alternatives)) {
                details.alternatives = item.alternatives;
            } else if (typeof item.alternatives === 'string') {
                details.alternatives = item.alternatives.split(',').map(s => s.trim());
            }
        }

        // If no specifications found, try to extract from other fields
        if (details.specifications.length === 0) {
            const possibleSpecFields = ['model', 'type', 'category', 'manufacturer'];
            possibleSpecFields.forEach(field => {
                if (item[field] && typeof item[field] === 'string') {
                    details.specifications.push(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${item[field]}`);
                }
            });
        }

        return details;
    }

    /**
     * Create a list of specification text elements
     */
    createSpecificationsList(details, centerX, startY, maxWidth) {
        const specs = [];
        const lineHeight = 15;
        const maxLines = 6; // Limit to prevent overflow

        details.specifications.slice(0, maxLines).forEach((spec, index) => {
            // Truncate long specifications
            const truncatedSpec = spec.length > 30 ? spec.substring(0, 27) + '...' : spec;

            const specText = this.createTextElement(
                truncatedSpec,
                centerX,
                startY + (index * lineHeight),
                'middle',
                '11px',
                '#bbbbbb'
            );
            specs.push(specText);
        });

        return specs;
    }

    /**
     * Handle viewport changes
     */
    handleViewportChange() {
        // If detail content is currently visible, re-render it with new viewport
        if (this.isVisible && this.currentItem) {
            Logger.debug('📋 Re-rendering detail content due to viewport change');
            this.renderDetailContent(this.currentItem);
        }
    }

    /**
     * Reset the module state
     */
    reset() {
        this.hideDetailContent();
        Logger.debug('MobileDetailSector reset');
    }
}

export { MobileDetailSector };