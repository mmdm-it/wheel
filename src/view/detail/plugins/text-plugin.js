import { BaseDetailPlugin } from '../plugin-registry.js';

export class TextDetailPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'text' || typeof item?.text === 'string';
  }

  render(item, bounds = {}, options = {}) {
    const create = options.createElement || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
    if (!create) throw new Error('TextDetailPlugin.render: no createElement available');

    const container = create('div');
    container.className = 'detail-sector-content detail-text';
    const text = item?.text ?? item?.name ?? '';
    container.textContent = text;
    if (container.style) {
      if (bounds?.width) container.style.maxWidth = `${bounds.width}px`;
      if (bounds?.height) container.style.maxHeight = `${bounds.height}px`;
    }
    return container;
  }

  getMetadata() {
    return { name: 'TextDetailPlugin', version: '1.0.0', contentTypes: ['text'] };
  }
}
