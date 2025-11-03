/**
 * Mobile Catalog Data Manager
 * Manages data loading with error handling and caching
 */

import { Logger } from './mobile-logger.js';

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
    }

    async load() {
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.performLoad();
        return this.loadPromise;
    }

    async performLoad() {
        if (this.loading) return this.data;

        this.loading = true;
        Logger.debug('Loading catalog data...');

        try {
            const response = await fetch('./catalog.json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.data = await response.json();

            if (!this.validateData(this.data)) {
                throw new Error('Invalid data structure received');
            }

            Logger.debug('Data loaded successfully', this.data);
            return this.data;

        } catch (error) {
            Logger.error('Failed to load data:', error);
            this.data = null;
            throw new Error(`Unable to load catalog data: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }

    validateData(data) {
        return data && data.MMdM && data.MMdM.markets && typeof data.MMdM.markets === 'object';
    }

    getData() {
        return this.data;
    }

    getMarkets() {
        return this.data ? Object.keys(this.data.MMdM.markets) : [];
    }

    getManufacturers(market) {
        if (!this.data || !this.data.MMdM.markets[market]) return [];

        const countries = this.data.MMdM.markets[market].countries;
        const manufacturers = [];

        Object.keys(countries).forEach(country => {
            Object.keys(countries[country].manufacturers).forEach(manufacturer => {
                manufacturers.push({
                    name: manufacturer,
                    country: country,
                    market: market,
                    key: `${market}/${country}/${manufacturer}`
                });
            });
        });

        return manufacturers.sort((a, b) => b.name.localeCompare(a.name));
    }

    getAllManufacturers() {
        if (!this.data || !this.data.MMdM.markets) return [];

        const allManufacturers = [];

        // Combine manufacturers from all markets
        Object.keys(this.data.MMdM.markets).forEach(market => {
            const countries = this.data.MMdM.markets[market].countries;

            Object.keys(countries).forEach(country => {
                Object.keys(countries[country].manufacturers).forEach(manufacturer => {
                    allManufacturers.push({
                        name: manufacturer,
                        country: country,
                        market: market,
                        key: `${market}/${country}/${manufacturer}`
                    });
                });
            });
        });

        // Sort reverse alphabetically by manufacturer name (Z to A)
        return allManufacturers.sort((a, b) => b.name.localeCompare(a.name));
    }

    getCylinders(market, country, manufacturer) {
        if (!this.data.MMdM?.markets?.[market]?.countries?.[country]?.manufacturers?.[manufacturer]?.cylinders) {
            Logger.warn(`No cylinders found for ${market}/${country}/${manufacturer}`);
            return [];
        }

        const cylinderData = this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders;
        const cylinders = [];

        // Convert cylinder counts to objects
        Object.keys(cylinderData).forEach(cylinderCount => {
            cylinders.push({
                name: `${cylinderCount} Cylinders`,
                cylinderCount: parseInt(cylinderCount),
                market: market,
                country: country,
                manufacturer: manufacturer,
                key: `${market}/${country}/${manufacturer}/${cylinderCount}`,
                data: cylinderData[cylinderCount]
            });
        });

        // Sort by cylinder count (descending - High to Low)
        cylinders.sort((a, b) => b.cylinderCount - a.cylinderCount);
        
        Logger.debug(`Found ${cylinders.length} cylinder types for ${manufacturer}:`, cylinders.map(c => c.name));
        return cylinders;
    }

    getFamilies(market, country, manufacturer, cylinderCount) {
        Logger.debug(`Getting families for ${market}/${country}/${manufacturer}/${cylinderCount}`);
        
        const models = this.getModels(market, country, manufacturer, cylinderCount);
        if (models.length === 0) {
            Logger.warn(`No models found for ${manufacturer} ${cylinderCount} cylinders`);
            return [];
        }
        
        // Group models by engine family (extract from engine_model name)
        const familyMap = new Map();
        
        models.forEach(model => {
            // Try to extract family from engine model name
            // Common patterns: "ABC-123", "XYZ 456", "DEF_789"
            let familyName = model.name;
            
            // Extract base family name (before numbers or special chars)
            const familyMatch = model.name.match(/^([A-Za-z]+)/);
            if (familyMatch) {
                familyName = familyMatch[1];
            }
            
            if (!familyMap.has(familyName)) {
                familyMap.set(familyName, {
                    name: `${familyName} Family`,
                    familyCode: familyName,
                    market: market,
                    country: country,
                    manufacturer: manufacturer,
                    cylinderCount: cylinderCount,
                    key: `${market}/${country}/${manufacturer}/${cylinderCount}/${familyName}`,
                    models: []
                });
            }
            
            familyMap.get(familyName).models.push(model);
        });
        
        const families = Array.from(familyMap.values());
        Logger.debug(`Found ${families.length} families:`, families.map(f => `${f.name} (${f.models.length} models)`));
        
        return families;
    }

    getModels(market, country, manufacturer, cylinder) {
        if (!this.data || !this.data.MMdM.markets[market] ||
            !this.data.MMdM.markets[market].countries[country] ||
            !this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer] ||
            !this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder]) {
            return [];
        }

        const models = this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder];
        if (!Array.isArray(models)) return [];

        return models.map((model, index) => ({
            name: model.engine_model,
            market: market,
            country: country,
            manufacturer: manufacturer,
            cylinder: cylinder,
            key: `${market}/${country}/${manufacturer}/${cylinder}/${model.engine_model}`,
            data: model,
            index: index
        }));
    }
    
    getModelsByFamily(market, country, manufacturer, cylinderCount, familyName) {
        const allModels = this.getModels(market, country, manufacturer, cylinderCount);
        
        // Filter models that belong to this family
        return allModels.filter(model => {
            const familyMatch = model.name.match(/^([A-Za-z]+)/);
            const modelFamily = familyMatch ? familyMatch[1] : model.name;
            return modelFamily === familyName || model.name.startsWith(familyName);
        });
    }
}

// Mock add to cart function
window.addToCart = function(model) {
    Logger.debug('Add to cart requested:', model);
    // Mobile-friendly alert or modal would go here
    if (confirm(`Add ${model} to cart?`)) {
        alert(`Added ${model} to cart!`);
    }
};

export { DataManager };