// THE CHART PACK'S READER (W-307): a pack unpacks to the charts the engine has
// always been handed, and the loader reads the pack before the bundle.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpackCharts, unpackChart, isChartPack, unitSeatingUtterance } from '../src/adapters/chart-pack.js';
import { loadBibleVolume } from '../src/adapters/bible-volume.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// THE WORKED EXAMPLE, pinned here and in the corpus's suite so the writer and
// the reader cannot drift: this string is what the corpus's writer makes of
// the chart below it.
const PACKED = '{"edition":"EX","pack":1,"charts":{"bexample":{"shards":["bshard"],"groups":[{"label":"1","from":1,"to":3},{"label":"2","from":4,"to":6}],"labels":[[1,3],[1,1],"2a",[3,1]],"b":"AAAAAQAAAAL/////CgsMDRAgMEDerb7v","n":{"3":2,"4":0},"x":{"5":{"absent":true}}}}}';
const CHART = {
  book: 'bexample', edition: 'EX', shards: ['bshard'],
  groups: [{ label: '1', from: 1, to: 3 }, { label: '2', from: 4, to: 6 }],
  seats: [
    { label: '1', utterances: ['u00000001'] }, { label: '2', utterances: ['u00000002'] }, { label: '3', utterances: ['uffffffff'] },
    { label: '1', utterances: ['u0a0b0c0d', 'u10203040'] }, { label: '2a', utterances: [] }, { label: '3', utterances: ['udeadbeef'], absent: true }
  ]
};

describe('a chart pack unpacks to the charts it was made from (W-307)', () => {
  it('the worked example: runs of labels, a seat of two, a seat of none, a seat with a key of its own', () => {
    assert.deepStrictEqual(unpackCharts(JSON.parse(PACKED)), { bexample: CHART });
  });
  it('a chart carried whole comes back as it went', () => {
    const odd = { book: 'b', edition: 'EX', seats: [{ label: '1', utterances: ['not-an-id'] }] };
    assert.deepStrictEqual(unpackCharts({ edition: 'EX', pack: 1, charts: { b: { whole: odd } } }), { b: odd });
  });
  it('what is not a pack is not unpacked, and a pack that miscounts its utterances is refused', () => {
    assert.equal(unpackCharts({ edition: 'EX', charts: {} }), null);
    assert.equal(isChartPack({ edition: 'EX', pack: 2, charts: {} }), false);
    assert.throws(() => unpackChart('b', 'EX', { labels: [[1, 2]], b: 'AAAAAQ==' }));
  });
  it('which unit seats an utterance is answered from the pack itself', () => {
    const pack = JSON.parse(PACKED);
    assert.equal(unitSeatingUtterance(pack, 'u10203040'), 'bexample');
    assert.equal(unitSeatingUtterance(pack, 'u00000003'), null);
    // The same four bytes straddling two ids are not an id: 00 00 02 ff.
    assert.equal(unitSeatingUtterance(pack, 'u000002ff'), null);
  });
});

describe('the loader reads the pack first and the bundle where there is none (W-307)', () => {
  const BASE = path.join(root, 'test/fixtures/h11/gutenberg');
  const VERSION = 'v1';
  const disk = async p => JSON.parse(readFileSync(p, 'utf8'));
  const PACK = path.join(BASE, VERSION, 'charts', 'DRA', 'pack', 'all.json');
  const BUNDLE = path.join(BASE, VERSION, 'charts', 'DRA', 'all.json');
  it('with no pack in the corpus the bundle is read, and the charts are the bundle\'s', async () => {
    const touched = [];
    const volume = await loadBibleVolume({ base: BASE, version: VERSION, firstEdition: 'DRA', fetchJson: async p => { touched.push(p); return disk(p); } });
    assert.ok(touched.indexOf(PACK) >= 0, 'the pack is asked for');
    assert.ok(touched.indexOf(PACK) < touched.indexOf(BUNDLE), 'before the bundle');
    assert.equal(volume.chartFor('bdra9e1', 'DRA')?.seats.length, 31);
  });
  it('with a pack the bundle is never asked for, and the charts are the same', async () => {
    const bundle = await disk(BUNDLE);
    // The fixture's ids are shorter than the corpus's eight digits, which the
    // writer would carry whole; they are widened here so the short form is
    // what the loader is handed.
    for (const chart of Object.values(bundle.charts)) for (const seat of chart.seats) seat.utterances = seat.utterances.map(u => `u${u.slice(1).padStart(8, '0')}`);
    // Packed here the way the corpus's writer does it, by hand for one edition.
    const packed = { edition: 'DRA', pack: 1, charts: {} };
    for (const [book, chart] of Object.entries(bundle.charts)) {
      const { seats, _labels, book: _b, edition: _e, ...rest } = chart;
      packed.charts[book] = { ...rest, labels: seats.map(s => s.label), b: Buffer.from(seats.flatMap(s => s.utterances).map(u => u.slice(1)).join(''), 'hex').toString('base64') };
      const odd = seats.map((s, i) => [i, s.utterances.length]).filter(([, c]) => c !== 1);
      if (odd.length) packed.charts[book].n = Object.fromEntries(odd);
    }
    const touched = [];
    const volume = await loadBibleVolume({
      base: BASE, version: VERSION, firstEdition: 'DRA',
      fetchJson: async p => { touched.push(p); return p === PACK ? packed : disk(p); }
    });
    assert.ok(!touched.includes(BUNDLE), 'the bundle stays on the shelf');
    for (const [book, chart] of Object.entries(bundle.charts)) {
      assert.deepStrictEqual(volume.chartFor(book, 'DRA').seats, chart.seats, book);
      assert.deepStrictEqual(volume.chartFor(book, 'DRA').groups, chart.groups, book);
    }
  });
});
