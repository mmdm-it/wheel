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
        return data && 
               data.MMdM && 
               data.MMdM.markets && 
               typeof data.MMdM.markets === 'object';
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