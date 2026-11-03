// THE EDITION RING DOES NOT JUMP AT THE FIRST TRUCK (Howell 2026-11-03): as
// the language ring came to rest on English, the edition ring behind it had
// King James in the lens for an instant, then jumped to the Catholic Public
// Domain Version as the truck began. The receded ring previews a tongue's
// first edition; in the overture the tongue the film rests on shows the seat
// the edition turn starts from instead, so the truck lands where it stood.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

describe('the overture lands the edition ring where it already stood', () => {
  it('the edition turn records the landing seat, or the reader\'s own when nothing turns', () => {
    assert.match(main, /overtureLanding = tongue \? \{ language: tongue, edition: dimensionBridge\.editionOfKey\?\.\(items\[items\.length >= 2 && from !== to \? from : to\]\) \?\? null \} : null;/);
  });
  // by edition code: the plan is made while the shelves stock, when the seat
  // is a hollow key ('__coming__:…') that the real key replaces before the
  // lens arrives — the first cut matched by key and so never matched at all.
  it('the language preview takes the landing edition for that tongue, only while the film runs', () => {
    assert.match(main, /const landing = bootOvertureLive && overtureLanding\?\.language === item\s+\? editions\.find\(k => dimensionBridge\.editionOfKey\?\.\(k\) === overtureLanding\.edition\) : null;/);
    assert.match(main, /edition: landing \|\| editions\.find/);
  });
  it('the film asks for the language turn before the edition turn, and the truck seats the edition turn\'s start', () => {
    const film = fs.readFileSync(new URL('../src/view/boot-overture.js', import.meta.url), 'utf8');
    assert.match(film, /const turnA = drive\.turn\?\.\(2\) \|\| null, turnB = drive\.turn\?\.\(1\) \|\| null;/);
    assert.match(film, /seat: turnB \? \{ 1: turnB\.from \} : null/);
  });
});
