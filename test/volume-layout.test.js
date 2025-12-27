import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createVolumeLayoutSpec } from '../src/adapters/volume-layout.js';

const commonArgs = {
  manifest: {},
  buildPlacesLevel: () => ({}),
  placesChildrenHandler: () => {},
  getCatalogChildren: () => [],
  getCalendarMonths: () => [],
  getBibleChapters: () => [],
  getApp: () => ({})
};

describe('createVolumeLayoutSpec', () => {
  it('returns empty object when no pyramid config is available', () => {
    const spec = createVolumeLayoutSpec({ volume: 'unknown', ...commonArgs });
    assert.deepEqual(spec, {});
  });

  it('builds pyramid config for catalog volume', () => {
    let catalogMode = 'manufacturer';
    const spec = createVolumeLayoutSpec({
      volume: 'catalog',
      ...commonArgs,
      catalogModeRef: () => catalogMode,
      setCatalogMode: next => { catalogMode = next; }
    });
    assert.ok(spec.pyramid);
    assert.equal(typeof spec.pyramid.getChildren, 'function');
    assert.equal(typeof spec.pyramid.onClick, 'function');
  });

  it('builds pyramid config for bible volume', () => {
    let bibleMode = 'book';
    const spec = createVolumeLayoutSpec({
      volume: 'bible',
      namesMap: {},
      ...commonArgs,
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: () => {}
    });
    assert.ok(spec.pyramid);
  });
});
