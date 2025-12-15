/**
 * NavigationState
 * Lightweight store for navigation-related state with change listeners.
 */
class NavigationState {
    constructor() {
        this.state = {
            selectedFocusItem: null,
            activePath: [],
            translation: null,
            rotationOffset: 0,
            parentLabel: null
        };
        this.listeners = new Set();
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        const snapshot = this.getState();
        this.listeners.forEach(fn => {
            try {
                fn(snapshot);
            } catch (err) {
                // Swallow to keep notifications resilient
                console.error('NavigationState listener error', err);
            }
        });
    }

    getState() {
        return { ...this.state, activePath: [...this.state.activePath] };
    }

    setSelectedFocusItem(item) {
        this.state.selectedFocusItem = item || null;
        this.notify();
    }

    setActivePath(path) {
        this.state.activePath = Array.isArray(path) ? [...path] : [];
        this.notify();
    }

    setTranslation(code) {
        this.state.translation = code || null;
        this.notify();
    }

    setRotationOffset(offset) {
        this.state.rotationOffset = typeof offset === 'number' ? offset : 0;
        this.notify();
    }

    setParentLabel(label) {
        this.state.parentLabel = label || null;
        this.notify();
    }
}

export { NavigationState };
