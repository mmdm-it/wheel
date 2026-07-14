// Phase B.3: merge a reviewed manufacturer draft (data/mmdm/drafts/*.json)
// into mmdm_catalog.json, replacing that manufacturer's node in place.
//
// The replacement is TEXT-SURGICAL: only the target manufacturer's block is
// rewritten, so the rest of the file keeps its exact formatting and key
// order (whole-file re-serialization reorders numeric-looking keys in V8).
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

// Locate the manufacturer's key within its country block, then brace-match.
// Indentation in this file: markets=3 levels in... manufacturer entries sit
// at 7 levels of 4-space indent (28 spaces).
const keyToken = `"${manufacturer}": {`;
const countryToken = `"${country}": {`;
const countryIdx = text.indexOf(countryToken);
if (countryIdx < 0) { console.error('country block not found in text'); process.exit(1); }
const keyIdx = text.indexOf(keyToken, countryIdx);
if (keyIdx < 0) { console.error('manufacturer key not found in text after country'); process.exit(1); }

// Brace-match from the opening brace of the manufacturer object.
const openIdx = keyIdx + keyToken.length - 1;
let depth = 0, endIdx = -1, inString = false, escaped = false;
for (let i = openIdx; i < text.length; i++) {
  const ch = text[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') { inString = true; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx < 0) { console.error('brace matching failed'); process.exit(1); }

// Serialize the new node at the manufacturer's indentation depth.
const baseIndent = ' '.repeat(28);
const serialized = JSON.stringify(node, null, 4)
  .split('\n')
  .map((line, i) => (i === 0 ? line : baseIndent + line))
  .join('\n');

const next = text.slice(0, keyIdx) + `"${manufacturer}": ` + serialized + text.slice(endIdx + 1);

// Validate the result parses and the node landed intact.
const reparsed = JSON.parse(next);
const landed = reparsed.MMdM.markets[market].countries[country].manufacturers[manufacturer];
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
const modelCount = countModels(landed);
if (modelCount !== countModels(node)) { console.error('model count mismatch after merge'); process.exit(1); }

if (!dryRun) writeFileSync(CATALOG, next);
console.log(`${dryRun ? '[DRY RUN] ' : ''}merged ${manufacturer} (${market}/${country}): ${modelCount} models, ` +
  `${Object.keys(node.cylinders).length} cylinder buckets [${Object.keys(node.cylinders).join(', ')}]`);
