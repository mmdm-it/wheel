import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';

function makeMockElement(tag) {
  const children = [];
  const listeners = {};
  return {
    tag,
    attrs: {},
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    children,
    parentNode: null,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    setAttributeNS(ns, name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(node) { children.push(node); node.parentNode = this; return node; },
    removeChild(node) { const i = children.indexOf(node); if (i >= 0) children.splice(i, 1); node.parentNode = null; },
    remove() { if (this.parentNode?.removeChild) this.parentNode.removeChild(this); },
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatchEvent(event) { const handler = listeners[event.type]; if (handler) handler(event); }
  };
}

function makeMockDocument() {
  return {
    createElementNS(ns, tag) { return makeMockElement(tag); }
  };
}

describe('dimension portals UI', () => {
  const originalDocument = globalThis.document;

  it('cycles language → edition → primary with correct aria labels', () => {
    globalThis.document = makeMockDocument();

    const svgRoot = makeMockElement('svg');
    const items = [
      { id: 'a', name: 'Alpha', order: 0 },
      { id: 'b', name: 'Beta', order: 1 }
    ];
    const viewport = getViewportInfo(800, 600);
    const portalCallbacks = [];
    const telemetry = [];

    const dimensionPortals = {
      languages: {
        items: [
          { id: 'english', name: 'English' },
          { id: 'latin', name: 'Latina' }
        ],
        labels: { english: 'English', latin: 'Latina' },
        defaultId: 'english'
      },
      editions: {
        available: {
          english: ['NAB', 'DRA'],
          latin: ['VUL']
        },
        default: {
          english: 'NAB',
          latin: 'VUL'
        },
        labels: {
          NAB: 'New American Bible',
          DRA: 'Douay-Rheims',
          VUL: 'Clementine Vulgate'
        }
      },
      onSelectLanguage: lang => portalCallbacks.push(`lang:${lang}`),
      onSelectEdition: (edition, ctx) => portalCallbacks.push(`ed:${edition}:${ctx.language}`)
    };

    const app = createApp({
      svgRoot,
      items,
      viewport,
      contextOptions: {
        hasDimensions: true,
        onEvent: payload => telemetry.push(payload)
      },
      dimensionPortals
    });

    const icon = app.view?.dimensionIcon;
    assert.ok(icon, 'dimension icon missing');
    assert.equal(icon.attrs['aria-label'], 'Select language');

    // Click 1: go to language stage
    icon.onclick();
    assert.equal(icon.attrs['aria-label'], 'Select edition');
    const languageNodes = app.view.mirroredNodesGroup.children;
    assert.ok(languageNodes.length >= 2, 'language ring should render nodes');
    assert.ok(telemetry.some(evt => evt.type === 'dimension:stage' && evt.stage === 'language'));

    // Select English language (triggers edition stage)
    languageNodes[0].onclick();
    assert.equal(icon.attrs['aria-label'], 'Select edition for English');
    const editionNodes = app.view.mirroredNodesGroup.children;
    assert.ok(editionNodes.length >= 2);
    assert.ok(telemetry.some(evt => evt.type === 'dimension:language' && evt.language === 'english'));
    assert.ok(telemetry.some(evt => evt.type === 'dimension:stage' && evt.stage === 'edition'));

    // Choose edition via click on first edition node
    editionNodes[0].onclick();
    assert.equal(icon.attrs['aria-label'], 'Select language'); // back to primary
    assert.ok(portalCallbacks.includes('lang:english'));
    assert.ok(portalCallbacks.some(e => e.startsWith('ed:')));
    assert.ok(telemetry.some(evt => evt.type === 'dimension:edition'));
    assert.ok(telemetry.some(evt => evt.type === 'dimension:stage' && evt.stage === 'primary'));

    app.setBlur(false);
    globalThis.document = originalDocument;
  });

  it('supports keyboard activation on dimension control', () => {
    globalThis.document = makeMockDocument();

    const svgRoot = makeMockElement('svg');
    const items = [
      { id: 'a', name: 'Alpha', order: 0 },
      { id: 'b', name: 'Beta', order: 1 }
    ];
    const viewport = getViewportInfo(800, 600);

    const app = createApp({
      svgRoot,
      items,
      viewport,
      contextOptions: { hasDimensions: true },
      dimensionPortals: {
        languages: {
          items: [
            { id: 'english', name: 'English' },
            { id: 'latin', name: 'Latina' }
          ],
          defaultId: 'english'
        },
        editions: {
          available: { english: ['NAB', 'DRA'], latin: ['VUL'] },
          default: { english: 'NAB', latin: 'VUL' }
        }
      }
    });

    const icon = app.view?.dimensionIcon;
    assert.ok(icon, 'dimension icon missing');
    assert.equal(icon.attrs['aria-label'], 'Select language');

    // Enter key should activate toggle and move to language stage (editions available → aria asks for edition)
    let prevented = false;
    icon.onkeydown({ key: 'Enter', preventDefault: () => { prevented = true; } });
    assert.equal(icon.attrs['aria-label'], 'Select edition');
    assert.equal(prevented, true);

    // Space key should continue cycle back toward primary when tertiary exists
    icon.onkeydown({ key: ' ', preventDefault() {} });
    const aria = icon.attrs['aria-label'];
    assert.ok(aria === 'Select edition for English' || aria === 'Select language');

    globalThis.document = originalDocument;
  });
});
