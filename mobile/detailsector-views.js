/**
 * Detail Sector Views
 * Handles rendering of different view types (audio, info, list, gallery, links)
 * 
 * Responsibilities:
 * - Render audio player views (HTML5 or fallback overlay)
 * - Render info views with title/subtitle/body/fields
 * - Render list views with item templates
 * - Render gallery views with image metadata
 * - Render links views with URLs
 * - Handle empty states for all view types
 */

import { Logger } from './mobile-logger.js';

/**
 * Manages view rendering for detail sector content
 */
class DetailSectorViews {
    constructor(dataManager, renderer, geometry, contentHelpers) {
        this.dataManager = dataManager;
        this.renderer = renderer;
        this.geometry = geometry;
        this.contentHelpers = contentHelpers;
        this.supportsSVGForeignObject = this.detectForeignObjectSupport();
        this.activeAudioOverlay = null;
        
        Logger.debug('📋 DetailSectorViews: foreignObject support detected', { 
            supported: this.supportsSVGForeignObject 
        });
    }

    /**
     * Render a view based on its type
     */
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

        // Apply translation selection: override 'text' with selected translation's property
        const translationContext = this.contentHelpers.applyTranslationToContext(context);

        const title = this.dataManager.resolveDetailTemplate(titleTemplate, translationContext);
        const subtitle = this.dataManager.resolveDetailTemplate(subtitleTemplate, translationContext);
        
        // Handle body as array or string
        let body = null;
        if (Array.isArray(bodyTemplate)) {
            // Resolve each template in the array and join with newlines
            const resolvedLines = bodyTemplate
                .map(template => this.dataManager.resolveDetailTemplate(template, translationContext))
                .filter(line => line); // Remove empty lines
            body = resolvedLines.join('\n');
        } else {
            body = this.dataManager.resolveDetailTemplate(bodyTemplate, translationContext);
        }

