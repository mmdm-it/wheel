/**
 * Detail Sector Content Helpers
 * Provides utility methods for content rendering and manipulation
 * 
 * Responsibilities:
 * - Create text elements with proper styling
 * - Render headers with title/subtitle templates
 * - Wrap text to fit within width constraints
 * - Render Gutenberg verse text with dynamic font sizing
 * - Extract and format item details
 * - Handle context merging for template resolution
 * - Support translation selection for multilingual content
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Content rendering helper utilities for detail sector
 */
class DetailSectorContent {
    constructor(dataManager, renderer, geometry) {
        this.dataManager = dataManager;
        this.renderer = renderer;
        this.geometry = geometry;
    }

    /**
     * Render header section with title and optional subtitle
     */
    renderHeader(headerConfig, context, contentGroup, currentY) {
        const fallbackTitle = context.name || '';
        
        // Skip header if level config says so (e.g., verse number shown in Focus Ring)
        const displayConfig = this.dataManager.getDisplayConfig();
        const levelConfig = displayConfig?.hierarchy_levels?.[context.level];
        const skipHeader = levelConfig?.detail_sector?.skip_header === true;
        if (skipHeader) {
            return currentY;
        }

        if (!headerConfig && fallbackTitle) {
            const title = this.createTextElement(fallbackTitle, 180, currentY, 'end', '22px', '#000000', 'bold');
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
            const title = this.createTextElement(resolvedTitle, 180, currentY, 'end', '22px', '#000000', 'bold');
            contentGroup.appendChild(title);
            currentY += 30;
        }

        if (resolvedSubtitle) {
            const subtitle = this.createTextElement(resolvedSubtitle, 180, currentY, 'end', '14px', '#333333');
            contentGroup.appendChild(subtitle);
            currentY += 22;
        }

        return currentY;
    }

    /**
     * Render detail content for an item (main entry point for rendering)
     */
    renderDetailContent(item, contentGroup, contentRadius) {
        // Get merged detail sector configuration
        const detailConfig = this.dataManager.getDetailSectorConfigForItem(item);
        
        if (!detailConfig) {
            Logger.debug('📋 No detail sector config found, using legacy fallback');
            return this.renderLegacyFallback(contentGroup, item, contentRadius);
        }

        // Build context for template resolution
        const context = this.dataManager.getDetailSectorContext(item);
        
        const bounds = this.geometry.getContentBounds();
        let currentY = bounds.SSd + 8;

        // Render header if configured
        if (detailConfig.header) {
            currentY = this.renderHeader(detailConfig.header, context, contentGroup, currentY);
            currentY += 12;
        }

        // Render views if configured
        if (Array.isArray(detailConfig.views) && detailConfig.views.length > 0) {
            // Views will be rendered by DetailSectorViews module
            // This is a placeholder for the main coordinator to call
            Logger.debug('📋 DetailContent: views should be rendered by Views module');
        }

        return currentY;
    }

    /**
     * Render Gutenberg Bible verse text within the Detail Sector bounds
     * Text flows along the arc boundary with per-line width calculation
     * Two-tier font sizing: 30px for short verses (≤30 words), 22px for long verses (31+ words)
     */
    renderGutenbergVerse(body, contentGroup, startY, wordCount = 0) {
        const bounds = this.geometry.getContentBounds();
        
        // Two-tier font sizing based on word count
        // Big Font tier: 1-30 words = 30px, charWidth 0.45
        // Small Font tier: 31+ words = 22px, charWidth 0.35
        const isShortVerse = wordCount <= 30;
        const fontSize = isShortVerse ? 30 : 22;
        const charWidthRatio = isShortVerse ? 0.45 : 0.35;
        
        // Build line position table with per-line arc-based left margins
        const lineTable = this.geometry.buildLineTable(bounds, fontSize, 20, charWidthRatio);
        
        // Wrap text using per-line character limits
        const wrappedLines = this.geometry.wrapTextWithLineTable(body, lineTable);
        
        console.log('📖 GUTENBERG VERSE:', {
            wordCount: wordCount,
            tier: isShortVerse ? 'BIG (≤30 words)' : 'SMALL (31+ words)',
            fontSize: fontSize,
            charWidthRatio: charWidthRatio,
            SSd: bounds.SSd,
            lineTableSize: lineTable.length,
            wrappedLineCount: wrappedLines.length
        });
        
        // Render each line at its calculated position - LEFT ALIGNED
        wrappedLines.forEach(({ text, lineIndex }, idx) => {
            const lineInfo = lineTable[lineIndex];
            
            // Create a text element for the line
            const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
            textElement.setAttribute('x', lineInfo.leftX);
            textElement.setAttribute('y', lineInfo.y);
            textElement.setAttribute('text-anchor', 'start');
            textElement.setAttribute('fill', '#1a1a1a');
            // Apply detail-body-text class with appropriate font-size tier
            const fontClass = fontSize === 30 ? 'detail-body-text big-font' : 'detail-body-text small-font';
            textElement.setAttribute('class', fontClass);
            textElement.textContent = text;
            contentGroup.appendChild(textElement);
            
            // Debug: log chars vs maxChars
            console.log(`📏 Line ${lineIndex}: chars=${text.length}, maxChars=${lineInfo.maxChars}, available=${lineInfo.availableWidth.toFixed(0)}`);
        });
        
        // Return Y position after last line
        const lastLineIndex = wrappedLines.length > 0 ? wrappedLines[wrappedLines.length - 1].lineIndex : 0;
        const lineHeight = fontSize * 1.4;
        return lineTable.length > 0 ? lineTable[lastLineIndex].y + lineHeight : startY;
    }

