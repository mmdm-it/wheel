/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
 * 
 * This is part of the modular mobile volume system.
 * Edit this file directly - no bundling required.
 */

// Debug flag - set to false to disable verbose console logging
const DEBUG_VERBOSE = false;

import { MOBILE_CONFIG, VERSION } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { MobileAnimation } from './mobile-animation.js';
import { MobileChildPyramid } from './mobile-childpyramid.js';
import { MobileDetailSector } from './mobile-detailsector.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';
import { showSortNumberErrorOverlay } from './validation-overlay.js';
import { TranslationToggle } from './translation-toggle.js';
import { NavigationView } from './navigation-view.js';
import { FocusRingView } from './focus-ring-view.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager, navigationState) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.navigationState = navigationState;
        this.controller = null; // injected controller (e.g., MobileCatalogApp)

        // Modules
        this.animation = new MobileAnimation(viewportManager, dataManager, this);
        this.childPyramid = new MobileChildPyramid(viewportManager, dataManager, this);
        this.detailSector = new MobileDetailSector(viewportManager, dataManager, this);
        this.translationToggle = new TranslationToggle(viewportManager);
        this.navigationView = new NavigationView(viewportManager);
        this.focusRingView = new FocusRingView(this);

        // DOM/state caches
        this.elements = {};
        this.focusElements = new Map();
        this.positionCache = new Map();
        this.leafStateCache = new Map();
        this.detailSectorAnimating = false;
        this.isAnimating = false;

        // Selection state
        this.selectedTopLevel = null;
        this.setSelectedFocusItem(null);
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;

        // Rotation/settling state
        this.isRotating = false;
        this.settleTimeout = null;
        this.allFocusItems = [];
        this.chainPosition = 0;
        this.visibleStartIndex = 0;
        this.visibleEndIndex = 0;
        this.forceImmediateFocusSettlement = false;
        this._lastFocusItemsKey = null;

        // Translation state
        this.currentTranslation = null;
        this.translationsConfig = null;

        // Debug flags
        this.focusRingDebugFlag = this.computeFocusRingDebugFlag();
        this.loopInOutDebugFlag = this.computeLoopInOutDebugFlag();
    }

    setSelectedFocusItem(item) {
        this.selectedFocusItem = item || null;
        if (this.navigationState) {
            this.navigationState.setSelectedFocusItem(this.selectedFocusItem);
        }
    }

    setActivePath(path) {
        this.activePath = Array.isArray(path) ? path : [];
        if (this.navigationState) {
            this.navigationState.setActivePath(this.activePath);
        }
    }

    setTranslation(code) {
        this.currentTranslation = code || null;
        if (this.navigationState) {
            this.navigationState.setTranslation(this.currentTranslation);
        }
    }

    focusRingDebug(...args) {
        if ((typeof window !== 'undefined' && window.DEBUG_FOCUS_RING) || this.focusRingDebugFlag) {
            Logger.debug(...args);
        }
    }

    setController(controller) {
        this.controller = controller;
    }

    getTouchHandler() {
        return this.controller && this.controller.touchHandler;
    }

    computeFocusRingDebugFlag() {
        if (typeof window === 'undefined') {
            return false;
        }

        try {
            const persisted = localStorage.getItem('debugFocusRing') === 'true';
            const queryFlag = new URLSearchParams(window.location.search).get('debugFocusRing') === '1';
            return persisted || queryFlag;
        } catch (error) {
            return false;
        }
    }

    computeLoopInOutDebugFlag() {
        if (typeof window === 'undefined') {
            return false;
        }

        try {
            if (window.DEBUG_LOOP_INOUT === true) {
                return true;
            }

            const persisted = localStorage.getItem('debugLoopInOut') === 'true';
            const queryFlag = new URLSearchParams(window.location.search).get('loopInOut') === '1';
            return persisted || queryFlag;
        } catch (error) {
            return false;
        }
    }

    async initialize() {
        await this.initializeElements();
        this.navigationView.init();
        this.viewport.adjustSVGForMobile(this.elements.svg, this.elements.mainGroup);
        // Detail Sector circle is created after volume loads (config-dependent)
        this.setupCopyrightDiagnosticToggle();
        return true;
    }

    async initializeElements() {
        const requiredElements = [
            'catalogSvg', 'mainGroup', 'centralGroup', 'topLevel',
            'pathLinesGroup', 'focusRing', 'detailItems'
        ];

        const optionalElements = [
            'childRing', // Will be created dynamically if needed
            'translationButtonGroup' // Translation toggle button
        ];

        const elementIds = [...requiredElements, ...optionalElements];
        const missing = [];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const key = id === 'catalogSvg' ? 'svg' :
                           id === 'mainGroup' ? 'mainGroup' :
                           id === 'centralGroup' ? 'centralGroup' :
                           id === 'topLevel' ? 'topLevelGroup' :
                           id === 'pathLinesGroup' ? 'pathLinesGroup' :
                           id === 'focusRing' ? 'focusRingGroup' :
                           id === 'childRing' ? 'childRingGroup' :
                           id === 'detailItems' ? 'detailItemsGroup' :
                           id + 'Group';
                this.elements[key] = element;
            } else {
                if (requiredElements.includes(id)) {
                    missing.push(id);
                } else {
                    Logger.debug(`Optional element ${id} not found - will create if needed`);
                }
            }
        });

        if (!this.elements.childRingGroup) {
            Logger.debug('Creating childRing element dynamically');
            const childRing = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
            childRing.id = 'childRing';
            childRing.classList.add('hidden');
            this.elements.mainGroup.appendChild(childRing);
            this.elements.childRingGroup = childRing;
        }

        this.childPyramid.initialize(this.elements.childRingGroup);
        this.detailSector.initialize(this.elements.detailItemsGroup);

        if (missing.length > 0) {
            Logger.error('Missing DOM elements:', missing);
            Logger.debug('Available elements in DOM:', elementIds.map(id => `${id}: ${!!document.getElementById(id)}`));
            throw new Error(`Required DOM elements not found: ${missing.join(', ')}`);
        }

        Logger.debug('DOM elements initialized:', Object.keys(this.elements));
        Logger.debug('UserAgent:', navigator.userAgent);
        Logger.debug('Window size:', window.innerWidth, 'x', window.innerHeight);
    }

    updateParentButton(parentName, skipAnimation = false) {
        // If we've locked the parent button at top level, ignore attempts to show it
        if (this._parentButtonLockedAtTop) {
            parentName = null;
        }

        if (!parentName) {
            this.navigationView.hideParentButton(skipAnimation);
            return;
        }

        // Check if we're at top navigation level to decide circle visibility
        const rootData = this.dataManager.data?.[this.dataManager.rootDataKey];
        const startupConfig = rootData?.display_config?.focus_ring_startup;
        const topNavLevel = startupConfig?.top_navigation_level;
        const currentLevel = this.activeType;
        const isAtTopLevel = topNavLevel && currentLevel === topNavLevel;
        const shouldHideCircle = isAtTopLevel || currentLevel === null;

        // Position parent button via helper
        this.navigationView.positionParentButton();
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        if (parentNodeCircle) {
            parentNodeCircle.style.visibility = shouldHideCircle ? 'hidden' : 'visible';
        }

        this.navigationView.updateParentButton(parentName, skipAnimation);

        // Re-add parent line (if hidden) after animation begins
        setTimeout(() => {
            this.navigationView.drawParentLine({
                parentName,
                skipAnimation: true
            });
        }, 50);
    }

    positionMagnifyingRing() {
        const ring = this.elements.magnifier;
        if (!ring) {
            Logger.error('Magnifier not found');
            return;
        }
        
        const position = this.viewport.getMagnifyingRingPosition();
        
        // Position ring at calculated dynamic position
        ring.setAttribute('cx', position.x);
        ring.setAttribute('cy', position.y);
        ring.setAttribute('r', MOBILE_CONFIG.RADIUS.MAGNIFIER);
        
        // Final styling: black ring as requested
        ring.setAttribute('stroke', 'black');
        ring.setAttribute('stroke-width', '1');
        ring.setAttribute('opacity', '0.8');
        
        // Restore visibility if hidden during animation
        ring.style.opacity = '';
        
        // Log Magnifier position and current selected item text
        const selectedItem = this.selectedFocusItem;
        console.log('🔍 === MAGNIFIER AT LOAD ===');
        console.log('🔍 Magnifier position:', { x: position.x.toFixed(1), y: position.y.toFixed(1), radius: MOBILE_CONFIG.RADIUS.MAGNIFIER });
        console.log('🔍 Magnifier angle (from viewport):', (position.angle * 180 / Math.PI).toFixed(1) + '°');
        if (selectedItem) {
            console.log('🔍 Selected item text:', selectedItem.name);
            console.log('🔍 Selected item rotation:', '0° (text is horizontal at Magnifier)');
        } else {
            console.log('🔍 No selected item yet');
        }
        
        this.focusRingDebug(`Magnifier positioned at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) with radius ${MOBILE_CONFIG.RADIUS.MAGNIFIER}`);
    }

    initializeTranslationButton() {
        const displayConfig = this.dataManager.getDisplayConfig();
        const translations = displayConfig?.translations;
        if (!translations || !translations.available || translations.available.length < 2) {
            Logger.debug('🌐 No translations configured or only one language - hiding button');
            return;
        }

        this.translationsConfig = translations;

        const initialized = this.translationToggle.init(translations, {
            onChange: (lang) => this.handleTranslationChange(lang)
        });

        if (!initialized) {
            Logger.warn('🌐 Translation toggle could not be initialized (missing DOM elements?)');
            return;
        }

        // Sync initial selection to navigation state
        this.setTranslation(this.translationToggle.getCurrent());

        Logger.info(`🌐 Translation button initialized: ${this.translationToggle.getCurrent()}`);
    }

    setupCopyrightDiagnosticToggle() {
        const copyright = document.getElementById('copyright');
        if (!copyright) {
            Logger.debug('Copyright element not found - diagnostic toggle not available');
            return;
        }

        copyright.style.cursor = 'pointer';
        copyright.addEventListener('click', () => {
            this.showDetailSectorBoundsFlag = !this.showDetailSectorBoundsFlag;
            if (this.showDetailSectorBoundsFlag) {
                this.showDetailSectorBounds();
                console.log('📐 Detail Sector bounds: ON');
            } else {
                this.hideDetailSectorBounds();
                console.log('📐 Detail Sector bounds: OFF');
            }
        });

        Logger.debug('Copyright diagnostic toggle initialized - click to show/hide Detail Sector bounds');
    }

    handleTranslationChange(lang) {
        this.setTranslation(lang);

        // Refresh detail sector if visible
        if (this.detailSector.isVisible && this.selectedFocusItem) {
            this.detailSector.showDetailContent(this.selectedFocusItem);
        }

        // Refresh Focus Ring to update Magnifier labels (Chapter/Verse translations)
        if (this.lastRotationOffset !== undefined) {
            this.updateFocusRingPositions(this.lastRotationOffset);
        }

        // Keep toggle label in sync if external callers set translation
        if (this.translationToggle.getCurrent() !== lang) {
            this.translationToggle.setCurrent(lang);
        }
    }
    
    createMagnifier() {
        // Remove existing magnifier if it exists
        const existingRing = this.elements.magnifier;
        if (existingRing) {
            existingRing.remove();
        }
        
        // Create new magnifier
        const ring = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        ring.setAttribute('id', 'magnifier');
        ring.style.cursor = 'pointer';
        ring.style.pointerEvents = 'all'; // Ensure it receives touch events
        
        console.log('✨ Magnifier created with click handler');
        
        // Add click handler to advance Focus Ring by one node
        let touchStartPos = null;
        let touchStartTime = null;
        
        ring.addEventListener('touchstart', (e) => {
            console.log('✨ Magnifier TOUCHSTART');
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchStartTime = performance.now();
        }, { passive: true });
        
        ring.addEventListener('touchend', (e) => {
            console.log('✨ Magnifier TOUCHEND');
            if (!touchStartPos) return;
            
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartPos.x;
            const dy = touch.clientY - touchStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const duration = performance.now() - touchStartTime;
            
            Logger.debug('🔍 Magnifier touchend:', {
                distance: distance.toFixed(2),
                duration: duration.toFixed(2),
                willTrigger: distance < 10 && duration < 300
            });
            
            // Only trigger if touch didn't move much (click, not swipe) and was quick
            if (distance < 10 && duration < 300) {
                e.preventDefault();
                e.stopPropagation();
                console.log('✨ MAGNIFIER TAP - no action (clicks on unselected nodes move them to center)');
            } else {
                console.log('✨ Magnifier touch too long or moved too much:', { distance, duration });
            }
            touchStartPos = null;
            touchStartTime = null;
        }, { passive: false });
        
        // Magnifier click disabled - clicking unselected nodes brings them to center
        ring.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Logger.debug('🔍 Magnifier clicked - no action (clicks on unselected nodes move them to center)');
        });
        
        // Add to main group (NOT to focus ring group, so it stays visible)
        this.elements.mainGroup.appendChild(ring);
        
        // Cache the element
        this.elements.magnifier = ring;
        
        // Position it
        this.positionMagnifyingRing();
        
        Logger.debug('Magnifier created and positioned with click handler');
        
        return ring;
    }
    
    /**
     * Initialize translation button if translations are configured
     */
    initializeTranslationButton() {
        console.log('🌐 initializeTranslationButton() called');
        
        const displayConfig = this.dataManager.getDisplayConfig();
        console.log('🌐 displayConfig:', displayConfig ? 'exists' : 'null');
        
        const translations = displayConfig?.translations;
        console.log('🌐 translations config:', JSON.stringify(translations));
        
        if (!translations || !translations.available || translations.available.length < 2) {
            console.log('🌐 No translations configured or only one language - hiding button');
            return;
        }
        
        this.translationsConfig = translations;

        const initialized = this.translationToggle.init(translations, {
            onChange: (lang) => this.handleTranslationChange(lang)
        });

        if (!initialized) {
            Logger.warn('🌐 Translation toggle could not be initialized (missing DOM elements?)');
            return;
        }

        // Sync initial selection to navigation state
        this.setTranslation(this.translationToggle.getCurrent());

        Logger.info(`🌐 Translation button initialized: ${this.translationToggle.getCurrent()}`);
    }
    
    /**
     * Get current translation code (e.g., 'lat', 'eng')
     */
    getCurrentTranslation() {
        return this.currentTranslation || 'lat';
    }
    
    /**
     * Get the text property name for current translation
     * Now uses language codes directly (e.g., 'latin', 'english', 'hebrew')
     */
    getTranslationTextProperty() {
        // Return current translation language code directly
        // (e.g., 'latin', 'english', 'hebrew', 'greek', 'french', etc.)
        return this.currentTranslation || 'latin';
    }

    /**
     * Get the translated display name for a hierarchy level
     * @param {Object} levelConfig - The hierarchy level configuration
     * @returns {string} The translated display name or default display_name
     */
    getTranslatedDisplayName(levelConfig) {
        if (!levelConfig) return '';
        
        // Try to get the translated version first
        const translatedKey = `display_name_${this.currentTranslation}`;
        if (levelConfig[translatedKey]) {
            return levelConfig[translatedKey];
        }
        
        // Fall back to default display_name
        return levelConfig.display_name || '';
    }

    /**
     * Bring a specific focus node to center (magnifier position)
     * Triggered by clicking an unselected focus node
     */
    bringFocusNodeToCenter(focusItem) {
        console.log('🎯🎯🎯 bringFocusNodeToCenter CALLED');
        console.log(`🎯🔍 SEARCH: Looking for item name="${focusItem.name}" key="${focusItem.key}"`);
        console.log(`🎯🔍 SEARCH: currentFocusItems array has ${this.currentFocusItems.length} items`);
        
        Logger.debug('🎯🎯🎯 bringFocusNodeToCenter CALLED');
        Logger.debug('🎯 Target item:', focusItem.name);
        
        if (!this.currentFocusItems || this.currentFocusItems.length === 0) {
            Logger.warn('🎯 No focus items available');
            return;
        }
        
        // Find the index of the clicked item
        const targetIndex = this.currentFocusItems.findIndex(item => {
            return item.key === focusItem.key;
        });
        
        if (targetIndex < 0) {
            Logger.warn('🎯 Clicked item not found in current focus items');
            return;
        }
        
        Logger.debug('🎯 Target index:', targetIndex);
        
        // Calculate rotation offset needed to center this item
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (this.currentFocusItems.length - 1) / 2;
        const targetOffset = (targetIndex - middleIndex) * angleStep;
        
        Logger.debug(`🎯 Centering [${targetIndex}] ${focusItem.name} with offset: ${targetOffset.toFixed(3)}`);
        
        // Animate to target position
        if (this.controller && typeof this.controller.animateRotationTo === 'function') {
            this.controller.animateRotationTo(targetOffset);
        } else {
            Logger.error('🎯 rotation controller not available');
        }
    }

    /**
     * Advance Focus Ring by one node clockwise (increase sort_number by 1)
     * Triggered by clicking the magnifier
     */
    advanceFocusRing() {
        Logger.debug('🔍🔍🔍 advanceFocusRing CALLED');
        
        if (!this.currentFocusItems || this.currentFocusItems.length === 0) {
            Logger.warn('🔍 No focus items to advance');
            return;
        }
        
        Logger.debug('🔍 Current focus items:', this.currentFocusItems.length);
        
        // Get current selected index
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (this.currentFocusItems.length - 1) / 2;
        const currentRotationOffset = this.getTouchHandler()?.rotationOffset || 0;
        const currentIndex = this.getSelectedFocusIndex(currentRotationOffset, this.currentFocusItems.length);
        
        Logger.debug('🔍 Selection state:', {
            angleStep,
            middleIndex,
            currentRotationOffset: currentRotationOffset.toFixed(3),
            currentIndex
        });
        
        if (currentIndex < 0) {
            Logger.warn('🔍 No item currently selected at center');
            return;
        }
        
        const currentItem = this.currentFocusItems[currentIndex];
        Logger.debug('🔍 Current item:', currentItem.name);
        
        // Calculate next index (wrap around to 0 if at end)
        const nextIndex = (currentIndex + 1) % this.currentFocusItems.length;
        const nextItem = this.currentFocusItems[nextIndex];
        
        // Calculate rotation offset needed to center the next item
        const targetOffset = (nextIndex - middleIndex) * angleStep;
        
        Logger.debug(`🔍🎯 Magnifier clicked: advancing from [${currentIndex}] ${currentItem.name} to [${nextIndex}] ${nextItem.name}`);
        Logger.debug(`🔍🎯 Offset: ${currentRotationOffset.toFixed(3)} → ${targetOffset.toFixed(3)}`);
        
        // Animate to target position
        if (this.controller && typeof this.controller.animateRotationTo === 'function') {
            Logger.debug('🔍 Calling animateRotationTo with targetOffset:', targetOffset.toFixed(3));
            this.controller.animateRotationTo(targetOffset);
        } else {
            Logger.error('🔍 rotation controller not available');
        }
    }
    

    
    onRotationEnd() {
        // Called when touch rotation has completely stopped
        if (this.settleTimeout) {
            clearTimeout(this.settleTimeout);
        }
        
        // Trigger immediate settling for the currently selected focus item
        this.isRotating = false;
        if (this.selectedFocusItem) {
            this.focusRingDebug('Rotation ended, showing children for settled focus item:', this.selectedFocusItem.name);
            const selectedIndex = this.currentFocusItems.findIndex(m => m.key === this.selectedFocusItem.key);
            if (selectedIndex >= 0) {
                const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
                const centerAngle = this.viewport.getCenterAngle();
                const middleIndex = (this.currentFocusItems.length - 1) / 2;
                const angle = centerAngle + (middleIndex - selectedIndex) * angleStep;
                this.showChildContentForFocusItem(this.selectedFocusItem, angle);
            }
        }
    }
    
    buildActivePath(focusItem) {
        // Pure universal: Use metadata __path property
        this.setActivePath(focusItem.__path || []);
        this.focusRingDebug('Built active path:', this.activePath);
    }
    
    showChildContentForFocusItem(focusItem, angle) {
        // PERFORMANCE: Debounce - skip if we've shown content for same item recently
        const itemKey = focusItem.key || focusItem.name;
        if (this._lastChildContentItem === itemKey && 
            this._lastChildContentTime && 
            performance.now() - this._lastChildContentTime < 50) {
            // Skip redundant call
            return;
        }
        this._lastChildContentItem = itemKey;
        this._lastChildContentTime = performance.now();
        
        if (DEBUG_VERBOSE) console.log('📦📦📦 showChildContentForFocusItem CALLED:', focusItem.name, 'path:', focusItem.__path);
        Logger.debug('Showing child content for focus item:', focusItem.name);

        // Determine the hierarchy level of the focus item
        const currentLevel = this.getItemHierarchyLevel(focusItem);
        if (DEBUG_VERBOSE) console.log('📦 Current level:', currentLevel);
        if (!currentLevel) {
            Logger.warn('Could not determine hierarchy level for focus item:', focusItem);
            return;
        }

        // Get the immediate next hierarchy level (universal navigation requires immediate children)
        const nextLevel = this.getNextHierarchyLevel(currentLevel);
        if (DEBUG_VERBOSE) console.log('📦 Next level:', nextLevel);
        if (!nextLevel) {
            Logger.debug('No next level detected for', focusItem.name, '- treating as leaf');
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, null), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        // Check if we need lazy loading (split volume, book level getting chapters)
        if (this.dataManager.isSplitStructure() && currentLevel === 'book' && nextLevel === 'chapter') {
            // Use async version for lazy loading
            this._showChildContentForFocusItemAsync(focusItem, angle, currentLevel, nextLevel);
            return;
        }

        // Check if we need lazy loading for chapters (chapter-level split, chapter getting verses)
        if (this.dataManager.isChapterSplitStructure() && currentLevel === 'chapter' && nextLevel === 'verse') {
            // Use async version for lazy loading
            this._showChildContentForChapterAsync(focusItem, angle, currentLevel, nextLevel);
            return;
        }

        // Synchronous path for monolithic volumes
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Async helper for showChildContentForFocusItem - handles lazy loading of books
     */
    async _showChildContentForFocusItemAsync(focusItem, angle, currentLevel, nextLevel) {
        Logger.info(`📥 Lazy loading chapters for book: ${focusItem.name}`);
        
        // Ensure book data is loaded
        const loaded = await this.dataManager.ensureBookLoaded(focusItem);
        if (!loaded) {
            Logger.error(`Failed to load book data for ${focusItem.name}`);
            this.handleLeafFocusSelection(focusItem);
            return;
        }
        
        // Now continue with sync path since data is loaded
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Async helper for showChildContentForFocusItem - handles lazy loading of chapters
     */
    async _showChildContentForChapterAsync(focusItem, angle, currentLevel, nextLevel) {
        console.log(`🔍 DEBUG _showChildContentForChapterAsync: chapter=${focusItem.name}, path=${JSON.stringify(focusItem.__path)}`);
        Logger.info(`📥 Lazy loading verses for chapter: ${focusItem.name}`);
        
        // Ensure chapter data is loaded
        const loaded = await this.dataManager.ensureChapterLoaded(focusItem);
        console.log(`🔍 DEBUG ensureChapterLoaded returned: ${loaded}`);
        if (!loaded) {
            Logger.error(`Failed to load chapter data for ${focusItem.name}`);
            this.handleLeafFocusSelection(focusItem);
            return;
        }
        
        // Now continue with sync path since data is loaded
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Synchronous helper for showChildContentForFocusItem
     */
    _showChildContentSync(focusItem, angle, currentLevel, nextLevel) {
        const { level: resolvedLevel, items: childItems } = this.resolveChildLevel(focusItem, nextLevel);
        const cacheLevel = resolvedLevel || nextLevel;

        if (DEBUG_VERBOSE) console.log(`📦 Resolved level: '${cacheLevel}', child items:`, childItems?.length);
        Logger.debug(`Focus item is at level '${currentLevel}', requested '${nextLevel}', resolved to '${cacheLevel}'`);
        
        if (!childItems || childItems.length === 0) {
            if (DEBUG_VERBOSE) console.log(`📦 NO CHILD ITEMS - treating as leaf`);
            Logger.debug(`No child items found for ${currentLevel}: ${focusItem.name} - treating as leaf`);
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, cacheLevel), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        this.leafStateCache.set(this.getLeafCacheKey(focusItem, cacheLevel), false);

        const itemType = this.getLevelPluralLabel(cacheLevel);
        if (DEBUG_VERBOSE) console.log(`📦 Found ${childItems.length} ${itemType}, calling showChildPyramid`);
        Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);

        // Set the active type to the current focus item's level
        this.activeType = currentLevel;
        this.setSelectedFocusItem(focusItem);
        
        // Update Parent Button for non-leaf items
        const itemLevel = this.getItemHierarchyLevel(focusItem);
        const parentLevel = itemLevel ? this.getPreviousHierarchyLevel(itemLevel) : null;
        const parentName = parentLevel ? this.getParentNameForLevel(focusItem, parentLevel) : null;
        Logger.debug(`🔼 Parent Button update: itemLevel=${itemLevel}, parentLevel=${parentLevel}, parentName=${parentName}, path=${JSON.stringify(focusItem.__path)}`);
        this.updateParentButton(parentName, true); // Skip animation during rotation

        // Collapse Detail Sector when showing Child Pyramid (non-leaf items)
        if (this.detailSector && this.detailSector.isVisible) {
            Logger.debug('🔵 Collapsing Detail Sector - Child Pyramid visible');
            this.collapseDetailSector();
        }

        // Show child items in Child Pyramid
        Logger.debug('🔺 SHOWING Child Pyramid with', childItems.length, itemType, 'for focus item:', focusItem.name);
        this.currentChildItems = childItems; // Cache for sibling retrieval when child is clicked
        this.childPyramid.showChildPyramid(childItems, itemType);
    }

    /**
     * Get child items for a specific hierarchy level
     */
    /**
     * Display a critical user-visible error for missing sort_number
     */
    showSortNumberError(items, context) {
        // Check if this level should skip sort validation
        const levelName = items.length > 0 ? items[0].__level : null;
        if (levelName) {
            const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
            if (levelConfig?.skip_sort_validation === true) {
                return false;
            }
        }
        
        const itemsWithoutSort = items.filter(item => {
            const sortNum = item.data?.sort_number ?? item.sort_number;
            return sortNum === undefined || sortNum === null;
        });

        if (itemsWithoutSort.length === 0) return false;
        const shown = showSortNumberErrorOverlay(itemsWithoutSort, context);

        Logger.error(`❌ CRITICAL: ${itemsWithoutSort.length} items missing sort_number in ${context}`);
        itemsWithoutSort.forEach(item => {
            Logger.error(`   Missing sort_number: ${item.name || item.key} (${item.__level})`);
        });
        
        return shown;
    }

    /**
     * Validate that all items have sort_numbers - returns filtered list
     */
    validateSortNumbers(items, context) {
        if (!items || items.length === 0) return items;

        const hasError = this.showSortNumberError(items, context);
        if (hasError) {
            // Return empty array - do not render items without sort_numbers
            return [];
        }

        return items;
    }

    getChildItemsForLevel(parentItem, childLevel) {
        // Pure universal: Use DataManager's universal navigation method
        const childLevelName = childLevel;
        const items = this.dataManager.getItemsAtLevel(parentItem, childLevelName) || [];
        
        // Validate sort_numbers before returning
        return this.validateSortNumbers(items, `${childLevelName} under ${parentItem.name}`);
    }

    /**
     * Get cousin items for Focus Ring display - all items at the same level
     * across all parent groups, with gaps between sibling groups
     * IMPORTANT: Only includes current parent and subsequent parents (no wrap-around)
     * @param {Object} item - The current item
     * @param {string} itemLevel - The level of the current item
     * @returns {Array} Array of items with null gaps between sibling groups
     */
    getCousinItemsForLevel(item, itemLevel) {
        // Get the grandparent level (two levels up)
        const parentLevel = this.getPreviousHierarchyLevel(itemLevel);
        if (!parentLevel) {
            Logger.warn('No parent level found for cousin navigation');
            return this.getChildItemsForLevel(this.buildParentItemFromChild(item, parentLevel), itemLevel);
        }
        
        const grandparentLevel = this.getPreviousHierarchyLevel(parentLevel);
        if (!grandparentLevel) {
            Logger.warn('No grandparent level found for cousin navigation - falling back to sibling navigation');
            const parentItem = this.buildParentItemFromChild(item, parentLevel);
            return this.getChildItemsForLevel(parentItem, itemLevel);
        }
        
        // Build parent and grandparent items from current item
        const parentItem = this.buildParentItemFromChild(item, parentLevel);
        const grandparentItem = this.buildParentItemFromChild(item, grandparentLevel);
        
        // Get all parents (uncles/aunts) at the parent level under the grandparent
        const allParents = this.getChildItemsForLevel(grandparentItem, parentLevel);
        
        // Find the index of the current parent in the list
        const currentParentIndex = allParents.findIndex(p => p.key === parentItem.key);
        
        if (currentParentIndex === -1) {
            Logger.warn(`🎯👥 Could not find current parent ${parentItem.name} in parent list - using all parents`);
        }
        
        // Only include parents from current parent forward (no wrap-around)
        const parentsToInclude = currentParentIndex >= 0 
            ? allParents.slice(currentParentIndex) 
            : allParents;
        
        Logger.debug(`🎯👥 Cousin navigation: ${itemLevel} across ${parentsToInclude.length}/${allParents.length} ${parentLevel}s starting from ${parentItem.name}`);
        
        // Collect all cousins with gaps
        const cousinsWithGaps = [];
        
        parentsToInclude.forEach((parent, parentIndex) => {
            // Get siblings under this parent
            const siblings = this.getChildItemsForLevel(parent, itemLevel);
            
            Logger.debug(`  ${parentLevel} "${parent.name}": ${siblings.length} ${itemLevel}s`);
            
            // Add all siblings
            cousinsWithGaps.push(...siblings);
            
            // Add 2 gaps after each sibling group (except the last one)
            if (parentIndex < parentsToInclude.length - 1) {
                cousinsWithGaps.push(null, null); // Two gap entries
            }
        });
        
        Logger.debug(`🎯👥 Total cousin items: ${cousinsWithGaps.filter(x => x !== null).length} + ${cousinsWithGaps.filter(x => x === null).length} gaps = ${cousinsWithGaps.length} total`);
        
        return cousinsWithGaps;
    }

    /**
     * Async version of getChildItemsForLevel that supports lazy loading
     * Used for split volumes where data may need to be fetched
     */
    async getChildItemsForLevelAsync(parentItem, childLevel) {
        const childLevelName = childLevel;
        
        // Check if lazy loading is needed (for split volumes)
        if (this.dataManager.isSplitStructure()) {
            // For books getting chapters, ensure book data is loaded first
            const parentLevel = parentItem.__level;
            if (parentLevel === 'book' && childLevelName === 'chapter') {
                const loaded = await this.dataManager.ensureBookLoaded(parentItem);
                if (!loaded) {
                    console.error(`Failed to load book data for ${parentItem.name}`);
                    return [];
                }
            }
            // For chapters getting verses (chapter-level split), ensure chapter data is loaded first
            if (parentLevel === 'chapter' && childLevelName === 'verse' && this.dataManager.isChapterSplitStructure()) {
                const loaded = await this.dataManager.ensureChapterLoaded(parentItem);
                if (!loaded) {
                    console.error(`Failed to load chapter data for ${parentItem.name}`);
                    return [];
                }
            }
        }
        
        // Now get items (data should be available)
        const items = this.dataManager.getItemsAtLevel(parentItem, childLevelName) || [];
        
        // Validate sort_numbers before returning
        return this.validateSortNumbers(items, `${childLevelName} under ${parentItem.name}`);
    }

    resolveChildLevel(parentItem, startingLevel) {
        if (!startingLevel) {
            return { level: null, items: [] };
        }

        const visited = new Set();
        let levelName = startingLevel;

        while (levelName && !visited.has(levelName)) {
            visited.add(levelName);

            const childItems = this.getChildItemsForLevel(parentItem, levelName);
            if (childItems && childItems.length) {
                return { level: levelName, items: childItems };
            }

            const isPseudo = typeof this.dataManager.isPseudoLevel === 'function'
                ? this.dataManager.isPseudoLevel(levelName)
                : false;

            if (!isPseudo) {
                break;
            }

            levelName = this.getNextHierarchyLevel(levelName);
        }

        return { level: levelName, items: [] };
    }

    /**
     * Async version of resolveChildLevel that supports lazy loading
     * Used for split volumes where data may need to be fetched
     */
    async resolveChildLevelAsync(parentItem, startingLevel) {
        if (!startingLevel) {
            return { level: null, items: [] };
        }

        const visited = new Set();
        let levelName = startingLevel;

        while (levelName && !visited.has(levelName)) {
            visited.add(levelName);

            // Use async version for lazy loading support
            const childItems = await this.getChildItemsForLevelAsync(parentItem, levelName);
            if (childItems && childItems.length) {
                return { level: levelName, items: childItems };
            }

            const isPseudo = typeof this.dataManager.isPseudoLevel === 'function'
                ? this.dataManager.isPseudoLevel(levelName)
                : false;

            if (!isPseudo) {
                break;
            }

            levelName = this.getNextHierarchyLevel(levelName);
        }

        return { level: levelName, items: [] };
    }

    getTopLevelItems() {
        const levelNames = this.getHierarchyLevelNames();
        if (!levelNames.length) {
            return [];
        }

        const topLevelName = levelNames[0];
        const topLevelCollection = this.dataManager.getTopLevelCollection();
        if (!topLevelCollection || typeof topLevelCollection !== 'object') {
            return [];
        }

        const levelConfig = this.dataManager.getHierarchyLevelConfig(topLevelName);

        const items = Object.keys(topLevelCollection).map(key => {
            const entry = topLevelCollection[key];
            const displayName = (entry && (entry.display_name || entry.name)) || key;

            return {
                name: displayName,
                key: key,
                data: entry,
                __level: topLevelName,
                __levelDepth: 0,
                __isLeaf: false,
                __path: [key],
                [topLevelName]: key
            };
        });

        let sortedItems = items;
        if (typeof this.dataManager.sortItems === 'function') {
            sortedItems = this.dataManager.sortItems(items, levelConfig);
        }

        // Validate sort_numbers for top level items
        return this.validateSortNumbers(sortedItems, `Top level ${topLevelName}`);
    }

    getLevelPluralLabel(levelName) {
        if (!levelName) {
            return '';
        }

        // Prefer plural naming from hierarchy config when available
        const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
        if (levelConfig) {
            if (levelConfig.plural_display_name) {
                return levelConfig.plural_display_name;
            }

            if (levelConfig.irregular_plural) {
                return levelConfig.irregular_plural;
            }
        }

        // Use data manager's plural property name when exposed
        if (typeof this.dataManager.getPluralPropertyName === 'function') {
            return this.dataManager.getPluralPropertyName(levelName);
        }

        return `${levelName}s`;
    }

    getLeafCacheKey(item, nextLevel) {
        const itemKey = item && (item.key || item.name || 'unknown');
        return nextLevel ? `${itemKey}::${nextLevel}` : `${itemKey}::terminal`;
    }

    isLeafItem(item) {
        if (!item) {
            return false;
        }

        if (item.__isLeaf === true) {
            return true;
        }

        if (item.__isLeaf === false) {
            return false;
        }

        const currentLevel = this.getItemHierarchyLevel(item);
        if (!currentLevel) {
            return false;
        }

        const nextLevel = this.getNextHierarchyLevel(currentLevel);
        if (!nextLevel) {
            this.leafStateCache.set(this.getLeafCacheKey(item, null), true);
            item.__isLeaf = true;
            return true;
        }

        const cacheKey = this.getLeafCacheKey(item, nextLevel);
        if (this.leafStateCache.has(cacheKey)) {
            const cached = this.leafStateCache.get(cacheKey);
            item.__isLeaf = cached;
            return cached;
        }

        const childItems = this.getChildItemsForLevel(item, nextLevel);
        const isLeaf = !childItems || childItems.length === 0;
        this.leafStateCache.set(cacheKey, isLeaf);
        item.__isLeaf = isLeaf;
        return isLeaf;
    }

    handleLeafFocusSelection(focusItem) {
        if (!focusItem) {
            return;
        }

        Logger.debug('Leaf focus item selected:', focusItem.name);

        // Hide child visuals when no children exist
        if (this.elements.childRingGroup) {
            this.elements.childRingGroup.classList.add('hidden');
        }
        this.clearFanLines();

        // Update current selection state
        this.setSelectedFocusItem({ ...focusItem });

        // Set the active type to the current focus item's level
        const itemLevel = this.getItemHierarchyLevel(focusItem);
        this.activeType = itemLevel;
        
        const parentLevel = itemLevel ? this.getPreviousHierarchyLevel(itemLevel) : null;
        const parentName = parentLevel ? this.getParentNameForLevel(focusItem, parentLevel) : null;
        Logger.debug(`🔼 Parent Button update (leaf): itemLevel=${itemLevel}, parentLevel=${parentLevel}, parentName=${parentName}, path=${JSON.stringify(focusItem.__path)}`);
        this.updateParentButton(parentName, true); // Skip animation during rotation

        if (!this.detailSector) {
            return;
        }

        // Check if this is actually at the leaf level (not just childless)
        const displayConfig = this.dataManager.getDisplayConfig();
        const leafLevel = displayConfig?.leaf_level;
        const isActualLeaf = leafLevel && itemLevel === leafLevel;
        
        // Only expand Detail Sector for actual leaf items (e.g., models, verses)
        // Don't expand for childless non-leaf items (e.g., cylinder counts without models)
        
        if (isActualLeaf) {
            if (this.detailSector.isVisible) {
                this.detailSector.showDetailContent(focusItem);
            } else if (!this.detailSectorAnimating) {
                this.expandDetailSector();
            }
        }
        // For childless non-leaf items, don't show Detail Sector at all
    }
    
    updateCenterNodeState(inactive) {
        const centralGroup = this.elements.centralGroup;
        if (inactive) {
            centralGroup.classList.add('inactive');
        } else {
            centralGroup.classList.remove('inactive');
        }
    }
    
    showFocusRing() {
        this.focusRingView.showFocusRing();
    }
    
    /**
     * Create white background band for Focus Ring nzone
     * Creates a curved band from 95% to 105% of Focus Ring radius
     */
    createFocusRingBackground() {
        this.focusRingView.createFocusRingBackground();
    }

    attachFocusRingDebugLogging(focusRingGroup) {
        this.focusRingView.attachFocusRingDebugLogging(focusRingGroup);
    }
    
    calculateInitialRotationOffset() {
        return this.focusRingView.calculateInitialRotationOffset();
    }
    
    updateFocusRingPositions(rotationOffset) {
        // PERFORMANCE: Reduce verbose logging during animation frames
        if (DEBUG_VERBOSE) {
            console.log(`🎯🔄 updateFocusRingPositions CALLED with rotationOffset=${rotationOffset?.toFixed(3) || 'undefined'}`);
            console.log(`🎯🔄 At start: currentFocusItems=${this.currentFocusItems?.length || 0}, allFocusItems=${this.allFocusItems?.length || 0}`);
        }
        
        const focusRingGroup = this.elements.focusRingGroup;
        
        // For sprocket chain: use all focus items but apply viewport filtering during rendering
        const allFocusItems = this.allFocusItems.length > 0 ? this.allFocusItems : this.currentFocusItems;
        if (!allFocusItems.length) return;
        
        // Validate rotationOffset
        if (isNaN(rotationOffset)) {
            Logger.error(`Invalid rotationOffset: ${rotationOffset}`);
            rotationOffset = 0; // Safe fallback
        }
        
        // Track rotation changes - hide Child Pyramid during rotation
        const programmaticFocus = this.forceImmediateFocusSettlement === true;
        const rotationTriggered = this.lastRotationOffset !== undefined && Math.abs(rotationOffset - this.lastRotationOffset) > 0.001;
        // Don't hide Child Pyramid if we're within the protection period after immediate settlement
        const isProtected = this.protectedRotationOffset !== undefined && Math.abs(rotationOffset - this.protectedRotationOffset) < 0.01;
        const isRotating = !programmaticFocus && !isProtected && rotationTriggered;
        
        if (isRotating) {
            const errorDivCount = document.querySelectorAll('.sort-number-error').length;
            if (errorDivCount > 0) {
                console.log('🔄 ROTATION DETECTED - Removing error divs:', errorDivCount);
            }
            this.focusRingDebug('🔄 Rotation detected - hiding Child Pyramid temporarily');
            
            // Hide Child Pyramid and fan lines during rotation
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
            this.navigationView.clearParentLine();
            
            // Remove any sort number error messages
            const errorDivs = document.querySelectorAll('.sort-number-error');
            
            errorDivs.forEach(div => {
                console.log('🗑️ Removing error div:', div.textContent.substring(0, 50));
                div.remove();
            });
        }
        this.lastRotationOffset = rotationOffset;
        
        // PERFORMANCE OPTIMIZATION: Check if focus items changed - only rebuild if needed
        const focusItemsKey = allFocusItems.map(item => item === null ? 'GAP' : item.key).join('|');
        const focusItemsChanged = this._lastFocusItemsKey !== focusItemsKey;
        this._lastFocusItemsKey = focusItemsKey;
        
        // Always clear and rebuild during rotation to prevent ghosting
        // The optimization is for static state (same items, same position) only
        const shouldRebuild = focusItemsChanged || isRotating || rotationTriggered;
        
        // Ensure background band stays in DOM; we'll diff visible nodes instead of clearing all
        const background = focusRingGroup.querySelector('#focusRingBackground');
        if (background && !background.parentNode) {
            focusRingGroup.appendChild(background);
        }
        
        // Use updated angle calculation logic to maintain JSON order
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD; // Keep original 4.3° spacing
        const centerAngle = this.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + rotationOffset;
        const middleIndex = (allFocusItems.length - 1) / 2;
        
        // Validate centerAngle
        if (isNaN(centerAngle) || isNaN(adjustedCenterAngle)) {
            Logger.error(`Invalid angles: centerAngle=${centerAngle}, adjustedCenterAngle=${adjustedCenterAngle}`);
            return;
        }
        
        // Calculate arc parameters
        const arcParams = this.viewport.getArcParameters();
        let selectedFocusItem = null;
        let selectedIndex = -1;
        
        // Only log for Bible books
        const isBibleBooks = allFocusItems.length > 0 && allFocusItems[0].name?.startsWith('Liber_');
        
        if (isBibleBooks) {
            this.focusRingDebug(`📚 BIBLE BOOKS - Focus items order (${allFocusItems.length} items):`);
            allFocusItems.forEach((item, idx) => {
                const sortNum = item.data?.sort_number ?? item.sort_number ?? 'none';
                this.focusRingDebug(`  [${idx}] ${item.name} (sort_number: ${sortNum})`);
            });
            this.focusRingDebug(`🎯 Center angle: ${(centerAngle * 180 / Math.PI).toFixed(1)}°, Rotation offset: ${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
            this.focusRingDebug(`🎯 Adjusted center angle: ${(adjustedCenterAngle * 180 / Math.PI).toFixed(1)}°`);
        }

        // Process all focus items but only render those in viewport window (with small buffer)
        const visibleEntries = [];
        const viewportBuffer = angleStep * 2; // keep a small buffer to reduce pop-in

        allFocusItems.forEach((focusItem, index) => {
            // Skip gap entries (null values used for visual separation between cousin groups)
            if (focusItem === null) {
                return; // Don't render anything for gaps
            }
            
            // Validate sort_number
            const sortNumber = focusItem.data?.sort_number ?? focusItem.sort_number;
            if (sortNumber === undefined || sortNumber === null) {
                Logger.error(`❌ RUNTIME ERROR: Item "${focusItem.name}" at index ${index} missing sort_number`);
            }
            
            // Calculate angle using original logic
            const angle = adjustedCenterAngle + (middleIndex - index) * angleStep;
            
            if (isBibleBooks) {
                this.focusRingDebug(`📐 Item [${index}] ${focusItem.name}: angle = ${(angle * 180 / Math.PI).toFixed(1)}°`);
            }
            
            // Validate calculated angle
            if (isNaN(angle)) {
                Logger.error(`Invalid calculated angle for focus item ${index}: ${angle}`);
                return;
            }
            
            // Check if this focus item should be visible (viewport filter)
            const angleDiff = Math.abs(angle - centerAngle);
            const maxViewportAngle = MOBILE_CONFIG.VIEWPORT.VIEWPORT_ARC / 2;
            
            if (angleDiff <= maxViewportAngle + viewportBuffer) {
                const position = this.calculateFocusPosition(angle, arcParams);
                const isSelected = angleDiff < (angleStep * 0.5);
                if (isSelected) {
                    selectedFocusItem = focusItem;
                    selectedIndex = index;
                    if (DEBUG_VERBOSE) {
                        console.log(`🎯🎯🎯 ITEM SELECTED AT CENTER: [${index}] ${focusItem.name}, angleDiff=${angleDiff.toFixed(3)}°, rotationOffset=${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
                    }
                    this.focusRingDebug('🎯 SELECTED during rotation:', focusItem.name, 'angleDiff:', angleDiff.toFixed(3), 'threshold:', (angleStep * 0.5).toFixed(3));
                }

                visibleEntries.push({
                    focusItem,
                    position,
                    angle,
                    isSelected
                });
            }
        });

        // Diff DOM: remove nodes that scrolled out of view
        const visibleKeys = new Set(visibleEntries.map(entry => entry.focusItem.key));
        for (const [key, element] of this.focusElements.entries()) {
            if (!visibleKeys.has(key)) {
                element.remove();
                this.focusElements.delete(key);
            }
        }

        // Render/update visible nodes in order
        visibleEntries.forEach(entry => {
            const { focusItem, position, angle, isSelected } = entry;
            let element = this.focusElements.get(focusItem.key);
            if (element) {
                this.updateFocusElement(element, position, angle, isSelected);
            } else {
                element = this.createFocusElement(focusItem, position, angle, isSelected);
                this.focusElements.set(focusItem.key, element);
            }
            if (element.parentNode !== focusRingGroup) {
                focusRingGroup.appendChild(element);
            } else if (element.nextSibling && element.nextSibling.id === 'focusRingBackground') {
                // Keep background as first child if present
                focusRingGroup.appendChild(element);
            }
        });

        // Ensure background stays behind nodes
        if (background && focusRingGroup.firstChild !== background) {
            focusRingGroup.insertBefore(background, focusRingGroup.firstChild);
        }
        
        // Position magnifying ring at the calculated center angle
        this.positionMagnifyingRing();
        
        // COUSIN NAVIGATION FIX: If no item was selected (gap at center), find nearest non-gap item
        if (selectedIndex === -1 && allFocusItems.length > 0) {
            // Calculate which index should be at center based on angles
            const centerIndexFloat = middleIndex - (rotationOffset / angleStep);
            const centerIndexRounded = Math.round(centerIndexFloat);
            
            // Search outward from center position to find nearest non-gap item
            let searchRadius = 0;
            const maxSearch = allFocusItems.length;
            
            while (searchRadius < maxSearch && selectedFocusItem === null) {
                // Check items at increasing distances from center
                const checkIndices = [];
                if (searchRadius === 0) {
                    checkIndices.push(centerIndexRounded);
                } else {
                    checkIndices.push(centerIndexRounded + searchRadius);
                    checkIndices.push(centerIndexRounded - searchRadius);
                }
                
                for (const checkIndex of checkIndices) {
                    if (checkIndex >= 0 && checkIndex < allFocusItems.length) {
                        const candidate = allFocusItems[checkIndex];
                        if (candidate !== null) {
                            selectedFocusItem = candidate;
                            selectedIndex = checkIndex;
                            Logger.debug(`🎯 Gap at center - selected nearest item: [${selectedIndex}] ${selectedFocusItem.name}`);
                            break;
                        }
                    }
                }
                searchRadius++;
            }
        }
        
        // Update active path with selected focus item  
        if (selectedIndex >= 0 && selectedFocusItem) {
            // Build appropriate active path based on item type
            this.buildActivePath(selectedFocusItem);
            
            this.setSelectedFocusItem(selectedFocusItem);
            const parentLevel = this.getPreviousHierarchyLevel(this.getItemHierarchyLevel(selectedFocusItem));
            const parentName = parentLevel ? this.getParentNameForLevel(selectedFocusItem, parentLevel) : null;
            this.updateParentButton(parentName, true); // Skip animation during rotation

            const angle = adjustedCenterAngle + (middleIndex - selectedIndex) * angleStep;

            if (this.forceImmediateFocusSettlement) {
                this.focusRingDebug('🔺 Immediate focus settlement triggered - showing child content without rotation delay');
                this.isRotating = false;
                if (this.settleTimeout) {
                    clearTimeout(this.settleTimeout);
                }
                this.elements.detailItemsGroup.classList.add('hidden');
                this.clearFanLines();
                this.showChildContentForFocusItem(selectedFocusItem, angle);
            } else {
                // Mark as rotating and defer child display
                this.isRotating = true;

                // Clear any existing settle timeout
                if (this.settleTimeout) {
                    clearTimeout(this.settleTimeout);
                }

                // Hide child ring immediately during rotation to prevent strobing
                this.focusRingDebug('🔄 ROTATION: Focus item selected but rotating - hiding Child Pyramid during rotation');
                this.elements.childRingGroup.classList.add('hidden');
                this.elements.detailItemsGroup.classList.add('hidden');
                this.clearFanLines();

                // Set timeout to show appropriate child content after settling
                this.settleTimeout = setTimeout(() => {
                    this.focusRingDebug('⏰ TIMEOUT FIRED: isRotating=', this.isRotating, 'selectedFocusItem=', this.selectedFocusItem && this.selectedFocusItem.name, 'expectedItem=', selectedFocusItem.name);
                    this.isRotating = false;
                    if (this.selectedFocusItem && this.selectedFocusItem.key === selectedFocusItem.key) {
                        this.focusRingDebug('✅ Focus item settled:', selectedFocusItem.name, 'showing child content');
                        this.showChildContentForFocusItem(selectedFocusItem, angle);
                    } else {
                        this.focusRingDebug('❌ Timeout fired but item changed - not showing child content');
                    }
                }, MOBILE_CONFIG.TIMING.FOCUS_ITEM_SETTLE_DELAY);
            }
            
        } else {
            // Hide child ring immediately when no focus item is selected (during rotation)
            this.focusRingDebug('🔄 ROTATION: No focus item selected - hiding Child Pyramid immediately');
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
            this.setSelectedFocusItem(null);
            this.hideParentButton();
        }
    }
    
    /**
     * Manually trigger focus settlement to show Child Pyramid for centered item
     * Called after programmatic rotation animations complete
     */
    triggerFocusSettlement() {
        Logger.debug('🎯 triggerFocusSettlement CALLED');
        
        // Mark as no longer rotating
        this.isRotating = false;
        
        // Clear any pending settle timeout
        if (this.settleTimeout) {
            clearTimeout(this.settleTimeout);
            this.settleTimeout = null;
        }
        
        // Get the currently selected focus item
        if (!this.selectedFocusItem) {
            Logger.warn('🎯 No selected focus item to settle');
            return;
        }
        
        // Calculate the angle for the selected item
        const allFocusItems = this.allFocusItems.length > 0 ? this.allFocusItems : this.currentFocusItems;
        const selectedIndex = allFocusItems.findIndex(item => item.key === this.selectedFocusItem.key);
        
        if (selectedIndex < 0) {
            Logger.warn('🎯 Selected focus item not found in focus items list');
            return;
        }
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const centerAngle = this.viewport.getCenterAngle();
        const rotationOffset = this.getTouchHandler()?.rotationOffset || 0;
        const adjustedCenterAngle = centerAngle + rotationOffset;
        const middleIndex = (allFocusItems.length - 1) / 2;
        const angle = adjustedCenterAngle + (middleIndex - selectedIndex) * angleStep;
        
        Logger.debug(`🎯 Settling on: ${this.selectedFocusItem.name} at index ${selectedIndex}`);
        this.showChildContentForFocusItem(this.selectedFocusItem, angle);

        // After settlement, refresh parent line
        setTimeout(() => {
            this.navigationView.drawParentLine({
                isRotating: this.isRotating,
                isAnimating: this.isAnimating
            });
        }, 10);
        
        // BUGFIX: Removed redundant updateFocusRingPositions() call
        // The focus ring was already positioned correctly with click handlers attached
        // during handleChildPyramidClick() before this settlement function was called.
        // Calling it again here was causing a race condition where DOM elements were
        // being recreated while still settling from the animation, breaking click handlers.
    }
    
    getSelectedFocusIndex(rotationOffset, focusCount) {
        if (focusCount === 0) return -1;
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (focusCount - 1) / 2;
        
        // Calculate which focus item index should be at the dynamic center angle position
        // For a focus item at index i to be at center angle:
        // centerAngle + rotationOffset + (middleIndex - i) * angleStep = centerAngle
        // Therefore: i = middleIndex + (rotationOffset / angleStep)
        const exactIndex = middleIndex + (rotationOffset / angleStep);
        const roundedIndex = Math.round(exactIndex);
        
        // Only select if the focus item is very close to the exact position (detent threshold)
        const detentThreshold = 0.15; // Allow small deviation for selection
        const deviation = Math.abs(exactIndex - roundedIndex);
        
        if (deviation <= detentThreshold && roundedIndex >= 0 && roundedIndex < focusCount) {
            return roundedIndex;
        }
        
        return -1; // No focus item selected if not close enough to detent position
    }
    

    
    calculateFocusPosition(angle, arcParams) {
        return this.focusRingView.calculateFocusPosition(angle, arcParams);
    }
    
    // Phase 2 Consolidation: Bilingual coordinate positioning method
    // Uses bilingual coordinate system while preserving exact positioning behavior
    calculateFocusPositionBilingual(angle, arcParams) {
        return this.focusRingView.calculateFocusPositionBilingual(angle, arcParams);
    }
    
    createFocusElement(focusItem, position, angle, isSelected = false) {
        return this.focusRingView.createFocusElement(focusItem, position, angle, isSelected);
    }
    
    updateFocusElement(element, position, angle, isSelected = false) {
        this.focusRingView.updateFocusElement(element, position, angle, isSelected);
    }
    
    updateFocusItemText(textElement, angle, item, isSelected = false) {
        // Validate angle to prevent NaN errors
        if (isNaN(angle)) {
            Logger.error(`Invalid text angle: ${angle}`);
            return;
        }
        
        // Get configuration for this item's level (pure universal)
        const itemLevel = item.__level || 'focusItem';
        const levelConfig = this.dataManager.getHierarchyLevelConfig(itemLevel);
        const textPosition = levelConfig && levelConfig.focus_text_position || 'radial';
        const textTransform = levelConfig && levelConfig.focus_text_transform || 'none';
        
        let textX, textY, textAnchor;
        
        if (textPosition === 'centered') {
            // Center text over the node
            textX = 0;
            textY = 0;
            textAnchor = 'middle';
        } else {
            // Radial positioning - center text over circles for all items
            // No offset needed - text positioned at same coordinates as circle center
            const offset = 0;
            
            textX = offset * Math.cos(angle);
            textY = offset * Math.sin(angle);
            
            // Center all text over circles for consistent positioning
            textAnchor = 'middle';
        }
        
        let rotation = angle * 180 / Math.PI;
        
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        
        // Validate calculated values
        if (isNaN(textX) || isNaN(textY) || isNaN(rotation)) {
            Logger.error(`Invalid text position: x=${textX}, y=${textY}, rotation=${rotation}, angle=${angle}`);
            return;
        }
        
        textElement.setAttribute('x', textX);
        textElement.setAttribute('y', textY);
        textElement.setAttribute('dy', '0.3em');
        textElement.setAttribute('text-anchor', textAnchor);
        textElement.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        textElement.setAttribute('fill', 'black');
        
        // Let CSS handle font sizing and weight through the 'selected' class
        textElement.removeAttribute('font-size');
        textElement.removeAttribute('font-weight');
        
        // Apply text transformation based on configuration (pure universal)
        // Prefer translated display name when available, BUT NOT for numeric items
        // (verses have their content in language properties, not their display name)
        const isNumericLevel = levelConfig && levelConfig.is_numeric;
        const translationProp = (!isNumericLevel && typeof this.getTranslationTextProperty === 'function')
            ? this.getTranslationTextProperty()
            : null;
        // Only look for translated names on non-numeric items (books, sections, etc.)
        // For numeric items (chapters, verses), the language property contains content, not the name
        const translated = translationProp
            ? (item.translations?.[translationProp])  // Only check translations object, not item root
            : null;
        const baseName = translated || item.name;

        let displayText = baseName;
        if (textTransform === 'number_only_or_cil') {
            // Extract numeric part and optionally append CIL when selected
            const match = baseName && baseName.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                displayText = isSelected ? `${number} CIL` : number;
            }
        } else if (textTransform === 'number_only') {
            // Show just the number for unselected, prepend display_name when selected
            const match = baseName && baseName.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                if (isSelected && levelConfig) {
                    const translatedDisplayName = this.getTranslatedDisplayName(levelConfig);
                    if (translatedDisplayName) {
                        displayText = `${translatedDisplayName} ${number}`;
                    } else {
                        displayText = number;
                    }
                } else {
                    displayText = number;
                }
            }
        }
        
        textElement.textContent = displayText;
        
        // Log text size for Magnifier (selected focus item)
        if (isSelected) {
            // CSS sets font-size via .focusItem.selected text rule (20px bold)
            console.log('📏 MAGNIFIER TEXT SIZE:', '20px (CSS)', 'weight: bold (CSS)', 'item:', item.name);
        }
    }
    
    addTimestampToCenter() {
        const existingTimestamp = this.elements.centralGroup.querySelector('.timestamp');
        if (existingTimestamp) {
            existingTimestamp.remove();
        }
        
        const timestamp = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        timestamp.setAttribute('class', 'timestamp');
        timestamp.setAttribute('x', '0');
        timestamp.setAttribute('y', '60');
        timestamp.setAttribute('text-anchor', 'middle');
        timestamp.setAttribute('fill', '#f2f2e6');
        timestamp.setAttribute('font-size', '8');
        timestamp.setAttribute('opacity', '0.7');
        timestamp.textContent = new Date().toLocaleTimeString();
        
        this.elements.centralGroup.appendChild(timestamp);
    }
    
    /**
     * Get the color scheme from display_config
     */
    getColorScheme() {
        const displayConfig = this.dataManager.getDisplayConfig();
        return displayConfig && displayConfig.color_scheme || {
            background: '#868686',
            nodes: '#f1b800',
            detail_sector: '#362e6a',
            text_primary: '#000000',
            text_secondary: '#ffffff'
        };
    }

    getColor(type, name) {
        // Special handling for volume selector
        if (type === 'volume_selector') {
            return '#362e6a'; // MMdM blue for volume selector
        }
        
        // Get color from display configuration
        const levelConfig = this.dataManager.getHierarchyLevelConfig(type);
        const colorScheme = this.getColorScheme();
        return levelConfig && levelConfig.color || colorScheme.nodes;
    }
    
    getColorForType(type) {
        return this.getColor(type, '');
    }
    
    /**
     * Get the hierarchy levels configuration
     */
    getHierarchyLevels() {
        const displayConfig = this.dataManager.getDisplayConfig();
        return displayConfig && displayConfig.hierarchy_levels || {};
    }

    /**
     * Get the ordered list of hierarchy level names
     */
    getHierarchyLevelNames() {
        const levels = this.getHierarchyLevels();
        return Object.keys(levels);
    }

    /**
     * Get the depth/level index for a given level name
     */
    getHierarchyLevelDepth(levelName) {
        const levelNames = this.getHierarchyLevelNames();
        return levelNames.indexOf(levelName);
    }

    /**
     * Determine what hierarchy level an item belongs to based on its properties
     */
    getItemHierarchyLevel(item) {
        // Pure universal: Use metadata __level property
        return item.__level || null;
    }

    /**
     * Get the next hierarchy level name
     */
    getNextHierarchyLevel(currentLevelName) {
        const levelNames = this.getHierarchyLevelNames();
        const currentIndex = levelNames.indexOf(currentLevelName);
        if (currentIndex >= 0 && currentIndex < levelNames.length - 1) {
            return levelNames[currentIndex + 1];
        }
        return null;
    }

    /**
     * Get the previous hierarchy level name
     */
    getPreviousHierarchyLevel(currentLevelName) {
        const levelNames = this.getHierarchyLevelNames();
        const currentIndex = levelNames.indexOf(currentLevelName);
        
        if (currentIndex <= 0) {
            return null;
        }
        
        // Walk backwards through hierarchy, skipping virtual levels
        for (let i = currentIndex - 1; i >= 0; i--) {
            const candidateLevel = levelNames[i];
            const levelConfig = this.dataManager.getHierarchyLevelConfig(candidateLevel);
            
            // Skip virtual levels (those with is_virtual: true)
            if (!levelConfig || !levelConfig.is_virtual) {
                return candidateLevel;
            }
            
            Logger.debug(`🔼 Skipping virtual level: ${candidateLevel}`);
        }
        
        return null;
    }
    
    reset() {
        this.selectedTopLevel = null;
        this.setSelectedFocusItem(null);
        this.hideParentButton();
        this.currentFocusItems = [];
        this.setActivePath([]);
        this.activeType = null;
        this.focusElements.clear();
        this.positionCache.clear();
        this.leafStateCache.clear();
    this.detailSectorAnimating = false;
        
        // Collapse Detail Sector
        this.collapseDetailSector();
        
        // Hide rings
        this.elements.focusRingGroup.classList.add('hidden');
        this.elements.childRingGroup.classList.add('hidden');
        this.elements.detailItemsGroup.classList.add('hidden');
        this.clearFanLines();
        
        // Reset top level visuals
        const levelGroups = document.querySelectorAll('.levelGroup');
        levelGroups.forEach(group => {
            group.classList.remove('active', 'inactive');
        });
        
        // Reset center node
        this.updateCenterNodeState(false);
        
        // Remove timestamp
        const timestamp = this.elements.centralGroup.querySelector('.timestamp');
        if (timestamp) {
            timestamp.remove();
        }
        
        // Reset detail sector
        this.detailSector.reset();
        
        Logger.debug('Renderer reset');
    }
    
    clearFanLines() {
        const group = this.elements.pathLinesGroup;
        if (!group) return;

        // Preserve the parent-line; remove only other line elements
        Array.from(group.children).forEach(child => {
            if (!child.classList.contains('parent-line')) {
                child.remove();
            }
        });
    }
    
    hideParentButton() {
        this.navigationView.hideParentButton(true);
    }
    
    /**
     * Animate a Child Pyramid node to the Magnifier position
     * Delegates to animation module
     */
    animateNodeToMagnifier(nodeGroup, startPos, endPos, onComplete) {
        this.animation.animateNodeToMagnifier(nodeGroup, startPos, endPos, onComplete);
    }

    /**
     * Handle Child Pyramid item clicks (nzone migration)
     */
    handleChildPyramidClick(item, event) {
        // Block clicks during animation
        if (this.isAnimating) {
            Logger.debug('🔺 Click blocked - animation in progress');
            return;
        }
        
        console.log('🔺🔺🔺 HANDLE CHILD PYRAMID CLICK CALLED!', item.name);
        Logger.debug('🔺 Child pyramid item clicked:', item.name, 'implementing nzone migration OUT');

        // Set animation flag to block further clicks
        this.isAnimating = true;

        // Immediately disable touch handling to prevent race conditions with touch events
        const touchHandler = this.getTouchHandler();
        if (touchHandler) {
            touchHandler.tempDisabled = true;
        }
        
        // Capture all Child Pyramid node positions before clearing
        const allChildNodes = Array.from(this.elements.childRingGroup.querySelectorAll('.child-pyramid-item'));
        const nodePositions = allChildNodes.map(node => {
            const circle = node.querySelector('.node');
            const dataItem = JSON.parse(node.getAttribute('data-item'));
            return {
                node: node,
                key: dataItem.key,
                startX: parseFloat(circle.getAttribute('cx')),
                startY: parseFloat(circle.getAttribute('cy'))
            };
        });
        
        Logger.debug(`🎬 Captured ${nodePositions.length} Child Pyramid nodes for animation`);
        
        // Clear Child Pyramid and fan lines immediately to prevent duplicates during animation
        this.elements.childRingGroup.innerHTML = '';
        this.elements.childRingGroup.classList.add('hidden');
        this.clearFanLines();
        
        // Clear Focus Ring nodes but preserve the background band (wallpaper)
        const focusRingGroup = this.elements.focusRingGroup;
        const background = focusRingGroup.querySelector('#focusRingBackground');
        focusRingGroup.innerHTML = '';
        if (background) {
            focusRingGroup.appendChild(background);
        }
        // Don't hide the focusRingGroup - keep it visible to show the background band
        
        // Check if clicked item is a leaf - if so, start Detail Sector expansion immediately
        const isLeaf = this.isLeafItem(item);
        
        if (isLeaf) {
            Logger.debug('🔺 Leaf item detected - starting Detail Sector expansion during animation');
            const displayConfig = this.dataManager.getDisplayConfig();
            const leafLevel = displayConfig?.leaf_level;
            const itemLevel = this.getItemHierarchyLevel(item);
            const isActualLeaf = leafLevel && itemLevel === leafLevel;
            
            if (isActualLeaf && !this.detailSectorAnimating) {
                this.expandDetailSector();
            }
        }
        
        // Animate Magnifier node (current focus) to Parent Button and Parent Button off-screen
        this.animation.animateMagnifierToParentButton(item, this.selectedFocusItem);
        
        // Start animation for all nodes, then continue with state updates
        const allSiblings = this.currentChildItems || [];
        this.animation.animateSiblingsToFocusRing(item, nodePositions, allSiblings, () => {
            // Animation complete - now show the real focus ring
            this.isAnimating = false;
            const handler = this.getTouchHandler();
            if (handler) {
                handler.tempDisabled = false;
            }
            this.continueChildPyramidClick(item);
        });
    }
    
    /**
     * Animate the current Magnifier node to Parent Button position
     * Delegates to animation module
     */
    animateMagnifierToParentButton(clickedItem) {
        this.animation.animateMagnifierToParentButton(clickedItem, this.selectedFocusItem);
    }
    
    /**
     * Animate all sibling nodes from Child Pyramid to Focus Ring positions
     * @param {Object} clickedItem - The item that was clicked
     * @param {Array} nodePositions - Array of {node, key, startX, startY} for all Child Pyramid nodes
     * @param {Function} onComplete - Callback when all animations complete
     */
    animateSiblingsToFocusRing(clickedItem, nodePositions, onComplete) {
        const allSiblings = this.currentChildItems || [];
        this.animation.animateSiblingsToFocusRing(clickedItem, nodePositions, allSiblings, onComplete);
    }

    runInOutInDebugLoop(animatedNodes, done) {
        this.animation.runInOutInDebugLoop(animatedNodes, done);
    }

    /**
     * OUT MIGRATION: Animate Focus Ring nodes to Child Pyramid positions
     * This is the reverse of animateSiblingsToFocusRing
     * Used when Parent Button is clicked to navigate OUT to parent level
     * 
     * @param {Array} focusItems - Current items in Focus Ring (data)
     * @param {Array} clonedNodes - Pre-cloned DOM nodes with transform info
     * @param {Function} onComplete - Callback after animation completes
     */
    animateFocusRingToChildPyramid(focusItems, clonedNodes, onComplete) {
        this.animation.animateFocusRingToChildPyramid(
            focusItems,
            this.elements.focusRingGroup,
            this.elements.magnifier,
            onComplete
        );
    }
    
    /**
     * Continue with Child Pyramid click logic after animation completes
     */
    continueChildPyramidClick(item) {
        Logger.debug('🔺 Continuing child pyramid click after animation:', item.name);
        
        // NZONE MIGRATION: Child Pyramid → Focus Ring
        // This moves the clicked item OUT to become the new focus in the Focus Ring

        // Determine the hierarchy level of the clicked item
        const itemLevel = this.getItemHierarchyLevel(item);
        if (!itemLevel) {
            Logger.warn('🔺 Could not determine hierarchy level for clicked item:', item);
            return;
        }

        Logger.debug(`🔺 ${itemLevel} clicked:`, item.name, 'Full item:', item);

        // 1. Update the navigation state - this item becomes the new focus
        this.buildActivePath(item);
        this.activeType = itemLevel;
        this.setSelectedFocusItem({ ...item });

        // 2. Get all siblings at the same level
        // COUSIN NAVIGATION: Get all items at this level across all parents (with gaps)
        let allSiblings = [];
        
        // For Child Pyramid clicks, siblings are the other items currently in Child Pyramid
        // But we want to expand to cousin navigation
        if (this.currentChildItems && this.currentChildItems.length > 0) {
            // We have cached child items, but we want cousins instead
            Logger.debug(`🔺 Expanding from ${this.currentChildItems.length} siblings to cousin navigation`);
        }
        
        // Use cousin navigation for Focus Ring
        allSiblings = this.getCousinItemsForLevel(item, itemLevel);
        
        console.log(`🔺🔍 COUSINS ARRAY (${allSiblings.length} items including gaps):`, allSiblings.map((s, i) => s ? `[${i}]${s.name}(key:${s.key})` : `[${i}]GAP`).join(', '));
        console.log(`🔺🔍 CLICKED ITEM: name="${item.name}", key="${item.key}"`);
        
        Logger.debug(`🔺 Getting cousins for "${item.name}" at level ${itemLevel}, found ${allSiblings.length} items (including gaps)`);

        // Validate sort_numbers for non-null items only
        const nonNullItems = allSiblings.filter(s => s !== null);
        const validatedNonNull = this.validateSortNumbers(nonNullItems, `Focus Ring cousins at ${itemLevel}`);
        if (validatedNonNull.length === 0) {
            Logger.error('🔺 Cannot display Focus Ring - no valid items with sort_numbers');
            return;
        }
        
        // Rebuild array with gaps in original positions
        const validatedWithGaps = allSiblings.map(s => s === null ? null : s);

        this.currentFocusItems = validatedWithGaps;
        this.allFocusItems = validatedWithGaps;
        
        console.log(`🎯🔄 SET currentFocusItems: ${validatedWithGaps.length} items set (${nonNullItems.length} real + ${validatedWithGaps.length - nonNullItems.length} gaps)`);

        // 3. Clear current Child Pyramid (already cleared before animation)
        this.elements.childRingGroup.innerHTML = '';
        this.elements.childRingGroup.classList.add('hidden');

        // 4. Check if this is a leaf item (model with no children)
        if (this.isLeafItem(item)) {
            Logger.debug('🔺 Leaf item clicked:', item.name, '- moving siblings to Focus Ring and displaying in Detail Sector');
            
            // Find the clicked item in siblings and calculate center offset
            const clickedIndex = this.findItemIndexInArray(item, allSiblings, itemLevel);
            const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
            const middleIndex = (allSiblings.length - 1) / 2;
            const centerOffset = (clickedIndex - middleIndex) * angleStep;
            
            Logger.debug(`🔺 Calculated centerOffset for leaf ${item.name}: clickedIndex=${clickedIndex}, middleIndex=${middleIndex}, centerOffset=${centerOffset.toFixed(3)}`);

            // Set up touch rotation with the correct offset
            if (this.controller && typeof this.controller.setupTouchRotation === 'function') {
                this.controller.setupTouchRotation(allSiblings);
                Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
                
                const handler = this.getTouchHandler();
                if (handler) {
                    handler.rotationOffset = centerOffset;
                    Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
                }
            }
            
            this.lastRotationOffset = centerOffset;

            // Show Focus Ring with siblings - clicked item should be centered
            this.forceImmediateFocusSettlement = true;
            try {
                this.showFocusRing();
                // Immediately update with correct offset
                this.updateFocusRingPositions(centerOffset);
            } finally {
                this.forceImmediateFocusSettlement = false;
            }
            
            // Handle as leaf item - display in Detail Sector
            // (handleLeafFocusSelection already updates the parent button)
            this.handleLeafFocusSelection(item);
            
            Logger.debug(`🔺 Immediate focus settlement complete for leaf ${itemLevel} ${item.name}`);
            return;
        }

        // Non-leaf item handling: continue with regular nzone migration

        // 4. Find the clicked item in the siblings and calculate the center offset FIRST
        const clickedIndex = this.findItemIndexInArray(item, allSiblings, itemLevel);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        // FIX: Use positive offset to match the (middleIndex - index) formula in updateFocusRingPositions
        // If clicked item is at higher index (e.g., 14), we need positive offset to shift base angle UP
        // so that (middleIndex - 14) becomes less negative, bringing item 14 closer to center
        const centerOffset = (clickedIndex - middleIndex) * angleStep;
        
        Logger.debug(`🔺 Calculated centerOffset for ${item.name}: clickedIndex=${clickedIndex}, middleIndex=${middleIndex}, centerOffset=${centerOffset.toFixed(3)}`);

        // 5. Set up touch rotation with the correct offset
        if (this.controller && typeof this.controller.setupTouchRotation === 'function') {
            this.controller.setupTouchRotation(allSiblings);
            Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
            
            // CRITICAL: Set the rotation offset AFTER setupTouchRotation to override its default
            const handler = this.getTouchHandler();
            if (handler) {
                // Stop any ongoing inertial animation to prevent it from interfering
                handler.stopAnimation();
                handler.rotationOffset = centerOffset;
                Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
            }
        }
        
        // Also update lastRotationOffset to prevent rotation detection
        this.lastRotationOffset = centerOffset;

        // CRITICAL: Set selectedFocusItem BEFORE conditional check
        // This ensures showChildContentForFocusItem has the correct context
        this.setSelectedFocusItem(item);
        this.activeType = itemLevel;
        
        // Animate text migration from Magnifier (old focus) to Parent Button (new parent)
        // Get the new parent name that will appear in Parent Button
        const parentLevel = this.getPreviousHierarchyLevel(itemLevel);
        const newParentName = parentLevel ? this.getParentNameForLevel(item, parentLevel) : null;
        if (newParentName) {
            this.updateParentButton(newParentName, false); // Trigger animation
        }

        // Update Focus Ring with siblings - clicked item should be centered
        this.forceImmediateFocusSettlement = true;
        try {
            this.showFocusRing();
            // Immediately update with correct offset
            this.updateFocusRingPositions(centerOffset);
            
            // Protect this rotation position from triggering Child Pyramid hide
            this.protectedRotationOffset = centerOffset;
            setTimeout(() => {
                this.protectedRotationOffset = undefined;
            }, 100);
            
            // Show child content for the newly selected focus item (non-leaf)
            const magnifierPos = this.viewport.getMagnifyingRingPosition();
            this.showChildContentForFocusItem(item, magnifierPos.angle);
        } finally {
            this.forceImmediateFocusSettlement = false;
        }

        Logger.debug(`🔺 Immediate focus settlement complete for ${itemLevel} ${item.name}`);
        return;
    }

    /**
     * Get the display name for a parent level
     * Builds contextual breadcrumb from top navigation level through parent level
     */
    getParentNameForLevel(item, parentLevel) {
        if (!item.__path || item.__path.length === 0) {
            return parentLevel;
        }
        
        // Get top navigation level configuration
        const rootData = this.dataManager.data?.[this.dataManager.rootDataKey];
        const startupConfig = rootData?.display_config?.focus_ring_startup;
        const topNavLevel = startupConfig?.top_navigation_level;
        const parentButtonStyle = startupConfig?.parent_button_style || 'cumulative';
        
        // If simple style, just return the immediate parent name
        if (parentButtonStyle === 'simple') {
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2].toUpperCase();
            }
            return parentLevel;
        }
        
        if (!topNavLevel) {
            // Fallback to simple parent name if no top nav level configured
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2];
            }
            return parentLevel;
        }
        
        // Get hierarchy information
        const levelNames = this.getHierarchyLevelNames();
        const topNavDepth = levelNames.indexOf(topNavLevel);
        const parentDepth = levelNames.indexOf(parentLevel);

        const normalizeSegment = (segment) => {
            if (typeof segment === 'string') return segment;
            if (segment && typeof segment === 'object') {
                return segment.name || segment.key || String(segment);
            }
            return segment === undefined || segment === null ? '' : String(segment);
        };
        
        if (topNavDepth === -1 || parentDepth === -1) {
            // Fallback if levels not found in hierarchy
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2];
            }
            return parentLevel;
        }
        
        // Build contextual breadcrumb: always show top ancestor, then immediate parent (if different)
        const contextSegments = [];
        
        // Determine actual parent from path (handles skipped hierarchy levels)
        const actualParentIndex = item.__path.length - 2;
        const actualParentSegment = actualParentIndex >= 0 ? item.__path[actualParentIndex] : null;
        
        // Case 1: Parent is ABOVE top navigation level
        // Show only the parent name, singular
        if (actualParentIndex < topNavDepth) {
            if (actualParentSegment) {
                contextSegments.push(normalizeSegment(actualParentSegment));
            }
        }
        // Case 2: Parent IS the top navigation level
        // Show only top ancestor, singular
        else if (actualParentIndex === topNavDepth) {
            const topAncestorSegment = normalizeSegment(item.__path[topNavDepth]);
            contextSegments.push(topAncestorSegment);
        }
        // Case 3: Parent is BELOW top navigation level
        // Show top ancestor + parent (pluralized)
        else if (actualParentIndex > topNavDepth) {
            // Add top ancestor first
            const topAncestorSegment = normalizeSegment(item.__path[topNavDepth]);
            contextSegments.push(topAncestorSegment);
            
            // Add actual parent (pluralized)
            if (actualParentSegment) {
                const levelName = levelNames[actualParentIndex] || parentLevel;
                const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
                
                // Pluralize based on level type
                const normalizedParent = normalizeSegment(actualParentSegment);
                const pluralized = levelConfig?.is_numeric 
                    ? normalizedParent + "'s"  // Numbers: "8" → "8's"
                    : normalizedParent + "'s"; // Words: "Flathead" → "Flathead's"
                
                contextSegments.push(pluralized);
            }
        }
        
        // Join segments with space and convert to uppercase
        return contextSegments.join(' ').toUpperCase();
    }

    /**
     * Build a parent item from a child item for navigation purposes
     */
    buildParentItemFromChild(childItem, parentLevel) {
        if (!childItem.__path) {
            Logger.warn('buildParentItemFromChild: Child item missing __path metadata');
            return {};
        }

        const levelNames = this.getHierarchyLevelNames();
        const parentIndex = levelNames.indexOf(parentLevel);
        if (parentIndex === -1) {
            Logger.warn(`buildParentItemFromChild: Unknown parent level "${parentLevel}"`);
            return {};
        }

        // Build parent item from the path slice up to parentLevel
        const parentItem = {
            __level: parentLevel,
            __levelDepth: parentIndex,
            __path: childItem.__path.slice(0, parentIndex + 1),
            __isLeaf: false,
            key: childItem.__path.slice(0, parentIndex + 1).join('/')
        };

        // Reconstruct actual data properties from __path for legacy method compatibility
        // TODO: Remove this once getItemsAtLevel is refactored to use only metadata
        for (let i = 0; i <= parentIndex; i++) {
            const levelName = levelNames[i];
            const pathValue = childItem.__path[i];
            
            // Generic property mapping - property name matches level name
            parentItem[levelName] = pathValue;
            
            // Additional property aliases for legacy compatibility
            if (levelName === parentLevel && !parentItem.name) {
                parentItem.name = pathValue;
            }
            
            // Handle numeric conversions for count-based levels
            const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
            if (levelConfig && levelConfig.is_numeric) {
                const countProperty = levelName + 'Count';
                parentItem[countProperty] = parseInt(pathValue);
            }
            
            // Handle code-based properties
            if (levelConfig && levelConfig.use_code_property) {
                const codeProperty = levelName + 'Code';
                parentItem[codeProperty] = pathValue;
            }
        }

        if (!parentItem.name) {
            parentItem.name = childItem.__path[parentIndex];
        }

        return parentItem;
    }

    /**
     * Find the index of an item in an array based on level-specific matching
     */
    findItemIndexInArray(item, array, level) {
        console.log(`🔺🔍 SEARCHING FOR: key="${item.key}" in array of ${array.length} items (including gaps)`);
        const index = array.findIndex(sibling => sibling !== null && sibling.key === item.key);
        console.log(`🔺🔍 FOUND AT INDEX: ${index} (${index >= 0 ? array[index].name : 'NOT FOUND'})`);
        
        if (index === -1) {
            Logger.warn(`🔺 findItemIndexInArray: Item key "${item.key}" not found in array of ${array.length} items`);
            Logger.warn(`🔺 Item keys in array:`, array.filter(s => s !== null).map(s => s.key));
            Logger.warn(`🔺 Searching for item:`, item);
        }
        
        return index;
    }

    /**
     * Expand the Detail Sector when a leaf item is selected
     * Animates the blue circle from upper right to focus ring center
     */
    expandDetailSector() {
        Logger.debug('🔵 expandDetailSector() called - animating circle and logo');
        this.detailSectorAnimating = true;
        const arcParams = this.viewport.getArcParameters();
        
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        // Check if circle should be hidden for this volume
        const displayConfig = this.dataManager.getDisplayConfig();
        const hideCircle = displayConfig?.detail_sector?.hide_circle;
        
        if (!detailLogo || (!detailCircle && !hideCircle)) {
            Logger.error('🔵 Detail Sector elements not found for expansion');
            this.detailSectorAnimating = false;
            return;
        }
        
        // Get color and opacity from display config (only if circle exists)
        const detailColor = displayConfig?.color_scheme?.detail_sector;
        const detailOpacity = displayConfig?.color_scheme?.detail_sector_opacity || '1.0';
        
        // Only change color if explicitly set in config and circle exists
        if (detailCircle && detailColor) {
            detailCircle.setAttribute('fill', detailColor);
        }
        
        // Calculate circle START position (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const startRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for proper positioning
        const logoScaleFactor = 1.8;
        const startLogoWidth = startRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const startLogoHeight = startLogoWidth / logoAspectRatio;
        const logoHalfWidth = startLogoWidth / 2;
        
        // Circle START position
        const circleStartX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleStartY = -(viewportHeight / 2) + startRadius + margin;
        
        // Logo START position (top-left corner for image element)
        const logoStartX = circleStartX - (startLogoWidth / 2);
        const logoStartY = circleStartY - (startLogoHeight / 2);
        
        // Calculate circle END position (focus ring center)
        const circleEndX = arcParams.centerX;
        const circleEndY = arcParams.centerY;
        const endRadius = arcParams.radius * 0.99;  // Match Focus Ring inner edge
        
        // Calculate logo END position (centered horizontally, same top buffer)
        const logoEndState = this.getDetailSectorLogoEndState();
        
        // Opacity animation values
        const startOpacity = 0.5;
        const circleEndOpacity = parseFloat(detailOpacity); // Use config value for end opacity
        const logoEndOpacity = 0.10;
        
        // Rotation animation values
        const startRotation = 0; // Initial logo has no rotation
        const magnifierAngle = this.viewport.getCenterAngle();
        const endRotation = (magnifierAngle * 180 / Math.PI) - 180; // Match test logo rotation (CCW)
        
        // Animate to END state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentCircleOpacity = startOpacity + (circleEndOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartX + (logoEndState.x - logoStartX) * eased;
            const currentLogoY = logoStartY + (logoEndState.y - logoStartY) * eased;
            const currentLogoWidth = startLogoWidth + (logoEndState.width - startLogoWidth) * eased;
            const currentLogoHeight = startLogoHeight + (logoEndState.height - startLogoHeight) * eased;
            const currentLogoOpacity = startOpacity + (logoEndOpacity - startOpacity) * eased;
            const currentRotation = startRotation + (endRotation - startRotation) * eased;
            
            // Apply animated values to circle (if it exists)
            if (detailCircle) {
                detailCircle.setAttribute('cx', currentCircleX);
                detailCircle.setAttribute('cy', currentCircleY);
                detailCircle.setAttribute('r', currentRadius);
                detailCircle.setAttribute('opacity', currentCircleOpacity);
            }
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentLogoOpacity);
            
            // Apply rotation transform with current center as rotation point
            const currentCenterX = currentLogoX + currentLogoWidth / 2;
            const currentCenterY = currentLogoY + currentLogoHeight / 2;
            detailLogo.setAttribute('transform', `rotate(${currentRotation}, ${currentCenterX}, ${currentCenterY})`);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact END state for circle (if it exists)
                if (detailCircle) {
                    detailCircle.setAttribute('cx', circleEndX);
                    detailCircle.setAttribute('cy', circleEndY);
                    detailCircle.setAttribute('r', endRadius);
                    detailCircle.setAttribute('opacity', detailOpacity); // END state: configurable opacity
                }
                
                // Ensure exact END state for logo
                detailLogo.setAttribute('x', logoEndState.x);
                detailLogo.setAttribute('y', logoEndState.y);
                detailLogo.setAttribute('width', logoEndState.width);
                detailLogo.setAttribute('height', logoEndState.height);
                detailLogo.setAttribute('opacity', '0.10'); // END state: 10% opacity
                
                // Apply rotation to match test logo
                const magnifierAngle = this.viewport.getCenterAngle();
                const rotationDegrees = (magnifierAngle * 180 / Math.PI) - 180;
                detailLogo.setAttribute('transform', `rotate(${rotationDegrees}, ${logoEndState.centerX}, ${logoEndState.centerY})`);
                
                // Calculate top buffer for debug logging
                const logoTopEdge = logoEndState.y;
                const screenTop = -(window.innerHeight / 2);
                const topBuffer = logoTopEdge - screenTop;
                
                Logger.debug(`🔵 Detail Sector animation COMPLETE - END STATE reached`);
                Logger.debug(`   Circle: (${circleEndX}, ${circleEndY}) r=${endRadius}px`);
                Logger.debug(`   Logo: (${logoEndState.x}, ${logoEndState.y}) ${logoEndState.width}x${logoEndState.height}px`);
                Logger.debug(`   Logo top edge: ${logoTopEdge.toFixed(1)}, Screen top: ${screenTop.toFixed(1)}`);
                Logger.debug(`   Logo top buffer from screen edge: ${topBuffer.toFixed(1)}px`);
                
                // Show detail content for the selected item
                if (this.selectedFocusItem) {
                    Logger.debug('📋 Displaying detail content for selected item:', this.selectedFocusItem.name);
                    this.detailSector.showDetailContent(this.selectedFocusItem);
                }

                this.detailSectorAnimating = false;
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector animation STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${startLogoWidth.toFixed(1)}x${startLogoHeight.toFixed(1)} TO: ${logoEndState.width}x${logoEndState.height}`);
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item
     * Animates from focus ring center back to upper right corner
     */
    collapseDetailSector() {
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        if (!detailCircle || !detailLogo) {
            return;
        }

        this.detailSectorAnimating = true;
        
        // Hide detail content immediately when starting collapse
        this.detailSector.hideDetailContent();
        
        // Check if circle is already collapsed
        const currentRadius = parseFloat(detailCircle.getAttribute('r'));
        const vWidth = window.innerWidth;
        const vHeight = window.innerHeight;
        const shorter = Math.min(vWidth, vHeight);
        const collapsedRadius = shorter * 0.12;
        
        if (Math.abs(currentRadius - collapsedRadius) < 10) {
            Logger.debug('🔵 Detail Sector already collapsed - skipping animation');
            this.detailSectorAnimating = false;
            return;
        }
        
        // Get circle START state (expanded at focus ring center)
        const arcParams = this.viewport.getArcParameters();
        const circleStartX = arcParams.centerX;
        const circleStartY = arcParams.centerY;
        const startRadius = arcParams.radius * 0.98;
        
        // Get logo START state (centered horizontally, at top)
        const logoStartState = this.getDetailSectorLogoEndState();
        
        // Calculate circle END state (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const endRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for END state
        const logoScaleFactor = 1.8;
        const endLogoWidth = endRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const endLogoHeight = endLogoWidth / logoAspectRatio;
        const logoHalfWidth = endLogoWidth / 2;
        
        // Circle END position
        const circleEndX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleEndY = -(viewportHeight / 2) + endRadius + margin;
        
        // Logo END position (top-left corner for image element)
        const logoEndX = circleEndX - (endLogoWidth / 2);
        const logoEndY = circleEndY - (endLogoHeight / 2);
        
        // Opacity animation values
        const startOpacity = 1.0;
        const endOpacity = 0.5;
        
        // Rotation animation values - get current rotation from transform attribute
        const currentTransform = detailLogo.getAttribute('transform') || '';
        const rotateMatch = currentTransform.match(/rotate\(([^,]+)/);
        const startRotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
        const endRotation = 0; // Back to START state (no rotation)
        
        // Animate back to collapsed state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentOpacity = startOpacity + (endOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartState.x + (logoEndX - logoStartState.x) * eased;
            const currentLogoY = logoStartState.y + (logoEndY - logoStartState.y) * eased;
            const currentLogoWidth = logoStartState.width + (endLogoWidth - logoStartState.width) * eased;
            const currentLogoHeight = logoStartState.height + (endLogoHeight - logoStartState.height) * eased;
            const currentRotation = startRotation + (endRotation - startRotation) * eased;
            
            // Apply animated values to circle (if it exists)
            if (detailCircle) {
                detailCircle.setAttribute('cx', currentCircleX);
                detailCircle.setAttribute('cy', currentCircleY);
                detailCircle.setAttribute('r', currentRadius);
                detailCircle.setAttribute('opacity', currentOpacity);
            }
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentOpacity);
            
            // Apply rotation transform with current center as rotation point
            const currentCenterX = currentLogoX + currentLogoWidth / 2;
            const currentCenterY = currentLogoY + currentLogoHeight / 2;
            detailLogo.setAttribute('transform', `rotate(${currentRotation}, ${currentCenterX}, ${currentCenterY})`);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact collapsed state for circle (if it exists)
                if (detailCircle) {
                    detailCircle.setAttribute('cx', circleEndX);
                    detailCircle.setAttribute('cy', circleEndY);
                    detailCircle.setAttribute('r', endRadius);
                    detailCircle.setAttribute('opacity', '0.5'); // START state: 50% opacity
                }
                
                // Ensure exact collapsed state for logo
                detailLogo.setAttribute('x', logoEndX);
                detailLogo.setAttribute('y', logoEndY);
                detailLogo.setAttribute('width', endLogoWidth);
                detailLogo.setAttribute('height', endLogoHeight);
                detailLogo.setAttribute('opacity', '0.5'); // START state: 50% opacity
                detailLogo.setAttribute('transform', 'rotate(0)'); // START state: no rotation
                
                Logger.debug(`🔵 Detail Sector collapse COMPLETE`);
                Logger.debug(`   Circle: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
                Logger.debug(`   Logo: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);

                this.detailSectorAnimating = false;
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector collapse STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${logoStartState.width}x${logoStartState.height} TO: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);
    }
    
    /**
     * Create the Detail Sector circle at upper right corner
     * This circle animates to the focus ring center when a leaf item is selected
     */
    createDetailSectorCircle() {
        // Check if circle should be hidden for this volume
        const displayConfig = this.dataManager.getDisplayConfig();
        const hideCircle = displayConfig?.detail_sector?.hide_circle;
        
        console.log('🔵🔵🔵 createDetailSectorCircle called');
        console.log('🔵🔵🔵 displayConfig:', displayConfig);
        console.log('🔵🔵🔵 detail_sector:', displayConfig?.detail_sector);
        console.log('🔵🔵🔵 hide_circle:', hideCircle);
        
        if (hideCircle) {
            Logger.debug('🔵 Detail Sector circle disabled by config (hide_circle: true)');
            // Remove any existing circle from previous volume
            const existingCircle = document.getElementById('detailSectorCircle');
            console.log('🔵🔵🔵 Existing circle found:', !!existingCircle);
            if (existingCircle) {
                existingCircle.remove();
                Logger.debug('🔵 Removed existing Detail Sector circle');
            }
            return;
        }
        
        console.log('🔵🔵🔵 Proceeding to create circle (hide_circle is false or undefined)');
        
        // Calculate radius as 12% of the shorter viewport dimension
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Calculate logo dimensions (needed for proper positioning)
        const logoScaleFactor = 1.8;
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation since logo is wider than circle
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Create Detail Sector circle
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('id', 'detailSectorCircle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', '#362e6a'); // MMdM blue
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('opacity', '0.5'); // START state: 50% opacity
        
        // Insert at the BEGINNING of mainGroup so all other elements appear on top
        const mainGroup = this.elements.mainGroup;
        if (mainGroup && mainGroup.firstChild) {
            mainGroup.insertBefore(circle, mainGroup.firstChild);
            Logger.debug(`🔵 Detail Sector circle inserted at BEGINNING of mainGroup (below all other elements)`);
        } else if (mainGroup) {
            mainGroup.appendChild(circle);
            Logger.debug(`🔵 Detail Sector circle appended to empty mainGroup`);
        } else {
            Logger.error(`🔵 mainGroup not found - cannot insert Detail Sector circle`);
            return;
        }
        
        // Calculate top buffer for debug logging
        const circleTopEdge = cy - radius;
        const topBuffer = circleTopEdge - (-(viewportHeight / 2));
        
        Logger.debug(`🔵 Detail Sector circle created at (${cx.toFixed(1)}, ${cy.toFixed(1)}) with ${radius.toFixed(1)}px radius`);
        Logger.debug(`   Circle top edge: ${circleTopEdge.toFixed(1)}, Screen top: ${(-(viewportHeight/2)).toFixed(1)}`);
        Logger.debug(`   Circle top buffer from screen edge: ${topBuffer.toFixed(1)}px (margin: ${margin.toFixed(1)}px)`);
        
        // Create Detail Sector logo
        this.createDetailSectorLogo();
    }
    
    /**
     * Create the volume logo positioned over the Detail Sector circle
     * Logo is centered at the same position as the circle
     */
    createDetailSectorLogo() {
        console.log('🖼️🖼️🖼️ createDetailSectorLogo called');
        
        // Calculate the same position as Detail Sector circle
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Scale logo relative to circle radius
        // Logo aspect ratio: 154:134 = ~1.149:1
        const logoAspectRatio = 154 / 134;
        const logoScaleFactor = 1.8; // Logo width = 180% of circle diameter (3.6× radius)
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHeight = logoWidth / logoAspectRatio;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Calculate top-left position to center logo over circle center
        const x = cx - (logoWidth / 2);
        const y = cy - (logoHeight / 2);
        
        // Get configured logo path from catalog configuration
        const displayConfig = this.dataManager.getDisplayConfig();
        const detailSectorConfig = displayConfig && displayConfig.detail_sector;
        const logoBasePath = detailSectorConfig && detailSectorConfig.logo_base_path;
        const defaultImage = detailSectorConfig && detailSectorConfig.default_image;
        
        console.log('🖼️🖼️🖼️ Logo config:', { displayConfig, detailSectorConfig, logoBasePath, defaultImage });
        
        // Check if logo is configured
        if (logoBasePath && defaultImage) {
            // Logo is configured - create image element
            const logoPath = logoBasePath + defaultImage + '.png';
            
            const logo = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'image');
            logo.setAttribute('id', 'detailSectorLogo');
            logo.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoPath);
            logo.setAttribute('x', x);
            logo.setAttribute('y', y);
            logo.setAttribute('width', logoWidth);
            logo.setAttribute('height', logoHeight);
            logo.setAttribute('opacity', '0.5'); // START state: 50% opacity
            logo.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier
            
            // Add to main group
            this.elements.mainGroup.appendChild(logo);
            
            Logger.debug(`🔵 Detail Sector logo created at (${x.toFixed(1)}, ${y.toFixed(1)}) with size ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (${logoScaleFactor * 100}% of circle diameter)`);
            Logger.debug(`🔵 Logo path: ${logoPath}`);
        } else {
            // No logo configured - create text element with "Choose an Image"
            const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
            textElement.setAttribute('id', 'detailSectorLogo');
            textElement.setAttribute('x', cx);
            textElement.setAttribute('y', cy);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('fill', '#666666');
            textElement.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier
            textElement.setAttribute('font-family', 'Montserrat, sans-serif');
            textElement.setAttribute('font-size', '16');
            textElement.setAttribute('font-weight', '500');
            textElement.setAttribute('opacity', '0.5'); // START state: 50% opacity
            textElement.textContent = 'Choose an Image';
            
            // Add to main group
            this.elements.mainGroup.appendChild(textElement);
            
            Logger.debug(`🔵 Detail Sector text created at (${cx.toFixed(1)}, ${cy.toFixed(1)}) - no logo configured`);
        }
    }

    
    /**
     * Update the Detail Sector logo after volume loading
     * Replaces the "Choose an Image" text with the actual catalog logo
     */
    updateDetailSectorLogo() {
        const existingLogo = document.getElementById('detailSectorLogo');
        if (existingLogo) {
            // Remove existing logo from previous volume
            existingLogo.remove();
            Logger.debug('🔵 Removed existing Detail Sector logo');
        }
        
        // Create new logo based on current volume configuration
        this.createDetailSectorLogo();
        
        Logger.debug('🔵 Detail Sector logo updated for loaded volume');
    }

    /**
     * Calculate END state position and size for Detail Sector logo
     * Returns logo dimensions and position for expanded state
     * Uses same calculation as test logo for consistency
     */
    getDetailSectorLogoEndState() {
        // Get Focus Ring parameters (same as test logo)
        const arcParams = this.viewport.getArcParameters();
        const focusRingRadius = arcParams.radius;
        
        // Get magnifier angle (same as test logo)
        const magnifierAngle = this.viewport.getCenterAngle();
        
        // Logo dimensions: 100% of Focus Ring radius for width (same as test logo)
        const logoAspectRatio = 154 / 134; // Original aspect ratio
        const logoWidth = focusRingRadius * 1.0;
        const logoHeight = logoWidth / logoAspectRatio;
        
        // Position center of logo along magnifier angle at -35% of Focus Ring radius (same as test logo)
        const logoCenterRadius = focusRingRadius * -0.35;
        const logoCenterX = logoCenterRadius * Math.cos(magnifierAngle);
        const logoCenterY = logoCenterRadius * Math.sin(magnifierAngle);
        
        // Position logo so its center is at the calculated point
        const endX = logoCenterX - (logoWidth / 2);
        const endY = logoCenterY - (logoHeight / 2);
        
        // Debug calculation
        Logger.debug(`🔵 getDetailSectorLogoEndState() calculation (matching test logo):`);
        Logger.debug(`   Focus Ring radius: ${focusRingRadius.toFixed(1)}`);
        Logger.debug(`   Logo center at (${logoCenterX.toFixed(1)}, ${logoCenterY.toFixed(1)}) (-35% of radius)`);
        Logger.debug(`   Logo size: ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (100% of radius)`);
        Logger.debug(`   Logo position: (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
        
        return {
            x: endX,
            y: endY,
            width: logoWidth,
            height: logoHeight,
            centerX: logoCenterX,
            centerY: logoCenterY
        };
    }
    
    /**
     * DIAGNOSTIC: Visualize the Detail Sector bounding area
     * Shows the usable content region bounded by:
     * - Inner arc of Focus Ring
     * - Top edge of viewport
     * - Right edge of viewport
     * 
     * Call this method to see the actual available space for Detail Sector content
     */
    showDetailSectorBounds() {
        console.log('📐📐📐 showDetailSectorBounds() called');
        
        const SVG_NS = MOBILE_CONFIG.SVG_NS;
        const mainGroup = this.elements.mainGroup;
        
        console.log('📐📐📐 mainGroup:', mainGroup);
        
        if (!mainGroup) {
            console.error('📐📐📐 Cannot show Detail Sector bounds - mainGroup not found');
            Logger.error('Cannot show Detail Sector bounds - mainGroup not found');
            return;
        }
        
        // Remove any existing diagnostic elements
        const existing = document.getElementById('detailSectorBoundsDiag');
        console.log('📐📐📐 existing diagnostic:', existing);
        if (existing) existing.remove();
        
        const diagGroup = document.createElementNS(SVG_NS, 'g');
        diagGroup.setAttribute('id', 'detailSectorBoundsDiag');
        
        // Get viewport and arc parameters
        const viewport = this.viewport.getViewportInfo();
        const arcParams = this.viewport.getArcParameters();
        
        console.log('📐📐📐 viewport:', viewport);
        console.log('📐📐📐 arcParams:', arcParams);
        
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
        
        // Calculate the text margin arc inside the Focus Ring band
        // Using 98% to provide margin from the 99% inner edge of the Focus Ring band
        const innerRadius = ringRadius * 0.98;
        
        // Dynamic margins based on shorter side (SSd) - same approach as Detail Sector circle
        const SSd = viewport.SSd;
        const marginPercent = 0.03; // 3% of shorter side
        const topMargin = SSd * marginPercent;
        const rightMargin = SSd * marginPercent;
        
        console.log('📐📐📐 Calculating intersections...');
        console.log('📐📐📐 Ring center:', ringCenterX, ringCenterY, 'innerRadius:', innerRadius);
        console.log('📐📐📐 Viewport bounds: top=', topY, 'bottom=', bottomY, 'left=', leftX, 'right=', rightX);
        console.log('📐📐📐 Margins: top=', topMargin, 'right=', rightMargin, '(3% of SSd:', SSd, ')');
        
        // Apply margins to viewport bounds
        const effectiveTopY = topY + topMargin;
        const effectiveRightX = rightX - rightMargin;
        
        // Find ALL intersection points of the inner Focus Ring arc with EFFECTIVE viewport edges
        const intersections = [];
        
        // Check EFFECTIVE TOP edge (y = effectiveTopY)
        const dyTop = effectiveTopY - ringCenterY;
        const discTop = innerRadius * innerRadius - dyTop * dyTop;
        if (discTop >= 0) {
            const sqrtTop = Math.sqrt(discTop);
            const x1 = ringCenterX - sqrtTop;
            const x2 = ringCenterX + sqrtTop;
            if (x1 >= leftX && x1 <= effectiveRightX) intersections.push({x: x1, y: effectiveTopY, edge: 'top'});
            if (x2 >= leftX && x2 <= effectiveRightX && x2 !== x1) intersections.push({x: x2, y: effectiveTopY, edge: 'top'});
        }
        
        // Check BOTTOM edge (y = bottomY) - no margin on bottom
        const dyBottom = bottomY - ringCenterY;
        const discBottom = innerRadius * innerRadius - dyBottom * dyBottom;
        if (discBottom >= 0) {
            const sqrtBottom = Math.sqrt(discBottom);
            const x1 = ringCenterX - sqrtBottom;
            const x2 = ringCenterX + sqrtBottom;
            if (x1 >= leftX && x1 <= effectiveRightX) intersections.push({x: x1, y: bottomY, edge: 'bottom'});
            if (x2 >= leftX && x2 <= effectiveRightX && x2 !== x1) intersections.push({x: x2, y: bottomY, edge: 'bottom'});
        }
        
        // Check LEFT edge (x = leftX) - no margin on left
        const dxLeft = leftX - ringCenterX;
        const discLeft = innerRadius * innerRadius - dxLeft * dxLeft;
        if (discLeft >= 0) {
            const sqrtLeft = Math.sqrt(discLeft);
            const y1 = ringCenterY - sqrtLeft;
            const y2 = ringCenterY + sqrtLeft;
            if (y1 >= effectiveTopY && y1 <= bottomY) intersections.push({x: leftX, y: y1, edge: 'left'});
            if (y2 >= effectiveTopY && y2 <= bottomY && y2 !== y1) intersections.push({x: leftX, y: y2, edge: 'left'});
        }
        
        // Check EFFECTIVE RIGHT edge (x = effectiveRightX)
        const dxRight = effectiveRightX - ringCenterX;
        const discRight = innerRadius * innerRadius - dxRight * dxRight;
        if (discRight >= 0) {
            const sqrtRight = Math.sqrt(discRight);
            const y1 = ringCenterY - sqrtRight;
            const y2 = ringCenterY + sqrtRight;
            if (y1 >= effectiveTopY && y1 <= bottomY) intersections.push({x: effectiveRightX, y: y1, edge: 'right'});
            if (y2 >= effectiveTopY && y2 <= bottomY && y2 !== y1) intersections.push({x: effectiveRightX, y: y2, edge: 'right'});
        }
        
        console.log('📐📐📐 All intersections:', intersections);
        
        // Draw the Focus Ring arc (inner edge with margin) 
        const arcPath = document.createElementNS(SVG_NS, 'circle');
        arcPath.setAttribute('cx', ringCenterX);
        arcPath.setAttribute('cy', ringCenterY);
        arcPath.setAttribute('r', innerRadius);
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', 'lime');
        arcPath.setAttribute('stroke-width', '2');
        arcPath.setAttribute('stroke-dasharray', '8,4');
        diagGroup.appendChild(arcPath);
        
        // Draw EFFECTIVE content boundary (with margins applied)
        const effectiveRect = document.createElementNS(SVG_NS, 'rect');
        effectiveRect.setAttribute('x', leftX);
        effectiveRect.setAttribute('y', effectiveTopY);
        effectiveRect.setAttribute('width', effectiveRightX - leftX);
        effectiveRect.setAttribute('height', bottomY - effectiveTopY);
        effectiveRect.setAttribute('fill', 'none');
        effectiveRect.setAttribute('stroke', 'lime');
        effectiveRect.setAttribute('stroke-width', '2');
        diagGroup.appendChild(effectiveRect);
        
        // Mark ring center with an X
        const centerMarkerSize = 15;
        const centerX1 = document.createElementNS(SVG_NS, 'line');
        centerX1.setAttribute('x1', ringCenterX - centerMarkerSize);
        centerX1.setAttribute('y1', ringCenterY - centerMarkerSize);
        centerX1.setAttribute('x2', ringCenterX + centerMarkerSize);
        centerX1.setAttribute('y2', ringCenterY + centerMarkerSize);
        centerX1.setAttribute('stroke', 'lime');
        centerX1.setAttribute('stroke-width', '2');
        diagGroup.appendChild(centerX1);
        
        const centerX2 = document.createElementNS(SVG_NS, 'line');
        centerX2.setAttribute('x1', ringCenterX - centerMarkerSize);
        centerX2.setAttribute('y1', ringCenterY + centerMarkerSize);
        centerX2.setAttribute('x2', ringCenterX + centerMarkerSize);
        centerX2.setAttribute('y2', ringCenterY - centerMarkerSize);
        centerX2.setAttribute('stroke', 'lime');
        centerX2.setAttribute('stroke-width', '2');
        diagGroup.appendChild(centerX2);
        
        // Mark all intersection points
        intersections.forEach((pt, i) => {
            const marker = document.createElementNS(SVG_NS, 'circle');
            marker.setAttribute('cx', pt.x);
            marker.setAttribute('cy', pt.y);
            marker.setAttribute('r', 6);
            marker.setAttribute('fill', 'lime');
            diagGroup.appendChild(marker);
            
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', pt.x + 10);
            label.setAttribute('y', pt.y + 5);
            label.setAttribute('fill', 'lime');
            label.setAttribute('font-size', '12px');
            label.setAttribute('font-family', 'monospace');
            label.textContent = `${pt.edge}(${pt.x.toFixed(0)},${pt.y.toFixed(0)})`;
            diagGroup.appendChild(label);
        });
        
        // Add label for ring center
        const centerLabel = document.createElementNS(SVG_NS, 'text');
        centerLabel.setAttribute('x', ringCenterX + 20);
        centerLabel.setAttribute('y', ringCenterY + 5);
        centerLabel.setAttribute('fill', 'lime');
        centerLabel.setAttribute('font-size', '12px');
        centerLabel.setAttribute('font-family', 'monospace');
        centerLabel.textContent = `CENTER(${ringCenterX.toFixed(0)},${ringCenterY.toFixed(0)})`;
        diagGroup.appendChild(centerLabel);
        
        mainGroup.appendChild(diagGroup);
        console.log('📐📐📐 Diagnostic group appended to mainGroup');
        
        Logger.info('📐 Detail Sector bounds diagnostic displayed (lime green outline)');
        
        return {
            viewport: {topY, bottomY, leftX, rightX},
            ring: {centerX: ringCenterX, centerY: ringCenterY, innerRadius},
            intersections
        };
    }
    
    /**
     * Hide the Detail Sector bounds diagnostic
     */
    hideDetailSectorBounds() {
        const existing = document.getElementById('detailSectorBoundsDiag');
        if (existing) {
            existing.remove();
            Logger.info('📐 Detail Sector bounds diagnostic hidden');
        }
    }
}

export { MobileRenderer };
