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

        this.detailItemsGroup.innerHTML = '';

        const arcParams = this.viewport.getArcParameters();
        const circleRadius = arcParams.radius * 0.98;

        const contentGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentGroup.setAttribute('class', 'detail-content');
        contentGroup.setAttribute('transform', `translate(${arcParams.centerX} ${arcParams.centerY})`);

        const contentRadius = circleRadius * 0.82;
        const detailConfig = this.dataManager.getDetailSectorConfigForItem(item);
        const detailContext = this.dataManager.getDetailSectorContext(item);

        Logger.debug('📋 DetailSector: resolved config for item', {
            itemKey: item.key,
            level: item.__level,
            hasHeader: Boolean(detailConfig && detailConfig.header),
            viewCount: detailConfig && detailConfig.views ? detailConfig.views.length : 0
        });

        if (!detailConfig || (!detailConfig.header && (!detailConfig.views || detailConfig.views.length === 0))) {
            this.renderLegacyFallback(contentGroup, item, contentRadius);
            this.detailItemsGroup.appendChild(contentGroup);
            return;
        }

        let currentY = -contentRadius + 36;
        currentY = this.renderHeader(detailConfig.header, detailContext, contentGroup, currentY);

        (detailConfig.views || []).forEach(view => {
            currentY = this.renderView(view, detailContext, contentGroup, currentY, contentRadius);
        });

        this.detailItemsGroup.appendChild(contentGroup);
    }

    renderHeader(headerConfig, context, contentGroup, currentY) {
        const fallbackTitle = context.name || '';

        if (!headerConfig && fallbackTitle) {
            const title = this.createTextElement(fallbackTitle, 0, currentY, 'middle', '22px', '#ffffff', 'bold');
            contentGroup.appendChild(title);
            return currentY + 32;
        }

        if (!headerConfig) {
            return currentY;
        }

        const titleTemplate = headerConfig.title_template || headerConfig.title || fallbackTitle;
        const subtitleTemplate = headerConfig.subtitle_template || headerConfig.subtitle;

        const resolvedTitle = this.dataManager.resolveDetailTemplate(titleTemplate, context) || fallbackTitle;
        const resolvedSubtitle = this.dataManager.resolveDetailTemplate(subtitleTemplate, context);

        if (resolvedTitle) {
            const title = this.createTextElement(resolvedTitle, 0, currentY, 'middle', '22px', '#ffffff', 'bold');
            contentGroup.appendChild(title);
            currentY += 30;
        }

        if (resolvedSubtitle) {
            const subtitle = this.createTextElement(resolvedSubtitle, 0, currentY, 'middle', '14px', '#d0d0d0');
            contentGroup.appendChild(subtitle);
            currentY += 22;
        }

        return currentY;
    }

    renderView(viewConfig, context, contentGroup, currentY, contentRadius) {
        if (!viewConfig || viewConfig.hidden === true) {
            return currentY;
        }

        const viewType = (viewConfig.type || 'info').toLowerCase();

        Logger.debug('📋 DetailSector: rendering view', {
            id: viewConfig.id || '(anonymous)',
            type: viewType
        });

        switch (viewType) {
            case 'info':
                return this.renderInfoView(viewConfig, context, contentGroup, currentY);
            case 'list':
                return this.renderListView(viewConfig, context, contentGroup, currentY);
            case 'gallery':
                return this.renderGalleryView(viewConfig, context, contentGroup, currentY);
            case 'links':
                return this.renderLinksView(viewConfig, context, contentGroup, currentY);
            default:
                Logger.debug(`📋 Unsupported detail view type: ${viewConfig.type}`);
                return currentY;
        }
    }

    renderInfoView(viewConfig, context, contentGroup, currentY) {
        const titleTemplate = viewConfig.title_template || viewConfig.title;
        const subtitleTemplate = viewConfig.subtitle_template || viewConfig.subtitle;
        const bodyTemplate = viewConfig.body_template || viewConfig.body;

        const title = this.dataManager.resolveDetailTemplate(titleTemplate, context);
        const subtitle = this.dataManager.resolveDetailTemplate(subtitleTemplate, context);
        const body = this.dataManager.resolveDetailTemplate(bodyTemplate, context);

        if (title) {
            const titleElement = this.createTextElement(title, 0, currentY, 'middle', '18px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 24;
        }

        if (subtitle) {
            const subtitleElement = this.createTextElement(subtitle, 0, currentY, 'middle', '13px', '#d0d0d0');
            contentGroup.appendChild(subtitleElement);
            currentY += 20;
        }

        if (body) {
            const lines = this.wrapText(body, 42);
            lines.forEach(line => {
                const bodyElement = this.createTextElement(line, 0, currentY, 'middle', '12px', '#c0c0c0');
                contentGroup.appendChild(bodyElement);
                currentY += 16;
            });
        }

        const fields = Array.isArray(viewConfig.fields) ? viewConfig.fields : [];

        fields.forEach(field => {
            const labelTemplate = field.label_template || field.label;
            const valueTemplate = field.value_template || field.value;

            const label = this.dataManager.resolveDetailTemplate(labelTemplate, context);
            const value = this.dataManager.resolveDetailTemplate(valueTemplate, context);

            if (!label && !value) {
                return;
            }

            const combined = label && value ? `${label}: ${value}` : (label || value);
            const fieldElement = this.createTextElement(combined, 0, currentY, 'middle', '12px', '#b0b0b0');
            contentGroup.appendChild(fieldElement);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderListView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        Logger.debug('📋 DetailSector: list view data', {
            id: viewConfig.id || '(anonymous)',
            totalItems: items.length
        });

        if (title) {
            const titleElement = this.createTextElement(title, 0, currentY, 'middle', '16px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
            const emptyElement = this.createTextElement(emptyMessage, 0, currentY, 'middle', '12px', '#888888');
            contentGroup.appendChild(emptyElement);
            return currentY + 20;
        }

        items.slice(0, viewConfig.max_items || 4).forEach(item => {
            const itemContext = this.combineContext(context, item);

            const primary = this.dataManager.resolveDetailTemplate(viewConfig.item?.primary_template, itemContext) || '';
            const secondary = this.dataManager.resolveDetailTemplate(viewConfig.item?.secondary_template, itemContext) || '';
            const meta = this.dataManager.resolveDetailTemplate(viewConfig.item?.meta_template, itemContext) || '';
            const badge = this.dataManager.resolveDetailTemplate(viewConfig.item?.badge_template, itemContext) || '';

            const primaryText = primary ? `• ${primary}` : null;
            if (primaryText) {
                const primaryElement = this.createTextElement(primaryText, 0, currentY, 'middle', '12px', '#ffffff');
                contentGroup.appendChild(primaryElement);
                currentY += 16;
            }

            if (secondary) {
                const secondaryElement = this.createTextElement(secondary, 0, currentY, 'middle', '11px', '#cccccc');
                contentGroup.appendChild(secondaryElement);
                currentY += 15;
            }

            if (meta || badge) {
                const summary = [meta, badge].filter(Boolean).join(' · ');
                if (summary) {
                    const summaryElement = this.createTextElement(summary, 0, currentY, 'middle', '10px', '#9fd2ff');
                    contentGroup.appendChild(summaryElement);
                    currentY += 14;
                }
            }

            currentY += 6;
        });

        return currentY + 12;
    }

    renderGalleryView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        Logger.debug('📋 DetailSector: gallery view data', {
            id: viewConfig.id || '(anonymous)',
            totalItems: items.length
        });

        if (title) {
            const titleElement = this.createTextElement(title, 0, currentY, 'middle', '16px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            return this.renderEmptyState(viewConfig, context, contentGroup, currentY);
        }

        items.slice(0, viewConfig.max_items || 6).forEach(item => {
            const itemContext = this.combineContext(context, item);
            const caption = this.dataManager.resolveDetailTemplate(viewConfig.caption_template, itemContext);
            const images = this.normalizeToArray(this.dataManager.resolveDetailPath(viewConfig.image_field || 'images', itemContext));

            const descriptor = images.length ? `${images.length} photo${images.length === 1 ? '' : 's'}` : 'No imagery';
            const summary = caption ? `${caption} · ${descriptor}` : descriptor;

            const entry = this.createTextElement(`🖼️ ${summary}`, 0, currentY, 'middle', '11px', '#dcdcdc');
            contentGroup.appendChild(entry);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderLinksView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        Logger.debug('📋 DetailSector: links view data', {
            id: viewConfig.id || '(anonymous)',
            totalItems: items.length
        });

        if (title) {
            const titleElement = this.createTextElement(title, 0, currentY, 'middle', '16px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            return this.renderEmptyState(viewConfig, context, contentGroup, currentY);
        }

        items.slice(0, viewConfig.max_items || 5).forEach(item => {
            const itemContext = this.combineContext(context, item);
            const label = this.dataManager.resolveDetailTemplate(viewConfig.label_template, itemContext);
            const description = this.dataManager.resolveDetailTemplate(viewConfig.description_template, itemContext);
            const url = this.dataManager.resolveDetailPath(viewConfig.url_field, itemContext) || this.dataManager.resolveDetailTemplate(viewConfig.url_template, itemContext);

            const labelElement = this.createTextElement(label || url || 'Link', 0, currentY, 'middle', '12px', '#9fd2ff');
            contentGroup.appendChild(labelElement);
            currentY += 15;

            if (description) {
                const descriptionElement = this.createTextElement(description, 0, currentY, 'middle', '11px', '#cccccc');
                contentGroup.appendChild(descriptionElement);
                currentY += 15;
            }

            if (url) {
                const urlElement = this.createTextElement(url, 0, currentY, 'middle', '10px', '#7ab8ff');
                contentGroup.appendChild(urlElement);
                currentY += 14;
            }

            currentY += 6;
        });

        return currentY + 12;
    }

    renderEmptyState(viewConfig, context, contentGroup, currentY) {
        const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
        const emptyElement = this.createTextElement(emptyMessage, 0, currentY, 'middle', '12px', '#888888');
        contentGroup.appendChild(emptyElement);
        return currentY + 20;
    }

    getViewItems(viewConfig, context) {
        if (!viewConfig || !viewConfig.items_field) {
            return [];
        }

        const rawItems = this.dataManager.resolveDetailPath(viewConfig.items_field, context);

        if (!rawItems) {
            return [];
        }

        if (Array.isArray(rawItems)) {
            return rawItems;
        }

        if (typeof rawItems === 'object') {
            return Object.values(rawItems);
        }

        return [];
    }

    normalizeToArray(value) {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }

    combineContext(baseContext, item) {
        if (item && typeof item === 'object') {
            return { ...baseContext, ...item };
        }
        return { ...baseContext, value: item };
    }

    wrapText(value, maxChars = 40) {
        if (!value) {
            return [];
        }

        const words = String(value).split(/\s+/);
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (candidate.length > maxChars && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = candidate;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    renderLegacyFallback(contentGroup, item, contentRadius) {
        const startY = -contentRadius + 36;
        let currentY = startY;

        const title = this.createTextElement(item.name || 'Detail', 0, currentY, 'middle', '20px', '#ffffff', 'bold');
        contentGroup.appendChild(title);
        currentY += 28;

        const itemDetails = this.extractItemDetails(item);

        if (itemDetails.description) {
            this.wrapText(itemDetails.description, 42).forEach(line => {
                const desc = this.createTextElement(line, 0, currentY, 'middle', '12px', '#cccccc');
                contentGroup.appendChild(desc);
                currentY += 16;
            });
        }

        const specs = this.createSpecificationsList(itemDetails, 0, currentY, contentRadius);
        specs.forEach(spec => {
            contentGroup.appendChild(spec);
        });
        if (specs.length) {
            currentY += specs.length * 16;
        }

        if (itemDetails.alternatives && itemDetails.alternatives.length > 0) {
            currentY += 20;
            const altTitle = this.createTextElement('Alternatives:', 0, currentY, 'middle', '12px', '#ffffff', 'bold');
            contentGroup.appendChild(altTitle);

            itemDetails.alternatives.slice(0, 3).forEach((alt, index) => {
                const altText = this.createTextElement(`• ${alt}`, 0, currentY + 18 + (index * 16), 'middle', '11px', '#cccccc');
                contentGroup.appendChild(altText);
            });
        }
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