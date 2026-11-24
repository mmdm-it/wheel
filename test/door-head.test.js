// THE DOOR'S OWN HEAD (2026-11-10): the page a stranger's browser, a crawler
// and a share card read at the Bible's public address introduces Biblia
// Catholica, not the catalog whose head the shared index.html carries; the
// root of mmdm.it keeps its own; and the ground script knows both public
// doors by address, so a first visit paints the right ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stampHead, HEADS, GATE_WORDS } from '../scripts/stamp-door-head.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the public door\'s page introduces Biblia Catholica, not the catalog', () => {
  const out = stampHead(read('index.html'), 'public');
  const head = out.slice(0, out.indexOf('</head>'));
  assert.match(head, /<html lang="la"/);
  assert.match(head, /<title>Biblia Catholica<\/title>/);
  assert.match(head, /<link rel="canonical" href="https:\/\/bibliacatholica\.com\/" \/>/);
  assert.match(head, /<meta property="og:url" content="https:\/\/bibliacatholica\.com\/" \/>/);
  assert.match(head, /<meta property="og:title" content="Biblia Catholica" \/>/);
  assert.match(head, /<meta property="og:site_name" content="Biblia Catholica" \/>/);
  assert.match(head, new RegExp(`<meta name="description" content="${HEADS.public.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" />`));
  assert.doesNotMatch(head, /name="keywords"|name="author"|og:locale/);
  assert.doesNotMatch(head, /Meccanismi|collettor|="https:\/\/mmdm\.it\/"/);
  assert.equal(out.indexOf('<title>'), out.lastIndexOf('<title>'), 'one title');
  // the body a crawler reads without script, and the desk's gate
  const body = out.slice(out.indexOf('<body>'));
  assert.match(body, /<noscript>\s*<h1>Biblia Catholica<\/h1>/);
  assert.match(body, /<p class="desktop-gate-title">BIBLIA CATHOLICA<\/p>/);
  assert.match(body, /<p class="desktop-gate-mail"><a href="mailto:info@bibliacatholica\.com">info@bibliacatholica\.com<\/a> &nbsp;&middot;&nbsp; <a href="mailto:corrections@bibliacatholica\.com">corrections@bibliacatholica\.com<\/a><\/p>/, 'both addresses, info first');
  assert.match(body, /<p class="desktop-gate-copyright">© 2026 Howell Gibbens\. All rights reserved\.<\/p>/, 'O-339: the card carries the copyright in his name');
  // O-321: the door's own QR, drawn in the page, and the gate's two lines in the visitor's tongue
  assert.doesNotMatch(body, /qr\.png/, 'the catalog\'s QR does not stand at the Bible\'s door');
  assert.match(body, /<svg class="desktop-gate-qr"[^>]*aria-label="QR: bibliacatholica\.com"/);
  assert.match(body, /<div id="desktop-gate" style="background: #d4a574"/, 'the card stands on the volume\'s sepia');
  assert.match(body, /<svg class="desktop-gate-qr"[^>]*>\s*<rect[^>]*fill="#d4a574"\/>/, 'and so does the code');
  assert.doesNotMatch(body, /fill="#fff"/);
  assert.match(body, /<p class="desktop-gate-title">BIBLIA CATHOLICA<\/p>\s*<p class="desktop-gate-about">A free reader of the Bible and the Roman Catholic catechism<\/p>/, 'what it is, under its name');
  assert.match(body, /<p class="desktop-gate-text">MADE FOR THE PHONE<\/p>/);
  assert.match(body, /<p class="desktop-gate-sub">Scan the code with your phone to open it<\/p>/);
  const script = /<script id="wheel:gate-words">([\s\S]*?)<\/script>/.exec(body);
  assert.ok(script && body.indexOf(script[0]) > body.indexOf('desktop-gate-mail'), 'the words follow the gate they change');
  const say = languages => {
    const node = () => ({ textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
    const about = node(), text = node(), sub = node();
    const gate = { ...node(), querySelector: sel => ({ '.desktop-gate-about': about, '.desktop-gate-text': text, '.desktop-gate-sub': sub })[sel] };
    new Function('navigator', 'document', script[1])({ languages }, { getElementById: () => gate });
    return [about.textContent, text.textContent, sub.textContent, about.attrs.dir || ''];
  };
  assert.deepEqual(say(['fi-FI', 'en']), ['Maksuton Raamatun ja roomalaiskatolisen katekismuksen lukusovellus', 'TEHTY PUHELIMELLE', 'Avaa se skannaamalla koodi puhelimellasi', '']);
  assert.deepEqual(say(['en-US', 'fi']), ['', '', '', ''], 'English first keeps the page\'s own words');
  assert.equal(say(['ja', 'it-IT'])[1], 'FATTO PER IL TELEFONO', 'the first language the table knows');
  assert.equal(say(['ar'])[3], 'rtl');
  assert.deepEqual(say(['ja']), ['', '', '', ''], 'an unknown tongue keeps the English');
  for (const [k, w] of Object.entries(GATE_WORDS)) assert.ok(w.slice(0, 3).every(x => typeof x === 'string' && x.length > 5), `${k} says all three lines`);
  assert.doesNotMatch(body, /Meccanismi|MMdM|collettor|mmdm\.it|Tutti i diritti/);
  assert.match(body, /<div id="copyright-notice" class="copyright-notice" aria-label="Copyright"><\/div>/);
});

test('the root keeps the page\'s own head', () => {
  const html = read('index.html');
  assert.equal(stampHead(html, 'root'), html);
});

test('the mirror stamps the public door\'s page and protects the room under the root', () => {
  const sh = read('scripts/mirror-room.sh');
  assert.match(sh, /node scripts\/stamp-door-head\.mjs public index\.html/);
  assert.match(sh, /ROOT_REMOTE="\$\{ROOT_REMOTE:-namecheap:~\/public_html\/mmdm\}"/);
  assert.match(sh, /\[\[ "\$door" == root \]\] && KEEP\+=\(--exclude='wheel-v3\/' --filter='P wheel-v3\/' --exclude='manifest\.webmanifest'\)/);
  assert.match(sh, /root\) echo "https:\/\/mmdm\.it\/"/);
  // the calendar's data leaves without the corpus's notes, by either door
  assert.match(sh, /node scripts\/scrub-notes\.mjs data\/calendar "\$WORK\/calendar"/);
  assert.match(sh, /rsync -azc -i --delete "\$\{DRY\[@\]\}" "\$WORK\/calendar\/" "\$\{DEST\}data\/calendar\/"/);
});

test('the ground script knows the public doors by address', () => {
  const html = read('index.html');
  const ground = html.slice(html.indexOf('id="wheel:ground"'), html.indexOf('</script>', html.indexOf('id="wheel:ground"')));
  assert.match(ground, /'bibliacatholica\.com': 'bible'/);
  assert.match(ground, /'www\.bibliacatholica\.com': 'bible'/);
  assert.match(ground, /'mmdm\.it': 'calendar'/);
  assert.match(ground, /'www\.mmdm\.it': 'calendar'/);
  // the path's word still speaks first: the room's bible door on mmdm.it
  assert.ok(ground.indexOf("p.indexOf('/' + k)") < ground.indexOf('doors['), 'path before address');
  assert.ok(ground.indexOf('doors[') < ground.indexOf("localStorage.getItem('wheel:last-volume')"), 'address before memory');
});
