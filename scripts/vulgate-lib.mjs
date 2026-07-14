// Shared helpers for the Phase B Vulgate data migration (2026-07).
// Source corpus: the Clementine Vulgate Project files preserved in
// ../wheel-v0/sources/latin/clementine/src/utf8 (see wheel-v0 BOOKPOPULATION.md).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const CORPUS_DIR = '/media/howell/dev_workspace/wheel-v0/sources/latin/clementine/src/utf8';
export const CHAPTERS_DIR = new URL('../data/gutenberg/chapters', import.meta.url).pathname;

// chapters/<DIR> → Clementine <file>.lat
export const BOOK_TO_LAT = {
  ABDI: 'Abd', ACTU: 'Act', AGGE: 'Agg', AMO: 'Am', APOC: 'Apc', BARU: 'Bar',
  CANT: 'Ct', COLO: 'Col', DAN: 'Dn', DEUT: 'Dt', ECCLE: 'Ecl', ECCLU: 'Sir',
  EPHE: 'Eph', ESTH: 'Est', EXO: 'Ex', EZE: 'Ez', GALA: 'Gal', GENE: 'Gn',
  HAB: 'Hab', HEBR: 'Hbr', IACO: 'Jac', I_COR: '1Cor', IERE: 'Jr', II_COR: '2Cor',
  III_IOHA: '3Jo', II_IOHA: '2Jo', III_REG: '3Rg', I_IOHA: '1Jo', II_PETR: '2Ptr',
  II_SAM: '2Rg', II_THES: '2Thes', II_TIMO: '2Tim', IOB: 'Job', IOEL: 'Joel',
  IOHA: 'Jo', IONA: 'Jon', IOSU: 'Jos', I_PETR: '1Ptr', ISA: 'Is', I_SAM: '1Rg',
  I_THES: '1Thes', I_TIMO: '1Tim', IUDA: 'Jud', IUDI: 'Jdc', IUDITH: 'Jdt',
  IV_REG: '4Rg', LAME: 'Lam', LEVI: 'Lv', LUCA: 'Lc', MALA: 'Mal', MARC: 'Mc',
  MATHE: 'Mt', MICH: 'Mch', NAHU: 'Nah', NUME: 'Nm', OSE: 'Os', PHILE: 'Phlm',
  PHILI: 'Phlp', PROV: 'Pr', PSAL: 'Ps', ROM: 'Rom', RUTH: 'Rt', SAPI: 'Sap',
  SOPH: 'Soph', TITU: 'Tit', TOBI: 'Tob', ZACH: 'Zach'
};

// Parse a .lat file → { [chapter]: { [verse]: rawText } }
export function parseLat(latName) {
  const raw = readFileSync(join(CORPUS_DIR, `${latName}.lat`), 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(\d+):(\d+)\s(.*)$/);
    if (!m) continue;
    const [, ch, v, text] = m;
    (out[ch] ||= {})[v] = text;
  }
  return out;
}

// The v0 import stored Clementine text with inner typography markers kept.
// Determine the exact stored transform empirically against a fully-covered
// book, so filled text is byte-identical in style to existing text.
const CANDIDATES = [
  ['raw', t => t],
  ['strip-trailing-markers', t => t.replace(/[\\/\s]+$/g, '').trim()],
  ['strip-trailing-backslash', t => t.replace(/\\\s*$/g, '').trim()]
];

export function detectTransform(readChapterFile) {
  const results = [];
  for (const [name, fn] of CANDIDATES) {
    let match = 0, total = 0;
    for (const book of ['GENE', 'ISA', 'LUCA']) {
      const lat = parseLat(BOOK_TO_LAT[book]);
      for (const chFile of readdirSync(join(CHAPTERS_DIR, book)).slice(0, 5)) {
        const data = readChapterFile(book, chFile);
        const chNum = String(Number.parseInt(chFile, 10));
        for (const [vk, verse] of Object.entries(data.verses || {})) {
          const stored = verse?.text?.VUL;
          const corpus = lat[chNum]?.[vk];
          if (typeof stored !== 'string' || typeof corpus !== 'string') continue;
          total++;
          if (fn(corpus) === stored) match++;
        }
      }
    }
    results.push({ name, fn, match, total });
  }
  results.sort((a, b) => b.match - a.match);
  const best = results[0];
  return { ...best, rate: best.total ? best.match / best.total : 0, all: results.map(r => `${r.name}:${r.match}/${r.total}`) };
}