    /**
     * Create a text element with specified properties
     * Uses CSS classes for all font sizing and weights (Phase 3A)
     */
    createTextElement(text, x, y, anchor, fontSize, color, weight = 'normal') {
        const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', anchor);
        textElement.setAttribute('fill', color);
        
        // Build CSS class list for font sizing and weight
        const classes = [];
        classes.push(`text-size-${fontSize}`);
        
        if (weight === 'italic') {
            classes.push('font-style-italic');
            classes.push('font-weight-normal');
        } else if (weight === 'normal') {
            classes.push('font-weight-normal');
        } else if (weight === 'bold') {
            classes.push('font-weight-bold');
        } else {
            // Numeric weights (500, 600, 700)
            classes.push(`font-weight-${weight}`);
        }
        
        textElement.setAttribute('class', classes.join(' '));
        textElement.textContent = text;
        return textElement;
    }

    /**
     * Wrap text to fit within a maximum character width
     */
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

    /**
     * Legacy fallback for volumes without detail_sector configuration
     */
    renderLegacyFallback(contentGroup, item, contentRadius) {
        const startY = -contentRadius + 36;
        let currentY = startY;

        const title = this.createTextElement(item.name || 'Detail', 180, currentY, 'end', '20px', '#ffffff', 'bold');
        contentGroup.appendChild(title);
        currentY += 28;

        const itemDetails = this.extractItemDetails(item);

        if (itemDetails.description) {
            this.wrapText(itemDetails.description, 42).forEach(line => {
                const desc = this.createTextElement(line, 180, currentY, 'end', '12px', '#cccccc');
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
            const altTitle = this.createTextElement('Alternatives:', 180, currentY, 'end', '12px', '#ffffff', 'bold');
            contentGroup.appendChild(altTitle);

            itemDetails.alternatives.slice(0, 3).forEach((alt, index) => {
                const altText = this.createTextElement(`• ${alt}`, 180, currentY + 18 + (index * 16), 'end', '11px', '#cccccc');
                contentGroup.appendChild(altText);
            });
        }
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
            const possibleSpecFields = ['model', 'type', 'category', 'brand', 'name'];
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
                180, // Right-aligned
                startY + (index * lineHeight),
                'end', // Right anchor
                '11px',
                '#bbbbbb'
            );
            specs.push(specText);
        });

        return specs;
    }

    /**
     * Combine base context with item data for template resolution
     */
    combineContext(baseContext, item) {
        if (item && typeof item === 'object') {
            return { ...baseContext, ...item };
        }
        return { ...baseContext, value: item };
    }

    /**
     * Normalize value to array (handles single values and arrays)
     */
    normalizeToArray(value) {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }

    /**
     * Apply translation selection to context
     * Overrides 'text' property with selected translation's property
     */
    applyTranslationToContext(context) {
        // Get current translation from renderer
        const currentLang = this.renderer.getCurrentTranslation();
        
        // If no translation, return as-is
        if (!currentLang) {
            return context;
        }

        // Create a copy of context
        const translatedContext = { ...context };

        // Strategy 1: Check if language property exists directly on context (normalized data)
        // e.g., context.latin, context.hebrew, context.greek
        if (context[currentLang] && typeof context[currentLang] === 'string') {
            translatedContext.text = context[currentLang];
            return translatedContext;
        }

        // Strategy 2: Check if language exists in text object (un-normalized or old data)
        // e.g., context.text.VUL, context.text.WLC
        if (context.text && typeof context.text === 'object' && context.text[currentLang]) {
            translatedContext.text = context.text[currentLang];
            return translatedContext;
        }

        // Strategy 3: If neither exists, keep text as-is (may be object or string)
        return translatedContext;
    }
}

export { DetailSectorContent };
