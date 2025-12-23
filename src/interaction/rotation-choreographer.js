const DECAY = 0.95;
const MIN_VELOCITY = 0.001;

function raf(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  return setTimeout(fn, 16);
}

function caf(id) {
  if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame(id);
  clearTimeout(id);
}

export class RotationChoreographer {
  constructor({ onRender, onSelection, maxSpan = Infinity, minRotation = -Infinity, maxRotation = Infinity }) {
    this.visualRotation = 0;
    this.velocity = 0;
    this.onRender = onRender || (() => {});
    this.onSelection = onSelection || (() => {});
    this.rafId = null;
    this.minRotation = Number.isFinite(minRotation) ? minRotation : -Infinity;
    this.maxRotation = Number.isFinite(maxRotation) ? maxRotation : Infinity;
    if (Number.isFinite(maxSpan)) {
      this.minRotation = -maxSpan;
      this.maxRotation = maxSpan;
    }
  }

  getRotation() {
    return this.visualRotation;
  }

  setRotation(value, { emit = true } = {}) {
    this.visualRotation = this.#clamp(value);
    if (emit) this.onRender(this.visualRotation);
  }

  rotate(delta) {
    this.visualRotation = this.#clamp(this.visualRotation + delta);
    this.onRender(this.visualRotation);
  }

  startMomentum(initialVelocity) {
    this.velocity = initialVelocity;
    this.stopMomentum();
    const loop = () => {
      this.velocity *= DECAY;
      if (Math.abs(this.velocity) < MIN_VELOCITY) {
        this.stopMomentum();
        return;
      }
      this.visualRotation = this.#clamp(this.visualRotation + this.velocity);
      this.onRender(this.visualRotation);
      this.rafId = raf(loop);
    };
    this.rafId = raf(loop);
  }

  stopMomentum() {
    if (this.rafId) {
      caf(this.rafId);
      this.rafId = null;
    }
  }

  setBounds(minRotation, maxRotation) {
    if (Number.isFinite(minRotation)) this.minRotation = minRotation;
    if (Number.isFinite(maxRotation)) this.maxRotation = maxRotation;
    this.visualRotation = this.#clamp(this.visualRotation);
  }

  #clamp(value) {
    if (!Number.isFinite(this.minRotation) && !Number.isFinite(this.maxRotation)) return value;
    const min = Number.isFinite(this.minRotation) ? this.minRotation : -Infinity;
    const max = Number.isFinite(this.maxRotation) ? this.maxRotation : Infinity;
    return Math.max(min, Math.min(max, value));
  }
}
