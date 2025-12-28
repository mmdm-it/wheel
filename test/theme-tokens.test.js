import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const themeTokensPath = path.join(repoRoot, 'styles', 'theme-tokens.css');
const overlaysDir = path.join(repoRoot, 'styles', 'themes');
const volumes = ['bible', 'catalog', 'calendar', 'places'];

const requiredTokens = [
  'theme-color-bg',
  'theme-color-node',
  'theme-color-text',
  'theme-color-band',
  'theme-color-accent',
  'theme-color-magnifier-stroke',
  'theme-font-body',
  'theme-font-label',
  'theme-font-magnifier',
  'theme-space-2xs',
  'theme-space-xs',
  'theme-space-sm',
  'theme-space-md',
  'theme-space-lg',
  'theme-space-xl',
  'theme-space-2xl',
  'theme-radius-node',
  'theme-radius-panel',
  'theme-radius-card',
  'theme-stroke-node',
  'theme-motion-duration-fast',
  'theme-motion-duration-medium',
  'theme-motion-duration-slow',
  'theme-motion-ease'
];

describe('theme tokens', () => {
  it('defines the required base tokens', async () => {
    const css = await fs.readFile(themeTokensPath, 'utf8');
    requiredTokens.forEach(token => {
      assert.match(css, new RegExp(`--${token}\\s*:`), `Missing token: --${token}`);
    });
  });

  it('declares overlays for all volumes', async () => {
    for (const volume of volumes) {
      const overlayPath = path.join(overlaysDir, `${volume}.css`);
      const css = await fs.readFile(overlayPath, 'utf8');
      assert.match(css, new RegExp(`:root\\[data-theme=\\"${volume}\\"\\]`), `Overlay missing data-theme selector for ${volume}`);
    }
  });
});
