import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const themesDir = resolve(process.cwd(), 'styles/themes');
// Three volumes since H-16 retired places (Howell 2026-08-13).
const volumes = ['bible', 'calendar', 'catalog'];

describe('theme swap smoke', () => {
  volumes.forEach(volume => {
    it(`declares theme block for ${volume}`, () => {
      const cssPath = resolve(themesDir, `${volume}.css`);
      const css = readFileSync(cssPath, 'utf8');
      assert.ok(css.includes(`:root[data-theme="${volume}"]`), `missing data-theme selector for ${volume}`);
      assert.ok(css.trim().length > 0, 'theme file should not be empty');
    });
  });
});
