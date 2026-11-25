// THE LITURGICAL YEAR AND THE CATHOLIC CALENDAR (O-341). The arithmetic is
// held against dates anyone can look up; the table of days in these tests is
// a made-up one — the real one is the volume's, in the corpus.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { easter, adventStart, temporalKey, feastKey, kept, liturgicalDay, dayNumber } from '../src/adapters/liturgical-year.js';
import { liturgicalDetailFor, primeLiturgy, feastLines } from '../src/adapters/calendar-adapter.js';
import { EphemerisDetailPlugin } from '../src/view/detail/plugins/ephemeris-plugin.js';
import { portalRecord, renderLandscapePortal } from '../src/view/landscape-portal.js';
import { volumeConfigs, VENUES } from '../src/volume-configs.js';
import { WALL_ADDRESS_KEYS } from '../src/volume-roots.js';
import { createMockElement } from './helpers/mock-dom.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iso = n => new Date(n * 86400000).toISOString().slice(0, 10);

describe('the liturgical year (O-341)', () => {
  it('finds Easter', () => {
    assert.equal(iso(easter(2026)), '2026-04-05');
    assert.equal(iso(easter(2027)), '2027-03-28');
    assert.equal(iso(easter(2038)), '2038-04-25');   // the latest it can fall
    assert.equal(iso(easter(1818)), '1818-03-22');   // the earliest
    assert.equal(iso(easter(1962)), '1962-04-22');
  });

  it('begins Advent on the Sunday nearest St Andrew', () => {
    assert.equal(iso(adventStart(2026)), '2026-11-29');
    assert.equal(iso(adventStart(2027)), '2027-11-28');
    assert.equal(iso(adventStart(2028)), '2028-12-03');
    assert.equal(iso(adventStart(2033)), '2033-11-27');
  });

  it('names the days of the seasons', () => {
    assert.equal(temporalKey(2026, 11, 29), 'Adv1-0');
    assert.equal(temporalKey(2026, 12, 16), 'Adv3-3');
    assert.equal(temporalKey(2026, 12, 27), 'Nat1-0');
    assert.equal(temporalKey(2026, 12, 25), null, 'Christmas is the date\'s own feast');
    assert.equal(temporalKey(2027, 1, 3), 'Nat2-0', 'the Sunday between the 2nd and the 5th');
    assert.equal(temporalKey(2027, 1, 6), null);
    assert.equal(temporalKey(2027, 1, 10), 'Epi1-0');
    assert.equal(temporalKey(2027, 1, 24), 'Quadp1-0', 'Septuagesima, nine weeks before Easter');
    assert.equal(temporalKey(2027, 2, 10), 'Quadp3-3', 'Ash Wednesday');
    assert.equal(temporalKey(2027, 2, 14), 'Quad1-0');
    assert.equal(temporalKey(2027, 3, 21), 'Quad6-0', 'Palm Sunday');
    assert.equal(temporalKey(2027, 3, 26), 'Quad6-5', 'Good Friday');
    assert.equal(temporalKey(2027, 3, 28), 'Pasc0-0');
    assert.equal(temporalKey(2027, 5, 6), 'Pasc5-4', 'the Ascension, a Thursday');
    assert.equal(temporalKey(2027, 5, 16), 'Pasc7-0', 'Pentecost');
    assert.equal(temporalKey(2027, 5, 23), 'Pent01-0', 'Trinity');
    assert.equal(temporalKey(2027, 5, 27), 'Pent01-4', 'Corpus Christi');
  });

  it('closes the year: Christ the King, the Sundays taken up again, the last Sunday', () => {
    assert.equal(temporalKey(2026, 10, 25), '10-DU');
    assert.equal(temporalKey(2027, 10, 31), '10-DU');
    assert.equal(temporalKey(2026, 11, 22), 'Pent24-0', 'the Sunday before Advent is always the last');
    assert.equal(temporalKey(2026, 11, 15), 'PentEpi6-0', 'and the one before it the sixth after Epiphany');
    assert.equal(temporalKey(2026, 11, 8), 'PentEpi5-0');
    // Easter at its latest leaves twenty-three Sundays: the twenty-third is the last.
    assert.equal(temporalKey(2038, 11, 21), 'Pent24-0');
    assert.equal(temporalKey(2038, 11, 14), 'Pent22-0');
  });

  it('reckons nothing before the Gregorian Easter', () => {
    assert.equal(temporalKey(1500, 4, 1), null);
    assert.equal(liturgicalDay({ tempora: {}, sancti: {} }, 1500, 4, 1), null);
  });

  it('says which of the season\'s day and the feast the day keeps', () => {
    const sunday1 = { rank: 6.9 }, sunday2 = { rank: 5 }, feria = { rank: 1 }, lent = { rank: 3.9 };
    const first = { rank: 6 }, second = { rank: 5 }, third = { rank: 3 }, lord = { rank: 5.1, lord: true }, great = { rank: 7 };
    assert.equal(kept(sunday1, first, { sunday: true }), sunday1, 'a Sunday of the first class keeps itself');
    assert.equal(kept(sunday1, { rank: 6.5, overAdvent: true }, { sunday: true, advent: true }).overAdvent, true, 'but for the feast that is over Advent');
    assert.equal(kept(sunday1, great, { sunday: true }), great);
    assert.equal(kept(sunday2, first, { sunday: true }), first);
    assert.equal(kept(sunday2, second, { sunday: true }), sunday2);
    assert.equal(kept(sunday2, lord, { sunday: true }), lord, 'a feast of the Lord takes a Sunday of the second class');
    assert.equal(kept(feria, third), third);
    assert.equal(kept(lent, third), lent, 'a weekday of Lent outranks a feast of the third class');
    assert.equal(kept(null, third), third);
    assert.equal(kept(feria, null), feria);
  });

  const TABLE = {
    tempora: {
      'Adv1-0': { name: { english: 'A Sunday' }, rank: 6.9, gospel: 'Somewhere 1:1', u: 'uaaaa' },
      'Adv1-1': { name: { english: 'A Monday' }, rank: 2.1, gospel: 'Somewhere 1:1', u: 'uaaaa' }
    },
    sancti: {
      '11-30': { name: { latin: 'Festum', english: 'A feast with a name long enough to need two lines' }, rank: 5, gospel: 'Elsewhere 4:18', u: 'ubbbb' }
    }
  };

  it('reads a day off the volume\'s table', () => {
    assert.equal(feastKey(3, 9), '03-09');
    assert.equal(liturgicalDay(TABLE, 2026, 11, 29).key, 'Adv1-0');
    const andrew = liturgicalDay(TABLE, 2026, 11, 30);
    assert.equal(andrew.key, '11-30');
    assert.equal(andrew.other, TABLE.tempora['Adv1-1'], 'what the day leaves is kept beside it');
    // A day the table does not name says the nearest named day before it again.
    const tuesday = liturgicalDay(TABLE, 2026, 12, 1);
    assert.equal(tuesday.key, '11-30');
    assert.equal(tuesday.feria, true);
    assert.equal(dayNumber(1970, 1, 1), 0);
  });

  it('the day\'s card: no tables, no drawing, the feast and its verse as a door into the Bible', () => {
    const manifest = { Calendar: { weekday_template: { sun: { name: 'Sunday', weekday_number: 0 }, mon: { name: 'Monday', weekday_number: 1 }, tue: { name: 'Tuesday', weekday_number: 2 }, wed: { name: 'Wednesday', weekday_number: 3 }, thu: { name: 'Thursday', weekday_number: 4 }, fri: { name: 'Friday', weekday_number: 5 }, sat: { name: 'Saturday', weekday_number: 6 } } } };
    primeLiturgy(TABLE);
    try {
      const card = liturgicalDetailFor({ id: 'd:2026:11:30', level: 'day' }, manifest);
      assert.equal(card.type, 'ephemeris');
      assert.equal(card.title, 'MONDAY');
      assert.deepEqual(card.tables, []);
      assert.equal(card.figure, null);
      assert.ok(card.feast.length >= 2 && card.feast.every(line => line.length <= 22), 'the name is set on short lines');
      assert.equal(card.feast.join(' '), 'A feast with a name long enough to need two lines');
      assert.deepEqual(card.link, { text: 'Elsewhere 4:18', href: './?volume=bible&utterance=ubbbb' });
      // A level above the day is the calendar's own card, untouched.
      assert.equal(liturgicalDetailFor({ id: '2026', level: 'year', yearNumber: 2026 }, manifest).type, 'card');
      primeLiturgy(null);
      const bare = liturgicalDetailFor({ id: 'd:2026:11:30', level: 'day' }, manifest);
      assert.deepEqual(bare.feast, []);
      assert.equal(bare.link, null, 'before the table lands the card is the weekday alone');
    } finally {
      primeLiturgy(null);
    }
    assert.deepEqual(feastLines('One two'), ['One two']);
  });

  it('the card draws the verse as a link, and a card with no tables draws no empty lines', () => {
    const plugin = new EphemerisDetailPlugin();
    const lineTable = Array.from({ length: 30 }, (_, i) => ({ y: i * 20, leftX: 40, availableWidth: 280, rightX: 320 }));
    const node = plugin.render(
      { type: 'ephemeris', title: 'MONDAY', rows: [], tables: [], figure: null, feast: ['A feast', 'of two lines'], link: { text: 'Elsewhere 4:18', href: './?volume=bible&utterance=ubbbb' } },
      { lineTable, width: 360, SSd: 650 },
      { createElement: tag => createMockElement(tag) }
    );
    const kids = node.children;
    assert.equal(kids.filter(k => /detail-ephemeris-feast/.test(k.className)).length, 2);
    const link = kids.find(k => /detail-ephemeris-link/.test(k.className));
    assert.equal(link.tag, 'a');
    assert.equal(link.getAttribute('href'), './?volume=bible&utterance=ubbbb');
    assert.equal(link.textContent, 'Elsewhere 4:18');
    assert.equal(kids.filter(k => /detail-ephemeris-table/.test(k.className)).length, 0);
  });
});

