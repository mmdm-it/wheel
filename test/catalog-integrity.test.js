import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Guards the catalog's structural invariants: every container in the
// hierarchy must lead to at least one model, and every model must carry
// its prose. A node with nothing behind it is a dead end in the wheel.

let catalog;

function modelCount(container) {
  let n = (container.models ?? []).length;
  for (const fam of Object.values(container.families ?? {})) {
    n += (fam.models ?? []).length;
    for (const sub of Object.values(fam.subfamilies ?? {})) {
      n += (sub.models ?? []).length;
    }
  }
  return n;
}

function* manufacturers() {
  for (const [marketName, market] of Object.entries(catalog.MMdM.markets)) {
    for (const [countryName, country] of Object.entries(market.countries)) {
      for (const [name, node] of Object.entries(country.manufacturers)) {
        yield { marketName, countryName, name, node };
      }
    }
  }
}

describe('catalog integrity', () => {
  before(async () => {
    const raw = await fs.readFile(
      path.join(repoRoot, 'data', 'mmdm', 'mmdm_catalog.json'),
      'utf8'
    );
    catalog = JSON.parse(raw);
  });

  it('every country has at least one manufacturer', () => {
    for (const market of Object.values(catalog.MMdM.markets)) {
      for (const [countryName, country] of Object.entries(market.countries)) {
        assert.ok(
          Object.keys(country.manufacturers ?? {}).length > 0,
          `country "${countryName}" has no manufacturers`
        );
      }
    }
  });

  it('every manufacturer has cylinder buckets, or is a gateway', () => {
    for (const { name, node } of manufacturers()) {
      if (node.gateway_children) continue;
      assert.ok(
        Object.keys(node.cylinders ?? {}).length > 0,
        `manufacturer "${name}" has no cylinder buckets and is not a gateway`
      );
    }
  });

  it('every cylinder bucket leads to at least one model', () => {
    for (const { name, node } of manufacturers()) {
      for (const [cyl, bucket] of Object.entries(node.cylinders ?? {})) {
        assert.ok(
          modelCount(bucket) > 0,
          `empty bucket: ${name} [${cyl}]`
        );
      }
    }
  });

  it('every family and subfamily has at least one model beneath it', () => {
    for (const { name, node } of manufacturers()) {
      for (const [cyl, bucket] of Object.entries(node.cylinders ?? {})) {
        for (const [famName, fam] of Object.entries(bucket.families ?? {})) {
          const famModels =
            (fam.models ?? []).length +
            Object.values(fam.subfamilies ?? {}).reduce(
              (n, sub) => n + (sub.models ?? []).length,
              0
            );
          assert.ok(
            famModels > 0,
            `empty family: ${name} [${cyl}] "${famName}"`
          );
          for (const [subName, sub] of Object.entries(fam.subfamilies ?? {})) {
            assert.ok(
              (sub.models ?? []).length > 0,
              `empty subfamily: ${name} [${cyl}] "${famName}/${subName}"`
            );
          }
        }
      }
    }
  });

  it('every model carries key_notes and description prose', () => {
    const bare = [];
    for (const { name, node } of manufacturers()) {
      for (const bucket of Object.values(node.cylinders ?? {})) {
        const all = [
          ...(bucket.models ?? []),
          ...Object.values(bucket.families ?? {}).flatMap((fam) => [
            ...(fam.models ?? []),
            ...Object.values(fam.subfamilies ?? {}).flatMap(
              (sub) => sub.models ?? []
            ),
          ]),
        ];
        for (const m of all) {
          if (!m.data?.key_notes || !m.data?.description) {
            bare.push(`${name}: ${m.engine_model}`);
          }
        }
      }
    }
    assert.deepEqual(bare, [], `models without full prose: ${bare.join(', ')}`);
  });
});

// Phase B audit M3: gateway declarations are data — a typo'd volume id or a
// malformed child ships a clickable node that silently does nothing. The
// known-volume set mirrors src/main.js volumeConfigs.
const KNOWN_VOLUMES = ['catalog', 'bible', 'calendar', 'places'];

describe('gateway integrity', () => {
  it('gateway_children are well-formed and name known volumes only', () => {
    for (const { name, node } of manufacturers()) {
      if (node.gateway_children === undefined) continue;
      assert.ok(
        Array.isArray(node.gateway_children) && node.gateway_children.length > 0,
        `${name}: gateway_children must be a non-empty array`
      );
      for (const gw of node.gateway_children) {
        assert.ok(typeof gw.name === 'string' && gw.name.length > 0, `${name}: gateway child missing name`);
        assert.ok(KNOWN_VOLUMES.includes(gw.volume), `${name}: gateway names unknown volume "${gw.volume}"`);
        assert.ok(Number.isFinite(gw.sort_number), `${name}: gateway child "${gw.name}" missing sort_number`);
      }
    }
  });

  it('a manufacturer is a gateway or an engine house, never both', () => {
    for (const { name, node } of manufacturers()) {
      if (node.gateway_children === undefined) continue;
      assert.ok(
        Object.keys(node.cylinders ?? {}).length === 0,
        `${name}: declares both gateway_children and cylinders — the cylinders would be unreachable`
      );
    }
  });

  it('the census holds: 1,032 models across 99 houses plus 2 gateway patrons', () => {
    // The Phase C docs audit caught "100 manufacturers" drifting into three
    // documents — false under every reading. Pin the real numbers so the
    // prose can be checked against a guard, and any data change that moves
    // them is a DELIBERATE census event, not a silent drift.
    let models = 0;
    let houses = 0;
    let patrons = 0;
    for (const { node } of manufacturers()) {
      if (node.gateway_children !== undefined) { patrons += 1; continue; }
      houses += 1;
      for (const cylVal of Object.values(node.cylinders ?? {})) {
        models += Array.isArray(cylVal.models) ? cylVal.models.length : 0;
        for (const famVal of Object.values(cylVal.families ?? {})) {
          models += Array.isArray(famVal.models) ? famVal.models.length : 0;
          for (const subVal of Object.values(famVal.subfamilies ?? {})) {
            models += Array.isArray(subVal.models) ? subVal.models.length : 0;
          }
        }
      }
    }
    assert.equal(models, 1032, 'model census');
    assert.equal(houses, 99, 'engine-house census');
    assert.equal(patrons, 2, 'gateway patrons (Gutenberg, Gregorio XIII)');
  });
});
