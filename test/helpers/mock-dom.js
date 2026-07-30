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
    // A style object that also answers the CSSStyleDeclaration METHODS the app
    // uses (custom properties travel through setProperty). Defined
    // non-enumerably so suites that inspect `style` as a plain bag of values
    // — checking fills and font sizes — see exactly what they always did.
    style: (() => {
      const s = {};
      Object.defineProperties(s, {
        setProperty: { value(name, value) { s[name] = value; } },
        getPropertyValue: { value(name) { return s[name] ?? ''; } },
        removeProperty: { value(name) { delete s[name]; } }
      });
      return s;
    })(),
    dataset: {},
    classList: (() => {
      const set = new Set();
      return {
        toggle(name, force) {
          const want = force === undefined ? !set.has(name) : Boolean(force);
          if (want) set.add(name); else set.delete(name);
          return want;
        },
        add(name) { set.add(name); },
        remove(name) { set.delete(name); },
        contains(name) { return set.has(name); }
      };
    })(),
    parentNode: null,
    textContent: '',
    onclick: null,
    onkeydown: null,
    get children() { return children; },
    // Real elements expose both; boot's teardown walks childNodes, and its
    // absence made the mock look like an element with no node list at all
    // (found while building the boot smoke test, 2026-07-30).
    get childNodes() { return children; },
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
    insertBefore(node, ref) {
      const idx = children.indexOf(node);
      if (idx >= 0) children.splice(idx, 1);
      const at = ref ? children.indexOf(ref) : -1;
      if (at >= 0) children.splice(at, 0, node); else children.push(node);
      node.parentNode = this;
      return node;
    },
    contains(node) { return children.includes(node); },
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; },
    getBBox() { return { x: 0, y: 0, width: 0, height: 0 }; },
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
