#!/usr/bin/env node
// READ THE MIGRATION LOG OFF THE PHONE (Howell's protocol, 2026-10-03).
//
// He reproduces the bug, STOPS, and sends a screenshot of what is wrong.
// This pulls the evidence: the page's window.__wheelLog over Chrome's
// devtools socket (forwarded through adb), plus a screen grab of the phone
// as it stands. Nothing is sent to the phone; the page is not touched.
//
//   node scripts/read-phone-log.mjs [out-dir]
//
// Needs: wireless debugging on, the laptop paired (see the memory note
// moto-g-wireless-adb), the page open in Chrome with ?swipelog=1 or
// ?migrationlog=1, and Chrome in the FOREGROUND — a backgrounded tab may
// have been dropped, and with it the log (the localStorage mirror is read
// as a fallback).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ADB = process.env.ADB || '/media/howell/dev_workspace/.tools/pt-new/platform-tools/adb';
const PORT = 9333;
const out = path.resolve(process.argv[2] || `phone-log-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', env: { ...process.env, ADB_MDNS_OPENSCREEN: '1' } });

// The device: whatever adb has, preferring a wireless one.
const devices = adb('devices').split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(p => p[1] === 'device').map(p => p[0]);
const dev = devices.find(d => /:\d+$/.test(d)) || devices[0];
if (!dev) { console.error('no device attached — is wireless debugging on, and the port current?'); process.exit(1); }
console.log('device', dev);

// The browser's devtools socket, by name. Chrome first.
const sockets = adb('-s', dev, 'shell', 'cat', '/proc/net/unix').match(/@[\w.]*devtools_remote[\w.]*/g) || [];
const sock = sockets.map(s => s.slice(1)).find(s => s.startsWith('chrome_devtools_remote')) || sockets.map(s => s.slice(1))[0];
if (!sock) { console.error('no browser devtools socket on the phone — is the page open in Chrome, in the foreground?'); process.exit(1); }
console.log('socket', sock);
adb('-s', dev, 'forward', '--remove-all');
adb('-s', dev, 'forward', `tcp:${PORT}`, `localabstract:${sock}`);

// The page.
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => /volume=|wheel-v3|bible/.test(p.url())) || pages[0];
if (!page) { console.error('no page open'); await browser.close(); process.exit(1); }
console.log('page  ', page.url());

// The log, live if the page still holds it, else the storage mirror.
const result = await page.evaluate(() => {
  if (window.__wheelLog) return { source: 'live', text: window.__wheelLog.dump() };
  try { const m = localStorage.getItem('wheel-log'); if (m) return { source: 'localStorage mirror (page reloaded since)', text: m }; } catch (e) { /* absent */ }
  return { source: 'none', text: '' };
});
writeFileSync(path.join(out, 'wheel-log.json'), result.text || '{}');
console.log('log   ', result.source, result.text ? `${result.text.length} chars` : '(empty)');

// What is on the glass right now: the page's own state, and the phone's screen.
const state = await page.evaluate(() => ({
  lens: document.querySelector('#app .focus-ring-magnifier-label:not(.focus-ring-parent-label)')?.textContent?.trim(),
  parent: document.querySelector('#app .focus-ring-parent-label')?.textContent?.trim(),
  ring: [...document.querySelectorAll('#app .focus-ring-labels text')].map(t => t.textContent.trim()).filter(Boolean),
  sky: [...document.querySelectorAll('#app .child-pyramid text')].map(t => t.textContent.trim()).filter(Boolean),
  overlays: [...document.querySelectorAll('#app .migration-animation-overlay')].map(o => ({ flight: (o.getAttribute('class') || '').replace('migration-animation-overlay', '').trim() || 'plain', clones: o.childElementCount })),
}));
writeFileSync(path.join(out, 'state-now.json'), JSON.stringify(state, null, 1));
console.log('now   ', `lens[${state.lens}] ring ${state.ring.length} sky ${state.sky.length} overlays ${state.overlays.length}`);
await browser.close();
try {
  const png = execFileSync(ADB, ['-s', dev, 'exec-out', 'screencap', '-p'], { maxBuffer: 1 << 26 });
  writeFileSync(path.join(out, 'screen.png'), png);
  console.log('screen', `${png.length} bytes`);
} catch (e) { console.log('screen grab failed:', e.message.split('\n')[0]); }
console.log('\nwritten to', out);
