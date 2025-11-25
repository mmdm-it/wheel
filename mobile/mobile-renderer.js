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
import { MobileChildPyramid } from './mobile-childpyramid.js';
import { MobileDetailSector } from './mobile-detailsector.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        
        // Initialize Child Pyramid module
        this.childPyramid = new MobileChildPyramid(viewportManager, dataManager, this);
        
        // Initialize Detail Sector module
        this.detailSector = new MobileDetailSector(viewportManager, dataManager, this);
        
        // DOM element caches
        this.elements = {};
        this.focusElements = new Map();
        this.positionCache = new Map();
    this.leafStateCache = new Map(); // Cache leaf determinations per item
    this.detailSectorAnimating = false;
    this.isAnimating = false; // Block clicks during node migration animations
        
        // Store animated nodes for OUT migration reuse
        this.lastAnimatedNodes = null;
        
        // State
        this.selectedTopLevel = null;
        this.selectedFocusItem = null;
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;
        
        // Settling state for smooth child item display
        this.isRotating = false;
        this.settleTimeout = null;
        
        // Sprocket chain viewport state
        this.allFocusItems = []; // Complete linear chain of all focus items
        this.chainPosition = 0; // Current position in the linear chain (0-based)
        this.visibleStartIndex = 0; // First visible focus item index
        this.visibleEndIndex = 0; // Last visible focus item index
        this.forceImmediateFocusSettlement = false; // Skip rotation delay for programmatic focus moves

        // Debug controls
        this.focusRingDebugFlag = this.computeFocusRingDebugFlag();
        this.loopInOutDebugFlag = this.computeLoopInOutDebugFlag();
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

    focusRingDebug(...args) {
        if ((typeof window !== 'undefined' && window.DEBUG_FOCUS_RING) || this.focusRingDebugFlag) {
            Logger.debug(...args);
        }
    }
    
    async initialize() {
        await this.initializeElements();
        this.viewport.adjustSVGForMobile(this.elements.svg, this.elements.mainGroup);
        
        // Note: Detail Sector circle will be created after volume loads
        // (when config is available to check hide_circle setting)
        
        return true;
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
    
    handleViewportChange() {
        // Update focus ring positions if they're currently shown
        if (this.currentFocusItems.length > 0) {
            this.updateFocusRingPositions(0);
        }
        
        // Notify child pyramid of viewport changes
        this.childPyramid.handleViewportChange();
        
        // Notify detail sector of viewport changes
        this.detailSector.handleViewportChange();
    }
    
    async initializeElements() {
        const requiredElements = [
            'catalogSvg', 'mainGroup', 'centralGroup', 'topLevel', 
            'pathLinesGroup', 'focusRing', 'detailItems'
        ];
        
        const optionalElements = [
            'childRing'  // Will be created dynamically if needed
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
                // Only add to missing if it's a required element
                if (requiredElements.includes(id)) {
                    missing.push(id);
                } else {
                    Logger.debug(`Optional element ${id} not found - will create if needed`);
                }
            }
        });
        
        // Handle missing childRing by creating it dynamically
        if (!this.elements.childRingGroup) {
            Logger.debug('Creating childRing element dynamically');
            const childRing = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
            childRing.id = 'childRing';
            childRing.classList.add('hidden');
            this.elements.mainGroup.appendChild(childRing);
            this.elements.childRingGroup = childRing;
        }
        
        // Initialize Child Pyramid module with the DOM element
        this.childPyramid.initialize(this.elements.childRingGroup);
        
        // Initialize Detail Sector module with the DOM element
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
                console.log('✨✨✨ MAGNIFIER TAP - advancing Focus Ring');
                this.advanceFocusRing();
            } else {
                console.log('✨ Magnifier touch too long or moved too much:', { distance, duration });
            }
            touchStartPos = null;
            touchStartTime = null;
        });
        
        ring.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Logger.debug('🔍 Magnifier click detected - calling advanceFocusRing');
            this.advanceFocusRing();
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
        const currentRotationOffset = window.mobileCatalogApp?.touchHandler?.rotationOffset || 0;
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
        if (window.mobileCatalogApp) {
            Logger.debug('🔍 Calling animateRotationTo with targetOffset:', targetOffset.toFixed(3));
            window.mobileCatalogApp.animateRotationTo(targetOffset);
        } else {
            Logger.error('🔍 window.mobileCatalogApp not found!');
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
        this.activePath = focusItem.__path || [];
        this.focusRingDebug('Built active path:', this.activePath);
    }
    
    showChildContentForFocusItem(focusItem, angle) {
        if (DEBUG_VERBOSE) console.log('📦📦📦 showChildContentForFocusItem CALLED:', focusItem.name, 'path:', focusItem.__path);
        Logger.debug('Showing child content for focus item:', focusItem.name);

        // Determine the hierarchy level of the focus item
        const currentLevel = this.getItemHierarchyLevel(focusItem);
        console.log('📦 Current level:', currentLevel);
        if (!currentLevel) {
            Logger.warn('Could not determine hierarchy level for focus item:', focusItem);
            return;
        }

        // Get the immediate next hierarchy level (universal navigation requires immediate children)
        const nextLevel = this.getNextHierarchyLevel(currentLevel);
        console.log('📦 Next level:', nextLevel);
        if (!nextLevel) {
            Logger.debug('No next level detected for', focusItem.name, '- treating as leaf');
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, null), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        const { level: resolvedLevel, items: childItems } = this.resolveChildLevel(focusItem, nextLevel);
        const cacheLevel = resolvedLevel || nextLevel;

        console.log(`📦 Resolved level: '${cacheLevel}', child items:`, childItems?.length);
        Logger.debug(`Focus item is at level '${currentLevel}', requested '${nextLevel}', resolved to '${cacheLevel}'`);
        
        if (!childItems || childItems.length === 0) {
            console.log(`📦 NO CHILD ITEMS - treating as leaf`);
            Logger.debug(`No child items found for ${currentLevel}: ${focusItem.name} - treating as leaf`);
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, cacheLevel), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        this.leafStateCache.set(this.getLeafCacheKey(focusItem, cacheLevel), false);

        const itemType = this.getLevelPluralLabel(cacheLevel);
        console.log(`📦 Found ${childItems.length} ${itemType}, calling showChildPyramid`);
        Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);

        // Set the active type to the current focus item's level
        this.activeType = currentLevel;
        this.selectedFocusItem = focusItem;
        
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

        const errorDiv = document.createElement('div');
        errorDiv.className = 'sort-number-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff3333;
            color: white;
            padding: 30px;
            border-radius: 10px;
            font-size: 20px;
            font-weight: bold;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            max-width: 80%;
        `;
        
        // Extract parent context from first item's path
        const firstItem = itemsWithoutSort[0];
        let parentInfo = '';
        if (firstItem.__path && firstItem.__path.length > 0) {
            // Get parent names from path (exclude the item itself)
            const parentNames = firstItem.__path.slice(0, -1).map(segment => {
                // Handle both string segments and object segments
                if (typeof segment === 'string') return segment;
                return segment.name || segment.key || segment;
            });
            if (parentNames.length > 0) {
                parentInfo = `<div style="font-size: 14px; margin-top: 10px; opacity: 0.9;">Parent: ${parentNames.join(' → ')}</div>`;
            }
        }
        const itemList = itemsWithoutSort.map(item => 
            `• ${item.name || item.key} (level: ${item.__level || 'unknown'})`
        ).join('<br>');
        
        errorDiv.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">⚠️ ERROR - Sort Number Missing</div>
            <div style="font-size: 16px; margin-bottom: 10px;">${context}</div>
            ${parentInfo}
            <div style="font-size: 14px; text-align: left; margin-top: 15px;">${itemList}</div>
            <div style="font-size: 12px; margin-top: 20px; opacity: 0.9;">Items cannot be displayed without sort_number</div>
        `;
        
        document.body.appendChild(errorDiv);
        
        console.log('🚨 ERROR DIV CREATED:', {
            className: errorDiv.className,
            inDOM: document.body.contains(errorDiv),
            allErrorDivs: document.querySelectorAll('.sort-number-error').length,
            timestamp: performance.now().toFixed(2)
        });
        
        Logger.error(`❌ CRITICAL: ${itemsWithoutSort.length} items missing sort_number in ${context}`);
        itemsWithoutSort.forEach(item => {
            Logger.error(`   Missing sort_number: ${item.name || item.key} (${item.__level})`);
        });
        
        return true;
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
        this.selectedFocusItem = { ...focusItem };

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
        const isMMDM = displayConfig && displayConfig.volume_name === 'MMdM Catalog';
        
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
        const focusRingGroup = this.elements.focusRingGroup;
        focusRingGroup.classList.remove('hidden');
        focusRingGroup.innerHTML = '';
        
        // Create Focus Ring background band (visual nzone differentiation)
        this.createFocusRingBackground();
        
        // Create magnifier at correct position when focus items are shown
        this.createMagnifier();
        
        // Initialize viewport filtering state
        this.allFocusItems = this.currentFocusItems; // Set the complete list for filtering
        
        Logger.debug(`Viewport filtering initialized: ${this.allFocusItems.length} total focus items`);
        
        // Calculate initial rotation to center nearest focus item (original logic)
        const initialOffset = this.calculateInitialRotationOffset();
        Logger.debug(`Using initial rotation offset: ${initialOffset} radians (${initialOffset * 180 / Math.PI}°)`);
        
        this.updateFocusRingPositions(initialOffset);
        
        // Store the initial offset for the touch handler
        this.initialRotationOffset = initialOffset;
    }
    
    /**
     * Create white background band for Focus Ring nzone
     * Creates a curved band from 95% to 105% of Focus Ring radius
     */
    createFocusRingBackground() {
        console.log('🎨 === CREATING FOCUS RING CENTERLINE ===');
        
        const arcParams = this.viewport.getArcParameters();
        console.log('🎨 arcParams:', arcParams);
        
        // Draw white band between 98% and 102% of Focus Ring radius
        const hubX = arcParams.centerX;
        const hubY = arcParams.centerY;
        const innerRadius = arcParams.radius * 0.98;  // 98% of Focus Ring radius
        const outerRadius = arcParams.radius * 1.02;  // 102% of Focus Ring radius
        
        console.log(`🎨 Hub: (${hubX}, ${hubY})`);
        console.log(`🎨 Inner radius (98%): ${innerRadius}`);
        console.log(`🎨 Outer radius (102%): ${outerRadius}`);
        
        // Insert at beginning so nodes appear on top
        const focusRingGroup = this.elements.focusRingGroup;
        
        // Create annular ring (donut) filled with white
        const pathData = [
            // Outer circle (clockwise)
            `M ${hubX + outerRadius} ${hubY}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${hubX - outerRadius} ${hubY}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${hubX + outerRadius} ${hubY}`,
            // Inner circle (counter-clockwise to create hole)
            `M ${hubX + innerRadius} ${hubY}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${hubX - innerRadius} ${hubY}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${hubX + innerRadius} ${hubY}`,
            `Z`
        ].join(' ');
        
        const path = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', '#7a7979ff');  // Slightly darker gray than background
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('id', 'focusRingBackground');
        
        console.log('🎨 White band created');
        
        if (focusRingGroup.firstChild) {
            focusRingGroup.insertBefore(path, focusRingGroup.firstChild);
            console.log('🎨 Inserted before first child');
        } else {
            focusRingGroup.appendChild(path);
            console.log('🎨 Appended to empty group');
        }
        
        console.log('🎨 focusRingGroup children after:', focusRingGroup.children.length);
        console.log('🎨 === WHITE BAND COMPLETE ===');
        
        Logger.debug('Focus Ring darker gray background band created (98% to 102%)');
    }
    
    calculateInitialRotationOffset() {
        if (!this.currentFocusItems.length) return 0;
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (this.currentFocusItems.length - 1) / 2;
        
        // Get startup configuration from volume - use correct property path
        const rootData = this.dataManager.data?.[this.dataManager.rootDataKey];
        const startupConfig = rootData?.display_config?.focus_ring_startup;
        
        Logger.info(`🎯 calculateInitialRotationOffset: ${this.currentFocusItems.length} focus items, middleIndex=${middleIndex}`);
        Logger.info(`🎯 Config: ${JSON.stringify(startupConfig)}`);
        
        // Debug: Log first 10 items with their sort_numbers
        Logger.info(`🎯 First 10 focus items:`);
        this.currentFocusItems.slice(0, 10).forEach((item, idx) => {
            const sortNum = item.data?.sort_number ?? item.sort_number;
            Logger.info(`   [${idx}] ${item.name} (sort_number: ${sortNum})`);
        });
        
        if (startupConfig && startupConfig.initial_magnified_item !== undefined) {
            // Find item with specified sort_number
            const targetSortNumber = startupConfig.initial_magnified_item;
            const targetIndex = this.currentFocusItems.findIndex(item => {
                const itemSortNumber = item.data?.sort_number ?? item.sort_number;
                return itemSortNumber === targetSortNumber;
            });
            
            Logger.info(`🎯 Looking for sort_number ${targetSortNumber}, found at index: ${targetIndex}`);
            
            if (targetIndex === -1) {
                const availableSortNumbers = this.currentFocusItems
                    .map(item => item.data?.sort_number ?? item.sort_number)
                    .filter(n => n !== undefined)
                    .sort((a, b) => a - b)
                    .join(', ');
                Logger.error(`❌ STARTUP ERROR: initial_magnified_item ${targetSortNumber} not found`);
                Logger.error(`   Available sort_numbers: ${availableSortNumbers}`);
                // Fallback to first item
                const offset = (0 - middleIndex) * angleStep;
                Logger.warn(`   Falling back to first item (index 0), offset = ${offset * 180 / Math.PI}°`);
                return offset;
            }
            
            // Calculate offset to center the target item under magnifier
            const offset = (targetIndex - middleIndex) * angleStep;
            Logger.info(`🎯 Startup: Magnifying item at sort_number ${targetSortNumber} (index ${targetIndex}), offset = ${offset * 180 / Math.PI}°`);
            Logger.info(`🎯 Item name: ${this.currentFocusItems[targetIndex].name}`);
            return offset;
        }
        
        // Fallback: no configuration specified
        Logger.warn(`⚠️ No focus_ring_startup configuration found - using first item`);
        const offset = (0 - middleIndex) * angleStep;
        return offset;
    }
    
    updateFocusRingPositions(rotationOffset) {
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
            
            // Remove any sort number error messages
            const errorDivs = document.querySelectorAll('.sort-number-error');
            
            errorDivs.forEach(div => {
                console.log('🗑️ Removing error div:', div.textContent.substring(0, 50));
                div.remove();
            });
        }
        this.lastRotationOffset = rotationOffset;
        
        // Clear existing elements but preserve the background band
        const background = focusRingGroup.querySelector('#focusRingBackground');
        focusRingGroup.innerHTML = '';
        if (background) focusRingGroup.appendChild(background);
        this.focusElements.clear();
        
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

        // Process all focus items but only render those in viewport window
        allFocusItems.forEach((focusItem, index) => {
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
            
            if (angleDiff <= maxViewportAngle) {
                // This focus item is in the viewport - render it
                const position = this.calculateFocusPosition(angle, arcParams);
                
                // Check if selected (centered) - should match snapping range
                const isSelected = angleDiff < (angleStep * 0.5); // ~2.15° - matches snapping threshold
                if (isSelected) {
                    selectedFocusItem = focusItem;
                    selectedIndex = index;
                    console.log(`🎯🎯🎯 ITEM SELECTED AT CENTER: [${index}] ${focusItem.name}, angleDiff=${angleDiff.toFixed(3)}°, rotationOffset=${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
                    this.focusRingDebug('🎯 SELECTED during rotation:', focusItem.name, 'angleDiff:', angleDiff.toFixed(3), 'threshold:', (angleStep * 0.5).toFixed(3));
                }
                
                // Create focus element
                const element = this.createFocusElement(focusItem, position, angle, isSelected);
                this.focusElements.set(focusItem.key, element);
                focusRingGroup.appendChild(element);
            }
        });
        
        // Position magnifying ring at the calculated center angle
        this.positionMagnifyingRing();
        
        // Update active path with selected focus item  
        if (selectedIndex >= 0 && selectedFocusItem) {
            // Build appropriate active path based on item type
            this.buildActivePath(selectedFocusItem);
            
            this.selectedFocusItem = selectedFocusItem;
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
            this.selectedFocusItem = null;
            this.hideParentButton();
        }
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
        // Validate inputs
        if (isNaN(angle) || !arcParams || isNaN(arcParams.centerX) || isNaN(arcParams.centerY) || isNaN(arcParams.radius)) {
            Logger.error(`Invalid position calculation inputs: angle=${angle}, arcParams=${JSON.stringify(arcParams)}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }
        
        const key = `${angle}_${arcParams.centerX}_${arcParams.centerY}_${arcParams.radius}`;
        
        if (this.positionCache.has(key)) {
            return this.positionCache.get(key);
        }
        
        // Arc-based positioning with off-screen center
        const x = arcParams.centerX + arcParams.radius * Math.cos(angle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(angle);
        
        // Validate calculated position
        if (isNaN(x) || isNaN(y)) {
            Logger.error(`Calculated NaN position: angle=${angle}, centerX=${arcParams.centerX}, centerY=${arcParams.centerY}, radius=${arcParams.radius}, x=${x}, y=${y}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }
        
        const position = { x, y, angle };
        this.positionCache.set(key, position);
        
        return position;
    }
    
    // Phase 2 Consolidation: Bilingual coordinate positioning method
    // Uses bilingual coordinate system while preserving exact positioning behavior
    calculateFocusPositionBilingual(angle, arcParams) {
        // Validate inputs - same as original method
        if (isNaN(angle) || !arcParams || isNaN(arcParams.centerX) || isNaN(arcParams.centerY) || isNaN(arcParams.radius)) {
            Logger.error(`Invalid bilingual position calculation inputs: angle=${angle}, arcParams=${JSON.stringify(arcParams)}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }
        
        // Setup coordinate system with current viewport
        const viewport = this.viewport.getViewportInfo();
        CoordinateSystem.setViewport({
            LSd: Math.max(viewport.width, viewport.height),
            SSd: Math.min(viewport.width, viewport.height)
        });
        
        // Create Hub coordinate using polar representation
        const hubCoord = HubNucCoordinate.fromPolar(angle, arcParams.radius);
        
        // Get Nuc coordinates (calculated lazily using constitutional formula)
        const x = hubCoord.nucX;
        const y = hubCoord.nucY;
        
        // Validate calculated position - same as original method
        if (isNaN(x) || isNaN(y)) {
            Logger.error(`Bilingual calculated NaN position: angle=${angle}, radius=${arcParams.radius}, x=${x}, y=${y}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }
        
        Logger.debug(`Bilingual focus position: Hub(${angle * 180 / Math.PI}°, r=${arcParams.radius}) -> Nuc(${x.toFixed(1)}, ${y.toFixed(1)})`);
        
        return { 
            x, 
            y, 
            angle,
            // Include coordinate representation for debugging
            hubCoord 
        };
    }
    
    createFocusElement(focusItem, position, angle, isSelected = false) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('focusItem');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('class', 'node');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColor('focusItem', focusItem.name));
        
        if (isSelected) {
            g.classList.add('selected');
        }
        
        // No strokes on focus nodes - clean styling
        
        g.appendChild(circle);
        
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateFocusItemText(text, angle, focusItem, isSelected);
        g.appendChild(text);
        
        return g;
    }
    
    updateFocusElement(element, position, angle, isSelected = false) {
        // Validate position to prevent NaN errors
        if (!position || isNaN(position.x) || isNaN(position.y)) {
            Logger.error(`Invalid focus element position: ${JSON.stringify(position)}, angle: ${angle}`);
            return;
        }
        
        element.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = element.querySelector('circle');
        const text = element.querySelector('text');
        
        // Simple binary selection: selected node is magnified, all others are normal
        const nodeRadius = isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED;
        circle.setAttribute('r', nodeRadius);
        
        // Clean styling - no strokes
        circle.removeAttribute('stroke');
        circle.removeAttribute('stroke-width');
        
        // Apply selected class based on selection state
        if (isSelected) {
            element.classList.add('selected');
            const textElement = element.querySelector('text');
            Logger.debug(`Applied selected class to focus item: ${textElement && textElement.textContent}`);
        } else {
            element.classList.remove('selected');
        }
        
        if (text) {
            this.updateFocusItemText(text, angle, { name: text.textContent, __level: 'focusItem' }, isSelected);
        }
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
            // Standard radial positioning for other items
            const radius = MOBILE_CONFIG.RADIUS.UNSELECTED;
            let offset = -(radius + 5);
            
            // For selected items, shift text further outward
            if (isSelected) {
                offset = -(radius + 50);
            }
            
            textX = offset * Math.cos(angle);
            textY = offset * Math.sin(angle);
            
            // For selected items, use 'end' anchor so text block ends near the node
            if (isSelected) {
                textAnchor = 'end';
            } else {
                textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
            }
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
        let displayText = item.name;
        if (textTransform === 'number_only_or_cil') {
            // Extract numeric part and optionally append CIL when selected
            const match = item.name.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                displayText = isSelected ? `${number} CIL` : number;
            }
        }
        
        textElement.textContent = displayText;
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
        this.selectedFocusItem = null;
        this.hideParentButton();
        this.currentFocusItems = [];
        this.activePath = [];
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
        this.elements.pathLinesGroup.innerHTML = '';
    }
    
    /**
     * Update Parent Button text and position
     */
    updateParentButton(parentName, skipAnimation = false) {
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        const parentText = document.getElementById('parentText');
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        
        if (parentName) {
            // Check if we're at top navigation level
            const rootData = this.dataManager.data?.[this.dataManager.rootDataKey];
            const startupConfig = rootData?.display_config?.focus_ring_startup;
            const topNavLevel = startupConfig?.top_navigation_level;
            const currentLevel = this.activeType;
            const isAtTopLevel = topNavLevel && currentLevel === topNavLevel;
            
            // During initial load, currentLevel may be null - treat as top level
            const shouldHideCircle = isAtTopLevel || currentLevel === null;
            
            // Get viewport dimensions and Hub center for fixed positioning
            const viewport = this.viewport.getViewportInfo();
            const SSd = Math.min(viewport.width, viewport.height);
            const LSd = Math.max(viewport.width, viewport.height);
            const arcParams = this.viewport.getArcParameters();
            
            // Fixed Parent Button circle position in Hub polar coordinates:
            // Circle: Radius 0.9 × LSd × sqrt(2) from Hub center at 135°
            // Text: Starts at radius 0.95 × LSd × sqrt(2) from Hub center at 135°
            const parentButtonAngle = 135 * Math.PI / 180;  // Convert to radians
            const parentButtonCircleRadius = 0.9 * LSd * Math.SQRT2;
            const parentButtonTextRadius = 0.95 * LSd * Math.SQRT2;
            
            // Convert circle position from Hub polar to SVG Cartesian (Nuc coordinates)
            const parentButtonNuc = {
                x: arcParams.centerX + parentButtonCircleRadius * Math.cos(parentButtonAngle),
                y: arcParams.centerY + parentButtonCircleRadius * Math.sin(parentButtonAngle)
            };
            
            // Calculate text start position in Hub coordinates
            const textStartNuc = {
                x: arcParams.centerX + parentButtonTextRadius * Math.cos(parentButtonAngle),
                y: arcParams.centerY + parentButtonTextRadius * Math.sin(parentButtonAngle)
            };
            
            // Text offset relative to circle center
            // Important: Both text and circle are on the same 135° radius line from Hub,
            // so the offset should maintain the same angle (textOffsetY should equal textOffsetX for 135°)
            const textOffsetX = textStartNuc.x - parentButtonNuc.x;
            const textOffsetY = textStartNuc.y - parentButtonNuc.y;
            
            // Verify: At 135°, sin and cos are equal, so offsets should be equal
            // textOffsetX = textOffsetY = (textRadius - circleRadius) * cos(135°)
            //             = (0.95 - 0.90) * LSd * √2 * cos(135°)
            //             = 0.05 * LSd * √2 * (-√2/2)
            //             = -0.05 * LSd
            
            // Position the group
            parentButtonGroup.setAttribute('transform', `translate(${parentButtonNuc.x}, ${parentButtonNuc.y})`);
            
            // DEBUG: Draw line from Hub center at 135° for LSd * 2
            const debugLine = document.getElementById('debugLine135');
            if (debugLine) {
                debugLine.remove();
            }
            const line = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
            line.setAttribute('id', 'debugLine135');
            line.setAttribute('x1', arcParams.centerX);
            line.setAttribute('y1', arcParams.centerY);
            const lineLength = LSd * 2;
            const lineEndX = arcParams.centerX + lineLength * Math.cos(parentButtonAngle);
            const lineEndY = arcParams.centerY + lineLength * Math.sin(parentButtonAngle);
            line.setAttribute('x2', lineEndX);
            line.setAttribute('y2', lineEndY);
            line.setAttribute('stroke', 'lime');
            line.setAttribute('stroke-width', '1');
            this.elements.mainGroup.appendChild(line);
            
            // DEBUG: Draw X at viewport center (Nuc origin = 0,0 in mainGroup coordinates)
            const xSize = 10;
            
            const debugX1 = document.getElementById('debugX1');
            if (debugX1) debugX1.remove();
            const debugX2 = document.getElementById('debugX2');
            if (debugX2) debugX2.remove();
            
            const x1 = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
            x1.setAttribute('id', 'debugX1');
            x1.setAttribute('x1', -xSize);
            x1.setAttribute('y1', -xSize);
            x1.setAttribute('x2', xSize);
            x1.setAttribute('y2', xSize);
            x1.setAttribute('stroke', 'lime');
            x1.setAttribute('stroke-width', '2');
            this.elements.mainGroup.appendChild(x1);
            
            const x2 = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
            x2.setAttribute('id', 'debugX2');
            x2.setAttribute('x1', -xSize);
            x2.setAttribute('y1', xSize);
            x2.setAttribute('x2', xSize);
            x2.setAttribute('y2', -xSize);
            x2.setAttribute('stroke', 'lime');
            x2.setAttribute('stroke-width', '2');
            this.elements.mainGroup.appendChild(x2);
            
            // Update text directly without animation
            parentText.textContent = parentName;
            
            // Position text at calculated offset from circle
            parentText.setAttribute('x', textOffsetX.toFixed(2));
            parentText.setAttribute('y', textOffsetY.toFixed(2));
            
            // Rotate text to align with Parent Button angle (135°)
            // Using same rotation logic as Focus Ring items
            let parentTextRotation = 135;
            if (Math.cos(135 * Math.PI / 180) < 0) {
                parentTextRotation += 180; // Results in 315°
            }
            // Rotate around the text's actual position, not a fixed point
            parentText.setAttribute('transform', `rotate(${parentTextRotation}, ${textOffsetX.toFixed(2)}, ${textOffsetY.toFixed(2)})`);
            
            // Position circle at fixed origin (0,0) relative to group transform
            // Circle radius from config
            parentNodeCircle.setAttribute('cx', '0');
            parentNodeCircle.setAttribute('cy', '0');
            parentNodeCircle.setAttribute('r', MOBILE_CONFIG.RADIUS.PARENT_BUTTON);
            
            // Show button group
            parentButtonGroup.classList.remove('hidden');
            // Force display to be visible (override any lingering CSS)
            parentButtonGroup.style.display = '';
            
            // Enable or disable based on level
            if (isAtTopLevel) {
                parentButtonGroup.classList.add('disabled');
                parentButtonGroup.setAttribute('data-disabled', 'true');
            } else {
                parentButtonGroup.classList.remove('disabled');
                parentButtonGroup.removeAttribute('data-disabled');
            }
            
            // Show/hide circle
            if (shouldHideCircle) {
                parentNodeCircle.classList.add('hidden');
                parentNodeCircle.style.display = 'none';
                this.clearParentLine();
            } else {
                parentNodeCircle.classList.remove('hidden');
                parentNodeCircle.style.display = '';
                // Draw line from circle to magnifier
                setTimeout(() => this.drawParentLine(parentButtonNuc), 20);
            }
        } else {
            // Hide button if no parent
            parentButtonGroup.classList.add('hidden');
            parentButtonGroup.style.display = 'none';
            parentButtonGroup.removeAttribute('data-disabled');
            
            if (parentNodeCircle) {
                parentNodeCircle.classList.add('hidden');
                parentNodeCircle.style.display = 'none';
            }
            this.clearParentLine();
        }
    }
    
    hideParentButton() {
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        if (!parentButtonGroup) return;
        
        parentButtonGroup.classList.add('hidden');
        parentButtonGroup.style.display = 'none';
        
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        if (parentNodeCircle) {
            parentNodeCircle.classList.add('hidden');
            parentNodeCircle.style.display = 'none';
        }
        
        // Hide parent line
        this.clearParentLine();
    }
    
    /**
     * Draw line from Parent Button circle to magnifier (similar to fan lines)
     */
    drawParentLine(parentButtonNuc) {
        console.log('🔵🔵 drawParentLine START:', {
            parentButtonNuc,
            timestamp: performance.now().toFixed(2)
        });
        
        // Clear any existing line
        this.clearParentLine();
        
        // Get magnifier position (already in SVG coordinates, same as mainGroup)
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        if (!magnifierPos) {
            console.warn('⚠️ drawParentLine: No magnifier position available');
            return;
        }
        
        // Magnifier is already positioned in the same SVG coordinate space as mainGroup
        // Parent Button is positioned with transform in Nuc coordinates
        // Both are in the same SVG space, so we can draw directly
        
        console.log('🔵 Magnifier position (SVG):', {
            x: magnifierPos.x.toFixed(2),
            y: magnifierPos.y.toFixed(2),
            angle: ((magnifierPos.angle * 180 / Math.PI) % 360).toFixed(1) + '°'
        });
        
        console.log('🔵 Parent Button position (Nuc/transform):', {
            x: parentButtonNuc.x.toFixed(2),
            y: parentButtonNuc.y.toFixed(2)
        });
        
        // Line connects the two circles: Parent Button circle and Magnifier circle
        // Parent Button circle is at the group origin (0,0) in group coordinates
        // So in SVG space, it's at parentButtonNuc (x, y)
        const lineEndX = parentButtonNuc.x;
        const lineEndY = parentButtonNuc.y;
        
        console.log('🔵 Circle-to-circle connection:', {
            parentCircleX: lineEndX.toFixed(2),
            parentCircleY: lineEndY.toFixed(2),
            magnifierX: magnifierPos.x.toFixed(2),
            magnifierY: magnifierPos.y.toFixed(2)
        });
        
        // Calculate distance
        const dx = magnifierPos.x - lineEndX;
        const dy = magnifierPos.y - lineEndY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        console.log('🔵 Line geometry:', {
            dx: dx.toFixed(2),
            dy: dy.toFixed(2),
            distance: distance.toFixed(2)
        });
        
        // Create line element
        const pathLinesGroup = this.elements.pathLinesGroup;
        if (!pathLinesGroup) {
            console.warn('⚠️ drawParentLine: pathLinesGroup not found');
            return;
        }
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'parent-line');
        line.setAttribute('x1', lineEndX);
        line.setAttribute('y1', lineEndY);
        line.setAttribute('x2', magnifierPos.x);
        line.setAttribute('y2', magnifierPos.y);
        line.setAttribute('stroke', 'black');
        line.setAttribute('stroke-width', '1');
        
        pathLinesGroup.appendChild(line);
        
        console.log('🔵🔵 drawParentLine COMPLETE:', {
            lineCreated: true,
            lineInDOM: !!document.querySelector('.parent-line'),
            parentLinesGroupChildren: pathLinesGroup.children.length,
            timestamp: performance.now().toFixed(2)
        });
    }
    
    /**
     * Clear the parent line
     */
    clearParentLine() {
        const pathLinesGroup = this.elements.pathLinesGroup;
        if (!pathLinesGroup) return;
        
        const existingLine = pathLinesGroup.querySelector('.parent-line');
        if (existingLine) {
            existingLine.remove();
        }
    }
    
    /**
     * Animate a Child Pyramid node to the Magnifier position
     * @param {SVGElement} nodeGroup - The SVG group element containing the node
     * @param {Object} startPos - Starting position {x, y}
     * @param {Object} endPos - Ending position {x, y, angle}
     * @param {Function} onComplete - Callback when animation completes
     */
    animateNodeToMagnifier(nodeGroup, startPos, endPos, onComplete) {
        Logger.debug('🎬 Starting node animation to Magnifier', startPos, endPos);
        
        // Clone the node group for animation
        const animatedNode = nodeGroup.cloneNode(true);
        animatedNode.classList.add('animating-node');
        
        // Calculate starting rotation from original node
        const originalCircle = nodeGroup.querySelector('.node');
        const startX = parseFloat(originalCircle.getAttribute('cx'));
        const startY = parseFloat(originalCircle.getAttribute('cy'));
        
        // Calculate angle from center for starting rotation
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const dx = startX - magnifierPos.x;
        const dy = startY - magnifierPos.y;
        const startAngle = Math.atan2(dy, dx);
        let startRotation = startAngle * 180 / Math.PI;
        if (Math.cos(startAngle) < 0) {
            startRotation += 180;
        }
        
        // Calculate end rotation (same logic as focus ring items)
        let endRotation = endPos.angle * 180 / Math.PI;
        if (Math.cos(endPos.angle) < 0) {
            endRotation += 180;
        }
        
        // Append animated node to main group (above everything)
        const mainGroup = document.getElementById('mainGroup');
        mainGroup.appendChild(animatedNode);
        
        // Calculate translation needed
        const translateX = endPos.x - startX;
        const translateY = endPos.y - startY;
        const rotationDelta = endRotation - startRotation;
        
        Logger.debug(`🎬 Animation params: translate(${translateX.toFixed(1)}, ${translateY.toFixed(1)}) rotate ${rotationDelta.toFixed(1)}°`);
        
        // Apply starting state
        animatedNode.style.transformOrigin = `${startX}px ${startY}px`;
        animatedNode.style.transform = 'translate(0, 0) rotate(0deg)';
        animatedNode.style.transition = 'none';
        
        // Force reflow
        animatedNode.getBoundingClientRect();
        
        // Apply animation
        setTimeout(() => {
            animatedNode.style.transition = 'transform 600ms ease-in-out';
            animatedNode.style.transform = `translate(${translateX}px, ${translateY}px) rotate(${rotationDelta}deg)`;
            
            // Clean up when animation completes
            setTimeout(() => {
                animatedNode.remove();
                Logger.debug('🎬 Animation complete, node removed');
                if (onComplete) onComplete();
            }, 600);
        }, 10);
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
        if (window.mobileCatalogApp && window.mobileCatalogApp.touchHandler) {
            window.mobileCatalogApp.touchHandler.tempDisabled = true;
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
        this.animateMagnifierToParentButton(item);
        
        // Start animation for all nodes, then continue with state updates
        this.animateSiblingsToFocusRing(item, nodePositions, () => {
            // Animation complete - now show the real focus ring
            this.isAnimating = false;
            this.continueChildPyramidClick(item);
        });
    }
    
    /**
     * Animate the current Magnifier node to Parent Button and Parent Button off-screen
     * @param {Object} clickedItem - The item that was clicked (will become new magnifier)
     */
    animateMagnifierToParentButton(clickedItem) {
        // Get current magnified item (parent of clicked item)
        const currentMagnifiedItem = this.selectedFocusItem;
        if (!currentMagnifiedItem) {
            Logger.debug('🎬 No current magnified item to animate');
            return;
        }
        
        // Get the actual Magnifier ring element and hide it during animation
        const magnifierRing = document.getElementById('magnifier');
        if (magnifierRing) {
            magnifierRing.style.display = 'none';
        }
        
        // Get Magnifier position (start)
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const startX = magnifierPos.x;
        const startY = magnifierPos.y;
        const startAngle = magnifierPos.angle;
        
        console.log('🎬 Magnifier animation START:', {
            startX: startX.toFixed(2),
            startY: startY.toFixed(2),
            startAngle: (startAngle * 180 / Math.PI).toFixed(1) + '°'
        });
        
        // Get Parent Button position (end)
        const viewport = this.viewport.getViewportInfo();
        const LSd = Math.max(viewport.width, viewport.height);
        const arcParams = this.viewport.getArcParameters();
        const parentButtonAngle = 135 * Math.PI / 180;
        const parentButtonCircleRadius = 0.9 * LSd * Math.SQRT2;
        
        const endX = arcParams.centerX + parentButtonCircleRadius * Math.cos(parentButtonAngle);
        const endY = arcParams.centerY + parentButtonCircleRadius * Math.sin(parentButtonAngle);
        
        console.log('🎬 Magnifier animation END:', {
            endX: endX.toFixed(2),
            endY: endY.toFixed(2),
            distance: Math.sqrt((endX - startX)**2 + (endY - startY)**2).toFixed(2)
        });
        
        // Create animated node for current magnifier using CSS transforms
        const mainGroup = document.getElementById('mainGroup');
        const animatedMagnifier = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        animatedMagnifier.classList.add('animating-magnifier');
        
        // Create circle (filled node) - positioned absolutely
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('cx', startX);
        circle.setAttribute('cy', startY);
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.MAGNIFIED);
        circle.setAttribute('fill', this.getColor(currentMagnifiedItem.__level, currentMagnifiedItem.name));
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        
        // Create Magnifier ring (black stroke circle) - positioned absolutely
        const magnifierRingClone = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        magnifierRingClone.setAttribute('cx', startX);
        magnifierRingClone.setAttribute('cy', startY);
        magnifierRingClone.setAttribute('r', MOBILE_CONFIG.RADIUS.MAGNIFIER);
        magnifierRingClone.setAttribute('fill', 'none');
        magnifierRingClone.setAttribute('stroke', 'black');
        magnifierRingClone.setAttribute('stroke-width', '1');
        magnifierRingClone.setAttribute('opacity', '0.8');
        
        // Create text - positioned absolutely
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        const textOffset = -(MOBILE_CONFIG.RADIUS.MAGNIFIED + 50);
        const textX = startX + textOffset * Math.cos(startAngle);
        const textY = startY + textOffset * Math.sin(startAngle);
        let textRotation = startAngle * 180 / Math.PI;
        if (Math.cos(startAngle) < 0) textRotation += 180;
        
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.setAttribute('dy', '0.3em');
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('transform', `rotate(${textRotation}, ${textX}, ${textY})`);
        text.setAttribute('fill', 'black');
        text.textContent = currentMagnifiedItem.name;
        
        animatedMagnifier.appendChild(circle);
        animatedMagnifier.appendChild(magnifierRingClone);
        animatedMagnifier.appendChild(text);
        mainGroup.appendChild(animatedMagnifier);
        
        console.log('🎬 Animated magnifier group created:', {
            circleCount: animatedMagnifier.querySelectorAll('circle').length,
            circlePositions: Array.from(animatedMagnifier.querySelectorAll('circle')).map(c => 
                `cx=${c.getAttribute('cx')} cy=${c.getAttribute('cy')} r=${c.getAttribute('r')}`
            )
        });
        
        // Calculate animation parameters
        const translateX = endX - startX;
        const translateY = endY - startY;
        
        // Calculate text rotation to match Parent Button angle
        let endTextRotation = parentButtonAngle * 180 / Math.PI;
        if (Math.cos(parentButtonAngle) < 0) endTextRotation += 180;
        let rotationDelta = endTextRotation - textRotation;
        while (rotationDelta > 180) rotationDelta -= 360;
        while (rotationDelta < -180) rotationDelta += 360;
        
        Logger.debug(`🎬 Magnifier → Parent Button: translate(${translateX.toFixed(1)}, ${translateY.toFixed(1)}) rotate ${rotationDelta.toFixed(1)}°`);
        
        // Apply starting state
        animatedMagnifier.style.transformOrigin = `${startX}px ${startY}px`;
        animatedMagnifier.style.transform = 'translate(0, 0)';
        animatedMagnifier.style.transition = 'none';
        
        // Force reflow
        animatedMagnifier.getBoundingClientRect();
        
        // Start animation
        setTimeout(() => {
            console.log('🎬 Starting magnifier animation with CSS transform');
            animatedMagnifier.style.transition = 'transform 600ms ease-in-out, opacity 600ms ease-in-out';
            animatedMagnifier.style.transform = `translate(${translateX}px, ${translateY}px)`;
            animatedMagnifier.style.opacity = '0.5';
            
            // Clean up
            setTimeout(() => {
                console.log('🎬 Magnifier animation complete, removing element');
                animatedMagnifier.remove();
                if (magnifierRing) {
                    magnifierRing.style.display = '';
                }
                Logger.debug('🎬 Magnifier animation complete');
            }, 600);
        }, 10);
        
        // Animate Parent Button off-screen
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        if (parentButtonGroup && !parentButtonGroup.classList.contains('hidden')) {
            Logger.debug('🎬 Animating Parent Button off-screen');
            
            parentButtonGroup.style.transition = 'transform 600ms ease-in-out, opacity 600ms ease-in-out';
            parentButtonGroup.style.opacity = '0';
            
            // Move off-screen (further along 135° angle)
            const offScreenDistance = LSd * 0.5;
            const currentTransform = parentButtonGroup.getAttribute('transform');
            const translateMatch = currentTransform && currentTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
            
            if (translateMatch) {
                const currentX = parseFloat(translateMatch[1]);
                const currentY = parseFloat(translateMatch[2]);
                const newX = currentX + offScreenDistance * Math.cos(parentButtonAngle);
                const newY = currentY + offScreenDistance * Math.sin(parentButtonAngle);
                
                parentButtonGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
            }
            
            // Reset after animation
            setTimeout(() => {
                parentButtonGroup.style.transition = '';
                parentButtonGroup.style.opacity = '';
                parentButtonGroup.classList.add('hidden');
            }, 600);
        }
    }
    
    /**
     * Animate all sibling nodes from Child Pyramid to Focus Ring positions
     * @param {Object} clickedItem - The item that was clicked
     * @param {Array} nodePositions - Array of {node, key, startX, startY} for all Child Pyramid nodes
     * @param {Function} onComplete - Callback when all animations complete
     */
    animateSiblingsToFocusRing(clickedItem, nodePositions, onComplete) {
        Logger.debug('🎬 Starting sibling migration animation');
        
        // Get siblings array to determine Focus Ring positions
        const allSiblings = this.currentChildItems || [];
        if (allSiblings.length === 0) {
            Logger.warn('No siblings found for animation');
            if (onComplete) onComplete();
            return;
        }
        
        // Calculate Focus Ring parameters
        const clickedIndex = this.findItemIndexInArray(clickedItem, allSiblings, clickedItem.__level);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        const centerOffset = (clickedIndex - middleIndex) * angleStep;
        
        const centerAngle = this.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + centerOffset;
        const arcParams = this.viewport.getArcParameters();
        
        Logger.debug(`🎬 Focus Ring params: clickedIndex=${clickedIndex}, centerOffset=${(centerOffset * 180 / Math.PI).toFixed(1)}°`);
        
        const mainGroup = document.getElementById('mainGroup');
        const animatedNodes = [];
        
        // Create animated clones for each sibling
        nodePositions.forEach(nodePos => {
            // Find this node's item in siblings array
            const siblingIndex = allSiblings.findIndex(sib => sib.key === nodePos.key);
            if (siblingIndex === -1) {
                Logger.warn(`Node ${nodePos.key} not found in siblings array`);
                return;
            }
            
            const siblingItem = allSiblings[siblingIndex];
            
            // Calculate Focus Ring position for this sibling
            const angle = adjustedCenterAngle + (middleIndex - siblingIndex) * angleStep;
            const endPos = this.calculateFocusPosition(angle, arcParams);
            endPos.angle = angle;
            
            // Clone the node for animation
            const animatedNode = nodePos.node.cloneNode(true);
            animatedNode.classList.add('animating-node');
            mainGroup.appendChild(animatedNode);
            
            // Get the text element's existing rotation (Child Pyramid text is pre-rotated)
            const textElement = animatedNode.querySelector('text');
            let textStartRotation = 0;
            if (textElement) {
                const transformAttr = textElement.getAttribute('transform');
                const rotateMatch = transformAttr && transformAttr.match(/rotate\(([-\d.]+)/);
                if (rotateMatch) {
                    textStartRotation = parseFloat(rotateMatch[1]);
                }
            }
            
            // Calculate end rotation for Focus Ring (same logic as updateFocusItemText)
            let textEndRotation = angle * 180 / Math.PI;
            if (Math.cos(angle) < 0) {
                textEndRotation += 180;
            }
            
            // Calculate the rotation delta for the text (not the whole group)
            let textRotationDelta = textEndRotation - textStartRotation;
            
            // Normalize to [-180, 180] range to take shortest path
            while (textRotationDelta > 180) textRotationDelta -= 360;
            while (textRotationDelta < -180) textRotationDelta += 360;
            
            const translateX = endPos.x - nodePos.startX;
            const translateY = endPos.y - nodePos.startY;
            
            // Determine if this is the clicked node (will be centered at Magnifier)
            const isClickedNode = siblingItem.key === clickedItem.key;
            
            Logger.debug(`🎬 Node ${siblingItem.name}: translate(${translateX.toFixed(1)}, ${translateY.toFixed(1)}) rotate ${textRotationDelta.toFixed(1)}° ${isClickedNode ? '[CLICKED - will magnify]' : ''}`);
            
            // Get circle element for radius animation
            const circleElement = animatedNode.querySelector('.node');
            const startRadius = circleElement ? parseFloat(circleElement.getAttribute('r')) : MOBILE_CONFIG.RADIUS.CHILD_NODE;
            const endRadius = isClickedNode ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED;
            
            // Apply starting state
            animatedNode.style.transformOrigin = `${nodePos.startX}px ${nodePos.startY}px`;
            animatedNode.style.transform = 'translate(0, 0) rotate(0deg)';
            animatedNode.style.transition = 'none';
            
            // Store animation data
            animatedNodes.push({
                node: animatedNode,
                circle: circleElement,
                translateX,
                translateY,
                rotationDelta: textRotationDelta,
                startRadius,
                endRadius,
                itemName: siblingItem.name  // For logging
            });
        });
        
        // Force reflow
        if (animatedNodes.length > 0) {
            animatedNodes[0].node.getBoundingClientRect();
        }
        
        // Save animated nodes for potential OUT animation reuse
        this.lastAnimatedNodes = animatedNodes;
        console.log('🎬 Saved', animatedNodes.length, 'animated nodes for potential OUT reuse');
        console.log('🎬⏰ IN animation setup complete at timestamp:', performance.now().toFixed(2), 'ms');
        
        const finalizeAnimatedNodes = () => {
            animatedNodes.forEach((anim, index) => {
                const computedTransform = window.getComputedStyle(anim.node).transform;
                console.log(`🎬🏁 IN[${index}] ${anim.itemName || 'unknown'} final computed transform: ${computedTransform}`);
                anim.node.style.opacity = '0';
            });
            console.log('🎬 IN animation END: Child Pyramid → Focus Ring');
            console.log('🎬⏰ Timestamp:', performance.now().toFixed(2), 'ms');
            if (onComplete) onComplete();
        };

        const handlePostAnimation = () => {
            if (this.loopInOutDebugFlag) {
                this.runInOutInDebugLoop(animatedNodes, finalizeAnimatedNodes);
            } else {
                finalizeAnimatedNodes();
            }
        };

        // Start all animations - simple IN without demonstration loop
        setTimeout(() => {
            console.log('🎬 IN animation START: Child Pyramid → Focus Ring');
            animatedNodes.forEach(anim => {
                anim.node.style.transition = 'transform 600ms ease-in-out';
                anim.node.style.transform = `translate(${anim.translateX}px, ${anim.translateY}px) rotate(${anim.rotationDelta}deg)`;
                
                // Animate circle radius
                if (anim.circle && anim.startRadius !== anim.endRadius) {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', anim.endRadius);
                }
            });
            
            // Do NOT remove nodes - keep them for potential OUT animation
            setTimeout(handlePostAnimation, 600);
        }, 10);

    }

    runInOutInDebugLoop(animatedNodes, done) {
        if (!animatedNodes || animatedNodes.length === 0) {
            done();
            return;
        }

        console.log('🎬 LOOP playback initiated (Child Pyramid ↔ Focus Ring)');

        const phases = [
            {
                label: 'OUT (loop)',
                transformFn: () => 'translate(0px, 0px) rotate(0deg)',
                radiusProp: 'startRadius'
            },
            {
                label: 'IN (loop)',
                transformFn: (anim) => `translate(${anim.translateX}px, ${anim.translateY}px) rotate(${anim.rotationDelta}deg)`,
                radiusProp: 'endRadius'
            }
        ];

        let phaseIndex = 0;

        const startPhase = () => {
            if (phaseIndex >= phases.length) {
                animatedNodes.forEach(anim => {
                    anim.node.style.opacity = '0';
                });
                console.log('🎬 LOOP sequence complete (IN/OUT/IN)');
                done();
                return;
            }

            const phase = phases[phaseIndex];
            console.log(`🎬 LOOP animation START: ${phase.label}`);
            animatedNodes.forEach(anim => {
                anim.node.style.opacity = '1';
                anim.node.style.transition = 'transform 600ms ease-in-out';
                anim.node.style.transform = phase.transformFn(anim);
                const radiusValue = anim[phase.radiusProp];
                if (anim.circle && typeof radiusValue === 'number') {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', radiusValue);
                }
            });

            setTimeout(() => {
                console.log(`🎬 LOOP animation END: ${phase.label}`);
                phaseIndex += 1;
                startPhase();
            }, 600);
        };

        // Ensure nodes remain visible for playback
        animatedNodes.forEach(anim => {
            anim.node.style.opacity = '1';
        });

        startPhase();
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
        console.log('🎬🎬🎬 OUT MIGRATION FUNCTION CALLED');
        console.log('🎬 focusItems:', focusItems?.length);
        console.log('🎬 lastAnimatedNodes:', this.lastAnimatedNodes?.length);
        Logger.debug('🎬 Starting OUT migration: Focus Ring → Child Pyramid');
        
        if (!focusItems || focusItems.length === 0) {
            console.log('🎬❌ No focus items for OUT animation');
            Logger.warn('No focus items for OUT animation');
            if (onComplete) onComplete();
            return;
        }
        
        // Use saved animated nodes from IN animation
        if (!this.lastAnimatedNodes || this.lastAnimatedNodes.length === 0) {
            console.log('🎬❌ No saved animated nodes for OUT animation');
            Logger.warn('No saved animated nodes for OUT animation');
            if (onComplete) onComplete();
            return;
        }
        
        const animatedNodes = this.lastAnimatedNodes;
        console.log('🎬✓ Reusing', animatedNodes.length, 'saved animated nodes');
        
        // Make nodes visible and animate back to Child Pyramid (reverse of IN animation)
        setTimeout(() => {
            console.log('🎬 Starting OUT animation - animating to origin (0, 0)');
            animatedNodes.forEach(anim => {
                // Make visible first
                anim.node.style.opacity = '1';
                anim.node.style.transition = 'transform 600ms ease-in-out, opacity 0ms';
                anim.node.style.transform = `translate(0, 0) rotate(0deg)`;
                
                // Animate circle radius back to Child Pyramid size
                if (anim.circle && anim.startRadius !== anim.endRadius) {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', anim.startRadius);
                }
            });
            
            // Clean up when animation completes - remove nodes to allow fresh Child Pyramid rendering
            setTimeout(() => {
                console.log('🎬 OUT animation complete - removing animated nodes');
                
                // Remove the animated nodes - they block new Child Pyramid content
                animatedNodes.forEach(anim => {
                    console.log('🎬🗑️ Removing animated node:', anim.node.getAttribute('data-item'));
                    anim.node.remove();
                });
                
                this.lastAnimatedNodes = null; // Clear saved nodes reference
                Logger.debug('🎬 OUT migration animation complete, nodes removed');
                console.log('🎬 OUT animation complete, animated nodes removed from DOM');
                console.log('🎬 Child Pyramid can now render fresh content for selected Focus Ring item');
                if (onComplete) onComplete();
            }, 600);
        }, 10);
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
        this.selectedFocusItem = { ...item };

        // 2. Get all siblings at the same level
        // For Child Pyramid clicks, siblings are the other items currently in Child Pyramid
        let allSiblings = this.currentChildItems || [];
        
        // If no child items cached, fall back to querying
        if (allSiblings.length === 0) {
            // Special handling for LEAF items with pseudo parents
            if (item.__hasPseudoParent && !item.__isPseudoParent) {
                // For leaf items under pseudo parents, siblings are in the pseudo parent's source items
                const pseudoParentName = item.__path[item.__path.length - 2];
                const pseudoParent = this.currentFocusItems?.find(p => 
                    p.__isPseudoParent && p.name === pseudoParentName
                );
                
                if (pseudoParent && pseudoParent.__pseudoSourceItems) {
                    allSiblings = pseudoParent.__pseudoSourceItems;
                    Logger.debug(`🔺 Got ${allSiblings.length} siblings from pseudo parent "${pseudoParentName}" in focus ring`);
                } else {
                    Logger.error(`🔺 Could not find pseudo parent "${pseudoParentName}" in current focus ring`);
                    allSiblings = [];
                }
            } else {
                // Normal navigation - get siblings from parent (includes pseudo parents themselves)
                const parentLevel = this.getPreviousHierarchyLevel(itemLevel);
                const parentItem = this.buildParentItemFromChild(item, parentLevel);
                allSiblings = this.getChildItemsForLevel(parentItem, itemLevel);
            }
        }
        
        console.log(`🔺🔍 SIBLINGS ARRAY (${allSiblings.length} items):`, allSiblings.map((s, i) => `[${i}]${s.name}(key:${s.key})`).join(', '));
        console.log(`🔺🔍 CLICKED ITEM: name="${item.name}", key="${item.key}"`);
        
        Logger.debug(`🔺 Getting siblings for "${item.name}" at level ${itemLevel}, found ${allSiblings.length} siblings`);

        // Validate sort_numbers before setting focus items
        const validatedSiblings = this.validateSortNumbers(allSiblings, `Focus Ring siblings at ${itemLevel}`);
        if (validatedSiblings.length === 0) {
            Logger.error('🔺 Cannot display Focus Ring - no valid items with sort_numbers');
            return;
        }

        this.currentFocusItems = validatedSiblings;
        this.allFocusItems = validatedSiblings;

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
            if (window.mobileCatalogApp) {
                window.mobileCatalogApp.setupTouchRotation(allSiblings);
                Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
                
                if (window.mobileCatalogApp.touchHandler) {
                    window.mobileCatalogApp.touchHandler.rotationOffset = centerOffset;
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
        if (window.mobileCatalogApp) {
            window.mobileCatalogApp.setupTouchRotation(allSiblings);
            Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
            
            // CRITICAL: Set the rotation offset AFTER setupTouchRotation to override its default
            if (window.mobileCatalogApp.touchHandler) {
                // Stop any ongoing inertial animation to prevent it from interfering
                window.mobileCatalogApp.touchHandler.stopAnimation();
                window.mobileCatalogApp.touchHandler.rotationOffset = centerOffset;
                // Re-enable touch handling after cooldown period
                setTimeout(() => {
                    if (window.mobileCatalogApp.touchHandler) {
                        window.mobileCatalogApp.touchHandler.tempDisabled = false;
                    }
                }, 500); // 500ms cooldown
                Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
            }
        }
        
        // Also update lastRotationOffset to prevent rotation detection
        this.lastRotationOffset = centerOffset;

        // CRITICAL: Set selectedFocusItem BEFORE conditional check
        // This ensures showChildContentForFocusItem has the correct context
        this.selectedFocusItem = item;
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
        
        if (topNavDepth === -1 || parentDepth === -1) {
            // Fallback if levels not found in hierarchy
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2];
            }
            return parentLevel;
        }
        
        // Build contextual breadcrumb: always show manufacturer, then immediate parent (if different)
        const contextSegments = [];
        
        // Determine actual parent from path (handles skipped hierarchy levels)
        const actualParentIndex = item.__path.length - 2;
        const actualParentSegment = actualParentIndex >= 0 ? item.__path[actualParentIndex] : null;
        
        // Case 1: Parent is ABOVE top navigation level (e.g., country above manufacturer)
        // Show only the parent name, singular
        if (actualParentIndex < topNavDepth) {
            if (actualParentSegment) {
                contextSegments.push(actualParentSegment);
            }
        }
        // Case 2: Parent IS the top navigation level (e.g., at manufacturer, parent is manufacturer)
        // Show only manufacturer, singular
        else if (actualParentIndex === topNavDepth) {
            const manufacturerSegment = item.__path[topNavDepth];
            contextSegments.push(manufacturerSegment);
        }
        // Case 3: Parent is BELOW top navigation level (e.g., cylinder, family, etc.)
        // Show manufacturer + parent (pluralized)
        else if (actualParentIndex > topNavDepth) {
            // Add manufacturer first
            const manufacturerSegment = item.__path[topNavDepth];
            contextSegments.push(manufacturerSegment);
            
            // Add actual parent (pluralized)
            if (actualParentSegment) {
                const levelName = levelNames[actualParentIndex] || parentLevel;
                const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
                
                // Pluralize based on level type
                const pluralized = levelConfig?.is_numeric 
                    ? actualParentSegment + "'s"  // Numbers: "8" → "8's"
                    : actualParentSegment + "'s"; // Words: "Flathead" → "Flathead's"
                
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
        console.log(`🔺🔍 SEARCHING FOR: key="${item.key}" in array of ${array.length} items`);
        const index = array.findIndex(sibling => sibling.key === item.key);
        console.log(`🔺🔍 FOUND AT INDEX: ${index} (${index >= 0 ? array[index].name : 'NOT FOUND'})`);
        
        if (index === -1) {
            Logger.warn(`🔺 findItemIndexInArray: Item key "${item.key}" not found in array of ${array.length} items`);
            Logger.warn(`🔺 Item keys in array:`, array.map(s => s.key));
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
        const endRadius = arcParams.radius * 0.98;
        
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
}

export { MobileRenderer };
