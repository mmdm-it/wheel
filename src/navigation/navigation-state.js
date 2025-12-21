export class NavigationState {
  constructor(items = []) {
    this.items = items;
    this.currentIndex = 0;
    this.observers = new Set();
  }

  setItems(items, selectedIndex = 0) {
    if (!Array.isArray(items)) {
      throw new Error('NavigationState.setItems: items must be an array');
    }
    this.items = items;
    this.currentIndex = Math.max(0, Math.min(selectedIndex, Math.max(items.length - 1, 0)));
    this.notify({ type: 'reset', index: this.currentIndex, item: this.items[this.currentIndex] });
  }

  getCurrent() {
    return this.items[this.currentIndex];
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  selectIndex(index) {
    if (index < 0 || index >= this.items.length) return;
    const prev = this.currentIndex;
    if (prev === index) return;
    this.currentIndex = index;
    this.notify({ type: 'select', from: prev, to: index, item: this.items[index] });
  }

  selectOffset(delta) {
    if (!delta) return;
    const next = this.wrapIndex(this.currentIndex + delta);
    this.selectIndex(next);
  }

  wrapIndex(index) {
    if (this.items.length === 0) return 0;
    const mod = ((index % this.items.length) + this.items.length) % this.items.length;
    return mod;
  }

  onChange(fn) {
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }

  notify(event) {
    this.observers.forEach(fn => fn(event));
  }
}
