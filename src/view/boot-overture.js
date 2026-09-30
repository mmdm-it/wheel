// THE BOOT OVERTURE (O-177). Storyboarded with Howell from 2026-09-23 to 28
// (art/storyboard/) and built here to the storyboard's timings. The reader's
// first screen is the instrument as line-work on the volume's own ground:
// three floors at their depths, the chooser rings dressed with the shelf AS
// IT WILL BE (the volume's declared cast), the text floor carrying the verse
// the reader is about to land on. Then a drill in that IS the app's own — the
// live app glides its floors exactly as it does when the globe is pressed,
// and the wireframe dissolves over it on the way — so there is only ever one
// drawing of the app and nothing to line up (Howell, 2026-09-28: "look at
// the code for the app to see how that page is drawn and then just replicate
// that math").
//
// THE TIMELINE, ms from the film's first frame — which is the frame the
// WHOLE wireframe can be drawn, the instrument standing and the verse set;
// until then the reader sees the ground alone (Howell 2026-09-29: the rings
// must not appear before their labels — "they should appear together. We
// don't want too many separate elements"):
//     0 –  800   the line-work fades in on the ground, all of it at once
//   800 – 2200   it holds
//  2200 – 3600   step one: the language ring leaves, the edition ring comes forward
//  3600 – 5000   step two: the edition ring leaves, the text arrives
//  3700 – 5000   the wireframe dissolves over the live app
//  4200          the wireframe's verse flips from ink to white, as the app's is
//  5000          the wireframe is gone; the app stands at the text
//
// One motion across both steps, eased in at the start and out at the end,
// straight through the join ("smooth and steady"). No colour before 3700:
// pure line-work on the tan. Every load; ?overture=0 skips it;
// ?overturescrub=1 holds it under a slider for the bench.
//
// WHAT IS DRAWN FROM WHERE. The chooser rings by the app's own stratum
// renderer (renderStratum) with the declared cast, restyled as line-work.
// The text floor from the live DOM once the instrument stands — its nodes and
// numerals, lens and caption, parent seat, the sector's circle, the
// watermark's box, and the verse's own line boxes cloned into a
// foreignObject so the type is set by the same rules — so it is the app's
// layout to the pixel. Only the emblem's line-work is an asset, traced from
// the artwork and served beside it (<emblem>-wire.svg).
import { getViewportInfo, getArcParameters, standardBandCenterline } from '../geometry/focus-ring-geometry.js';
import { renderStratum } from './secondary-strata-view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const T = {
  fadeMs: 800, holdUntil: 2200, stepMs: 1400,
  dissolveAfter: 1500, flipAfter: 2000,   // measured from the drill's start
  quickOutMs: 400                         // a volume with no floors to drill: the sheet simply lifts
};
const DEPTHS = [0.2, 0.4, 1], EXIT = 6;
// Each floor's scale at the walk's three stations: [language front, edition front, text front].
const WALK = [[0.2, 0.4, 1], [0.4, 1, EXIT], [1, EXIT, EXIT]];
const easeIn = t => t * t, easeOut = t => 1 - (1 - t) * (1 - t);

export function overtureShouldPlay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try { if (new URLSearchParams(window.location.search).get('overture') === '0') return false; } catch { /* no address */ }
  return true;
}
export function overtureScrubWanted() {
  try { return new URLSearchParams(window.location.search).get('overturescrub') === '1'; } catch { return false; }
}

const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
};
const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const offset = (pts, d) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * d, p[1] + dx / L * d]; });

