import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { localSunTimes, gregorianDayOfWeek } from '../src/geometry/solar.js';
import { detailFor, primeEphemeris } from '../src/adapters/calendar-adapter.js';
import { detailFor as catalogDetailFor } from '../src/adapters/catalog-adapter.js';
import { DetailPluginRegistry } from '../src/view/detail/plugin-registry.js';
import { EphemerisDetailPlugin } from '../src/view/detail/plugins/ephemeris-plugin.js';
import { CardDetailPlugin } from '../src/view/detail/plugins/card-plugin.js';
import { createMockElement } from './helpers/mock-dom.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = async rel => JSON.parse(await readFile(path.resolve(__dirname, '..', rel), 'utf-8'));

const FANO = { lat: 43.8433, lon: 13.0172 };
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const dev = (a, b) => { const d = Math.abs(hm(a) - hm(b)); return Math.min(d, 1440 - d); };

// The 2026 wall calendar prints wrong sun times on these two days (found by
// this very cross-check, 2026-07-20). The sky is the authority; the app
// computes. They are excluded from the agreement test and asserted as
// misprints below, so the check provably has teeth.
const PRINT_MISPRINTS = ['2026-04-24', '2026-04-25'];

describe('solar engine vs the print edition', () => {
  it('agrees with every printed sunrise/sunset within 6 minutes', async () => {
    const eph = await readJson('data/calendar/ephemeris-2026.json');
    let checked = 0;
    for (const [key, rec] of Object.entries(eph.days)) {
      if (PRINT_MISPRINTS.includes(key)) continue;
      const [y, m, d] = key.split('-').map(Number);
      const sun = localSunTimes(y, m, d, FANO.lat, FANO.lon);
      assert.ok(sun, `no solar events for ${key}`);
      assert.ok(dev(sun.alba, rec.alba) <= 6, `${key} alba: computed ${sun.alba} vs printed ${rec.alba}`);
      assert.ok(dev(sun.tramonto, rec.tramonto) <= 6, `${key} tramonto: computed ${sun.tramonto} vs printed ${rec.tramonto}`);
      checked += 1;
    }
    assert.equal(checked, 363, 'every non-misprint day checked');
  });

  it('detects the known April misprints (the check has teeth)', async () => {
    const eph = await readJson('data/calendar/ephemeris-2026.json');
    for (const key of PRINT_MISPRINTS) {
      const [y, m, d] = key.split('-').map(Number);
      const sun = localSunTimes(y, m, d, FANO.lat, FANO.lon);
      assert.ok(dev(sun.tramonto, eph.days[key].tramonto) > 30,
        `${key} should diverge from the misprinted sunset`);
    }
  });

  it('answers with solar time before the zone era', () => {
    // Pre-1893: local mean solar at Fano (~UTC+52min), no DST ever.
    const summer = localSunTimes(1492, 7, 15, FANO.lat, FANO.lon);
    const modern = localSunTimes(2026, 7, 15, FANO.lat, FANO.lon);
    assert.ok(summer && modern);
    // Modern July runs CEST (UTC+2) ≈ 68 min ahead of Fano solar time.
    const gap = hm(modern.tramonto) - hm(summer.tramonto);
    assert.ok(gap > 40 && gap < 100, `civil vs solar gap ${gap} min`);
  });

  it('weekday arithmetic matches the print (2026-07-20 is Monday)', () => {
    assert.equal(gregorianDayOfWeek(2026, 7, 20), 1);
    assert.equal(gregorianDayOfWeek(2026, 7, 5), 0); // a printed red Sunday
  });
});

describe('calendar day card (the ephemeris payload)', () => {
  let manifest;
  beforeEach(async () => {
    manifest = await readJson('data/calendar/manifest.json');
  });
  afterEach(() => primeEphemeris(null));

  const day = (y, m, d) => ({ id: `d:${y}:${m}:${d}`, level: 'day', yearNumber: y, monthNumber: m, dayNumber: d });

  it('carries weekday title (no date), sun row, and stored tide rows', () => {
    primeEphemeris({
      '2026-07-01': { alba: '5:27', tramonto: '20:55', alta: ['0:26', 0.9], bassa: ['7:01', 0.0], luna: null, festivo: false }
    });
    const payload = detailFor(day(2026, 7, 1), manifest);
    assert.equal(payload.type, 'ephemeris');
    assert.match(payload.title, /^[A-ZÌ]+$/, 'weekday only, uppercase — never the date');
    assert.equal(payload.festivo, false);
    assert.match(payload.rows[0], /^↑ \d{1,2}:\d{2}\s+↓ \d{1,2}:\d{2}$/);
    assert.equal(payload.rows[1], '▲ 0:26  0,9 m');
    assert.equal(payload.rows[2], '▽ 7:01  0,0 m');
  });

  it('marks feasts and names the moon quarter as printed', () => {
    primeEphemeris({
      '2026-08-15': { alba: '6:19', tramonto: '20:19', alta: ['3:00', 0.8], bassa: ['9:00', 0.1], luna: 'nuova', festivo: true }
    });
    const payload = detailFor(day(2026, 8, 15), manifest);
    assert.equal(payload.festivo, true);
    assert.ok(payload.rows.includes('LUNA NUOVA'));
  });

  it('outside the tide window shows the sun and nothing invented', () => {
    const payload = detailFor(day(1582, 10, 15), manifest);
    assert.equal(payload.type, 'ephemeris');
    assert.equal(payload.rows.length, 1, 'sun row only — no tides before the window');
    assert.match(payload.rows[0], /^↑ /);
  });
});

describe('ephemeris plugin and the dossier video', () => {
  const registry = new DetailPluginRegistry();
  registry.register(new CardDetailPlugin());
  registry.register(new EphemerisDetailPlugin());
  const createElement = tag => createMockElement(tag);

  it('renders weekday + rows; feast weekday wears the red class', () => {
    const item = { type: 'ephemeris', title: 'SABATO', titleAlign: 'center', festivo: true, rows: ['↑ 6:19    ↓ 20:19', '▲ 3:00  0,8 m'] };
    const plugin = registry.getPlugin(item);
    assert.equal(plugin.getMetadata().name, 'EphemerisDetailPlugin');
    const el = plugin.render(item, {}, { createElement });
    assert.equal(el.children[0].textContent, 'SABATO');
    assert.ok(el.children[0].className.includes('detail-ephemeris-title--festivo'));
    assert.equal(el.children.length, 3);
  });

  it('the dossier media slot renders a video when the data declares one', () => {
    // The slot is schema'd and dormant (Howell 2026-07-20: the batteau film
    // is recorded in docs/DETAIL_SECTOR_LOADS.md but removed from the data
    // for now). This pins the machinery so the slot works the day an entry
    // returns.
    const payload = { type: 'card', title: null, body: '1910 · 1925', video: 'https://example.test/film.m4v' };
    const plugin = registry.getPlugin(payload);
    const el = plugin.render(payload, {}, { createElement });
    const video = el.children.find(c => c.tag === 'video');
    assert.ok(video, 'card renders a video element');
    assert.equal(video.getAttribute('preload'), 'metadata', 'nothing streams until play');
  });

  it('the Twin 6 HP dossier carries no media for now — and no title, per the redundancy rule', async () => {
    const manifest = await readJson('data/mmdm/mmdm_catalog.json');
    const payload = catalogDetailFor({ id: 'model:Lockwood-Ash:2:Twin 6 HP', name: 'Twin 6 HP' }, manifest);
    assert.equal(payload.type, 'card');
    assert.equal(payload.video, null);
    assert.equal(payload.title, null, 'the magnifier already names the model');
  });
});