        if (title) {
            const titleElement = this.contentHelpers.createTextElement(title, 180, currentY, 'end', '18px', '#000000', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 24;
        }

        if (subtitle) {
            const subtitleElement = this.contentHelpers.createTextElement(subtitle, 180, currentY, 'end', '13px', '#333333');
            contentGroup.appendChild(subtitleElement);
            currentY += 20;
        }

        if (body) {
            // Check if this level uses text_display mode for larger text rendering
            const displayConfig = this.dataManager.getDisplayConfig();
            const levelConfig = displayConfig?.hierarchy_levels?.[context.level];
            const useTextDisplay = levelConfig?.detail_sector?.mode === 'text_display';
            
            if (useTextDisplay) {
                // Use dynamic bounds-based positioning for text content
                // Pass word_count for two-tier font sizing
                const wordCount = context.word_count || 0;
                currentY = this.contentHelpers.renderGutenbergVerse(body, contentGroup, currentY, wordCount);
            } else {
                // Standard rendering for other volumes
                const lines = this.contentHelpers.wrapText(body, 42);
                const fontSize = '12px';
                const lineHeight = 16;
                
                lines.forEach(line => {
                    const bodyElement = this.contentHelpers.createTextElement(line, 180, currentY, 'end', fontSize, '#333333');
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
            const fieldElement = this.contentHelpers.createTextElement(combined, 180, currentY, 'end', '12px', '#444444');
            contentGroup.appendChild(fieldElement);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderListView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        if (title) {
            const titleElement = this.contentHelpers.createTextElement(title, 180, currentY, 'end', '16px', '#000000', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
            const emptyElement = this.contentHelpers.createTextElement(emptyMessage, 180, currentY, 'end', '12px', '#666666');
            contentGroup.appendChild(emptyElement);
            return currentY + 20;
        }

        items.slice(0, viewConfig.max_items || 4).forEach(item => {
            const itemContext = this.contentHelpers.combineContext(context, item);

            const primary = this.dataManager.resolveDetailTemplate(viewConfig.item?.primary_template, itemContext) || '';
            const secondary = this.dataManager.resolveDetailTemplate(viewConfig.item?.secondary_template, itemContext) || '';
            const meta = this.dataManager.resolveDetailTemplate(viewConfig.item?.meta_template, itemContext) || '';
            const badge = this.dataManager.resolveDetailTemplate(viewConfig.item?.badge_template, itemContext) || '';

            const primaryText = primary ? `• ${primary}` : null;
            if (primaryText) {
                const primaryElement = this.contentHelpers.createTextElement(primaryText, 180, currentY, 'end', '12px', '#000000');
                contentGroup.appendChild(primaryElement);
                currentY += 16;
            }

            if (secondary) {
                const secondaryElement = this.contentHelpers.createTextElement(secondary, 180, currentY, 'end', '11px', '#444444');
                contentGroup.appendChild(secondaryElement);
                currentY += 15;
            }

            if (meta || badge) {
                const summary = [meta, badge].filter(Boolean).join(' · ');
                if (summary) {
                    const summaryElement = this.contentHelpers.createTextElement(summary, 180, currentY, 'end', '10px', '#9fd2ff');
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
            const titleElement = this.contentHelpers.createTextElement(title, 180, currentY, 'end', '16px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            return this.renderEmptyState(viewConfig, context, contentGroup, currentY);
        }

        items.slice(0, viewConfig.max_items || 6).forEach(item => {
            const itemContext = this.contentHelpers.combineContext(context, item);
            const caption = this.dataManager.resolveDetailTemplate(viewConfig.caption_template, itemContext);
            const images = this.contentHelpers.normalizeToArray(this.dataManager.resolveDetailPath(viewConfig.image_field || 'images', itemContext));

            const descriptor = images.length ? `${images.length} photo${images.length === 1 ? '' : 's'}` : 'No imagery';
            const summary = caption ? `${caption} · ${descriptor}` : descriptor;

            const entry = this.contentHelpers.createTextElement(`🖼️ ${summary}`, 180, currentY, 'end', '11px', '#dcdcdc');
            contentGroup.appendChild(entry);
            currentY += 16;
        });

        return currentY + 12;
    }

    renderLinksView(viewConfig, context, contentGroup, currentY) {
        const title = this.dataManager.resolveDetailTemplate(viewConfig.title_template || viewConfig.title, context);
        const items = this.getViewItems(viewConfig, context);

        if (title) {
            const titleElement = this.contentHelpers.createTextElement(title, 180, currentY, 'end', '16px', '#ffffff', 'bold');
            contentGroup.appendChild(titleElement);
            currentY += 22;
        }

        if (!items.length) {
            return this.renderEmptyState(viewConfig, context, contentGroup, currentY);
        }

        items.slice(0, viewConfig.max_items || 5).forEach(item => {
            const itemContext = this.contentHelpers.combineContext(context, item);
            const label = this.dataManager.resolveDetailTemplate(viewConfig.label_template, itemContext);
            const description = this.dataManager.resolveDetailTemplate(viewConfig.description_template, itemContext);
            const url = this.dataManager.resolveDetailPath(viewConfig.url_field, itemContext) || this.dataManager.resolveDetailTemplate(viewConfig.url_template, itemContext);

            const labelElement = this.contentHelpers.createTextElement(label || url || 'Link', 180, currentY, 'end', '12px', '#9fd2ff');
            contentGroup.appendChild(labelElement);
            currentY += 15;

            if (description) {
                const descriptionElement = this.contentHelpers.createTextElement(description, 180, currentY, 'end', '11px', '#cccccc');
                contentGroup.appendChild(descriptionElement);
                currentY += 15;
            }

            if (url) {
                const urlElement = this.contentHelpers.createTextElement(url, 180, currentY, 'end', '10px', '#7ab8ff');
                contentGroup.appendChild(urlElement);
                currentY += 14;
            }

            currentY += 6;
        });

        return currentY + 12;
    }

    renderEmptyState(viewConfig, context, contentGroup, currentY) {
        const emptyMessage = this.dataManager.resolveDetailTemplate(viewConfig.empty_state, context) || 'No data available.';
        const emptyElement = this.contentHelpers.createTextElement(emptyMessage, 180, currentY, 'end', '12px', '#888888');
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

    renderAudioFallback(contentGroup, context, currentY, audioPath) {
        const itemName = context && (context.name || context.title || 'Audio');

        const playText = this.contentHelpers.createTextElement('🎧 Play Audio Sample', 180, currentY + 18, 'end', '14px', '#9fd2ff', 'bold');
        playText.setAttribute('style', 'cursor: pointer;');
        playText.addEventListener('click', () => {
            this.openAudioOverlay(audioPath, itemName, context);
        });
        contentGroup.appendChild(playText);

        const hintText = this.contentHelpers.createTextElement('Tap to open player', 180, currentY + 38, 'end', '11px', '#c0c0c0');
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
        // Build ancestor breadcrumb from generic ancestor properties
        const ancestorLabels = [];
        for (let i = 1; i <= 3; i++) {
            const ancestor = context[`ancestor${i}`];
            if (ancestor) ancestorLabels.push(ancestor);
        }
        Logger.debug('🎵 Audio overlay metadata:', { ancestorLabels, contextKeys: Object.keys(context) });
        if (ancestorLabels.length > 0) {
            meta.textContent = ancestorLabels.join(' • ');
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
            const testFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            return !!testFO;
        } catch (error) {
            Logger.debug('📋 DetailSector: foreignObject creation failed', error);
            return false;
        }
    }
}

export { DetailSectorViews };