export function beginBootOverture({ viewport = null } = {}) {
  if (typeof document === 'undefined') return { ready() {}, abort() {} };
  const vp = viewport || getViewportInfo(window.innerWidth, window.innerHeight);
  const cs = getComputedStyle(document.documentElement);
  const ground = (cs.getPropertyValue('--theme-color-bg') || '').trim() || '#868686';
  const ink = (cs.getPropertyValue('--color-text') || '').trim() || '#111';
  const cx = vp.width / 2, cy = vp.height / 2;
  const scaleAbout = s => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
  const bandW = getArcParameters(vp).radius * 0.02;

  // ── THE SHEET ──────────────────────────────────────────────────────────
  const svg = el('svg', { id: 'boot-overture', viewBox: `0 0 ${vp.width} ${vp.height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:340;pointer-events:auto;';
  const style = el('style', {}, svg);
  // Line weights by floor, front to back; every stroke non-scaling so a
  // receding floor keeps its one-pixel line (Howell 2026-09-28).
  style.textContent = `
    #boot-overture .ink{fill:none;stroke:${ink};stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    #boot-overture .mid{fill:none;stroke:${ink};stroke-width:.9;opacity:.7;vector-effect:non-scaling-stroke}
    #boot-overture .back{fill:none;stroke:${ink};stroke-width:.7;opacity:.5;vector-effect:non-scaling-stroke}
    #boot-overture .body{fill:none;stroke:${ground};stroke-opacity:.72;stroke-linecap:butt;stroke-linejoin:round}
    #boot-overture circle.node{fill:${ground};fill-opacity:.72}
    #boot-overture .secondary-strata-band{display:none}
    #boot-overture .secondary-strata-node{fill:${ground};fill-opacity:.72;stroke:${ink};vector-effect:non-scaling-stroke;cursor:default}
    #boot-overture .plane-front .secondary-strata-node{stroke-width:1.1}
    #boot-overture .plane-front .secondary-strata-node.is-magnified{stroke-width:1.6}
    #boot-overture .plane-mid .secondary-strata-node{stroke-width:.9;opacity:.7}
    #boot-overture .secondary-strata-label{fill:${ink}}
    #boot-overture .plane-mid .secondary-strata-label{opacity:.75}
    #boot-overture .secondary-strata.labels-beside .secondary-strata-label.is-magnified{font-weight:700}
    #boot-overture text.copy{fill:${ink};opacity:.55}
    #boot-overture .verse{position:absolute;white-space:nowrap;color:${ink};opacity:.55;margin:0;padding:0}
    #boot-overture .verse.white{color:#fff;opacity:1}
    #boot-overture .emblem path{fill:none;stroke:${ink};stroke-width:56;stroke-linejoin:round;stroke-linecap:round}
  `;
  el('rect', { width: vp.width, height: vp.height, fill: ground }, svg);
  const wire = el('g', { id: 'boot-overture-wire' }, svg);
  wire.style.opacity = '0';
  const planes = ['plane-back', 'plane-mid', 'plane-front'].map((cls, i) => { const g = el('g', { class: `plane ${cls}` }, wire); g.setAttribute('transform', scaleAbout(DEPTHS[i])); return g; });
  const band = (g, pts, cls) => { el('path', { class: 'body', d: path(pts), 'stroke-width': bandW.toFixed(2) }, g); el('path', { class: cls, d: path(offset(pts, bandW / 2)) }, g); el('path', { class: cls, d: path(offset(pts, -bandW / 2)) }, g); };

  // ── STAGE A, at once: every floor's band and lens, from geometry alone ──
  const centre = standardBandCenterline(vp);
  const mirrored = centre.map(([x, y]) => [x, vp.height - y]);
  band(planes[0], centre, 'back');
  band(planes[1], mirrored, 'mid');
  band(planes[2], centre, 'ink');
  const ring = (plane, id, items, selected, opts) => renderStratum(plane, { id, viewport: vp, items, selectedIndex: Math.max(0, selected), allowEmpty: true, ...opts });
  ring(planes[1], 'boot-overture-editions', [], 0, { mirrored: true, labelsBeside: true });
  ring(planes[2], 'boot-overture-languages', [], 0, { centerMagnified: true });
  document.body.appendChild(svg);

  let raf = 0, done = false;
  const remove = () => { done = true; cancelAnimationFrame(raf); try { svg.remove(); } catch { /* gone */ } };

  // ── STAGE B, at ready: the cast on the chooser rings ───────────────────
  const dressRings = cast => {
    const langs = Array.isArray(cast?.languages) ? cast.languages : [];
    const eds = Array.isArray(cast?.editions) ? cast.editions : [];
    ring(planes[2], 'boot-overture-languages', langs, langs.indexOf(cast?.lens?.language), { centerMagnified: true });
    const edRing = ring(planes[1], 'boot-overture-editions', eds, eds.indexOf(cast?.lens?.edition), { mirrored: true, labelsBeside: true });
    // The lens name reads from the lens outward, as the storyboard had it
    // (Howell 2026-09-25: the nodes' names offset to the right, the lens's too).
    const lensLabel = edRing?.querySelector?.('.secondary-strata-label.is-magnified');
    if (lensLabel) lensLabel.setAttribute('text-anchor', 'start');
  };

  // ── STAGE B, the text floor: the live instrument, traced ───────────────
  let textDressed = false, fetcher = null;
  const dressText = () => {
    const g = planes[0];
    const root = document.getElementById('app');
    const lines = document.querySelectorAll('#detail-panel .detail-text-line');
    if (!root || !lines.length) return false;
    while (g.children.length > 3) g.removeChild(g.lastChild);   // the band's three paths stay
    const copyCircle = (c, extra = {}) => c && el('circle', { class: 'back node', cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: c.getAttribute('r'), ...extra }, g);
    const copyText = (t, extra = {}) => {
      if (!t || !t.textContent) return;
      const st = getComputedStyle(t);
      const n = el('text', { class: 'copy', x: t.getAttribute('x'), y: t.getAttribute('y'), dx: t.getAttribute('dx'), dy: t.getAttribute('dy'), transform: t.getAttribute('transform'),
        'text-anchor': t.getAttribute('text-anchor') || st.textAnchor, 'dominant-baseline': t.getAttribute('dominant-baseline') || st.dominantBaseline, ...extra }, g);
      n.style.font = st.font; n.style.letterSpacing = st.letterSpacing; n.style.textTransform = st.textTransform;
      n.textContent = t.textContent;
    };
    root.querySelectorAll('.focus-ring-node').forEach(c => copyCircle(c));
    root.querySelectorAll('.focus-ring-label').forEach(t => copyText(t));
    copyCircle(root.querySelector('.focus-ring-magnifier-circle:not(.focus-ring-parent-circle)'), { style: 'stroke-width:.9' });
    copyText(root.querySelector('.focus-ring-magnifier-label:not(.focus-ring-parent-label)'));
    copyText(root.querySelector('.focus-ring-magnifier-caption'));
    copyCircle(root.querySelector('.focus-ring-parent-circle'), { style: 'stroke-width:.9' });
    copyText(root.querySelector('.focus-ring-parent-label'));
    const disc = root.querySelector('#volume-logo-circle');
    if (disc) el('circle', { class: 'back', cx: disc.getAttribute('cx'), cy: disc.getAttribute('cy'), r: disc.getAttribute('r') }, g);
    // The verse: each line's own box, cloned with its type, in a foreignObject
    // over the floor — the same rules set the same glyphs at the same seats.
    const fo = el('foreignObject', { x: 0, y: 0, width: vp.width, height: vp.height }, g);
    const sheet = document.createElementNS(XHTML_NS, 'div');
    sheet.setAttribute('style', 'position:relative;width:100%;height:100%;pointer-events:none');
    fo.appendChild(sheet);
    // Each line's seat is read from LAYOUT (offsets up to the panel), never
    // from the screen: the panel may already be receded to a floor's depth
    // when the verse arrives, and a screen rectangle would carry that scale.
    const seat = line => { let x = 0, y = 0; for (let e = line; e && e.id !== 'detail-panel'; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return { x, y }; };
    lines.forEach(line => {
      const st = getComputedStyle(line), at = seat(line);
      const span = document.createElementNS(XHTML_NS, 'span');
      span.className = 'verse';
      span.style.cssText = `left:${at.x}px;top:${at.y}px;width:${line.offsetWidth}px;height:${line.offsetHeight}px;font:${st.font};letter-spacing:${st.letterSpacing};text-align:${st.textAlign};direction:${st.direction};`;
      span.textContent = line.textContent;
      sheet.appendChild(span);
    });
    // The emblem's line-work in the watermark's own box and rotation, from
    // the asset beside the image the app is showing.
    const logo = root.querySelector('#volume-logo-image');
    const href = logo && (logo.getAttributeNS(XLINK_NS, 'href') || logo.getAttribute('href') || '');
    if (logo && /\.png$/i.test(href) && typeof fetcher === 'function') {
      const bx = parseFloat(logo.getAttribute('x')) || 0, by = parseFloat(logo.getAttribute('y')) || 0, bw = parseFloat(logo.getAttribute('width')) || 0, bh = parseFloat(logo.getAttribute('height')) || 0;
      const holder = el('g', { class: 'emblem', opacity: .6, transform: logo.getAttribute('transform') || undefined }, g);
      fetcher(href.replace(/\.png$/i, '-wire.svg')).then(text => {
        if (done || !text) return;
        const vb = /viewBox="([^"]+)"/.exec(text)?.[1]?.split(/\s+/).map(Number) || [0, 0, 1, 1];
        const inner = /<g [^>]*>[\s\S]*<\/g>/.exec(text)?.[0] || '';
        const k = Math.min(bw / vb[2], bh / vb[3]);
        holder.innerHTML = `<g transform="translate(${(bx + (bw - vb[2] * k) / 2).toFixed(1)},${(by + (bh - vb[3] * k) / 2).toFixed(1)}) scale(${k.toFixed(5)})">${inner}</g>`;
      }).catch(() => { /* no line-work for this emblem: the box stays empty */ });
    }
    textDressed = true;
    return true;
  };

  // ── THE DRILL: the live app walks its floors; the wireframe walks with it ──
  let driller = null;
  const verses = () => wire.querySelectorAll('.verse');
  const render = ms => {   // the film from the drill's start, as a function of time
    const e1 = Math.max(0, Math.min(1, ms / T.stepMs)), e2 = Math.max(0, Math.min(1, (ms - T.stepMs) / T.stepMs));
    const a = easeIn(e1), b = easeOut(e2);
    planes.forEach((g, i) => {
      const [s0, s1, s2] = WALK[i];
      const s = ms < T.stepMs ? s0 + (s1 - s0) * a : s1 + (s2 - s1) * b;
      g.style.visibility = s >= EXIT ? 'hidden' : '';
      g.setAttribute('transform', scaleAbout(s));
    });
    const dis = Math.max(0, Math.min(1, (ms - T.dissolveAfter) / (2 * T.stepMs - T.dissolveAfter)));
    svg.style.opacity = String(1 - dis);
    verses().forEach(t => t.classList.toggle('white', ms >= T.flipAfter));
    driller?.at(ms, a, b);
  };
  const makeDriller = drive => {
    let step = 0, glide = null;
    const ensure = want => {
      if (step === want && glide) return;
      if (want === 1) { drive.setFront(2); drive.render(); glide = drive.glide(2, 1); }
      else { drive.setFront(1); glide = drive.glide(1, 0); }
      step = want;
    };
    return {
      at(ms, a, b) { if (ms < T.stepMs) { ensure(1); glide.frameAt(a); } else { ensure(2); glide.frameAt(b); } },
      finish() { if (glide) { glide.frameAt(1); drive.setFront(0); glide.settle(); } else { drive.setFront(0); drive.render(); } drive.arrive?.(); }
    };
  };
  const liftQuickly = () => {   // no floors to drill through: the sheet lifts off the standing app
    const from = performance.now();
    const tick = now => { if (done) return; const e = Math.min(1, (now - from) / T.quickOutMs); svg.style.opacity = String(1 - e); if (e < 1) raf = requestAnimationFrame(tick); else remove(); };
    raf = requestAnimationFrame(tick);
  };

  return {
    // The instrument stands: dress the wireframe from it, then drill.
    ready({ cast = null, drive = null, fetchText = null, scrub = false } = {}) {
      if (done) return;
      fetcher = fetchText;
      try { dressRings(cast); } catch (err) { console.warn('[wheel] overture rings', err); }
      const tryText = () => { if (!textDressed) { try { dressText(); } catch { /* next frame */ } } };
      tryText();
      if (!drive) { liftQuickly(); return; }
      driller = makeDriller(drive);
      if (scrub) { mountScrub(); return; }
      // The film starts the frame the whole wireframe stands — the verse sets
      // its type a moment after render-done (fonts, the wrap), and the rings
      // wait for it so everything appears together; but not forever: a text
      // floor with no verse starts three seconds on. Then the fade, the hold,
      // and the drill, on the storyboard's clock.
      // And the ring itself may still be seating nodes (the cousin chain
      // arrives with the neighbouring chart): the trace is taken only once
      // the ring has held still for a quarter second, so the wireframe shows
      // the ring the reader is about to see and not a moment of its building.
      const readyAt = performance.now();
      let filmAt = 0, ringSig = '', ringStillSince = 0;
      const ringSignature = () => { const r = document.getElementById('app'); return r ? `${r.querySelectorAll('.focus-ring-node').length}/${r.querySelectorAll('.focus-ring-label').length}/${document.querySelectorAll('#detail-panel .detail-text-line').length}` : ''; };
      const tick = now => {
        if (done) return;
        if (!filmAt) {
          const sig = ringSignature();
          if (sig !== ringSig) { ringSig = sig; ringStillSince = now; }
          const still = now - ringStillSince >= 250;
          if (still) tryText();
          if ((still && textDressed) || now >= readyAt + 3000) { if (!textDressed) tryText(); filmAt = now; }
          else { raf = requestAnimationFrame(tick); return; }
        }
        const t = now - filmAt;
        wire.style.opacity = String(Math.min(1, t / T.fadeMs));
        if (t < T.holdUntil) { raf = requestAnimationFrame(tick); return; }
        const ms = t - T.holdUntil;
        render(ms);
        if (ms < 2 * T.stepMs) raf = requestAnimationFrame(tick);
        else { driller.finish(); remove(); }
      };
      raf = requestAnimationFrame(tick);
    },
    // The reader (or a test) moved the floors: the sheet lifts and the floors
    // are left exactly as they were moved — nothing is settled here.
    abort() { if (!done) remove(); }
  };

  // ── THE BENCH SCRUBBER (?overturescrub=1): the film held under a slider ──
  function mountScrub() {
    const total = T.holdUntil + 2 * T.stepMs;   // the film's clock: 0 at the first frame
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(0,0,0,.6);color:#fff;padding:8px 12px 14px;font:14px Montserrat,sans-serif;pointer-events:auto;';
    bar.innerHTML = `<div style="font:700 20px/1.2 monospace"><span id="ov-ms">0</span> ms <small style="font:12px Montserrat,sans-serif;opacity:.8"> frame <span id="ov-fr">0</span> at 30/s</small></div>
      <input id="ov-t" type="range" min="0" max="${total}" step="10" value="0" style="width:100%;margin:6px 0">
      <div><button data-d="-100">−100 ms</button><button data-d="-33">−1 fr</button><button data-d="33">+1 fr</button><button data-d="100">+100 ms</button><button id="ov-play">Play from here</button><button id="ov-go">Finish</button></div>`;
    bar.querySelectorAll('button').forEach(b => { b.style.cssText = 'font:inherit;padding:7px 11px;margin:0 5px 4px 0;background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:6px'; });
    document.body.appendChild(bar);
    const slider = bar.querySelector('#ov-t');
    const seek = ms => {
      ms = Math.max(0, Math.min(total, ms)); slider.value = ms;
      bar.querySelector('#ov-ms').textContent = Math.round(ms); bar.querySelector('#ov-fr').textContent = Math.round(ms / (1000 / 30));
      if (!textDressed) { try { dressText(); } catch { /* not yet */ } }   // seats read from layout: safe at any depth
      wire.style.opacity = String(Math.min(1, ms / T.fadeMs));
      if (ms < T.holdUntil) { planes.forEach((g, i) => { g.style.visibility = ''; g.setAttribute('transform', scaleAbout(DEPTHS[i])); }); svg.style.opacity = '1'; verses().forEach(t => t.classList.remove('white')); driller.at(0, 0, 0); }
      else render(ms - T.holdUntil);
    };
    let playing = 0;
    slider.addEventListener('input', () => { cancelAnimationFrame(playing); seek(Number(slider.value)); });
    bar.querySelectorAll('button[data-d]').forEach(b => b.addEventListener('click', () => { cancelAnimationFrame(playing); seek(Number(slider.value) + Number(b.dataset.d)); }));
    bar.querySelector('#ov-play').addEventListener('click', () => {
      const from = Number(slider.value), start = performance.now();
      const tick = now => { const ms = from + (now - start); if (ms >= total) { seek(total); return; } seek(ms); playing = requestAnimationFrame(tick); };
      playing = requestAnimationFrame(tick);
    });
    bar.querySelector('#ov-go').addEventListener('click', () => { cancelAnimationFrame(playing); seek(total); driller.finish(); remove(); bar.remove(); });
    seek(0);
  }
}
