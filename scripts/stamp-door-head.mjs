#!/usr/bin/env node
// THE DOOR'S OWN HEAD (2026-11-10, the day the public doors opened). One
// index.html serves every door, and its static head — the title, the
// description, the link-preview tags, the canonical address — was the
// catalog's, written for the root of mmdm.it. The app retitles the tab once
// it runs, but a crawler, a share card and the tab before the bundle arrives
// read the static head, and Leicester Square must not introduce the Bible
// as a marine exhaust manifold. The room's mirror (scripts/mirror-room.sh)
// runs this for the public door and sends the stamped page in place of the
// tree's. The root of mmdm.it keeps the page's own head: it is that site's.
//
//   node scripts/stamp-door-head.mjs <door> <index.html> <out.html>
//
// The words are the session's draft for Howell's veto, like every other
// line a stranger reads.
import { readFileSync, writeFileSync } from 'node:fs';

export const HEADS = {
  public: {
    lang: 'la',
    title: 'Biblia Catholica',
    description: 'Biblia Catholica — a free reader of the Bible in Hebrew, Greek, Latin and the languages of the world. No advertising.',
    siteName: 'Biblia Catholica',
    url: 'https://bibliacatholica.com/',
    // The body's static words too: what a crawler reads with no script, and
    // the desktop gate — the one page a visitor at a desk sees, which named
    // the catalog, carried its QR and gave its address. No QR for the
    // Bible's door yet (nothing here draws one); the address is written out.
    noscript: '<h1>Biblia Catholica</h1>\n    <p>A free reader of the Bible in Hebrew, Greek, Latin and the languages of the world. Made for the phone. No advertising.</p>',
    gate: {
      title: 'BIBLIA CATHOLICA',
      text: 'BIBLIA CATHOLICA IS MADE FOR THE PHONE',
      sub: 'Open bibliacatholica.com on your phone to continue',
      mail: 'info@bibliacatholica.com'
    }
  }
};

// What the stamped page may not still say: the catalog's name, its mark,
// its wares, its mail, or the catalog's address as this page's own.
export const MUST_NOT_SAY = /Meccanismi|MMdM|collettor|info@mmdm\.it|content="https:\/\/mmdm\.it\/"|href="https:\/\/mmdm\.it\/"|alt="[^"]*mmdm\.it/;

export function stampHead(html, door) {
  const h = HEADS[door];
  if (!h) return html;
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const out = html
    .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n    ${h.noscript}\n  </noscript>`)
    .replace(/(<div id="copyright-notice"[^>]*>)[\s\S]*?(<\/div>)/, '$1$2')
    .replace(/<p class="desktop-gate-title">[^<]*<\/p>/, `<p class="desktop-gate-title">${h.gate.title}</p>`)
    .replace(/\n\s*<img class="desktop-gate-qr"[^>]*\/>/, '')
    .replace(/<p class="desktop-gate-text">[^<]*<\/p>/, `<p class="desktop-gate-text">${h.gate.text}</p>`)
    .replace(/<p class="desktop-gate-sub">[^<]*<\/p>/, `<p class="desktop-gate-sub">${h.gate.sub}</p>`)
    .replace(/<p class="desktop-gate-mail"><a href="mailto:[^"]*">[^<]*<\/a><\/p>/, `<p class="desktop-gate-mail"><a href="mailto:${h.gate.mail}">${h.gate.mail}</a></p>`)
    .replace(/<html lang="[^"]*"/, `<html lang="${h.lang}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${h.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(h.description)}" />`)
    .replace(/\n\s*<meta name="keywords" content="[^"]*" \/>/, '')
    .replace(/\n\s*<meta name="author" content="[^"]*" \/>/, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${h.url}" />`)
    .replace(/<meta property="og:site_name" content="[^"]*" \/>/, `<meta property="og:site_name" content="${esc(h.siteName)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(h.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(h.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${h.url}" />`)
    .replace(/\n\s*<meta property="og:locale(?::alternate)?" content="[^"]*" \/>/g, '');
  const said = MUST_NOT_SAY.exec(out);
  if (said) throw new Error(`stamp-door-head: the ${door} door's page still says "${said[0]}"`);
  return out;
}

if (process.argv[1] && /stamp-door-head\.mjs$/.test(process.argv[1])) {
  const [door, inPath, outPath] = process.argv.slice(2);
  if (!door || !inPath || !outPath) { console.error('usage: node scripts/stamp-door-head.mjs <door> <index.html> <out.html>'); process.exit(1); }
  if (!HEADS[door]) { console.error(`stamp-door-head: no head for the "${door}" door`); process.exit(1); }
  writeFileSync(outPath, stampHead(readFileSync(inPath, 'utf8'), door));
  console.log(`stamp-door-head: ${door} → ${outPath} (${HEADS[door].title})`);
}
