// Phase B.3: merge a reviewed manufacturer draft (data/mmdm/drafts/*.json)
// into mmdm_catalog.json, replacing that manufacturer's node in place.
//
// The replacement is TEXT-SURGICAL: only the target manufacturer's block is
// rewritten, so the rest of the file keeps its exact formatting and key
// order (whole-file re-serialization reorders numeric-looking keys in V8).
//
// Hardened per Phase B audit (H3): the market and country blocks are located
// by brace-matching, the manufacturer key search is BOUNDED to its country
// block and anchored at manufacturer indentation — family names that collide
// with manufacturer names ("Komatsu" the Lugger family vs. Komatsu the
// house) can no longer attract the splice. Validation deep-equals the landed
// node and asserts the rest of the tree is untouched.
// Usage: node scripts/merge-mmdm-manufacturer.mjs data/mmdm/drafts/<name>.json [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';

const draftPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!draftPath) { console.error('usage: merge-mmdm-manufacturer.mjs <draft.json> [--dry-run]'); process.exit(1); }

const CATALOG = new URL('../data/mmdm/mmdm_catalog.json', import.meta.url).pathname;
const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
const { market, country, manufacturer, node } = draft;
if (!market || !country || !manufacturer || !node) { console.error('draft missing market/country/manufacturer/node'); process.exit(1); }

const text = readFileSync(CATALOG, 'utf8');
const parsed = JSON.parse(text);
const manufacturers = parsed?.MMdM?.markets?.[market]?.countries?.[country]?.manufacturers;
if (!manufacturers || !(manufacturer in manufacturers)) {
  console.error(`manufacturer "${manufacturer}" not found at ${market}/${country}`);
  process.exit(1);
}

// Brace-match an object starting at the given opening-brace index; returns
// the index of its closing brace.
function matchBraces(src, openIdx) {
  let depth = 0, inString = false, escaped = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Locate a `"key": {` token at an exact indentation, within [from, to).
function findKeyAt(src, key, indent, from, to) {
  const token = `${' '.repeat(indent)}"${key}": {`;
  const idx = src.indexOf(token, from);
  if (idx < 0 || (to >= 0 && idx >= to)) return -1;
  return idx + token.length - 1; // index of the opening brace
}

// Indentation ladder in this file (4-space): markets=8, market-name=12,
// countries=16, country-name=20, manufacturers=24, manufacturer-name=28.
const marketOpen = findKeyAt(text, market, 12, 0, -1);
if (marketOpen < 0) { console.error(`market block "${market}" not found in text`); process.exit(1); }
const marketEnd = matchBraces(text, marketOpen);
const countryOpen = findKeyAt(text, country, 20, marketOpen, marketEnd);
if (countryOpen < 0) { console.error(`country block "${country}" not found inside market "${market}"`); process.exit(1); }
const countryEnd = matchBraces(text, countryOpen);
const openIdx = findKeyAt(text, manufacturer, 28, countryOpen, countryEnd);
if (openIdx < 0) { console.error(`manufacturer key "${manufacturer}" not found inside ${market}/${country}`); process.exit(1); }
const endIdx = matchBraces(text, openIdx);
if (endIdx < 0) { console.error('brace matching failed'); process.exit(1); }
const keyIdx = openIdx - `"${manufacturer}": {`.length + 1;

// Serialize the new node at the manufacturer's indentation depth.
const baseIndent = ' '.repeat(28);
const serialized = JSON.stringify(node, null, 4)
  .split('\n')
  .map((line, i) => (i === 0 ? line : baseIndent + line))
  .join('\n');

const next = text.slice(0, keyIdx) + `"${manufacturer}": ` + serialized + text.slice(endIdx + 1);

// Validate: result parses, the node landed EXACTLY as the draft specified,
// and nothing else in the tree changed.
const reparsed = JSON.parse(next);
const landed = reparsed.MMdM.markets[market].countries[country].manufacturers[manufacturer];
if (JSON.stringify(landed) !== JSON.stringify(node)) {
  console.error('merged node does not deep-equal the draft node — aborting');
  process.exit(1);
}
const scrub = (tree) => {
  const clone = JSON.parse(JSON.stringify(tree));
  delete clone.MMdM.markets[market].countries[country].manufacturers[manufacturer];
  return JSON.stringify(clone);
};
if (scrub(reparsed) !== scrub(parsed)) {
  console.error('merge modified data outside the target manufacturer — aborting');
  process.exit(1);
}

const countModels = n => {
  let c = 0;
  for (const cyl of Object.values(n.cylinders || {})) {
    c += (cyl.models || []).length;
    for (const fam of Object.values(cyl.families || {})) {
      c += (fam.models || []).length;
      for (const sub of Object.values(fam.subfamilies || {})) c += (sub.models || []).length;
    }
  }
  return c;
};
const buckets = Object.keys(node.cylinders || {});
const gateway = Array.isArray(node.gateway_children) ? ` gateway → ${node.gateway_children.map(g => g.volume).join(', ')}` : '';

if (!dryRun) writeFileSync(CATALOG, next);
console.log(`${dryRun ? '[DRY RUN] ' : ''}merged ${manufacturer} (${market}/${country}): ${countModels(node)} models, ` +
  `${buckets.length} cylinder buckets [${buckets.join(', ')}]${gateway}`);
