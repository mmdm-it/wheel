// WHICH EDITION THE BOOT WAITS FOR (O-175): the one the reader chose last
// time; failing that, the one the address names (O-219); failing that, the
// one the phone's own languages point to (O-176); failing that, the volume's
// default; failing that, the first thing offered. The same order the boot
// itself settles on, so the edition shown is the edition waited for.
//
// Lifted out of the volume's loader (O-317) so the early loader asks the same
// question with the same code: a guess of its own would, when wrong, put a
// quarter of a megabyte on the line for an edition nobody opens.
import { firstOfferedLanguage } from './tongue.js';

export function chooseFirstEdition(volumeJson, { remembered = null, named = null, languages = [] } = {}) {
  const cfg = volumeJson?.display_config || {};
  // O-229: the CHECKED gate is open — every edition the volume (and, on the
  // LAN under ?uncleared=true, its sidecar) enumerates is offered.
  const servable = e => Boolean(e) && e.hasChart !== false;
  const enumerated = volumeJson?.editions || [];
  const offered = new Set(enumerated.filter(servable).map(e => e.code));
  if (remembered && offered.has(remembered)) return remembered;
  if (named && offered.has(named)) return named;
  const defaults = cfg.editions?.default || {};
  const tonguesOffered = Object.keys(defaults).filter(l => offered.has(defaults[l]));
  const lang = firstOfferedLanguage(languages, tonguesOffered);
  const byTongue = lang ? defaults[lang] : null;
  if (byTongue && offered.has(byTongue)) return byTongue;
  const dflt = defaults[cfg.languages?.default];
  if (dflt && offered.has(dflt)) return dflt;
  // The first thing offered, in the volume's own order — the boot seats the
  // same (main.js, the same number).
  return enumerated.find(e => offered.has(e.code))?.code || null;
}
