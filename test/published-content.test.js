// WF-14: NOTHING PUBLISHED CARRIES CORPUS CONTENT — the text itself, or the
// editorial work product that established it — unless deliberately granted.
// Structure is given away on purpose (NOTICE §1b grants the WILBUR format);
// content is not.
//
// This is the guard, not a reading. The audit that produced it (2026-08-06)
// found exactly one line of scripture across nineteen published documents,
// and every other script match was a LABEL rather than text: language
// autonyms, edition native names, a chapter name, the vocabulary words for
// "chapter", and Greek letters used as mathematical symbols. Those are
// structure and they stay.
//
// Written as a test because WF-14 is otherwise a disposition, and this week
// has been an extended demonstration that dispositions fail. The rule now
// fails loudly the moment new script arrives in a published document, and
// whoever adds it must say which category it belongs to — which is the whole
// question the audit exists to ask.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Hebrew and Greek blocks. Cyrillic is deliberately absent: no scripture in
// this corpus is Cyrillic-only, and the Synodal edition's NAME is a label.
const SCRIPT = /[֐-׿Ͱ-Ͽἀ-῿]/u;

// LABELS, NOT TEXT. Each is a name the app displays or a symbol the prose
// needs — none is scripture. Extend this list only for another label, and say
// which kind it is; anything you cannot classify is probably content.
const PERMITTED = [
  'ΕΛΛΗΝΙΚΆ', 'Ελληνικά',            // language autonym
  'עברית',                            // language autonym
  'Οἱ Ἑβδομήκοντα',                   // edition native name
  'כתב יד לנינגרד',                    // edition native name
  'Δανιὴλ κατὰ Θεοδοτίωνα',           // edition native name
  'Πρόλογος',                         // a chapter's NAME, not its text
  'Κεφάλαιον', 'פֶּּרֶק', 'פרק',          // the vocabulary word for "chapter"
  'Στίχος',                           // the vocabulary word for "verse"
  'Ἡ Ἁγία Γραφή', 'כתבי הקודש'         // the volume's own title
];

// A lone Greek letter carrying mathematical weight — π, Δ, α, θ — is notation.
const MATH_SYMBOL = /^[Ͱ-Ͽ]$/u;

const scrub = line => {
  let out = line;
  for (const token of PERMITTED) out = out.split(token).join('');
  // strip numerals-with-marks (γʹ, ג׳, י״ז) and isolated symbol letters
  out = out.replace(/[Ͱ-Ͽ֐-׿][ʹʹ׳״]/gu, '');
  return [...out].filter(ch => !MATH_SYMBOL.test(ch)).join('');
};

const publishedDocs = () => {
  const files = readdirSync(path.join(root, 'docs'))
    .filter(f => f.endsWith('.md'))
    .map(f => path.join('docs', f));
  for (const f of ['README.md', 'WORKFLOW.md', 'NOTICE']) files.push(f);
  return files;
};

describe('WF-14 — published documents carry no corpus content', () => {
  it('no scripture in any published document', () => {
    const offenders = [];
    for (const rel of publishedDocs()) {
      let text;
      try { text = readFileSync(path.join(root, rel), 'utf-8'); } catch { continue; }
      text.split('\n').forEach((line, i) => {
        if (SCRIPT.test(scrub(line))) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 70)}`);
      });
    }
    assert.deepEqual(offenders, [],
      `corpus script in a published document — is it a LABEL (add it to PERMITTED, saying which kind) or is it TEXT (remove it)?\n${offenders.join('\n')}`);
  });

  it('the guard actually detects scripture — it is not vacuously green', () => {
    // Genesis 1:1, the line the 2026-08-06 audit found and Howell ruled on.
    assert.ok(SCRIPT.test(scrub('you watch *In principio* become *Ἐν ἀρχῇ* out there')));
    // And a label must still pass, or the guard is useless.
    assert.ok(!SCRIPT.test(scrub('named in its own tongue (ESPAÑOL, ΕΛΛΗΝΙΚΆ, עברית)')));
  });
});
