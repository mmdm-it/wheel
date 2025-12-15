/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
 * 
 * This is part of the modular mobile volume system.
 * Edit this file directly - no bundling required.
 */

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
import { MagnifierManager } from './magnifier-manager.js';
import { ThemeManager } from './theme-manager.js';
import { DataQueryHelper } from './data-query-helper.js';
import { ParentNameBuilder } from './parent-name-builder.js';
import { NavigationCoordinator } from './navigation-coordinator.js';
import { ChildContentCoordinator } from './child-content-coordinator.js';
import { ItemUtils } from './item-utils.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager, navigationState) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.navigationState = navigationState;
        this.theme = new ThemeManager(dataManager);
        this.controller = null; // injected controller (e.g., MobileCatalogApp)

        // Modules
        this.animation = new MobileAnimation(viewportManager, dataManager, this);
        this.childPyramid = new MobileChildPyramid(viewportManager, dataManager, this);
        this.detailSector = new MobileDetailSector(viewportManager, dataManager, this);
        this.translationToggle = new TranslationToggle(viewportManager);
        this.navigationView = new NavigationView(viewportManager);
        this.focusRingView = new FocusRingView(this);
        this.magnifier = new MagnifierManager(viewportManager, this);
        this.dataQuery = new DataQueryHelper(this);
        this.parentNameBuilder = new ParentNameBuilder(this);
        this.navigationCoordinator = new NavigationCoordinator(this);
        this.childContentCoordinator = new ChildContentCoordinator(this);

        // DOM/state caches
        this.elements = {};
        // focusElements Map moved to FocusRingView (single source of truth)
        // positionCache Map moved to FocusRingView (only used there)
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
        // _lastFocusItemsKey moved to FocusRingView (change detection)

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
        this.translationToggle.setCurrent(code);
        if (this.navigationState) {
            this.navigationState.setTranslation(code);
        }
    }

    focusRingDebug(...args) {
        if ((typeof window !== 'undefined' && window.DEBUG_FOCUS_RING) || this.focusRingDebugFlag) {
            Logger.debug(...args);
        }
    }

    setController(controller) {
        this.controller = controller;
        // Inject touch handler into magnifier manager
        if (controller && controller.touchHandler) {
            this.magnifier.setTouchHandler(controller.touchHandler);
        }
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

        this.navigationView.updateParentButton({
            parentName,
            currentLevel,
            topNavLevel,
            skipAnimation
        });

        // Re-add parent line (if hidden) after animation begins
        setTimeout(() => {
            this.navigationView.drawParentLine({
                parentName,
                skipAnimation: true
            });
        }, 50);
    }

    positionMagnifyingRing() {
        // Delegate to MagnifierManager
        this.magnifier.position();
    }

    initializeTranslationButton() {
        const displayConfig = this.dataManager.getDisplayConfig();
        const translations = displayConfig?.translations;
        if (!translations || !translations.available || translations.available.length < 2) {
            Logger.debug('🌐 No translations configured or only one language - hiding button');
            return;
        }

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
        // Delegate to MagnifierManager
        return this.magnifier.create();
    }
    
    /**
     * Get current translation code (e.g., 'lat', 'eng')
     */
    getCurrentTranslation() {
        return this.translationToggle.getCurrent() || 'lat';
    }
    
    /**
     * Get the text property name for current translation
     * Now uses language codes directly (e.g., 'latin', 'english', 'hebrew')
     */
    getTranslationTextProperty() {
        // Return current translation language code directly
        // (e.g., 'latin', 'english', 'hebrew', 'greek', 'french', etc.)
        return this.translationToggle.getCurrent() || 'latin';
    }

    /**
     * Get the translated display name for a hierarchy level
     * @param {Object} levelConfig - The hierarchy level configuration
     * @returns {string} The translated display name or default display_name
     */
    getTranslatedDisplayName(levelConfig) {
        if (!levelConfig) return '';
        
        // Try to get the translated version first
        const currentLang = this.translationToggle.getCurrent();
        const translatedKey = `display_name_${currentLang}`;
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
        // Delegate to MagnifierManager
        this.magnifier.bringToCenter(focusItem);
    }

    /**
     * Advance Focus Ring by one node clockwise (increase sort_number by 1)
     * Triggered by clicking the magnifier
     */
    advanceFocusRing() {
        // Delegate to MagnifierManager
        this.magnifier.advance();
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
            const selectedIndex = ItemUtils.findItemIndexByKey(this.currentFocusItems, this.selectedFocusItem.key);
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
    
    /**
     * Show child content for focus item - delegates to ChildContentCoordinator
     */
    showChildContentForFocusItem(focusItem, angle) {
        this.childContentCoordinator.showChildContentForFocusItem(focusItem, angle);
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
            const sortNum = ItemUtils.getSortNumber(item);
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
        return this.dataQuery.getChildItemsForLevel(parentItem, childLevel);
    }

    /**
     * Get cousin items for Focus Ring display - delegates to DataQueryHelper
     */
    getCousinItemsForLevel(item, itemLevel) {
        return this.dataQuery.getCousinItemsForLevel(item, itemLevel);
    }

    /**
     * Async version of getChildItemsForLevel - delegates to DataQueryHelper
     */
    async getChildItemsForLevelAsync(parentItem, childLevel) {
        return await this.dataQuery.getChildItemsForLevelAsync(parentItem, childLevel);
    }

    resolveChildLevel(parentItem, startingLevel) {
        return this.dataQuery.resolveChildLevel(parentItem, startingLevel);
    }

    /**
     * Async version of resolveChildLevel - delegates to DataQueryHelper
     */
    async resolveChildLevelAsync(parentItem, startingLevel) {
        return await this.dataQuery.resolveChildLevelAsync(parentItem, startingLevel);
    }

    getTopLevelItems() {
        return this.dataQuery.getTopLevelItems();
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

    /**
     * Handle leaf focus selection - delegates to ChildContentCoordinator
     */
    handleLeafFocusSelection(focusItem) {
        this.childContentCoordinator.handleLeafFocusSelection(focusItem);
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
        // Delegate to FocusRingView (method moved in Phase 2b)
        this.focusRingView.updateFocusRingPositions(rotationOffset);
    }
    
    /**
     * Manually trigger focus settlement to show Child Pyramid for centered item
     * Called after programmatic rotation animations complete
     */
    triggerFocusSettlement() {
        // Delegate to FocusRingView (method moved in Phase 3)
        this.focusRingView.triggerFocusSettlement();
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
        // Delegate to FocusRingView (method moved in Phase 3)
        this.focusRingView.updateFocusItemText(textElement, angle, item, isSelected);
    }
    
    /**
     * Get the color scheme from display_config
     */
    getColorScheme() {
        return this.theme.getColorScheme();
    }

    getColor(type, name) {
        return this.theme.getColor(type, name);
    }
    
    getColorForType(type) {
        return this.theme.getColorForType(type);
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
        
        // Clear caches (focusElements now in FocusRingView)
        this.focusRingView.focusElements.clear();
        // positionCache is in FocusRingView now
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
     * Handle Child Pyramid item click - delegates to NavigationCoordinator
     */
    handleChildPyramidClick(item, event) {
        this.navigationCoordinator.handleChildPyramidClick(item, event);
    }

    /**
     * OUT MIGRATION: Animate Focus Ring nodes to Child Pyramid positions
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
     * Get the display name for a parent level - delegates to ParentNameBuilder
     */
    getParentNameForLevel(item, parentLevel) {
        return this.parentNameBuilder.getParentNameForLevel(item, parentLevel);
    }

    /**
     * Build a parent item from a child item - delegates to DataQueryHelper
     */
    buildParentItemFromChild(childItem, parentLevel) {
        return this.dataQuery.buildParentItemFromChild(childItem, parentLevel);
    }

    /**
     * Find the index of an item in an array - delegates to DataQueryHelper
     */
    findItemIndexInArray(item, array, level) {
        return this.dataQuery.findItemIndexInArray(item, array, level);
    }

    /**
     * Expand the Detail Sector when a leaf item is selected
     * Animates the blue circle from upper right to focus ring center
     */
    expandDetailSector() {
        this.detailSectorAnimating = true;
        this.detailSector.expand();
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item
     * Animates from focus ring center back to upper right corner
     */
    collapseDetailSector() {
        this.detailSectorAnimating = true;
        this.detailSector.collapse();
    }
    
    /**
     * Create the Detail Sector circle - delegates to DetailSector module
     */
    createDetailSectorCircle() {
        this.detailSector.createCircle();
    }

    /**
     * Create the Detail Sector logo - delegates to DetailSector module
     */
    createDetailSectorLogo() {
        this.detailSector.createLogo();
    }

    /**
     * Update the Detail Sector logo - delegates to DetailSector module
     */
    updateDetailSectorLogo() {
        this.detailSector.updateLogo();
    }

    /**
     * Calculate END state position for Detail Sector logo - delegates to DetailSector module
     */
    getDetailSectorLogoEndState() {
        return this.detailSector.getLogoEndState();
    }
    
    /**
     * DIAGNOSTIC: Show Detail Sector bounds - delegates to DetailSector module
     */
    showDetailSectorBounds() {
        this.detailSector.showBounds();
    }
    
    /**
     * Hide Detail Sector bounds diagnostic - delegates to DetailSector module
     */
    hideDetailSectorBounds() {
        this.detailSector.hideBounds();
    }
}

export { MobileRenderer };
