/**
 * Data Lazy Loader
 * Handles lazy loading of external files for split volume structures
 * 
 * Responsibilities:
 * - Detect split structure types (split vs split_chapters)
 * - Load external JSON files on demand
 * - Ensure books and chapters are loaded before access
 * - Navigate to data locations in the hierarchy
 * - Prevent duplicate loads with promise tracking
 */

import { Logger } from './mobile-logger.js';

/**
 * Manages lazy loading for split volume structures
 */
class DataLazyLoader {
    constructor(dataManager, cacheManager) {
        this.dataManager = dataManager;
        this.cacheManager = cacheManager;
        
        // Track loaded files to prevent duplicate loads
        this.loadedExternalFiles = new Set();
        this.externalFileLoadingPromises = new Map();
    }

    /**
     * Check if current volume uses split structure with lazy loading
     * @returns {boolean} True if volume uses split structure
     */
    isSplitStructure() {
        const displayConfig = this.dataManager.getDisplayConfig();
        const structureType = displayConfig && displayConfig.structure_type;
        return structureType === 'split' || structureType === 'split_chapters';
    }

    /**
     * Check if current volume uses chapter-level split structure
     * @returns {boolean} True if volume uses chapter-level split structure
     */
    isChapterSplitStructure() {
        const displayConfig = this.dataManager.getDisplayConfig();
        return displayConfig && displayConfig.structure_type === 'split_chapters';
    }

    /**
     * Load external file data and merge into the main data structure
     * Used for split volumes where books/sections are stored in separate files
     * @param {string} externalFilePath - Path to the external JSON file
     * @param {Object} targetLocation - Location in data structure to merge into
     * @returns {Promise<Object>} The loaded data
     */
    async loadExternalFile(externalFilePath, targetLocation) {
        // Check if already loaded
        if (this.loadedExternalFiles.has(externalFilePath)) {
            Logger.debug(`📦 External file already loaded: ${externalFilePath}`);
            return targetLocation;
        }
        
        // Check if load is already in progress
        if (this.externalFileLoadingPromises.has(externalFilePath)) {
            Logger.debug(`⏳ Waiting for in-progress load: ${externalFilePath}`);
            return this.externalFileLoadingPromises.get(externalFilePath);
        }
        
        // Start loading
        const loadPromise = this._performExternalFileLoad(externalFilePath, targetLocation);
        this.externalFileLoadingPromises.set(externalFilePath, loadPromise);
        
        try {
            const result = await loadPromise;
            return result;
        } finally {
            this.externalFileLoadingPromises.delete(externalFilePath);
        }
    }

