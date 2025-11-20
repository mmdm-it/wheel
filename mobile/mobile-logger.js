/**
 * Mobile Catalog Logger
 * Conditional logging utility for debugging and error handling
 * 
 * Usage:
 *   Default (WARN): Only errors and warnings
 *   Info level: ?loglevel=3 - Shows important events
 *   Debug level: ?loglevel=4 - Shows all debug messages (noisy)
 *   Verbose level: ?loglevel=5 - Shows everything including loops
 */

class Logger {
    static LOG_LEVELS = {
        NONE: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
        VERBOSE: 5
    };

    static getLogLevel() {
        // Check URL parameter first (highest priority)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLevel = urlParams.get('loglevel');
        if (urlLevel) return parseInt(urlLevel) || Logger.LOG_LEVELS.WARN;

        // Check localStorage
        const storedLevel = localStorage.getItem('logLevel');
        if (storedLevel) return parseInt(storedLevel);

        // Legacy debug flag support (DISABLED - use ?loglevel=4 instead)
        // if (window.DEBUG_MOBILE || 
        //     localStorage.getItem('debugMobile') === 'true' ||
        //     urlParams.get('debug') === '1') {
        //     return Logger.LOG_LEVELS.DEBUG;
        // }

        // Default: WARN (quiet - only errors and warnings)
        return Logger.LOG_LEVELS.WARN;
    }

    static debug(...args) {
        if (Logger.getLogLevel() >= Logger.LOG_LEVELS.DEBUG) {
            console.log('[MobileCatalog]', ...args);
        }
    }

    static verbose(...args) {
        // For very noisy logs (loops, coordinate calculations, etc.)
        if (Logger.getLogLevel() >= Logger.LOG_LEVELS.VERBOSE) {
            console.log('[MobileCatalog VERBOSE]', ...args);
        }
    }
    
    static info(...args) {
        if (Logger.getLogLevel() >= Logger.LOG_LEVELS.INFO) {
            console.info('[MobileCatalog INFO]', ...args);
        }
    }
    
    static error(...args) {
        if (Logger.getLogLevel() >= Logger.LOG_LEVELS.ERROR) {
            console.error('[MobileCatalog ERROR]', ...args);
        }
    }
    
    static warn(...args) {
        if (Logger.getLogLevel() >= Logger.LOG_LEVELS.WARN) {
            console.warn('[MobileCatalog WARN]', ...args);
        }
    }
}

export { Logger };