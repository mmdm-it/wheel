// O-322 (Howell 2026-11-21, an iPhone in DuckDuckGo): the verse ran off the
// glass, and the browser warned that the site was not safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a browser text-size setting put on the body cannot inflate the page under it', () => {
  const css = read('styles/base.css');
  // The rule names the body's DESCENDANTS: an inline style on the body itself
  // outranks any rule for the body, but reaches the rest only by inheritance.
  assert.match(css, /\nbody \* \{\s*-webkit-text-size-adjust: 100%;\s*text-size-adjust: 100%;\s*\}/);
});

test('the plain http address sends the visitor to the secure one, before any other rewrite', () => {
  const ht = read('.htaccess');
  const secure = ht.indexOf('RewriteCond %{HTTPS} !=on');
  assert.ok(secure > 0, 'the rule exists');
  assert.match(ht.slice(secure), /^RewriteCond %\{HTTPS\} !=on\s+RewriteRule \^ https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\} \[R=301,L\]/);
  assert.ok(secure < ht.indexOf('RewriteCond %{HTTP:Accept-Encoding} gzip'), 'it runs first');
});
