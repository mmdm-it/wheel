import { BaseDetailPlugin } from '../plugin-registry.js';

export class CardDetailPlugin extends BaseDetailPlugin {
  canHandle(item) {
    return item?.type === 'card' || (item && item.title && item.body);
  }

  render(item, bounds = {}, options = {}) {
    const create = options.createElement || (typeof document !== 'undefined' ? document.createElement.bind(document) : null);
    if (!create) throw new Error('CardDetailPlugin.render: no createElement available');

    const card = create('div');
    card.className = 'detail-sector-content detail-card';

    const title = create('div');
    title.className = 'detail-card-title';
    title.textContent = item?.title ?? item?.name ?? '';

    const body = create('div');
    body.className = 'detail-card-body';
    body.textContent = item?.body ?? item?.text ?? '';

    if (item?.image) {
      const img = create('img');
      img.className = 'detail-card-image';
      img.alt = item?.title ?? item?.name ?? '';
      img.src = item.image;
      card.appendChild(img);
    }

    card.appendChild(title);
    card.appendChild(body);

    if (card.style) {
      if (bounds?.width) card.style.maxWidth = `${bounds.width}px`;
      if (bounds?.height) card.style.maxHeight = `${bounds.height}px`;
    }

    return card;
  }

  getMetadata() {
    return { name: 'CardDetailPlugin', version: '1.0.0', contentTypes: ['card'] };
  }
}
