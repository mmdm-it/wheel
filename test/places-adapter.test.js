import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placesAdapter, normalize as normalizePlaces } from '../src/adapters/places-adapter.js';

const sampleManifest = {
  Places: {
    display_config: {
      volume_name: 'Places',
      hierarchy_levels: {
        continent: { color: '#a1a1a1' },
        country: { color: '#b2b2b2' },
        city: { color: '#c3c3c3' }
      }
    },
    root: {
      children: ['NA', 'EU']
    },
    continents: {
      NA: { id: 'NA', name: 'North America', countries: ['US'] },
      EU: { id: 'EU', name: 'Europe', countries: ['DE'] }
    },
    countries: {
      US: { id: 'US', name: 'United States', continent_id: 'NA', cities: ['SEA', 'NYC'] },
      DE: { id: 'DE', name: 'Germany', continent_id: 'EU', cities: ['BER'] }
    },
    cities: {
      SEA: { id: 'SEA', name: 'Seattle', country_id: 'US' },
      NYC: { id: 'NYC', name: 'New York', country_id: 'US' },
      BER: { id: 'BER', name: 'Berlin', country_id: 'DE' }
    }
  }
};

describe('places adapter', () => {
  it('normalizes places manifest into items and links', () => {
    const normalized = normalizePlaces(sampleManifest);
    assert.equal(normalized.meta.volumeId, 'Places');
    assert.equal(normalized.items[0].id, 'volume:Places');
    const continents = normalized.items.filter(i => i.level === 'continent');
    const countries = normalized.items.filter(i => i.level === 'country');
    const cities = normalized.items.filter(i => i.level === 'city');
    assert.equal(continents.length, 2);
    assert.equal(countries.length, 2);
    assert.equal(cities.length, 3);
    assert.ok(normalized.links.find(l => l.to === 'US'));
    assert.ok(normalized.links.find(l => l.to === 'SEA'));
    assert.equal(normalized.meta.colors.city, '#c3c3c3');
  });

  it('builds layout spec with pyramid config', () => {
    const normalized = normalizePlaces(sampleManifest);
    const spec = placesAdapter.layoutSpec(normalized, { width: 800, height: 600 });
    assert.ok(Array.isArray(spec.rings));
    assert.equal(spec.rings.length, 3);
    const pyramid = spec.pyramid;
    assert.ok(pyramid);
    assert.ok(pyramid.capacity);
    assert.equal(typeof pyramid.place, 'function');
  });

  it('emits detail payloads', () => {
    const detail = placesAdapter.detailFor({ id: 'SEA', name: 'Seattle', level: 'city', parentName: 'United States' });
    assert.equal(detail.type, 'card');
    assert.ok(detail.title.includes('Seattle'));
  });
});
