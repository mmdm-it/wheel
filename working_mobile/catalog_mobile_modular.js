/**
 * Mobile Catalog - Main Entry Point
 * Modular architecture for better maintainability
 * 
 * IMPORTANT: This system uses native ES6 modules - NO BUNDLING REQUIRED!
 * 
 * Development workflow:
 * 1. Edit individual module files (mobile-*.js)
 * 2. Test by refreshing browser (no build step)
 * 3. All changes go directly to modules
 * 
 * The bundled version (catalog_mobile_bundled_bak.js) is retired backup only.
 * DO NOT create new bundled files - modern browsers support native modules.
 */

// Import all modules
import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { ViewportManager } from './mobile-viewport.js';
import { TouchRotationHandler } from './mobile-touch.js';
import { DataManager } from './mobile-data.js';
import { MobileRenderer } from './mobile-renderer.js';
import { MobileCatalogApp, initMobileCatalog, extendMobileRenderer } from './mobile-app.js';

// Apply renderer extensions for enhanced functionality
extendMobileRenderer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileCatalog);
} else {
    // DOM is already loaded
    initMobileCatalog();
}

// Export for potential external use
export {
    MOBILE_CONFIG,
    Logger,
    ViewportManager,
    TouchRotationHandler,
    DataManager,
    MobileRenderer,
    MobileCatalogApp,
    initMobileCatalog
};