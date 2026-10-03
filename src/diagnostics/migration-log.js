// THE MIGRATION LOG (Howell 2026-10-03, proposing a protocol for the
// disappearing-node bugs: "the program keeps an internal log on the phone and
// I go through whatever motions are necessary to reproduce the bug and then I
// stop, take a screenshot ... you look at the log via wireless debugging").
//
// It records MIGRATIONS, not gestures — the gestures were all correct when
// the ring lost its nodes; what was wrong was which items each flight
// carried and which windows the ring and the sky were showing. So, for every
// transition: each flight overlay as it appears and as it is retired, with
// the labels of the clones it carries; and each change of the ring or the
// sky, with the lens, the ring's labels, the sky's labels and the depth of
// the flight stack. The swipe decisions ride along for context.
//
// It watches the DOM rather than the sixteen places that launch a flight, so
// it changes nothing in the engine and it records what is on the glass
// rather than what the code meant. A ring buffer on window.__wheelLog,
// mirrored to localStorage so a dropped tab is a setback and not a loss, and
// copied to the LAN gesture sink when that is listening.
//
// Reading it: over adb, forward the browser's devtools socket and evaluate
// window.__wheelLog.dump() in the page; or read localStorage['wheel-log'].
// Rule for the reader's hand (Howell's protocol): when it happens, STOP —
// no swipe, no reload — the state at that moment is the evidence.

const KEY = 'wheel-log';
const LIMIT = 500;

export function migrationLogWanted() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('migrationlog') === '1' || q.get('swipelog') === '1';
  } catch { return false; }
}

const txt = el => (el && el.textContent || '').trim();
const labelsIn = (root, sel) => root ? [...root.querySelectorAll(sel)].map(txt).filter(Boolean) : [];

export function mountMigrationLog({ svg, getStackDepth = () => null } = {}) {
  if (typeof window === 'undefined' || !svg) return null;
  const t0 = performance.now();
  const entries = [];
  let mirrorTimer = 0;
  const mirror = () => {
    mirrorTimer = 0;
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-LIMIT))); } catch { /* storage may be absent */ }
  };
  const push = (ev, data = {}) => {
    const e = { t: Math.round(performance.now() - t0), ev, ...data };
    entries.push(e);
    if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
    if (!mirrorTimer) mirrorTimer = setTimeout(mirror, 250);
    try { if (typeof window.__tapDebugLog === 'function') window.__tapDebugLog('mig:' + ev, data); } catch { /* sink only */ }
    return e;
  };

  // THE LEVEL: lens, ring window, sky window, stack depth — whenever any of
  // them changes, debounced so one transition is one entry.
  const level = () => ({
    lens: txt(svg.querySelector('.focus-ring-magnifier-label')),
    parent: txt(svg.querySelector('.focus-ring-parent-label')),
    ring: labelsIn(svg.querySelector('.focus-ring-labels'), 'text'),
    sky: labelsIn(svg.querySelector('.child-pyramid'), 'text'),
    depth: getStackDepth(),
  });
  let lastLevel = '';
  let lastLevelObj = null;
  let levelTimer = 0;
  const noteLevel = why => {
    if (levelTimer) return;
    levelTimer = setTimeout(() => {
      levelTimer = 0;
      const l = level();
      const sig = JSON.stringify([l.lens, l.ring, l.sky]);
      if (sig === lastLevel) return;
      lastLevel = sig; lastLevelObj = l;
      push('level', { why, ...l });
    }, 60);
  };

  // THE FLIGHTS: each overlay as it appears (with what it carries, read a
  // tick later so its clones have been appended) and as it is retired.
  const isOverlay = n => n && n.nodeType === 1 && typeof n.getAttribute === 'function' && /\bmigration-animation-overlay\b/.test(n.getAttribute('class') || '');
  const flightName = n => ((n.getAttribute('class') || '').replace('migration-animation-overlay', '').trim()) || 'plain';
  const describe = ov => {
    const kids = [...ov.children];
    const labels = kids.map(txt).filter(Boolean);
    return { flight: flightName(ov), clones: kids.length, labels: labels.slice(0, 60) };
  };
  // A REPLAYED LAYER IS AN OVERLAY THAT ALREADY EXISTS (found on the phone,
  // 2026-10-03): the drill out shows again the clones the drill in saved, so
  // no node is added — only opacities change. Record an existing overlay's
  // clones becoming visible, so the stale snapshot shows up in the log.
  const shownBefore = new WeakMap();
  const noteReshown = ov => {
    const kids = [...ov.children];
    const vis = kids.filter(k => parseFloat(k.style.opacity || '1') > 0.05).length;
    const was = shownBefore.get(ov) || 0;
    shownBefore.set(ov, vis);
    if (vis > 0 && was === 0) push('reshown', describe(ov));
  };
  const observer = new MutationObserver(muts => {
    let levelTouched = false;
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'style') {
        const ov = m.target.closest && m.target.closest('.migration-animation-overlay');
        if (ov) noteReshown(ov);
        continue;
      }
      for (const n of m.addedNodes) {
        if (isOverlay(n)) setTimeout(() => push('flight', describe(n)), 0);
        else if (n.nodeType === 1) levelTouched = true;
      }
      for (const n of m.removedNodes) {
        if (isOverlay(n)) push('retired', { flight: flightName(n), clones: n.childElementCount });
        else if (n.nodeType === 1) levelTouched = true;
      }
      if (m.type === 'characterData') levelTouched = true;
    }
    if (levelTouched) noteLevel('dom');
  });
  observer.observe(svg, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });

  const api = {
    entries,
    push,
    level,
    lastLevel: () => lastLevelObj,
    dump: () => JSON.stringify({ at: new Date().toISOString(), url: window.location.href, ua: navigator.userAgent, entries }, null, 1),
    clear: () => { entries.length = 0; lastLevel = ''; try { localStorage.removeItem(KEY); } catch { /* absent */ } },
    stop: () => observer.disconnect(),
  };
  window.__wheelLog = api;
  push('start', { url: window.location.href, w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, ua: navigator.userAgent.slice(0, 80) });
  setTimeout(() => noteLevel('boot'), 1500);
  return api;
}
