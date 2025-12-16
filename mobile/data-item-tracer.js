/**
 * Data Item Tracer
 * Provides targeted debug logging for specific items during navigation
 * Useful for tracing complex hierarchy paths and debugging edge cases
 */

import { Logger } from './mobile-logger.js';

export class DataItemTracer {
    constructor(dataManager) {
        this.dataManager = dataManager;
        // Default trace target (can be overridden via window.DEBUG_ITEM_TRACE)
        this.traceItemTarget = 'Lockwood-Ash';
    }

    /**
     * Get the active trace target (runtime override or default)
     * @returns {string|null} Target item name/path to trace, or null if tracing disabled
     */
    getActiveTraceTarget() {
        if (typeof window !== 'undefined') {
            const runtimeOverride = window.DEBUG_ITEM_TRACE;
            if (typeof runtimeOverride === 'string') {
                const trimmed = runtimeOverride.trim();
                if (trimmed.length === 0) {
                    return null;
                }
                return trimmed;
            }
        }
        return this.traceItemTarget;
    }

    /**
     * Check if an item matches the active trace target
     * Searches item name, __path array, and top-level ancestor
     * @param {Object} item - Item to check
     * @returns {boolean} True if item should be traced
     */
    shouldTraceItem(item) {
        const target = this.getActiveTraceTarget();
        if (!target || !item) {
            return false;
        }

        const normalizedTarget = target.toLowerCase();
        const candidates = [];

        // Check top-level ancestor (first path segment)
        if (Array.isArray(item.__path) && item.__path.length > 0) {
            candidates.push(item.__path[0]);
        }

        if (item.name) {
            candidates.push(item.name);
        }

        if (Array.isArray(item.__path)) {
            candidates.push(...item.__path);
        }

        return candidates.some(value => typeof value === 'string' && value.toLowerCase().includes(normalizedTarget));
    }

    /**
     * Log a trace message for a specific item (if tracing is enabled for it)
     * @param {Object} item - Item being traced
     * @param {string} message - Trace message
     * @param {*} extraContext - Optional additional context to log
     */
    traceItem(item, message, extraContext = null) {
        if (!this.shouldTraceItem(item)) {
            return;
        }

        const prefix = this.getActiveTraceTarget() || 'Item';
        if (extraContext !== null) {
            Logger.info(`[Trace:${prefix}] ${message}`, extraContext);
        } else {
            Logger.info(`[Trace:${prefix}] ${message}`);
        }
    }
}
