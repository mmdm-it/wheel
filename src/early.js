// THE EARLY LOADER (O-317, Howell 2026-11-20: "making the wait for the user
// as short as possible"). The app is 165 KB of script, and until it had
// arrived and run nothing else was asked for: measured from the screening
// room on a 4 Mbit line, the volume's manifest left 3.2 s after the page
// did, and the first edition's charts — the largest thing the first verse
// waits on — half a second after that. This file is a few kilobytes, loads
// beside the app, and puts those two on the line at once: the manifest, and
// then the charts of the edition the boot will wait for, chosen by the
// boot's own rule (core/first-edition.js). The app's loader takes each from
// `window.__wheelEarly` by its path and fetches for itself whatever is not
// there, so a wrong or failed early fetch costs a request and never a boot.
//
// It acts only where the address plainly names a leaf-and-shard volume — a
// `volume` parameter, or a door of the venue table — and never under the
// LAN's uncleared sidecar, whose manifest is a merge the loader makes.
import { VENUES, WALL_ROOTS, WALL_ADDRESS_KEYS, WALL_RINGS_ABOVE_THE_LEAF } from './volume-roots.js';
import { doorVolume, unclearedActive } from './core/lan-gate.js';
import { chooseFirstEdition } from './core/first-edition.js';
import { phoneLanguages } from './core/tongue.js';
import { recall } from './core/session-memory.js';
import { resolvePath } from './core/identity.js';

(function early() {
  try {
    if (typeof window === 'undefined' || window.__wheelEarly || window.__wheelBooting) return;
    const early = window.__wheelEarly = new Map();
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('volume');
    const volumeId = asked || doorVolume(window.location, VENUES);
    const roots = WALL_ROOTS[volumeId];
    if (!roots || unclearedActive()) return;
    // Asked for at high priority: left at a fetch's default the manifest's
    // eight kilobytes waited out the whole of the app's script on the same
    // connection (1.2 to 1.6 s from the room on a 4 Mbit line).
    const get = path => {
      const p = fetch(path, { priority: 'high' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`); return r.json(); });
      p.catch(() => {});   // the app's loader hears of it, or fetches again
      early.set(path, p);
      return p;
    };
    const at = parts => resolvePath({ base: roots.base, version: roots.version, ...parts });
    get(at({ kind: 'volume' })).then(volume => {
      const code = chooseFirstEdition(volume, {
        remembered: recall(volumeId).edition,
        named: params.get('edition'),
        languages: phoneLanguages()
      });
      if (!code) return;
      get(at({ kind: 'chartIndex', edition: code }));
      get(at({ kind: 'chartBundle', edition: code })).then(bundle => {
        // THE FIRST LEAF'S OWN UNIT, the moment its charts say which it is.
        // The app asked for this text only after every name and shelf had
        // landed and the rings were built — about a second after the charts.
        // Only where the boot will open on a leaf it finds for itself: the
        // one last read, or the first visit's. An address that names a
        // place, or a reader who left a ring above the leaves, is the app's
        // to settle.
        const charts = (bundle && bundle.edition === code && bundle.charts) || null;
        if (!charts) return;
        if (WALL_ADDRESS_KEYS.some(k => params.get(k))) return;
        const memory = recall(volumeId);
        if (WALL_RINGS_ABOVE_THE_LEAF.includes(memory.placeLevel)) return;
        let bookId = null;
        const last = typeof memory.itemId === 'string' ? memory.itemId.slice(0, Math.max(0, memory.itemId.indexOf('_'))) : '';
        if (last && charts[last]) bookId = last;
        if (!bookId && !memory.itemId) {
          const wanted = (volume?.display_config?.boot?.first_visit || []).map(e => e?.utterance).filter(Boolean);
          for (const u of wanted) {
            for (const id of Object.keys(charts)) {
              if ((charts[id]?.seats || []).some(seat => (seat.utterances || []).includes(u))) { bookId = id; break; }
            }
            if (bookId) break;
          }
        }
        if (bookId) get(at({ kind: 'text', unitId: bookId, edition: code }));
      }, () => {});
    }, () => {});
  } catch (_) { /* the app boots without it */ }
}());
