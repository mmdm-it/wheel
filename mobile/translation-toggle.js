/**
 * TranslationToggle
 * Handles translation button label, cycling, and positioning.
 */
class TranslationToggle {
    constructor(viewport) {
        this.viewport = viewport;
        this.config = null;
        this.current = null;
        this.buttonGroup = null;
        this.buttonText = null;
        this.onChange = null;
    }

    init(config, { onChange } = {}) {
        this.config = config;
        this.onChange = typeof onChange === 'function' ? onChange : null;
        if (!config || !config.available || config.available.length < 2) return false;

        this.buttonGroup = document.getElementById('translationButtonGroup');
        this.buttonText = document.getElementById('translationText');
        if (!this.buttonGroup || !this.buttonText) return false;

        this.current = config.default || config.available[0];
        this.updateLabel();
        this.positionButton();

        this.buttonGroup.classList.remove('hidden');
        this.buttonGroup.style.display = '';

        this.buttonGroup.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cycle();
        });

        return true;
    }

    setCurrent(code) {
        this.current = code || this.current;
        this.updateLabel();
    }

    getCurrent() {
        return this.current;
    }

    cycle() {
        if (!this.config || !this.config.available) return;
        const available = this.config.available;
        const idx = available.indexOf(this.current);
        const next = available[(idx + 1) % available.length];
        this.current = next;
        this.updateLabel();
        if (this.onChange) this.onChange(this.current);
    }

    updateLabel() {
        if (!this.buttonText) return;
        const label = this.config?.labels?.[this.current] || (this.current ? this.current.toUpperCase() : '');
        this.buttonText.textContent = label;
    }

    positionButton() {
        if (!this.buttonGroup) return;
        const viewport = this.viewport.getViewportInfo();
        const SSd = Math.min(viewport.width, viewport.height);
        const x = 0;
        const y = (viewport.height / 2) - (SSd * 0.12);
        this.buttonGroup.setAttribute('transform', `translate(${x}, ${y})`);
    }
}

export { TranslationToggle };
