// WF-14: NOTHING PUBLISHED CARRIES CORPUS CONTENT — the text itself, or the
// editorial work product that established it — unless deliberately granted.
// Structure is given away on purpose (NOTICE §1b grants the WILBUR format);
// content is not.
//
// This is the guard, not a reading. **Measured 2026-08-06** (a dated finding,
// not a standing claim): the audit that produced it found exactly one line of
// scripture across the nineteen published documents that existed THEN, and
// every other script match was a LABEL rather than text — language autonyms,
// edition native names, a chapter name, the vocabulary words for "chapter",
// and Greek letters used as mathematical symbols. Those are structure and they
// stay. The count is history; what runs below is the check.
//
// H-5 (2026-08-08) SETS THE STANDARD THIS ENFORCES: a public document's worked
// examples quote the granted fixture set and nothing else — today Genesis 1 in
// the Douay-Rheims and the Vulgate. The fixture is English and Latin, so **no
// Hebrew or Greek scripture can ever be a permitted example**, which is
// precisely the line this guard can draw mechanically. The half it cannot draw
// — Latin or English verse text from outside Genesis 1, which no regex can
// tell from ordinary prose — stays human-audited under WF-13's rotation, with
// the fixture-only rule as its standard.
//
// **Corrected 2026-08-09 (H-5 item 5).** The header above used to assert "one
// line of scripture across nineteen published documents" as a present-tense
// fact, and the walk below read `docs/` NON-recursively — so `docs/prior-art/`
// and `docs/archive/` were never scanned at all. A guard describing coverage
// it did not have is the failure class this repository spent the week finding
// in other places.
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

// **The rule: scripture is a RUN of letters; notation is a letter alone.**
// A single Greek or Hebrew character is a mathematical symbol or a numeral --
// rotate(D-degrees), r*cos(theta), "chapter gimel". Two or more in a row is a
// word, and words are what scripture is made of.
//
// **Corrected 2026-08-09 (H-5 item 5), and this was the serious one.** The old
// rule tested a single-character class with .filter() over CHARACTERS -- and
// since every character is one character long, it stripped EVERY letter of the
// basic Greek block from every line. Monotonic Greek scripture passed the
// guard completely undetected; only polytonic Greek was ever caught, by the
// accident of living in the Extended block instead. The guard was narrower
// than its own header claimed, in the direction that matters.
const SCRIPT_RUN = /[\u0370-\u03FF\u0590-\u05FF\u1F00-\u1FFF]+/gu;

const scrub = line => line
  // numerals with their marks (gamma-keraia, gimel-geresh, yod-gershayim)
  .replace(/[\u0370-\u03FF\u0590-\u05FF][\u02B9\u05F3\u05F4]/gu, '')
  // a run of one is notation; a run of two or more is a word
  .replace(SCRIPT_RUN, run => ([...run].length > 1 ? run : ''));

// PERMITTED tokens are removed from the WHOLE document, not line by line,
// because a label wraps. One edition's native name was split across two lines
// of CHANGELOG.md and reported as two separate offenders -- the scrub could
// not recognise a token it only ever held half of. Matching allows any
// whitespace where the label has a space, and newlines are preserved so the
// reported line numbers stay true.
const blankPermitted = text => {
  let out = text;
  for (const token of PERMITTED) {
    const pattern = token.split(/\s+/)
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    out = out.replace(new RegExp(pattern, 'gu'), m => m.replace(/[^\n]/g, ' '));
  }
  return out;
};

// RECURSIVE, because publication does not stop at a subdirectory. `prior-art/`
// holds the defensive publications — the documents most certain to be read by
// strangers — and `archive/` is still in a public repository: archiving a file
// changes what it governs, never who can read it.
const walk = dir => {
  const out = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (entry.name.endsWith('.md')) out.push(rel);
  }
  return out;
};

// The root-level published files, by NOTICE's own sections: README and
// CHANGELOG are §1b, the deposit metadata is §1b, WORKFLOW and its projection
// are §2 — reserved, but still sitting in a public repository, which is what
// this guard is about. Rights say who may reuse a file; the guard asks who
// can READ one.
const ROOT_PUBLISHED = [
  'README.md', 'CHANGELOG.md', 'WORKFLOW.md', 'CLAUDE.md',
  'NOTICE', 'CITATION.cff', '.zenodo.json'
];