describe('the Catholic calendar as a volume (O-341)', () => {
  it('is the calendar\'s reader at a second data root, without the company\'s name or its app file', () => {
    const c = volumeConfigs.calendarium;
    assert.equal(c.id, 'calendarium');
    assert.equal(c.manifestPath, './data/calendarium/manifest.json');
    assert.equal(c.assetBase, './data/calendarium/');
    assert.equal(c.documentTitle, 'Calendarium Catholicum');
    assert.equal(c.webManifest, undefined);
    assert.equal(c.homeIcon, undefined);
    assert.deepEqual(c.palette, volumeConfigs.calendar.palette, 'the colours are the calendar\'s own');
    assert.equal(JSON.stringify(c.landscape).toLowerCase().includes('mmdm'), false);
    // The company's calendar is untouched: a copy, not a move.
    assert.equal(volumeConfigs.calendar.manifestPath, './data/calendar/manifest.json');
    assert.equal(volumeConfigs.calendar.documentTitle, 'Meccanismi Marittimi delle Marche');
    assert.equal(volumeConfigs.calendar.landscape.emblem.image, 'mmdm_logo');
  });

  it('the Bible\'s sideways page has a door to it under the name, and its own page a door back', () => {
    const SQUARE = { hostname: 'bibliacatholica.com', pathname: '/', protocol: 'https:' };
    const LAN = { hostname: '192.168.88.167', pathname: '/', protocol: 'http:' };
    const root = { display_config: { splash: { title: 'Biblia Catholica' }, detail_sector: { logo_base_path: 'assets/' }, landscape: { info: { default: 'info' }, corrections: { default: 'corrections' }, doors: { calendarium: { image: 'calendarium_door' } } } } };
    const r = portalRecord({ volume: 'bible', config: volumeConfigs.bible, root, lang: 'english', loc: SQUARE, table: VENUES });
    assert.equal(r.link, null, 'no door to the company\'s calendar (O-339)');
    assert.equal(r.doors.length, 1);
    assert.equal(r.doors[0].href, './?volume=calendarium');
    assert.match(r.doors[0].imageUrl, /assets\/calendarium_door\.png$/, 'the picture is the one the volume names (W-114)');
    assert.equal(portalRecord({ volume: 'bible', config: volumeConfigs.bible, root, lang: 'english', loc: LAN, table: VENUES }).doors[0].href, '/?volume=calendarium');
    // Drawn under the name (Howell, the same day, on the first photograph).
    const sheet = createMockElement('div');
    const doc = { createElement: tag => createMockElement(tag) };
    assert.equal(renderLandscapePortal(sheet, r, doc), true);
    const body = sheet.children[0].children[0];
    assert.equal(body.children[0].className, 'portal-title');
    assert.equal(body.children[1].className, 'portal-doors portal-doors--below');
    assert.equal(body.children[1].children[0].getAttribute('href'), './?volume=calendarium');
    assert.equal(r.mailsCorners, true, 'and the mail words go to the lower corners');
    // And back.
    const back = portalRecord({ volume: 'calendarium', config: volumeConfigs.calendarium, root: { display_config: { splash: { title: 'Calendarium\nCatholicum' }, landscape: { info: { default: 'info' }, door: { image: 'crown_of_thorns' } } } }, lang: 'english', loc: SQUARE, table: VENUES });
    assert.equal(back.link.href, './?volume=bible');
    assert.equal(back.link.corner, true);
    assert.deepEqual(back.doors, []);
  });

  it('the Bible opens at a verse named by its utterance on the address', () => {
    assert.ok(WALL_ADDRESS_KEYS.includes('utterance'), 'the early loader leaves such an address to the app');
    const options = volumeConfigs.bible.buildOptions({ params: new URLSearchParams('volume=bible&utterance=u123'), root: { display_config: { boot: { first_visit: [{ utterance: 'u999' }] } } }, memory: { itemId: 'b1_2_3' } });
    assert.equal(options.addressedUtterance, 'u123');
    assert.deepEqual(options.firstVisit, ['u999'], 'the volume\'s own first visit is not rewritten');
    assert.equal(options.bookId, null, 'and the remembered verse does not outrank the address');
    assert.equal(volumeConfigs.bible.buildOptions({ params: new URLSearchParams('volume=bible'), root: null }).addressedUtterance, null);
  });

  it('the page for a turned phone has a style for the row of doors, and the card for its link', async () => {
    const css = await fs.readFile(path.join(repoRoot, 'styles/base.css'), 'utf8');
    assert.match(css, /\.portal-doors \{/);
    assert.match(css, /\.detail-ephemeris-link \{[^}]*pointer-events: auto/);
  });
});
