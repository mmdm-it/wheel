#!/usr/bin/env node
// THE MIGRATION SWEEP (Howell 2026-10-03: "if you can look for Drill IN/OUT
// migration bugs on your own"; "Go ahead and run the sweep on the phone",
// 2026-10-07). Drives the app on the Moto G with synthetic touches over adb,
// reads the drawing over Chrome's devtools socket, and asserts invariants at
// every transition — held mid-flight and settled. A screen grab is taken at
// each held state for a second, visual pass. Findings come back as the exact
// sequence that produced them.
//
//   node scripts/sweep-migrations.mjs [out-dir]
//
// Needs: wireless debugging on and paired (memory: moto-g-wireless-adb), the
// page reachable, Chrome in the foreground. The route starts from the deep
// link the headless bench uses and ends where it began. Every touch is
// released on exit, whatever happens.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ADB = process.env.ADB || '/media/howell/dev_workspace/.tools/pt-new/platform-tools/adb';
const PORT = 9333;
const URL = process.env.SWEEP_URL || 'https://mmdm.it/wheel-v3/bible/?volume=bible&proofread=true&level=book&book=b2b44a790&migrationlog=1&overture=0';
const NAV_BAR_PX = 94;          // Android's bottom bar on the Moto G, physical px
const SCREEN = { w: 720, h: 1604 };
const out = path.resolve(process.argv[2] || `sweep-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });

const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', env: { ...process.env, ADB_MDNS_OPENSCREEN: '1' } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const devices = adb('devices').split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(p => p[1] === 'device').map(p => p[0]);
const dev = devices.find(d => /:\d+$/.test(d)) || devices[0];
if (!dev) { console.error('no device'); process.exit(1); }
const sh = (...a) => adb('-s', dev, 'shell', ...a);
let fingerDown = false;
const release = () => { if (fingerDown) { try { sh('input', 'motionevent', 'UP', '360', '800'); } catch (e) { /* best effort */ } fingerDown = false; } };
process.on('exit', release); process.on('SIGINT', () => { release(); process.exit(130); });

adb('-s', dev, 'forward', '--remove-all');
adb('-s', dev, 'forward', `tcp:${PORT}`, 'localabstract:chrome_devtools_remote');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
let page = browser.contexts().flatMap(c => c.pages()).find(p => /volume=/.test(p.url())) || browser.contexts()[0].pages()[0];
if (!page) { console.error('no page open in Chrome'); process.exit(1); }
await page.goto(URL, { waitUntil: 'load' });
await sleep(6000);

// ---- geometry: CSS px in the page -> physical px on the glass -------------
const vp = await page.evaluate(() => ({ dpr: window.devicePixelRatio, ih: window.innerHeight, iw: window.innerWidth }));
const TOP = SCREEN.h - Math.round(vp.ih * vp.dpr) - NAV_BAR_PX;
const phys = (x, y) => [Math.round(x * vp.dpr), Math.round(y * vp.dpr + TOP)];
const OPEN = { x: 183, y: 275 };                       // open ground, right of the band, below the sky
const BEARING = { out: 40, in: 223, cw: 312, ccw: 132 };
const HELD = 45, COMMIT = 150, SHORT = 16, TURN = 60;   // stroke lengths, CSS px

// ---- touch primitives -------------------------------------------------------
const down = (x, y) => { const [px, py] = phys(x, y); sh('input', 'motionevent', 'DOWN', String(px), String(py)); fingerDown = true; };
const move = (x, y) => { const [px, py] = phys(x, y); sh('input', 'motionevent', 'MOVE', String(px), String(py)); };
const up = (x, y) => { const [px, py] = phys(x, y); sh('input', 'motionevent', 'UP', String(px), String(py)); fingerDown = false; };
const strokeFrom = async (x0, y0, deg, len, { lift = true, settle = 1800 } = {}) => {
  const r = deg * Math.PI / 180, x1 = x0 + Math.sin(r) * len, y1 = y0 - Math.cos(r) * len;
  down(x0, y0);
  const n = Math.max(4, Math.round(len / 7));
  for (let i = 1; i <= n; i++) { move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await sleep(12); }
  if (lift) { await sleep(120); up(x1, y1); await sleep(settle); }
  else await sleep(900);
  return [x1, y1];
};
const stroke = (kind, len, o) => strokeFrom(OPEN.x, OPEN.y, BEARING[kind], len, o);

// ---- reading the drawing ----------------------------------------------------
const read = () => page.evaluate(() => {
  const txt = e => (e?.textContent || '').trim();
  const vis = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const v = parseFloat(getComputedStyle(e).opacity); if (!Number.isNaN(v)) o *= v; } return o; };
  const L = window.__wheelLog;
  const lastSwipe = L ? [...L.entries].reverse().find(e => e.ev === 'swipe') : null;
  const ovs = [...document.querySelectorAll('#app .migration-animation-overlay')].map(o => ({
    flight: (o.getAttribute('class') || '').replace('migration-animation-overlay', '').trim() || 'plain',
    labels: [...o.children].map(txt).filter(Boolean),
    shownLabels: [...o.children].filter(k => vis(k) > 0.05).map(txt).filter(Boolean),   // a hidden clone is not on the glass
    shown: [...o.children].filter(k => vis(k) > 0.05).length,
  }));
  const ringG = document.querySelector('#app .focus-ring-nodes'), skyG = document.querySelector('#app .child-pyramid');
  const skyTexts = [...document.querySelectorAll('#app .child-pyramid text')].map(t => { const r = t.getBoundingClientRect(); return { label: txt(t), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const stars = [...document.querySelectorAll('#app .child-pyramid-nodes circle')].map((c, i) => {
    const r = c.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    let best = null; for (const st of skyTexts) { const d = Math.hypot(st.x - x, st.y - y); if (!best || d < best.d) best = { d, label: st.label }; }
    return { i, x, y, r: r.width / 2, label: best && best.d < r.width ? best.label : '' };   // the label drawn inside this disc, by position
  });
  const skyLabels = skyTexts.map(t => t.label);
  const lensR = document.querySelector('#app .focus-ring-magnifier-circle')?.getBoundingClientRect();
  return {
    lens: txt(document.querySelector('#app .focus-ring-magnifier-label:not(.focus-ring-parent-label)')),   // the parent shares the class
    parent: txt(document.querySelector('#app .focus-ring-parent-label')),
    ring: [...document.querySelectorAll('#app .focus-ring-labels text')].map(txt).filter(Boolean),
    sky: skyLabels.filter(Boolean),
    stars,
    lensAt: lensR ? { x: lensR.left + lensR.width / 2, y: lensR.top + lensR.height / 2 } : null,
    depth: L ? L.level().depth : null,
    ringOpacity: ringG ? getComputedStyle(ringG).opacity : '?',
    skyOpacity: skyG ? getComputedStyle(skyG).opacity : '?',
    overlays: ovs,
    ringAtSwipe: lastSwipe?.ring || [],
    skyAtSwipe: lastSwipe?.sky || [],
    lensAtSwipe: lastSwipe?.lens || '',
  };
});
const grab = name => { try { writeFileSync(path.join(out, name + '.png'), execFileSync(ADB, ['-s', dev, 'exec-out', 'screencap', '-p'], { maxBuffer: 1 << 26 })); } catch (e) { /* optional */ } };

// ---- the findings -----------------------------------------------------------
const findings = [];
const route = [];
let step = 0;
const check = (name, ok, detail = '') => { findings.push({ step, name, ok, detail }); if (!ok) console.log(`  FAIL  ${name}  ${detail}`); };
const say = s => { step += 1; route.push(`${step}. ${s}`); console.log(`\n${step}. ${s}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sig = s => ({ lens: s.lens, ring: [...s.ring].sort(), sky: [...s.sky].sort(), depth: s.depth });   // the ring's drawing order is not its content

// Held drill out: every ring node must be carried by some flight.
const heldOutChecks = async (label) => {
  const s = await read();
  const carried = new Set(s.overlays.flatMap(o => o.labels));
  const stragglers = new Set(s.overlays.filter(o => o.flight === 'stragglers').flatMap(o => o.labels));
  const before = s.ringAtSwipe;
  const orphans = before.filter(l => !carried.has(l));
  const faded = before.filter(l => stragglers.has(l));
  check(`${label}: a flight launched`, s.overlays.length > 0, `overlays ${s.overlays.map(o => `${o.flight}(${o.labels.length})`).join(' ')}`);
  check(`${label}: every ring node has a clone in flight`, orphans.length === 0, orphans.length ? `no flight for: ${orphans.join(' ')}` : '');
  check(`${label}: the real ring is hidden under the clones`, s.ringOpacity === '0', `ring group opacity ${s.ringOpacity}`);
  // GHOSTS (O-197): a clone in flight for an item that is on neither the ring
  // it left, the sky it is going to, nor the sky that is leaving — a stale
  // layer replayed at seats that now belong to others.
  const known = new Set([...before, ...s.skyAtSwipe, ...s.sky]);
  const ghosts = s.overlays.filter(o => !/ring-inward|parent|magnifier|merge/.test(o.flight)).flatMap(o => o.shownLabels.filter(l => !known.has(l)).map(l => `${l}@${o.flight}`));
  check(`${label}: no ghost clone in flight`, ghosts.length === 0, ghosts.join(' '));
  if (faded.length) findings.push({ step, name: `${label}: stragglers (fade by design, the windowing question)`, ok: true, detail: faded.join(' ') });
  grab(`step${String(step).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-')}`);
  return s;
};
// Settled after a commit: overlays retired, nothing stuck hidden.
const settledChecks = (label, before, after, expectDepthDelta) => {
  check(`${label}: lens changed`, after.lens !== before.lens, `${before.lens} -> ${after.lens}`);
  check(`${label}: no clone still showing`, after.overlays.every(o => o.shown === 0), after.overlays.filter(o => o.shown).map(o => `${o.flight} ${o.shown} shown`).join(', '));
  check(`${label}: ring and sky visible again`, after.ringOpacity !== '0' && after.skyOpacity !== '0', `ring ${after.ringOpacity} sky ${after.skyOpacity}`);
  if (before.depth != null && after.depth != null) check(`${label}: stack depth moved by ${expectDepthDelta}`, after.depth - before.depth === expectDepthDelta, `${before.depth} -> ${after.depth}`);
};
const springChecks = (label, before, after) => {
  check(`${label}: state identical after the spring-back`, same(sig(before), sig(after)), same(sig(before), sig(after)) ? '' : `before ${JSON.stringify(sig(before)).slice(0, 120)} after ${JSON.stringify(sig(after)).slice(0, 120)}`);
  check(`${label}: no clone still showing`, after.overlays.every(o => o.shown === 0), after.overlays.filter(o => o.shown).map(o => `${o.flight} ${o.shown} shown`).join(', '));
  check(`${label}: ring and sky visible again`, after.ringOpacity !== '0' && after.skyOpacity !== '0', `ring ${after.ringOpacity} sky ${after.skyOpacity}`);
  check(`${label}: saved layers kept their drawing`, after.overlays.length >= before.overlays.length, `overlays ${before.overlays.length} -> ${after.overlays.length}`);
};
const windowing = (label, ringBefore, after) => {
  const missing = ringBefore.filter(l => !after.sky.includes(l));
  findings.push({ step, name: `${label}: ring nodes with no seat in the new sky (windowing)`, ok: true, detail: missing.length ? `${missing.length} of ${ringBefore.length}: ${missing.join(' ')}` : 'none' });
};

// One level's worth of drill-out trials, ending where it started.
const outTrials = async (levelName) => {
  const base = await read();
  say(`${levelName}: drill out, held`);
  await stroke('out', HELD, { lift: false });
  await heldOutChecks(`${levelName} out held`);
  up(OPEN.x + 10, OPEN.y - 10); await sleep(1800);
  springChecks(`${levelName} out sprung back`, base, await read());

  say(`${levelName}: drill out again after the spring-back, held (the layer-retention case)`);
  await stroke('out', HELD, { lift: false });
  await heldOutChecks(`${levelName} out after spring-back`);
  up(OPEN.x + 10, OPEN.y - 10); await sleep(1800);
  springChecks(`${levelName} second spring-back`, base, await read());

  say(`${levelName}: turn the ring, then drill out held (the stale-snapshot case)`);
  await stroke('ccw', TURN);
  const turned = await read();
  check(`${levelName} turn: the ring turned`, turned.lens !== base.lens || !same(turned.ring, base.ring), `${base.lens} -> ${turned.lens}`);
  await stroke('out', HELD, { lift: false });
  await heldOutChecks(`${levelName} out after a turn`);
  up(OPEN.x + 10, OPEN.y - 10); await sleep(1800);
  springChecks(`${levelName} spring-back after a turn`, turned, await read());
  await stroke('cw', TURN);   // turn back
  await sleep(600);
};

try {
  const start = await read();
  say(`start at ${start.lens || '?'} — ring ${start.ring.length}, sky ${start.sky.length}, depth ${start.depth}`);
  check('start: the page has a ring and a sky', start.ring.length > 0 && start.sky.length > 0);
  check('start: the migration log is running', start.depth != null, 'window.__wheelLog absent — is the flag on the address?');

  // L0 -> L1 by open ground
  const s0 = await read();
  say('drill in from open ground');
  await stroke('in', COMMIT);
  const s1 = await read();
  settledChecks('drill in (open ground)', s0, s1, +1);
  await outTrials('level 1');

  // L1 -> L2 from a star: the lens must land on the star pressed.
  const s1b = await read();
  const star = s1b.stars.filter(st => st.label && st.r > 6).sort((a, b) => a.r - b.r)[Math.floor(s1b.stars.length / 3)] || s1b.stars[0];
  if (star && s1b.lensAt) {
    say(`drill in from a star (pressed "${star.label}")`);
    const deg = (Math.atan2(s1b.lensAt.x - star.x, -(s1b.lensAt.y - star.y)) * 180 / Math.PI + 360) % 360;
    await strokeFrom(star.x, star.y, deg, Math.min(COMMIT, Math.hypot(s1b.lensAt.x - star.x, s1b.lensAt.y - star.y) * 0.8));
    const s2 = await read();
    settledChecks('drill in (from a star)', s1b, s2, +1);
    check('drill in (from a star): the star pressed is the one that came', s2.lens === star.label || s2.lens.endsWith(' ' + star.label), `pressed ${star.label}, lens ${s2.lens}`);
  } else {
    say('drill in from open ground (no star found to press)');
    const s1c = await read(); await stroke('in', COMMIT); settledChecks('drill in (open ground, level 2)', s1c, await read(), +1);
  }
  await outTrials('level 2');

  // L2 -> L3 (a leaf, if the volume has one here)
  const s2b = await read();
  say('drill in from open ground, towards a leaf');
  await stroke('in', COMMIT);
  const s3 = await read();
  if (s3.lens !== s2b.lens) {
    settledChecks('drill in (to level 3)', s2b, s3, +1);
    say('level 3: drill out, held');
    await stroke('out', HELD, { lift: false });
    await heldOutChecks('level 3 out held');
    up(OPEN.x + 10, OPEN.y - 10); await sleep(1800);
    springChecks('level 3 out sprung back', s3, await read());
    say('level 3: drill out, committed');
    const b3 = await read(); await stroke('out', COMMIT); const a3 = await read();
    settledChecks('drill out (3 -> 2)', b3, a3, -1); windowing('drill out (3 -> 2)', b3.ringAtSwipe.length ? b3.ringAtSwipe : b3.ring, a3);
  } else {
    findings.push({ step, name: 'level 3: nothing below to drill into (a leaf, or the stroke did not launch)', ok: true, detail: `lens stayed ${s2b.lens}` });
  }

  // back up to the start, committed, checking the windowing each time
  for (const [from, to] of [[2, 1], [1, 0]]) {
    say(`drill out, committed (${from} -> ${to})`);
    const b = await read(); await stroke('out', COMMIT); const a = await read();
    settledChecks(`drill out (${from} -> ${to})`, b, a, -1);
    windowing(`drill out (${from} -> ${to})`, b.ring, a);
  }
  const end = await read();
  check('end: back where it started', end.lens === start.lens && end.depth === start.depth, `${start.lens}/${start.depth} -> ${end.lens}/${end.depth}`);
} catch (e) {
  findings.push({ step, name: 'the sweep itself broke', ok: false, detail: String(e.stack || e).slice(0, 400) });
  console.log('\nSWEEP ERROR', e.message);
} finally {
  release();
  try { const log = await page.evaluate(() => window.__wheelLog?.dump() || ''); writeFileSync(path.join(out, 'wheel-log.json'), log); } catch (e) { /* page gone */ }
  await browser.close().catch(() => {});
}

const fails = findings.filter(f => !f.ok);
const report = { at: new Date().toISOString(), device: dev, url: URL, route, findings, failures: fails.length };
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
const md = [`# Migration sweep — ${report.at}`, '', `device ${dev}`, `route:`, ...route.map(r => `- ${r}`), '', `## ${fails.length} failure(s)`, ...fails.map(f => `- step ${f.step}: **${f.name}** — ${f.detail}`), '', '## every check', ...findings.map(f => `- ${f.ok ? 'ok  ' : 'FAIL'} step ${f.step}: ${f.name}${f.detail ? ' — ' + f.detail : ''}`)].join('\n');
writeFileSync(path.join(out, 'report.md'), md);
console.log(`\n${findings.length} checks, ${fails.length} failed. Written to ${out}`);
