// THE PAGE THAT IS NOT THERE (O-290, Howell 2026-11-11: "We need a clever 404
// page for both sites"). One file, served by Apache at any path, reading its
// door off the hostname: the scripture volume's public address gets the lost
// sheep of the Psalter, FETCHED from the served Latin so the words never sit
// in this public repository; every other door gets the ten days Gregory XIII
// struck from October 1582 — Thursday the 4th, then Friday the 15th.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('the error page stands at the root, Apache serves it for every missing address, and it keeps the 404', () => {
  const ht = read('.htaccess');
  assert.match(ht, /^ErrorDocument 404 \/404\.html$/m, 'root-absolute, so it is the same page at any path');
  assert.ok(fs.existsSync(path.join(here, '..', '404.html')));
});

test('one page, two doors, chosen by the hostname; every address in it root-absolute', () => {
  const html = read('404.html');
  assert.match(html, /body\[data-door="book"\] \.book, body\[data-door="days"\] \.days \{ display: block; \}/);
  assert.match(html, /bibliacatholica\\\.\(com\|org\|net\)\$\/\.test\(host\)/, 'the scripture volume’s public address');
  assert.match(html, /\\\/bible\(\\\/\|\$\)\/\.test\(path\)/, 'and the room’s door by its path word');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    assert.ok(u === '/' || u.startsWith('/'), `${u}: every address root-absolute (an error page is served at any path)`);
  }
  for (const m of html.matchAll(/url\('([^']+)'\)/g)) assert.ok(m[1].startsWith('/assets/'), `${m[1]}: fonts from the root`);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('the Psalter’s verse is fetched from the served Latin, never written here (WF-14)', () => {
  const html = read('404.html');
  assert.match(html, /\/data\/gutenberg\/2026\.08\.22\/text\/1592lat\/bc0f0d278\.json/, 'the Psalter’s shard in the served volume');
  assert.match(html, /j\.text\['118:176'\]/, 'Psalm 118:176 by address');
  assert.doesNotMatch(html, /Erravi|ovis|quære|periit/i, 'no word of the verse in the public tree');
  assert.match(html, /Psalmus CXVIII, 176/, 'the address is shown, for the reader who wants the rest');
  assert.match(html, /CDIV/, 'four hundred and four, as the Psalter would number it');
});

test('October 1582 as Rome lived it: Monday the 1st, Thursday the 4th, then Friday the 15th; the ten days struck', () => {
  const html = read('404.html');
  const grid = html.slice(html.indexOf('<div class="grid">'), html.indexOf('</div>', html.indexOf('<div class="grid">')));
  const cells = [...grid.matchAll(/<span(?: class="([^"]*)")?>([^<]*)<\/span>/g)].map(m => ({ cls: m[1] || '', t: m[2] }));
  assert.deepEqual(cells.slice(0, 7).map(c => c.t), ['L', 'M', 'M', 'G', 'V', 'S', 'D'], 'the week begins on Monday, as Italy’s does');
  const days = cells.slice(7).map(c => c.t);
  assert.deepEqual(days, ['1', '2', '3', '4', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31']);
  assert.equal(cells[7 + 3].cls, 'seam'); assert.equal(cells[7 + 4].cls, 'seam');   // Thursday 4, Friday 15
  const struck = html.slice(html.indexOf('<div class="struck"'), html.indexOf('<em>', html.indexOf('<div class="struck"')));
  assert.deepEqual([...struck.matchAll(/<span>(\d+)<\/span>/g)].map(m => m[1]), ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14']);
});
