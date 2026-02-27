/**
 * Canonical mock DOM helpers shared across all test files.
 * Using a single implementation prevents the class of failures where
 * different test files have slightly different mock shapes, causing
 * "Cannot read properties of undefined" errors when production code
 * traverses node trees expecting real DOM semantics.
 */

export function createMockElement(tag) {
  const children = [];
  const listeners = {};
  const element = {
    tag,
    attrs: {},
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    parentNode: null,
    textContent: '',
    onclick: null,
    onkeydown: null,
    get children() { return children; },
    get firstChild() { return children[0] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    setAttributeNS(ns, name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    appendChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) children.splice(idx, 1);
      children.push(node);
      node.parentNode = this;
      return node;
    },
    removeChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) { children.splice(idx, 1); node.parentNode = null; }
    },
    remove() { this.parentNode?.removeChild?.(this); },
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatchEvent(event) { listeners[event.type]?.(event); }
  };
  return element;
}

export function createMockDocument() {
  return {
    createElementNS(ns, tag) { return createMockElement(tag); }
  };
}
