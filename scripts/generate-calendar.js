#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const START_YEAR = -3000; // 3000 BC
const END_YEAR = 2026; // 2026 AD
const MONTHS = [
  ['jan', 'January'],
  ['feb', 'February'],
  ['mar', 'March'],
  ['apr', 'April'],
  ['may', 'May'],
  ['jun', 'June'],
  ['jul', 'July'],
  ['aug', 'August'],
  ['sep', 'September'],
  ['oct', 'October'],
  ['nov', 'November'],
  ['dec', 'December']
];

const outDir = path.resolve(process.cwd(), 'data/calendar');
const manifestPath = path.join(outDir, 'manifest.json');
const schemaPath = path.join(outDir, 'schema.json');

function yearLabel(yearNumber) {
  if (yearNumber < 0) return `${Math.abs(yearNumber)} BC`;
  return `${yearNumber} AD`;
}

function buildManifest() {
  const years = {};
  let sortCounter = 0;
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    if (year === 0) continue; // Skip year 0 per spec
    sortCounter += 1;
    const months = {};
    MONTHS.forEach(([id, name], idx) => {
      months[id] = {
        id,
        name,
        month_number: idx + 1
      };
    });
    years[year] = {
      id: String(year),
      name: yearLabel(year),
      year_number: year,
      sort_number: sortCounter,
      months
    };
  }

  return {
    Calendar: {
      display_config: {
        wheel_volume_version: '0.1-dev',
        volume_schema_version: '0.1-dev',
        volume_data_version: '0.1-dev',
        structure_type: 'calendar',
        volume_type: 'wheel_hierarchical',
        volume_name: 'Calendar (Dev)',
        volume_description: 'Year/month synthetic dataset for stress testing',
        leaf_level: 'month',
        focus_ring_startup: {
          initial_magnified_item: String(END_YEAR),
          top_navigation_level: 'year'
        },
        hierarchy_levels: {
          year: { display_name: 'Year', color: '#b8860b' },
          month: { display_name: 'Month', color: '#556b2f' }
        }
      },
      years
    }
  };
}

function buildSchema() {
  return {
    name: 'Calendar',
    version: '0.1-dev',
    levels: [
      {
        name: 'Year',
        depth: 0,
        properties: ['id', 'name', 'year_number', 'sort_number']
      },
      {
        name: 'Month',
        depth: 1,
        properties: ['id', 'name', 'month_number'],
        isLeaf: true
      }
    ],
    root: {
      id: 'root',
      children: Array.from({ length: END_YEAR - START_YEAR + 1 })
        .map((_, idx) => START_YEAR + idx)
        .filter(year => year !== 0)
        .map(String)
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = buildManifest();
  const schema = buildSchema();

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

  const yearCount = Object.keys(manifest.Calendar.years).length;
  const monthCount = yearCount * MONTHS.length;
  console.log(`Calendar manifest written to ${manifestPath}`);
  console.log(`Calendar schema written to ${schemaPath}`);
  console.log(`Years: ${yearCount}, Months: ${monthCount}`);
}

main();