    /**
     * Perform the actual external file load
     * @private
     */
    async _performExternalFileLoad(externalFilePath, targetLocation) {
        console.log(`🔍 DEBUG _performExternalFileLoad: path=${externalFilePath}`);
        Logger.info(`📥 Lazy loading external file: ${externalFilePath}`);
        
        try {
            // Check IndexedDB cache first
            const cachedData = await this.cacheManager.getCachedFile(externalFilePath);
            let externalData;
            
            if (cachedData) {
                console.log(`🔍 DEBUG: Using CACHED data for ${externalFilePath}`);
                Logger.info(`💾 Using cached data for: ${externalFilePath}`);
                externalData = cachedData;
            } else {
                console.log(`🔍 DEBUG: FETCHING from network: ${externalFilePath}`);
                // Fetch from network
                const response = await fetch(`./${externalFilePath}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                externalData = await response.json();
                console.log(`🔍 DEBUG: Fetched data, verses keys:`, externalData.verses ? Object.keys(externalData.verses).slice(0, 5) : 'no verses');
                
                // Cache for future use
                await this.cacheManager.setCachedFile(externalFilePath, externalData);
            }
            
            // Merge external data into target location
            // For book files, this means adding chapters data
            // For chapter files (split_chapters), this means adding verses data
            if (externalData.chapters) {
                targetLocation.chapters = externalData.chapters;
                targetLocation._loaded = true;
                Logger.info(`✅ Loaded ${Object.keys(externalData.chapters).length} chapters from ${externalFilePath}`);
            } else if (externalData.verses) {
                // Normalize verse data to flatten text.VUL → latin, etc. (Phase 3A fix)
                const normalizedVerses = {};
                Object.entries(externalData.verses).forEach(([key, verseData]) => {
                    normalizedVerses[key] = this.dataManager.itemBuilder.normalizeItem(verseData, 'verse');
                });
                targetLocation.verses = normalizedVerses;
                targetLocation._loaded = true;
                console.log(`🔍 DEBUG: Normalized and merged ${Object.keys(normalizedVerses).length} verses into targetLocation`);
                console.log(`🔍 DEBUG: Sample verse 6:`, JSON.stringify(normalizedVerses['6']).substring(0, 200));
                Logger.info(`✅ Loaded ${Object.keys(externalData.verses).length} verses from ${externalFilePath}`);
            } else {
                // Generic merge - copy all properties except metadata
                Object.keys(externalData).forEach(key => {
                    if (!key.startsWith('_')) {
                        targetLocation[key] = externalData[key];
                    }
                });
                targetLocation._loaded = true;
                Logger.info(`✅ Loaded external file: ${externalFilePath}`);
            }
            
            this.loadedExternalFiles.add(externalFilePath);
            return targetLocation;
            
        } catch (error) {
            Logger.error(`❌ Failed to load external file ${externalFilePath}:`, error);
            throw error;
        }
    }

    /**
     * Ensure book data is loaded before accessing its children (chapters)
     * @param {Object} bookItem - The book item that may need loading
     * @returns {Promise<boolean>} True if book is ready (already loaded or successfully loaded)
     */
    async ensureBookLoaded(bookItem) {
        if (!this.isSplitStructure()) {
            return true; // Monolithic structure - already loaded
        }
        
        // Navigate to the book in the data structure
        const bookData = this.getBookDataLocation(bookItem);
        
        if (!bookData) {
            Logger.warn(`ensureBookLoaded: Could not find book data for ${bookItem.name}`);
            return false;
        }
        
        // Check if book needs loading
        if (bookData._loaded === true) {
            return true; // Already loaded
        }
        
        if (!bookData._external_file) {
            Logger.debug(`ensureBookLoaded: Book ${bookItem.name} has no external file reference`);
            return true; // No external file - already has data
        }
        
        // Load the external file
        try {
            await this.loadExternalFile(bookData._external_file, bookData);
            return true;
        } catch (error) {
            Logger.error(`Failed to load book ${bookItem.name}:`, error);
            return false;
        }
    }

    /**
     * Get the actual data location for a book item
     * @param {Object} bookItem - Book item with __path metadata
     * @returns {Object|null} The book data object in the loaded data structure
     */
    getBookDataLocation(bookItem) {
        if (!bookItem || !bookItem.__path || bookItem.__path.length < 3) {
            return null;
        }
        
        const [testament, section, book] = bookItem.__path;
        const data = this.dataManager.data;
        const rootDataKey = this.dataManager.rootDataKey;
        const rootData = data && data[rootDataKey];
        
        if (!rootData || !rootData.testaments) {
            return null;
        }
        
        const testamentData = rootData.testaments[testament];
        if (!testamentData || !testamentData.sections) {
            return null;
        }
        
        const sectionData = testamentData.sections[section];
        if (!sectionData || !sectionData.books) {
            return null;
        }
        
        return sectionData.books[book];
    }

    /**
     * Ensure chapter data is loaded before accessing its children (verses)
     * @param {Object} chapterItem - The chapter item that may need loading
     * @returns {Promise<boolean>} True if chapter is ready (already loaded or successfully loaded)
     */
    async ensureChapterLoaded(chapterItem) {
        if (!this.isChapterSplitStructure()) {
            return true; // Not a chapter-split structure
        }
        
        // Navigate to the chapter in the data structure
        const chapterData = this.getChapterDataLocation(chapterItem);
        
        if (!chapterData) {
            Logger.warn(`ensureChapterLoaded: Could not find chapter data for ${chapterItem.name}`);
            return false;
        }
        
        // Check if chapter needs loading
        if (chapterData._loaded === true) {
            return true; // Already loaded
        }
        
        if (!chapterData._external_file) {
            Logger.debug(`ensureChapterLoaded: Chapter ${chapterItem.name} has no external file reference`);
            return true; // No external file - already has data
        }
        
        // Load the external file
        try {
            await this.loadExternalFile(chapterData._external_file, chapterData);
            return true;
        } catch (error) {
            Logger.error(`Failed to load chapter ${chapterItem.name}:`, error);
            return false;
        }
    }

    /**
     * Get the actual data location for a chapter item
     * @param {Object} chapterItem - Chapter item with __path metadata
     * @returns {Object|null} The chapter data object in the loaded data structure
     */
    getChapterDataLocation(chapterItem) {
        if (!chapterItem || !chapterItem.__path || chapterItem.__path.length < 4) {
            return null;
        }
        
        const [testament, section, book, chapter] = chapterItem.__path;
        const data = this.dataManager.data;
        const rootDataKey = this.dataManager.rootDataKey;
        const rootData = data && data[rootDataKey];
        
        if (!rootData || !rootData.testaments) {
            return null;
        }
        
        const testamentData = rootData.testaments[testament];
        if (!testamentData || !testamentData.sections) {
            return null;
        }
        
        const sectionData = testamentData.sections[section];
        if (!sectionData || !sectionData.books) {
            return null;
        }
        
        const bookData = sectionData.books[book];
        if (!bookData || !bookData.chapters) {
            return null;
        }
        
        return bookData.chapters[chapter];
    }

    /**
     * Clear loaded files tracking (used when clearing cache)
     */
    clearLoadedFiles() {
        this.loadedExternalFiles.clear();
        this.externalFileLoadingPromises.clear();
    }
}

export { DataLazyLoader };
