// THE BOOT OVERTURE (O-181, Howell 2026-09-30, retiring the wireframe of
// O-177: "I think we should just go from the initial icon and title to a
// regular color migration from tertiary stratum to primary stratum, just as
// it appears in the app.")
//
// Three beats, from the first frame:
//
//   THE CARD (O-180). The volume's emblem — the artwork itself — and the
//   volume's name on the ground, at once, as a phone's own apps open. It
//   holds a second and a half at least, and until the instrument stands
//   behind it (three at first; two, then one and a half, on 2026-09-30,
//   after a look at what the phone's own apps allow themselves: Android
//   caps its icon at a second, and the one deliberate exception in
//   Howell's set, Netflix, takes about two).
//
//   THE REVEAL. The card fades out and the app is there beneath it, standing
//   at its language ring — the tertiary stratum, in colour, exactly as the
//   reader would see it after trucking out twice.
//
//   THE MIGRATION. The app's own two-floor walk in, language ring to edition
//   ring to the text: the slider's glide (beginGlide), driven by this clock
//   instead of the thumb — eased in, straight through the join, eased out —
//   and settled at the text. Nothing here is drawn by hand; the app draws
//   itself.
//
//     0 – 1500   the card                       (longer if the instrument is not ready)
//  1500 – 1700   the card fades; the app stands at the language ring
//  1700 – 2100   it holds there
//  2100 – 4900   the migration in, two floors, one motion
//  4900          the text
//
// The volume declares the card's picture and words (display_config.splash);
// the engine remembers them on the phone so a return visit's card is up
// before the manifest is. Every load; ?overture=0 skips it; ?overturescrub=1
// holds it under a slider on the bench. Any glide begun by anyone else (the
// reader's slider, a tap, a test driving the floors) ends it on the spot and
// leaves the floors as they were moved.
import { getViewportInfo } from '../geometry/focus-ring-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const T = {
  splashMs: 1500,     // the card's linger, at least (Howell 2026-09-30: two seconds, then "shorten ... to 1.5 seconds")
  revealMs: 200,      // the card fading off the standing app
  holdMs: 400,        // the app at its language ring
  stepMs: 1400,       // each floor of the migration
  quickOutMs: 400     // a volume with no floors to migrate through: the card simply lifts
};
const easeIn = t => t * t, easeOut = t => 1 - (1 - t) * (1 - t);

export function overtureShouldPlay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try { if (new URLSearchParams(window.location.search).get('overture') === '0') return false; } catch { /* no address */ }
  return true;
}
// THE BOOT LOG (?bootlog=1, Howell 2026-09-30, on a cleared cache in the
// screening room: "there seems to be a bit of a delay before the crown of
// thorns appears"). Every beat of the boot is marked, and when the overture
// ends a panel lists them in ms from the first byte of the page, with the
// fetches the card waited on beside them — so a phone can show what it saw.
export function bootLogWanted() {
  try { return new URLSearchParams(window.location.search).get('bootlog') === '1'; } catch { return false; }
}
export function mark(name) { try { performance.mark(`wheel:ov:${name}`); } catch { /* no timing API */ } }
export function overtureScrubWanted() {
  try { return new URLSearchParams(window.location.search).get('overturescrub') === '1'; } catch { return false; }
}
// The card's record from a volume's declaration: the emblem's own image at
// the volume's asset base, and the name. Null when the volume declares none.
export function splashRecord(root, assetBase) {
  const sp = root?.display_config?.splash;
  const image = typeof sp?.image === 'string' && sp.image ? sp.image : null;
  const title = typeof sp?.title === 'string' ? sp.title : '';
  if (!image && !title) return null;
  const base = root?.display_config?.detail_sector?.logo_base_path || 'assets/';
  return { imageUrl: image ? `${assetBase || ''}${base}${image}.png` : null, title };
}

const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
};

