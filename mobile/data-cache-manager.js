/**
 * Data Cache Manager
 * Handles IndexedDB caching for external file loading in split volumes
 * 
 * Responsibilities:
 * - Initialize IndexedDB
 * - Cache external JSON files with version keys
 * - Retrieve cached files
 * - Clear cache when needed
 */

import { Logger } from './mobile-logger.js';

// IndexedDB constants
const IDB_NAME = 'WheelVolumeCache';
const IDB_VERSION = 1;
const IDB_STORE = 'externalFiles';

/**
 * Manages IndexedDB caching for external file loading
 */
class DataCacheManager {
    constructor() {
        this.idbCache = null;
        this.cacheVersion = 'unknown'; // Set by DataManager during volume load
        this.idbReady = this.initIndexedDB();
    }

    /**
     * Set the cache version (called by DataManager)
     * @param {string} version - Version key for cache invalidation
     */
    setCacheVersion(version) {
        this.cacheVersion = version;
    }

    /**
     * Initialize IndexedDB for caching external files
     * @returns {Promise<IDBDatabase|null>}
     */
    async initIndexedDB() {
        if (typeof indexedDB === 'undefined') {
            Logger.debug('💾 IndexedDB not available - using memory cache only');
            return null;
        }

        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(IDB_NAME, IDB_VERSION);

                request.onerror = () => {
                    Logger.warn('💾 IndexedDB open failed - using memory cache only');
                    resolve(null);
                };

                request.onsuccess = (event) => {
                    this.idbCache = event.target.result;
                    Logger.debug('💾 IndexedDB cache initialized');
                    resolve(this.idbCache);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        const store = db.createObjectStore(IDB_STORE, { keyPath: 'path' });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                        Logger.debug('💾 IndexedDB store created');
                    }
                };
            } catch (error) {
                Logger.warn('💾 IndexedDB init error:', error);
                resolve(null);
            }
        });
    }

    /**
     * Get cached external file from IndexedDB
     * @param {string} filePath - Path to the external file
     * @returns {Promise<Object|null>} Cached data or null
     */
    async getCachedFile(filePath) {
        await this.idbReady;
        if (!this.idbCache) return null;

        const cacheKey = this._buildCacheKey(filePath);

        return new Promise((resolve) => {
            try {
                const tx = this.idbCache.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const request = store.get(cacheKey);

                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        if (result.versionKey !== this.cacheVersion) {
                            Logger.debug(`💾 Cache version mismatch for ${filePath} (have ${result.versionKey}, want ${this.cacheVersion})`);
                            resolve(null);
                            return;
                        }
                        Logger.debug(`💾 Cache hit: ${filePath}`);
                        resolve(result.data);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    Logger.debug(`💾 Cache read error for ${filePath}`);
                    resolve(null);
                };
            } catch (error) {
                Logger.debug('💾 Cache read exception:', error);
                resolve(null);
            }
        });
    }

    /**
     * Store external file in IndexedDB cache
     * @param {string} filePath - Path to the external file
     * @param {Object} data - Data to cache
     */
    async setCachedFile(filePath, data) {
        await this.idbReady;
        if (!this.idbCache) return;

        const cacheKey = this._buildCacheKey(filePath);

        try {
            const tx = this.idbCache.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put({
                path: cacheKey,
                data: data,
                timestamp: Date.now(),
                versionKey: this.cacheVersion
            });
            Logger.debug(`💾 Cached: ${filePath} (version ${this.cacheVersion})`);
        } catch (error) {
            Logger.debug('💾 Cache write error:', error);
        }
    }

    /**
     * Clear all cached external files from IndexedDB
     * Useful for forcing fresh data reload
     */
    async clearCache() {
        await this.idbReady;
        if (!this.idbCache) return;

        try {
            const tx = this.idbCache.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.clear();
            Logger.info('💾 Cache cleared');
        } catch (error) {
            Logger.warn('💾 Cache clear error:', error);
        }
    }

    /**
     * Build cache key with version prefix
     * @private
     */
    _buildCacheKey(filePath) {
        return `${this.cacheVersion}::${filePath}`;
    }
}

export { DataCacheManager };