const publishedDocs = () => [...walk('docs'), ...ROOT_PUBLISHED];

describe('WF-14 — published documents carry no corpus content', () => {
  it('no scripture in any published document', () => {
    const offenders = [];
    for (const rel of publishedDocs()) {
      let text;
      try { text = readFileSync(path.join(root, rel), 'utf-8'); } catch { continue; }
      blankPermitted(text).split('\n').forEach((line, i) => {
        if (SCRIPT.test(scrub(line))) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 70)}`);
      });
    }
    assert.deepEqual(offenders, [],
      `corpus script in a published document — is it a LABEL (add it to PERMITTED, saying which kind) or is it TEXT (remove it)?\n${offenders.join('\n')}`);
  });

  // The pipeline as the test above runs it: labels blanked across the whole
  // document, then each line scrubbed of numerals and lone symbols.
  const check = text => SCRIPT.test(scrub(blankPermitted(text)));

  it('the guard actually detects scripture — it is not vacuously green', () => {
    // Genesis 1:1, the line the 2026-08-06 audit found and Howell ruled on.
    assert.ok(check('you watch *In principio* become *Ἐν ἀρχῇ* out there'));
    // And a label must still pass, or the guard is useless.
    assert.ok(!check('named in its own tongue (ESPAÑOL, ΕΛΛΗΝΙΚΆ, עברית)'));
  });

  it('MONOTONIC Greek is caught, not only polytonic — the hole H-5 item 5 closed', () => {
    // Both render Genesis 1:1. Before the fix only the first was detected: the
    // symbol filter ran per character and deleted the entire basic Greek block,
    // so an edition set in modern orthography walked straight through.
    assert.ok(check('Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς'), 'polytonic (Extended block)');
    assert.ok(check('Εν αρχη εποιησεν ο θεος'), 'MONOTONIC (basic block)');
  });

  it('notation and numerals still pass — a lone letter is not scripture', () => {
    assert.ok(!check('applies CSS `transform: rotate(Δ°)` over 600ms'));
    assert.ok(!check('`x = hubX + r*cos(θ)` — polar to Cartesian'));
    assert.ok(!check('the magnifier reads `פֶּּרֶק ג` in Hebrew'));
  });

  it('a label split across a line wrap is still one label', () => {
    // This exact wrap in CHANGELOG.md was reported as two offenders by the
    // per-line scrub, which never held the whole token at once.
    assert.ok(!check('the magnifier reads Vulgata Clementina, כתב יד\nלנינגרד, and more'));
  });

  // WF-17: a guard that cannot prove itself firing is not a guard. This is the
  // cell that would have caught the flat walk — it failed silently for weeks by
  // scanning nothing in the two subdirectories that matter most.
  it('the walk actually reaches the subdirectories, prior-art/ included', () => {
    const scanned = publishedDocs();
    const inDir = d => scanned.filter(f => f.startsWith(path.join('docs', d) + path.sep));

    assert.ok(inDir('prior-art').length >= 3,
      `expected the defensive publications to be scanned, found ${inDir('prior-art').length}`);
    assert.ok(inDir('archive').length >= 5,
      `expected archived documents to be scanned — archiving changes what a file governs, not who can read it; found ${inDir('archive').length}`);
    assert.ok(scanned.includes(path.join('docs', 'archive', 'DECISIONS.md')),
      'the file H-7 archived must still be scanned: it is in a public repository');
  });

  // H-5's mechanically checkable half, stated as an invariant rather than a
  // comment: the granted fixture is Douay-Rheims and Vulgate — English and
  // Latin — so Hebrew and Greek scripture can never qualify as a permitted
  // worked example, whatever else changes.
  it('the fixture-only standard: no Hebrew or Greek can pass as an example', () => {
    const greekVerse = 'Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν';
    const hebrewVerse = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
    assert.ok(SCRIPT.test(scrub(greekVerse)),
      'Greek scripture must be caught even where it renders Genesis 1 — the fixture is DR and Vulgate');
    assert.ok(SCRIPT.test(scrub(hebrewVerse)),
      'Hebrew scripture must be caught even where it renders Genesis 1 — the fixture is DR and Vulgate');
  });
});
