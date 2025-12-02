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
        this.supportsSVGForeignObject = this.detectForeignObjectSupport();
        Logger.debug('📋 DetailSector: foreignObject support detected', { supported: this.supportsSVGForeignObject });
        this.activeAudioOverlay = null;
    }

    /**
     * Initialize the Detail Sector with DOM element
     */
    initialize(detailItemsGroup) {
        this.detailItemsGroup = detailItemsGroup;
        Logger.debug('MobileDetailSector initialized');
    }

    /**
     * Calculate the usable content bounds for the Detail Sector
     * Returns the bounding box within the Focus Ring arc, with margins
     */
    getContentBounds() {
        const viewport = this.viewport.getViewportInfo();
        const arcParams = this.viewport.getArcParameters();
        
        // Viewport bounds in SVG coordinates (origin at center)
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;
        const topY = -halfHeight;
        const rightX = halfWidth;
        const bottomY = halfHeight;
        const leftX = -halfWidth;
        
        // Focus Ring parameters
        const ringCenterX = arcParams.centerX;
        const ringCenterY = arcParams.centerY;
        const ringRadius = arcParams.radius;
        
        // Inner edge of Focus Ring band with margin (96% to back off from 98% edge)
        const innerRadius = ringRadius * 0.96;
        
        // Dynamic margins based on shorter side (SSd) - 3% of shorter side
        const SSd = viewport.SSd;
        const marginPercent = 0.03;
        const topMargin = SSd * marginPercent;
        const rightMargin = SSd * marginPercent;
        
        // Apply margins to viewport bounds
        const effectiveTopY = topY + topMargin;
        const effectiveRightX = rightX - rightMargin;
        
        // Find intersection of arc with effective top edge
        const dyTop = effectiveTopY - ringCenterY;
        const discTop = innerRadius * innerRadius - dyTop * dyTop;
        let arcLeftAtTop = leftX;
        if (discTop >= 0) {
            const sqrtTop = Math.sqrt(discTop);
            arcLeftAtTop = Math.max(leftX, ringCenterX - sqrtTop);
        }
        
        // Find intersection of arc with effective right edge
        const dxRight = effectiveRightX - ringCenterX;
        const discRight = innerRadius * innerRadius - dxRight * dxRight;
        let arcTopAtRight = effectiveTopY;
        if (discRight >= 0) {
            const sqrtRight = Math.sqrt(discRight);
            arcTopAtRight = Math.max(effectiveTopY, ringCenterY - sqrtRight);
        }
        
        return {
            // Usable rectangle (conservative estimate inside the arc)
            topY: effectiveTopY,
            bottomY: bottomY,
            leftX: arcLeftAtTop, // Left edge constrained by arc at top
            rightX: effectiveRightX,
            // Raw values for advanced positioning
            arcCenterX: ringCenterX,
            arcCenterY: ringCenterY,
            arcRadius: innerRadius,
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
            SSd: SSd
        };
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

        this.closeAudioOverlay();

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
        const hubCenterX = (arcParams && typeof arcParams.centerX === 'number') ? arcParams.centerX : 0;
        const hubCenterY = (arcParams && typeof arcParams.centerY === 'number') ? arcParams.centerY : 0;
        const magnifierPosition = this.viewport.getMagnifyingRingPosition ? this.viewport.getMagnifyingRingPosition() : null;
        const focusAnchorX = magnifierPosition && typeof magnifierPosition.x === 'number'
            ? magnifierPosition.x
            : 0;
        const circleRadius = (arcParams && typeof arcParams.radius === 'number' ? arcParams.radius : 0) * 0.98;

        // Use viewport center instead of arc center for content positioning
        const viewportInfo = this.viewport.getViewportInfo();
        const viewportCenterX = viewportInfo.center.x;
        const viewportCenterY = viewportInfo.center.y;

        const contentGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentGroup.setAttribute('class', 'detail-content');
        contentGroup.setAttribute('transform', `translate(0, 0)`); // Position at SVG origin (screen center)
        contentGroup.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier below

        // Offset inner group toward the on-screen focus anchor so content stays within the visible arc
        const contentInnerGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentInnerGroup.setAttribute('class', 'detail-content-inner');
        const innerOffsetX = 0; // Center content at viewport center instead of offsetting to magnifier
        contentInnerGroup.setAttribute('transform', `translate(${innerOffsetX} 0)`);
        contentGroup.appendChild(contentInnerGroup);

        const contentRadius = circleRadius * 0.82;
        const detailConfig = this.dataManager.getDetailSectorConfigForItem(item);
        const detailContext = this.dataManager.getDetailSectorContext(item);

        Logger.debug('📋 DetailSector: content rendering context', {
            itemName: detailContext.name,
            level: detailContext.level,
            viewCount: detailConfig.views.length
        });

        Logger.debug('📋 DetailSector: resolved config for item', {
            itemName: detailContext.name,
            mode: detailConfig.mode,
            viewCount: detailConfig.views.length
        });

        if (!detailConfig || (!detailConfig.header && (!detailConfig.views || detailConfig.views.length === 0))) {
            this.renderLegacyFallback(contentInnerGroup, item, contentRadius);
            this.detailItemsGroup.appendChild(contentGroup);
            return;
        }

        // Start content near the top of the visible screen area
        // Position content in upper area of viewport for better visibility
        let currentY = -250; // Start 250px above screen center (higher up in viewport)
        currentY = this.renderHeader(detailConfig.header, detailContext, contentInnerGroup, currentY);

        (detailConfig.views || []).forEach(view => {
            currentY = this.renderView(view, detailContext, contentInnerGroup, currentY, contentRadius, arcParams);
        });

        this.detailItemsGroup.appendChild(contentGroup);
    }

    renderHeader(headerConfig, context, contentGroup, currentY) {
        const fallbackTitle = context.name || '';
        
        // Skip header for Gutenberg Bible verses (verse number shown in Focus Ring)
        const displayConfig = this.dataManager.getDisplayConfig();
        const isGutenbergVerse = displayConfig?.volume_name === 'Gutenberg Bible' && context.level === 'verse';
        if (isGutenbergVerse) {
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

    renderView(viewConfig, context, contentGroup, currentY, contentRadius, arcParams) {
        if (!viewConfig || viewConfig.hidden === true) {
            return currentY;
        }

        const viewType = (viewConfig.type || 'info').toLowerCase();

        Logger.debug('📋 DetailSector: rendering view', {
            id: viewConfig.id || '(anonymous)',
            type: viewType
        });

        switch (viewType) {
            case 'audio':
                return this.renderAudioView(viewConfig, context, contentGroup, currentY, arcParams);
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

    renderAudioView(viewConfig, context, contentGroup, currentY, arcParams) {
        Logger.debug('🎵 renderAudioView called', { viewConfig, contextKeys: Object.keys(context) });
        
        const audioFileProperty = viewConfig.audio_file_property || 'audio_file';
        const basePath = viewConfig.audio_base_path || '';
        
        // Get the audio file path from the context (flattened item properties)
        const audioFileName = context[audioFileProperty];
        
        Logger.debug('🎵 AudioView: rendering for item', {
            itemName: context.name,
            audioFileProperty,
            audioFileName,
            basePath,
            supportsForeignObject: this.supportsSVGForeignObject
        });
        
        if (!audioFileName) {
            Logger.debug('🎵 AudioView: no audio file found, skipping');
            return currentY;
        }
        
        const audioPath = basePath + audioFileName;
        Logger.debug('🎵 AudioView: audio path resolved', { audioPath });

        if (!this.supportsSVGForeignObject) {
            Logger.debug('🎵 AudioView: foreignObject not supported, using fallback overlay');
            return this.renderAudioFallback(contentGroup, context, currentY, audioPath);
        }
        
        // Create HTML5 audio player wrapped in foreignObject
        const playerWidth = 280;
        const playerHeight = 40;
        
        // Position player centered (x=0 is the center due to contentGroup positioning)
        const playerX = -playerWidth / 2; // Center horizontally
        
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', playerX);
        foreignObject.setAttribute('y', currentY);
        foreignObject.setAttribute('width', playerWidth);
        foreignObject.setAttribute('height', playerHeight);
        
        const audioHTML = `
            <audio controls style="width: 100%; background: rgba(255,255,255,0.1); border-radius: 4px;" preload="metadata">
                <source src="${audioPath}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        `;
        
        foreignObject.innerHTML = audioHTML;
        contentGroup.appendChild(foreignObject);
        
        Logger.debug('🎵 AudioView: HTML5 audio player created and added to DOM');
        
        // Add error handling to the audio element
        setTimeout(() => {
            const audioElement = foreignObject.querySelector('audio');
            if (audioElement) {
                audioElement.addEventListener('error', (e) => {
                    Logger.error('🎵 AudioView: audio element error', {
                        error: e,
                        audioPath,
                        networkState: audioElement.networkState,
                        readyState: audioElement.readyState,
                        errorCode: audioElement.error?.code
                    });
                });
                
                audioElement.addEventListener('loadstart', () => {
                    Logger.debug('🎵 AudioView: audio load started');
                });
                
                audioElement.addEventListener('canplay', () => {
                    Logger.debug('🎵 AudioView: audio can play');
                });
                
                audioElement.addEventListener('play', () => {
                    Logger.debug('🎵 AudioView: audio started playing');
                });
                
                Logger.debug('🎵 AudioView: audio event listeners attached');
            } else {
                Logger.error('🎵 AudioView: audio element not found after creation');
            }
        }, 100);
        
        return currentY + playerHeight + 12;
    }

    renderInfoView(viewConfig, context, contentGroup, currentY) {
        const titleTemplate = viewConfig.title_template || viewConfig.title;
        const subtitleTemplate = viewConfig.subtitle_template || viewConfig.subtitle;
        const bodyTemplate = viewConfig.body_template || viewConfig.body;

        const title = this.dataManager.resolveDetailTemplate(titleTemplate, context);
        const subtitle = this.dataManager.resolveDetailTemplate(subtitleTemplate, context);
        
        // Handle body as array or string
        let body = null;
        if (Array.isArray(bodyTemplate)) {
            // Resolve each template in the array and join with newlines
            const resolvedLines = bodyTemplate
                .map(template => this.dataManager.resolveDetailTemplate(template, context))
                .filter(line => line); // Remove empty lines
            body = resolvedLines.join('\n');
        } else {
            body = this.dataManager.resolveDetailTemplate(bodyTemplate, context);
        }

        if (title) {
            const titleElement = this.createTextElement(title, 180, currentY, 'end', '18px', '#000000', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 24;
        }

        if (subtitle) {
            const subtitleElement = this.createTextElement(subtitle, 180, currentY, 'end', '13px', '#333333');
            contentGroup.appendChild(subtitleElement);
            currentY += 20;
        }

        if (body) {
            // Use larger font (36px = 300% of 12px) for Gutenberg Bible verses
            const displayConfig = this.dataManager.getDisplayConfig();
            const isGutenberg = displayConfig?.volume_name === 'Gutenberg Bible';
            
            if (isGutenberg) {
                // Use dynamic bounds-based positioning for Bible verses
                currentY = this.renderGutenbergVerse(body, contentGroup, currentY);
            } else {
                // Standard rendering for other volumes
                const lines = this.wrapText(body, 42);
                const fontSize = '12px';
                const lineHeight = 16;
                
                lines.forEach(line => {
                    const bodyElement = this.createTextElement(line, 180, currentY, 'end', fontSize, '#333333');
                    contentGroup.appendChild(bodyElement);
                    currentY += lineHeight;
                });
            }
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
            const fieldElement = this.createTextElement(combined, 180, currentY, 'end', '12px', '#444444');
            contentGroup.appendChild(fieldElement);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderListView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        if (title) {
            const titleElement = this.createTextElement(title, 180, currentY, 'end', '16px', '#000000', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
            const emptyElement = this.createTextElement(emptyMessage, 180, currentY, 'end', '12px', '#666666');
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
                const primaryElement = this.createTextElement(primaryText, 180, currentY, 'end', '12px', '#000000');
                contentGroup.appendChild(primaryElement);
                currentY += 16;
            }

            if (secondary) {
                const secondaryElement = this.createTextElement(secondary, 180, currentY, 'end', '11px', '#444444');
                contentGroup.appendChild(secondaryElement);
                currentY += 15;
            }

            if (meta || badge) {
                const summary = [meta, badge].filter(Boolean).join(' · ');
                if (summary) {
                    const summaryElement = this.createTextElement(summary, 180, currentY, 'end', '10px', '#9fd2ff');
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

        if (title) {
            const titleElement = this.createTextElement(title, 180, currentY, 'end', '16px', '#ffffff', 'bold');
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

            const entry = this.createTextElement(`🖼️ ${summary}`, 180, currentY, 'end', '11px', '#dcdcdc');
            contentGroup.appendChild(entry);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderLinksView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        if (title) {
            const titleElement = this.createTextElement(title, 180, currentY, 'end', '16px', '#ffffff', 'bold');
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

            const labelElement = this.createTextElement(label || url || 'Link', 180, currentY, 'end', '12px', '#9fd2ff');
            contentGroup.appendChild(labelElement);
            currentY += 15;

            if (description) {
                const descriptionElement = this.createTextElement(description, 180, currentY, 'end', '11px', '#cccccc');
                contentGroup.appendChild(descriptionElement);
                currentY += 15;
            }

            if (url) {
                const urlElement = this.createTextElement(url, 180, currentY, 'end', '10px', '#7ab8ff');
                contentGroup.appendChild(urlElement);
                currentY += 14;
            }

            currentY += 6;
        });

        return currentY + 12;
    }

    renderEmptyState(viewConfig, context, contentGroup, currentY) {
        const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
        const emptyElement = this.createTextElement(emptyMessage, 180, currentY, 'end', '12px', '#888888');
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
     * Render Gutenberg Bible verse text within the Detail Sector bounds
     * Positions text in the upper-right area, right-aligned against the arc boundary
     * Font size scales dynamically based on viewport dimensions
     */
    renderGutenbergVerse(body, contentGroup, startY) {
        const bounds = this.getContentBounds();
        
        // Calculate available width for text (from arc edge to right margin)
        // Use 85% of right edge X to stay well inside the arc
        const textRightX = bounds.rightX * 0.85;
        const availableWidth = textRightX - bounds.leftX - 20; // 20px padding from arc
        
        // Calculate available height (from top margin to ~60% down the viewport)
        const availableHeight = bounds.viewportHeight * 0.5;
        
        // Dynamic font size based on shorter side (SSd) and aspect ratio
        // Base: ~4.7% of SSd, adjusted for aspect ratio (1/3 larger than original 3.5%)
        const aspectRatio = bounds.viewportWidth / bounds.viewportHeight;
        let fontSizePercent = 0.047; // 4.7% of SSd as base
        
        // Adjust for extreme aspect ratios
        if (aspectRatio > 1.5) {
            // Wide/landscape: slightly smaller font
            fontSizePercent = 0.040;
        } else if (aspectRatio < 0.6) {
            // Tall/narrow portrait: slightly larger font
            fontSizePercent = 0.053;
        }
        
        const fontSize = Math.round(bounds.SSd * fontSizePercent);
        const clampedFontSize = Math.max(16, Math.min(42, fontSize)); // Clamp between 16-42px
        
        const charWidth = clampedFontSize * 0.55;
        const maxCharsPerLine = Math.floor(availableWidth / charWidth);
        
        // Wrap text to fit available width
        const lines = this.wrapText(body, Math.max(15, maxCharsPerLine));
        const lineHeight = clampedFontSize * 1.4; // 1.4x line height
        
        // Start position - use bounds top with padding proportional to font size
        let currentY = bounds.topY + (clampedFontSize * 1.5);
        
        // Always log to console for debugging
        console.log('📖 GUTENBERG VERSE:', {
            SSd: bounds.SSd,
            aspectRatio: aspectRatio.toFixed(2),
            fontSizePercent,
            rawFontSize: fontSize,
            clampedFontSize,
            maxCharsPerLine,
            lineCount: lines.length
        });
        
        lines.forEach(line => {
            const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
            textElement.setAttribute('x', textRightX);
            textElement.setAttribute('y', currentY);
            textElement.setAttribute('text-anchor', 'end'); // Right-aligned
            textElement.setAttribute('font-size', `${clampedFontSize}px`);
            textElement.setAttribute('fill', '#1a1a1a'); // Near-black for readability
            textElement.setAttribute('font-family', "'Palatino Linotype', 'Book Antiqua', Palatino, serif");
            textElement.setAttribute('class', 'gutenberg-verse-text');
            textElement.textContent = line;
            contentGroup.appendChild(textElement);
            currentY += lineHeight;
        });
        
        return currentY + 12; // Return position after verse
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

    detectForeignObjectSupport() {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            return true;
        }

        const ua = navigator.userAgent || '';
        const isIOS = /iPad|iPhone|iPod/.test(ua);

        if (isIOS) {
            Logger.debug('📋 DetailSector: foreignObject unavailable on this platform (iOS detection)');
            return false;
        }

        try {
            const testFO = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'foreignObject');
            return !!testFO;
        } catch (error) {
            Logger.debug('📋 DetailSector: foreignObject creation failed', error);
            return false;
        }
    }

    renderAudioFallback(contentGroup, context, currentY, audioPath) {
        const itemName = context && (context.name || context.title || 'Audio');

        const playText = this.createTextElement('🎧 Play Audio Sample', 180, currentY + 18, 'end', '14px', '#9fd2ff', 'bold');
        playText.setAttribute('style', 'cursor: pointer;');
        playText.addEventListener('click', () => {
            this.openAudioOverlay(audioPath, itemName, context);
        });
        contentGroup.appendChild(playText);

        const hintText = this.createTextElement('Tap to open player', 180, currentY + 38, 'end', '11px', '#c0c0c0');
        contentGroup.appendChild(hintText);

        return currentY + 52;
    }

    openAudioOverlay(audioPath, itemName, context) {
        if (!audioPath) {
            return;
        }

        this.closeAudioOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'detail-audio-overlay';

        const sheet = document.createElement('div');
        sheet.className = 'detail-audio-sheet';

        const header = document.createElement('div');
        header.className = 'detail-audio-header';

        const title = document.createElement('h3');
        title.textContent = itemName || 'Audio Sample';
        header.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.className = 'detail-audio-close';
        closeButton.type = 'button';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => this.closeAudioOverlay());
        header.appendChild(closeButton);

        const audio = document.createElement('audio');
        audio.setAttribute('controls', '');
        audio.setAttribute('preload', 'metadata');

        const source = document.createElement('source');
        source.src = audioPath;
        source.type = 'audio/mpeg';
        audio.appendChild(source);

        // Add debugging event listeners
        audio.addEventListener('error', (e) => {
            Logger.error('🎵 AudioView: audio element error', {
                error: e,
                audioPath,
                networkState: audio.networkState,
                readyState: audio.readyState,
                errorCode: audio.error?.code,
                errorMessage: audio.error?.message
            });
        });

        audio.addEventListener('loadstart', () => {
            Logger.debug('🎵 AudioView: audio load started', { audioPath });
        });

        audio.addEventListener('canplay', () => {
            Logger.debug('🎵 AudioView: audio can play', { audioPath });
        });

        audio.addEventListener('play', () => {
            Logger.debug('🎵 AudioView: audio started playing', { audioPath });
        });

        audio.addEventListener('pause', () => {
            Logger.debug('🎵 AudioView: audio paused', { audioPath });
        });

        audio.addEventListener('ended', () => {
            Logger.debug('🎵 AudioView: audio ended', { audioPath });
            this.closeAudioOverlay();
        });

        audio.addEventListener('stalled', () => {
            Logger.warn('🎵 AudioView: audio stalled', { audioPath });
        });

        audio.addEventListener('waiting', () => {
            Logger.debug('🎵 AudioView: audio waiting/buffering', { audioPath });
        });

        const meta = document.createElement('p');
        meta.className = 'detail-audio-meta';
        const album = context && context.album ? context.album : null;
        const artist = context && context.artist ? context.artist : null;
        Logger.debug('🎵 Audio overlay metadata:', { album, artist, contextKeys: Object.keys(context) });
        if (album || artist) {
            meta.textContent = [album, artist].filter(Boolean).join(' • ');
        } else {
            meta.textContent = 'Tap play to listen.';
        }

        sheet.appendChild(header);
        sheet.appendChild(audio);
        sheet.appendChild(meta);

        overlay.appendChild(sheet);

        overlay.addEventListener('click', event => {
            if (event.target === overlay) {
                this.closeAudioOverlay();
            }
        });

        document.body.appendChild(overlay);
        this.activeAudioOverlay = overlay;
    }

    closeAudioOverlay() {
        if (this.activeAudioOverlay) {
            if (this.activeAudioOverlay.parentNode) {
                this.activeAudioOverlay.parentNode.removeChild(this.activeAudioOverlay);
            }
            this.activeAudioOverlay = null;
        }
    }
}

export { MobileDetailSector };