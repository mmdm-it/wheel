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

function ordinal(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}ST`;
  if (mod10 === 2 && mod100 !== 12) return `${n}ND`;
  if (mod10 === 3 && mod100 !== 13) return `${n}RD`;
  return `${n}TH`;
}

function millenniumInfo(yearNumber) {
  if (yearNumber === 0) throw new Error('Year 0 is not supported');
  if (yearNumber > 0) {
    const bucket = Math.floor((yearNumber - 1) / 1000) + 1;
    const id = `millennium_ad_${bucket}`;
    return { id, name: `${ordinal(bucket)} MILLENIA A.D.`, bucket, era: 'AD' };
  }
  const bucket = Math.floor((Math.abs(yearNumber) - 1) / 1000) + 1;
  const id = `millennium_bc_${bucket}`;
  return { id, name: `${ordinal(bucket)} MILLENIA B.C.`, bucket, era: 'BC' };
}

function yearLabel(yearNumber) {
  if (yearNumber < 0) return `${Math.abs(yearNumber)} BC`;
  return `${yearNumber} AD`;
}

function buildCalendarData() {
  const years = {};
  const millennia = {};
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

    const milli = millenniumInfo(year);
    if (!millennia[milli.id]) {
      millennia[milli.id] = {
        id: milli.id,
        name: milli.name,
        era: milli.era,
        bucket: milli.bucket,
        start_year: year,
        end_year: year,
        sort_number: milli.era === 'BC' ? -milli.bucket : milli.bucket,
        years: []
      };
    } else {
      millennia[milli.id].start_year = Math.min(millennia[milli.id].start_year, year);
      millennia[milli.id].end_year = Math.max(millennia[milli.id].end_year, year);
    }
    millennia[milli.id].years.push(String(year));

    years[year] = {
      id: String(year),
      name: yearLabel(year),
      year_number: year,
      sort_number: sortCounter,
      millennium_id: milli.id,
      parentName: milli.name,
      months
    };
  }

  const manifest = {
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
          millennium: { display_name: 'Millennia', color: '#5d3fd3' },
          year: { display_name: 'Year', color: '#b8860b' },
          month: { display_name: 'Month', color: '#556b2f' }
        }
      },
      millennia,
      years
    }
  };

  const millenniumOrder = Object.values(millennia)
    .sort((a, b) => a.sort_number - b.sort_number)
    .map(m => m.id);

  const schema = {
    name: 'Calendar',
    version: '0.1-dev',
    levels: [
      {
        name: 'Millennium',
        depth: 0,
        properties: ['id', 'name', 'era', 'bucket', 'start_year', 'end_year', 'sort_number']
      },
      {
        name: 'Year',
        depth: 1,
        properties: ['id', 'name', 'year_number', 'sort_number', 'millennium_id']
      },
      {
        name: 'Month',
        depth: 2,
        properties: ['id', 'name', 'month_number'],
        isLeaf: true
      }
    ],
    root: {
      id: 'root',
      children: millenniumOrder
    }
  };

  return { manifest, schema };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { manifest, schema } = buildCalendarData();

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

  const yearCount = Object.keys(manifest.Calendar.years).length;
  const monthCount = yearCount * MONTHS.length;
  console.log(`Calendar manifest written to ${manifestPath}`);
  console.log(`Calendar schema written to ${schemaPath}`);
  console.log(`Years: ${yearCount}, Months: ${monthCount}`);
}

main();