export function beginBootOverture({ viewport = null, splash = null } = {}) {
  if (typeof document === 'undefined') return { splash() {}, ready() {}, abort() {} };
  const vp = viewport || getViewportInfo(window.innerWidth, window.innerHeight);
  const cs = getComputedStyle(document.documentElement);
  const ground = (cs.getPropertyValue('--theme-color-bg') || '').trim() || '#868686';
  const ink = (cs.getPropertyValue('--color-text') || '').trim() || '#111';

  // ── THE SHEET: the ground, over everything, with the card on it ─────────
  const svg = el('svg', { id: 'boot-overture', viewBox: `0 0 ${vp.width} ${vp.height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:340;pointer-events:auto;';
  el('rect', { width: vp.width, height: vp.height, fill: ground }, svg);
  document.body.appendChild(svg);
  mark('sheet-up');
  let raf = 0, done = false;
  const remove = () => { done = true; cancelAnimationFrame(raf); mark('end'); try { svg.remove(); } catch { /* gone */ } if (bootLogWanted()) { try { mountBootLog(); } catch (err) { console.warn('[wheel] boot log', err); } } };

  // THE CARD ARRIVES WHOLE (Howell 2026-09-30: the title "pops on for a few
  // milliseconds in a different font before it settles on the correct
  // font"). The face comes from the network and the picture from the cache,
  // each on its own clock, and a card drawn the frame it is asked for shows
  // whichever has not arrived in its stand-in. So the card is built at once
  // but shown only when both are in hand — a frame or two on a return visit
  // — and no later than a second: past that the title is pinned to the
  // stand-in face for this visit, so it never swaps under the reader.
  let card = null, cardAt = 0, cardPending = false;
  const FACE = "'EB Garamond'", STAND_IN = 'Georgia, serif';
  const showCard = record => {
    if (card || cardPending || done || !record || (!record.imageUrl && !record.title)) return;
    cardPending = true;
    mark('card-asked');
    const g = el('g', { id: 'boot-overture-card' });
    const w = vp.width * 0.42, h = w, x = (vp.width - w) / 2, y = vp.height * 0.44 - h / 2;
    const px = (vp.width * 0.062).toFixed(1);
    const waits = [];
    if (record.imageUrl) {
      const img = el('image', { x: x.toFixed(1), y: y.toFixed(1), width: w.toFixed(1), height: h.toFixed(1), preserveAspectRatio: 'xMidYMid meet' }, g);
      img.setAttribute('href', record.imageUrl);
      img.setAttributeNS(XLINK_NS, 'xlink:href', record.imageUrl);
      // The picture is "in hand" when it has LOADED (a cached one fires at
      // once); decode is asked for too, but a browser that defers decoding
      // (a background tab) must not hold the card past the load.
      try {
        const probe = new Image();
        const loaded = new Promise(res => { probe.onload = () => res(); probe.onerror = () => res(); });
        probe.src = record.imageUrl;
        if (probe.complete) loaded.then(() => {});
        waits.push(Promise.race([loaded, probe.decode ? probe.decode().catch(() => {}) : loaded]).then(() => mark('image-loaded')));
      } catch { /* no picture probe: show on the cap */ }
    }
    let title = null;
    if (record.title) {
      title = el('text', { x: (vp.width / 2).toFixed(1), y: (y + h + vp.height * 0.075).toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
      title.style.cssText = `font-family:${FACE},${STAND_IN};font-size:${px}px;letter-spacing:.04em;fill:${ink}`;
      title.textContent = record.title;
      try { if (document.fonts?.load) waits.push(document.fonts.load(`${px}px ${FACE}`).catch(() => []).then(() => mark('face-ready'))); } catch { /* no font API: show on the cap */ }
    }
    let shown = false;
    const show = () => {
      if (shown || done) return;
      shown = true; cardPending = false;
      let haveFace = true;
      try { haveFace = !title || document.fonts?.check?.(`${px}px ${FACE}`) !== false; } catch { /* assume it */ }
      if (title && !haveFace) title.style.fontFamily = STAND_IN;
      svg.appendChild(g);
      card = g;
      cardAt = performance.now();
      mark(haveFace ? 'card-shown' : 'card-shown-stand-in-face');
    };
    const cap = setTimeout(() => { mark('card-cap-hit'); show(); }, 1000);
    Promise.all(waits).then(() => { clearTimeout(cap); show(); }, () => { clearTimeout(cap); show(); });
  };
  showCard(splash);
  const lingered = now => !cardPending && (!card || now >= cardAt + T.splashMs);

  // ── THE MIGRATION: the app walks its own floors on this clock ──────────
  let driller = null;
  const makeDriller = drive => {
    let step = 0, glide = null, standing = false;
    const ensure = want => {
      if (step === want && glide) return;
      standing = false;
      if (want === 1) { drive.setFront(2); drive.render(); glide = drive.glide(2, 1); }
      else { drive.setFront(1); glide = drive.glide(1, 0); }
      step = want;
    };
    return {
      stand() { if (standing) return; step = 0; glide = null; drive.setFront(2); drive.render(); drive.thumb?.(2); standing = true; },   // at the language ring, still
      // The globe (the slider's thumb) rides the walk exactly as the floors
      // do: two notches up at the language ring, home at the text.
      at(ms) {
        const e1 = Math.max(0, Math.min(1, ms / T.stepMs)), e2 = Math.max(0, Math.min(1, (ms - T.stepMs) / T.stepMs));
        if (ms < T.stepMs) { ensure(1); const e = easeIn(e1); glide.frameAt(e); drive.thumb?.(2 - e); }
        else { ensure(2); const e = easeOut(e2); glide.frameAt(e); drive.thumb?.(1 - e); }
      },
      // The thumb is set home and the hand taken off BEFORE the settle: the
      // settle un-presses the globe, and that step down must ride the
      // globe's own transition, which the sliding hand suppresses.
      finish() { if (glide) glide.frameAt(1); drive.thumb?.(0); drive.unslide?.(); drive.setFront(0); if (glide) glide.settle(); else drive.render(); drive.arrive?.(); }
    };
  };
  // The film from the card's last full frame: the reveal, the hold, the migration.
  const render = t => {
    svg.style.opacity = String(Math.max(0, 1 - t / T.revealMs));
    const ms = t - T.revealMs - T.holdMs;
    if (ms < 0) driller.stand(); else { if (!migrating) { migrating = true; mark('migration-start'); } driller.at(ms); }
  };
  let migrating = false;
  const filmMs = T.revealMs + T.holdMs + 2 * T.stepMs;
  const liftQuickly = () => {   // no floors: the card lifts off the standing app after its linger
    const tick = now => {
      if (done) return;
      if (!lingered(now)) { raf = requestAnimationFrame(tick); return; }
      const from = now;
      const fade = n => { if (done) return; const e = Math.min(1, (n - from) / T.quickOutMs); svg.style.opacity = String(1 - e); if (e < 1) raf = requestAnimationFrame(fade); else remove(); };
      raf = requestAnimationFrame(fade);
    };
    raf = requestAnimationFrame(tick);
  };

  return {
    // The declaration arrived (a first visit, before the card was known).
    splash(record) { showCard(record); },
    // The instrument stands: put it at its language ring behind the card,
    // and when the card has had its linger, reveal and migrate.
    ready({ drive = null, scrub = false } = {}) {
      if (done) return;
      if (!drive) { liftQuickly(); return; }
      driller = makeDriller(drive);
      mark('ready');
      if (scrub) { driller.stand(); mountScrub(); return; }
      // The floors are left at the text until the card is about to lift —
      // the app boots to the text (O-143) and anything reading it in the
      // meantime (the suites do) finds it there; standing at the language
      // ring is one synchronous render, taken the frame the reveal begins.
      const readyAt = performance.now();
      let filmAt = 0;
      const tick = now => {
        if (done) return;
        if (!filmAt) {
          if (lingered(now) && now >= readyAt + 300) { filmAt = now; mark('film-start'); }
          else { raf = requestAnimationFrame(tick); return; }
        }
        const t = now - filmAt;
        render(t);
        if (t < filmMs) raf = requestAnimationFrame(tick);
        else { driller.finish(); remove(); }
      };
      raf = requestAnimationFrame(tick);
    },
    // The reader (or a test) moved the floors: the sheet lifts and the floors
    // are left exactly as they were moved — nothing is settled here.
    abort() { if (!done) remove(); }
  };

  // ── THE BOOT LOG PANEL (?bootlog=1): what the phone saw, in ms from the page's first byte ──
  function mountBootLog() {
    const t0 = performance.getEntriesByName('wheel:html-start')[0]?.startTime ?? 0;
    const rel = t => Math.round(t - t0);
    const lines = [];
    const marks = performance.getEntriesByType('mark').filter(m => m.name.startsWith('wheel:')).map(m => ({ name: m.name.replace(/^wheel:(ov:)?/, ''), t: rel(m.startTime) }));
    const phases = window.__wheelBootPhases;
    if (phases) {
      const boot = phases.htmlToBoot ?? 0;
      marks.push({ name: 'boot-start', t: boot }, { name: 'manifest-ready', t: boot + (phases.manifest ?? 0) },
        { name: 'chain-built', t: boot + (phases.manifest ?? 0) + (phases.chainBuild ?? 0) }, { name: 'render-done', t: phases.total ?? 0 });
    }
    marks.sort((a, b) => a.t - b.t);
    lines.push('BOOT LOG  (ms from first byte)', '');
    for (const m of marks) lines.push(`${String(m.t).padStart(6)}  ${m.name}`);
    lines.push('', 'FETCHES  start→end  size');
    const want = [['page', /\/(\?|$|index\.html)/], ['app.js', /dist\/app\.js/], ['manifest', /volume\.json/], ['charts bundle', /charts\/[^/]+\/all\.json/], ['spine bundle', /spine\/all\.json/], ['fonts css', /fonts\.googleapis/], ['garamond', /gstatic.*(garamond|ebgaramond)/i], ['crown png', /crown_of_thorns\.png|torah_scroll\.png/], ['text', /\/text\//]];
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) lines.push(`${String(rel(nav.startTime)).padStart(6)}→${String(rel(nav.responseEnd)).padEnd(6)} page  ${Math.round((nav.transferSize || 0) / 1024)}k`);
    const res = performance.getEntriesByType('resource');
    for (const [label, re] of want.slice(1)) {
      const hits = res.filter(r => re.test(r.name));
      if (!hits.length) { lines.push(`     —          ${label}  (not fetched)`); continue; }
      const first = hits.reduce((a, b) => (a.startTime < b.startTime ? a : b));
      const last = hits.reduce((a, b) => (a.responseEnd > b.responseEnd ? a : b));
      const kb = Math.round(hits.reduce((n, r) => n + (r.transferSize || 0), 0) / 1024);
      const cached = hits.every(r => r.transferSize === 0 && r.decodedBodySize > 0);
      lines.push(`${String(rel(first.startTime)).padStart(6)}→${String(rel(last.responseEnd)).padEnd(6)} ${label}${hits.length > 1 ? ` ×${hits.length}` : ''}  ${cached ? 'cache' : kb + 'k'}`);
    }
    const conn = navigator.connection;
    const device = (/\(([^)]*)\)/.exec(navigator.userAgent || '')?.[1] || '').slice(0, 48);
    lines.push('', `${device}${conn ? `  ${conn.effectiveType || ''} ${conn.rtt ? conn.rtt + 'ms' : ''}` : ''}`);
    const box = document.createElement('pre');
    box.id = 'boot-log';
    box.textContent = lines.join('\n');
    box.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;max-height:72vh;overflow:auto;z-index:2147483000;margin:0;padding:10px 12px;background:rgba(0,0,0,.82);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre;border-radius:8px;pointer-events:auto;';
    const close = document.createElement('button');
    close.textContent = '✕'; close.style.cssText = 'position:absolute;top:4px;right:6px;background:none;border:0;color:#fff;font:16px sans-serif;padding:4px 8px';
    close.addEventListener('click', () => box.remove());
    box.appendChild(close);
    document.body.appendChild(box);
  }

  // ── THE BENCH SCRUBBER (?overturescrub=1): the film held under a slider ──
  function mountScrub() {
    const lead = card ? T.splashMs : 0;
    const total = lead + filmMs;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(0,0,0,.6);color:#fff;padding:8px 12px 14px;font:14px Montserrat,sans-serif;pointer-events:auto;';
    bar.innerHTML = `<div style="font:700 20px/1.2 monospace"><span id="ov-ms">0</span> ms <small style="font:12px Montserrat,sans-serif;opacity:.8"> frame <span id="ov-fr">0</span> at 30/s</small></div>
      <input id="ov-t" type="range" min="0" max="${total}" step="10" value="0" style="width:100%;margin:6px 0">
      <div><button data-d="-100">−100 ms</button><button data-d="-33">−1 fr</button><button data-d="33">+1 fr</button><button data-d="100">+100 ms</button><button id="ov-play">Play from here</button><button id="ov-start">Start</button></div>`;
    bar.querySelectorAll('button').forEach(b => { b.style.cssText = 'font:inherit;padding:7px 11px;margin:0 5px 4px 0;background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:6px'; });
    document.body.appendChild(bar);
    // The hamburger (Howell 2026-09-30, as the storyboard's scrubber had it):
    // hides and shows the panel, so a frame can be looked at clean.
    const peek = document.createElement('button');
    peek.textContent = '≡'; peek.title = 'Hide or show the controls';
    peek.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483001;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;border:0;font:700 16px/34px Montserrat,sans-serif;text-align:center;padding:0;pointer-events:auto;';
    peek.addEventListener('click', () => { bar.hidden = !bar.hidden; });
    document.body.appendChild(peek);
    const slider = bar.querySelector('#ov-t');
    const seek = ms => {
      ms = Math.max(0, Math.min(total, ms)); slider.value = ms;
      bar.querySelector('#ov-ms').textContent = Math.round(ms); bar.querySelector('#ov-fr').textContent = Math.round(ms / (1000 / 30));
      const t = ms - lead;
      if (t < 0) { svg.style.opacity = '1'; driller.stand(); } else render(t);
      // At the very end the app is settled at the text and the sheet lets
      // touches through, so the film can be scrubbed to its close and the
      // instrument used; scrubbing back takes the sheet up again.
      if (ms >= total) { driller.finish(); svg.style.pointerEvents = 'none'; } else svg.style.pointerEvents = 'auto';
    };
    let playing = 0;
    slider.addEventListener('input', () => { cancelAnimationFrame(playing); seek(Number(slider.value)); });
    bar.querySelectorAll('button[data-d]').forEach(b => b.addEventListener('click', () => { cancelAnimationFrame(playing); seek(Number(slider.value) + Number(b.dataset.d)); }));
    bar.querySelector('#ov-play').addEventListener('click', () => {
      const from = Number(slider.value), start = performance.now();
      const tick = now => { const ms = from + (now - start); if (ms >= total) { seek(total); return; } seek(ms); playing = requestAnimationFrame(tick); };
      playing = requestAnimationFrame(tick);
    });
    bar.querySelector('#ov-start').addEventListener('click', () => { cancelAnimationFrame(playing); seek(0); });
    seek(0);
  }
}
