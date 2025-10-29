/**
 * Mobile Catalog Logger
 * Conditional logging utility for debugging and error handling
 */

class Logger {
    static debug(...args) {
        // Enable debug logging by setting: localStorage.setItem('debugMobile', 'true') 
        // or adding ?debug=1 to URL or setting window.DEBUG_MOBILE = true
        if (window.DEBUG_MOBILE || 
            localStorage.getItem('debugMobile') === 'true' ||
            new URLSearchParams(window.location.search).get('debug') === '1') {
            console.log('[MobileCatalog]', ...args);
        }
    }
    
    static error(...args) {
        console.error('[MobileCatalog ERROR]', ...args);
    }
    
    static warn(...args) {
        console.warn('[MobileCatalog WARN]', ...args);
    }
}

export { Logger };