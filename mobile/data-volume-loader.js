/**
 * Data Volume Loader
 * Handles discovery and loading of Wheel volumes (monolithic and split structures)
 * Validates volume format and manages volume metadata
 */

import { Logger } from './mobile-logger.js';

export class DataVolumeLoader {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
        this.currentVolumePath = null;
        this.availableVolumes = [];
        this.rootDataKey = null; // e.g., 'MMdM' or 'Gutenberg_Bible'
        this.cacheVersion = 'unknown'; // versioned cache key (schema+data)
    }

    /**
     * Discover available Wheel volumes in the directory
     * Scans for JSON files and validates them as Wheel volumes
     * @returns {Promise<Array>} Array of discovered volume objects with metadata
     */
    async discoverVolumes() {
        Logger.debug('🔍 Discovering available Wheel volumes...');
        
        // Try to load volume index if available
        let volumeFiles = [];
        try {
            const indexResponse = await fetch('./volumes.json');
            if (indexResponse.ok) {
                const index = await indexResponse.json();
                const indexed = index.volumes || [];
                // Accept strings or objects { path, name }
                volumeFiles = indexed.map(entry => typeof entry === 'string' ? entry : entry?.path).filter(Boolean);
                Logger.debug('📋 Loaded volume index:', volumeFiles);
            }
        } catch (error) {
            Logger.debug('📋 No volume index found, scanning common locations');
        }
        
        // If no index, scan common volume file patterns
        if (volumeFiles.length === 0) {
            // Scan for any .json files that might be volumes
            // These are just common patterns - the validation below will reject non-volumes
            // Note: gutenberg.json removed - now uses split chapters in data/gutenberg/manifest.json
            volumeFiles = [
                'mmdm_catalog.json',
                'hg_mx.json',
                'fairhope.json'
            ];
        }
        
        // Also check for split manifests (these take precedence)
        const splitManifests = [
            { manifest: 'data/gutenberg/manifest.json', volumeId: 'gutenberg' }
        ];
        
        const volumes = [];
        const addedVolumeIds = new Set();
        
        // First, check for split manifests (they take precedence)
        for (const { manifest, volumeId } of splitManifests) {
            try {
                const response = await fetch(`./${manifest}`);
                
                if (!response.ok) {
                    continue;
                }
                
                const data = await response.json();
                const rootKey = Object.keys(data)[0];
                const rootData = data[rootKey];
                
                if (rootData &&
                    rootData.display_config &&
                    rootData.display_config.volume_type === 'wheel_hierarchical' &&
                    (rootData.display_config.structure_type === 'split' || rootData.display_config.structure_type === 'split_chapters')) {
                    
                    const schemaVersion = rootData.display_config.volume_schema_version || '1.0.0';
                    const dataVersion = rootData.display_config.volume_data_version || 'unknown';
                    const structureType = rootData.display_config.structure_type;
                    
                    Logger.info(`📦 Split volume discovered: ${rootData.display_config.volume_name}`);
                    Logger.info(`   Schema: ${schemaVersion} | Data: ${dataVersion} | Structure: ${structureType}`);
                    
                    volumes.push({
                        filename: manifest,
                        name: rootData.display_config.volume_name || volumeId,
                        description: rootData.display_config.volume_description || '',
                        version: rootData.display_config.wheel_volume_version,
                        schemaVersion: schemaVersion,
                        dataVersion: dataVersion,
                        structureType: structureType,
                        rootKey: rootKey
                    });
                    
                    addedVolumeIds.add(volumeId);
                    Logger.debug(`✅ Found split volume: ${rootData.display_config.volume_name}`);
                }
            } catch (error) {
                Logger.debug(`⏭️  Error checking split manifest ${manifest}: ${error.message}`);
            }
        }
        
        // Then check monolithic volumes (skip if split version already found)
        for (const filename of volumeFiles) {
            // Extract volume ID from filename (e.g., 'gutenberg.json' -> 'gutenberg')
            const volumeId = filename.replace('.json', '');
            
            // Skip if split version already discovered
            if (addedVolumeIds.has(volumeId)) {
                Logger.debug(`⏭️  Skipping ${filename} - split version already loaded`);
                continue;
            }
            
            try {
                const response = await fetch(`./${filename}`);
                
                if (!response.ok) {
                    continue;
                }
                
                const data = await response.json();
                
                // Check for Wheel volume identification keys
                const rootKey = Object.keys(data)[0];
                const rootData = data[rootKey];
                
                if (rootData &&
                    rootData.display_config &&
                    rootData.display_config.volume_type === 'wheel_hierarchical' &&
                    rootData.display_config.wheel_volume_version) {
                    
                    const schemaVersion = rootData.display_config.volume_schema_version || '1.0.0';
                    const dataVersion = rootData.display_config.volume_data_version || 'unknown';
                    const structureType = rootData.display_config.structure_type || 'monolithic';
                    
                    Logger.info(`📦 Volume schema: ${schemaVersion} | data: ${dataVersion} | structure: ${structureType}`);
                    
                    volumes.push({
                        filename: filename,
                        name: rootData.display_config.volume_name || filename,
                        description: rootData.display_config.volume_description || '',
                        version: rootData.display_config.wheel_volume_version,
                        schemaVersion: schemaVersion,
                        dataVersion: dataVersion,
                        structureType: structureType,
                        rootKey: rootKey
                    });
                    
                    Logger.debug(`✅ Found valid Wheel volume: ${rootData.display_config.volume_name}`);
                } else {
                    Logger.debug(`⏭️  ${filename} missing required Wheel volume keys`);
                }
            } catch (error) {
                // File doesn't exist or isn't valid JSON - skip it
                Logger.debug(`⏭️  Error checking ${filename}: ${error.message}`);
            }
        }
        
        this.availableVolumes = volumes;
        Logger.info(`🔍 Discovery complete: ${volumes.length} Wheel volume(s) found`);
        
        if (volumes.length > 0) {
            volumes.forEach(vol => {
                Logger.verbose(`   - ${vol.name} (${vol.filename}) [${vol.structureType}]`);
            });
        }
        
        return volumes;
    }

    /**
     * Load a specific Wheel volume by filename
     * @param {string} filename - Name of the JSON file to load (e.g., 'mmdm_catalog.json')
     * @returns {Promise<Object>} The loaded volume data structure
     * @throws {Error} If volume cannot be loaded or is invalid
     */
    async loadVolume(filename) {
        this.loading = true;
        Logger.debug(`📂 Loading volume: ${filename}`);
        
        try {
            const response = await fetch(`./${filename}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.data = await response.json();

            // Determine root data key (e.g., 'MMdM', 'Gutenberg_Bible')
            this.rootDataKey = Object.keys(this.data)[0];
            
            if (!this.validateData(this.data)) {
                throw new Error('Invalid data structure received');
            }
            
            // Log schema information
            const displayConfig = this.dataManager.getDisplayConfig();
            if (displayConfig) {
                const schemaVersion = displayConfig.volume_schema_version || '1.0.0';
                const dataVersion = displayConfig.volume_data_version || 'unknown';
                const structureType = displayConfig.structure_type || 'monolithic';
                this.cacheVersion = this.computeCacheVersion(displayConfig, filename);
                
                Logger.info(`📦 Loaded volume schema: ${schemaVersion} | data: ${dataVersion} | structure: ${structureType}`);
                
                // Check if structure type is supported
                if (structureType === 'split') {
                    Logger.info(`📂 Split structure detected - lazy loading enabled for external book files`);
                } else if (structureType === 'split_chapters') {
                    Logger.info(`📂 Chapter-level split structure detected - lazy loading enabled for external chapter files`);
                }
            }
            
            this.currentVolumePath = filename;
            // Reset external load tracking for new volume context
            this.dataManager.lazyLoader.clearLoadedFiles();
            Logger.info(`✅ Volume loaded successfully: ${filename}`);
            return this.data;
            
        } catch (error) {
            Logger.error(`❌ Failed to load volume ${filename}:`, error);
            this.data = null;
            throw new Error(`Unable to load volume: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Validate that loaded data is a proper Wheel volume
     * @param {Object} data - The volume data to validate
     * @returns {boolean} True if valid
     */
    validateData(data) {
        if (!data || !this.rootDataKey) {
            Logger.error('❌ Invalid data: no root key found');
            return false;
        }
        
        const rootData = data[this.rootDataKey];
        if (!rootData || typeof rootData !== 'object') {
            Logger.error(`❌ Invalid data: root key '${this.rootDataKey}' does not contain valid data`);
            return false;
        }
        
        const displayConfig = rootData.display_config;
        if (!displayConfig || typeof displayConfig !== 'object') {
            Logger.error('❌ Invalid data: display_config missing or invalid');
            return false;
        }
        
        if (displayConfig.volume_type !== 'wheel_hierarchical') {
            Logger.error(`❌ Invalid data: volume_type is '${displayConfig.volume_type}', expected 'wheel_hierarchical'`);
            return false;
        }
        
        if (!displayConfig.hierarchy_levels || typeof displayConfig.hierarchy_levels !== 'object') {
            Logger.error('❌ Invalid data: hierarchy_levels missing or invalid');
            return false;
        }
        
        Logger.verbose('✅ Data validation passed');
        return true;
    }

    /**
     * Compute cache version string from display config
     * Format: volumeName|schema|dataVersion
     * @param {Object} displayConfig - The display_config object
     * @param {string} filename - Current volume filename
     * @returns {string} Cache version string
     */
    computeCacheVersion(displayConfig, filename) {
        const volumeName = displayConfig.volume_name || filename.replace('.json', '');
        const schema = displayConfig.volume_schema_version || '1.0.0';
        const dataVersion = displayConfig.volume_data_version || 'unknown';
        
        const version = `${volumeName}|${schema}|${dataVersion}`;
        
        // Update cache manager with the version
        this.dataManager.cacheManager.setCacheVersion(version);
        
        return version;
    }

    /**
     * Load default volume (legacy support)
     * @returns {Promise<Object>} The loaded data
     */
    async load() {
        // Legacy support - load default volume if no volume selector is used
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;

        // Discover volumes and load the first one
        await this.discoverVolumes();
        const defaultVolume = this.availableVolumes?.[0]?.filename || 'mmdm_catalog.json';
        this.loadPromise = this.loadVolume(defaultVolume);
        return this.loadPromise;
    }

    /**
     * @deprecated Use load() instead
     */
    async performLoad() {
        return this.load();
    }
}
