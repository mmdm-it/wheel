// THE PHONE'S OWN TONGUE (O-176): the browser's ranked language list, matched
// against what the volume offers — the reader's first choice if we have it,
// the next if not, nothing if none.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstOfferedLanguage, primaryOf } from '../src/core/tongue.js';

describe('tongue — the phone settings, not the address', () => {
  const offered = ['hebrew', 'greek', 'latin', 'italian', 'english'];

  it('reads the primary subtag', () => {
    assert.equal(primaryOf('it-IT'), 'it');
    assert.equal(primaryOf('zh-Hant-TW'), 'zh');
    assert.equal(primaryOf('EN'), 'en');
    assert.equal(primaryOf(''), '');
  });

  it('takes the first language the volume offers, in the phone owner’s own order', () => {
    assert.equal(firstOfferedLanguage(['it-IT', 'en-US'], offered), 'italian');
    assert.equal(firstOfferedLanguage(['fi-FI', 'en-GB'], offered), 'english', 'Finnish is not offered yet, so their second choice');
    assert.equal(firstOfferedLanguage(['he-IL'], offered), 'hebrew');
    assert.equal(firstOfferedLanguage(['iw'], offered), 'hebrew', 'the old Hebrew tag some phones still send');
  });

  it('answers nothing when none of the phone’s languages is on the shelf, so the default stands', () => {
    assert.equal(firstOfferedLanguage(['fi-FI', 'sv-SE'], offered), null);
    assert.equal(firstOfferedLanguage([], offered), null);
    assert.equal(firstOfferedLanguage(['en'], []), null);
    assert.equal(firstOfferedLanguage(null, offered), null);
  });

  it('a Finnish phone finds a Finnish edition the day one exists', () => {
    assert.equal(firstOfferedLanguage(['fi-FI', 'en'], [...offered, 'finnish']), 'finnish');
  });
});
