// Generates data/calendar/manifest.json per the 2026-07-17 rulings:
//   - years 3000 BC .. 3000 AD, NO year zero (…"-2","-1","1","2"…) — a
//     calendar must see into the future, and both chain ends are real places
//   - years are the TOP level: the millennia layer is gone (demoted to
//     cousin-gap texture at build-chain time, not a parent you enter)
//   - year names: bare number for AD ("1969"), "BC" suffix for BC
//     ("753 BC") — the suffix appearing marks the era crossing at any speed
//   - months stored ONCE as month_template and synthesized per year
//     (every year carried an identical copy before: 8.4MB of duplication;
//     C.2 doctrine — data transport is the whole cost)
// Days do not exist yet; when they arrive, future years get them too.
import { writeFileSync } from 'node:fs';

const OUT = new URL('../data/calendar/manifest.json', import.meta.url).pathname;

const START_YEAR = -3000;
const END_YEAR = 3000;

const MONTHS = [
  ['jan', 'January'], ['feb', 'February'], ['mar', 'March'],
  ['apr', 'April'], ['may', 'May'], ['jun', 'June'],
  ['jul', 'July'], ['aug', 'August'], ['sep', 'September'],
  ['oct', 'October'], ['nov', 'November'], ['dec', 'December']
];

const month_template = {};
MONTHS.forEach(([id, name], idx) => {
  month_template[id] = { id, name, month_number: idx + 1 };
});

const years = {};
let sort = 0;
for (let y = START_YEAR; y <= END_YEAR; y += 1) {
  if (y === 0) continue; // there is no year zero
  sort += 1;
  const id = String(y);
  years[id] = {
    id,
    name: y < 0 ? `${Math.abs(y)} BC` : String(y),
    year_number: y,
    sort_number: sort
  };
}

const manifest = {
  Calendar: {
    display_config: {
      wheel_volume_version: '0.2-dev',
      volume_schema_version: '0.2-dev',
      volume_data_version: '0.2-dev',
      structure_type: 'calendar',
      volume_type: 'wheel_hierarchical',
      volume_name: 'Calendar (Dev)',
      volume_description: 'Gregorian year/month dataset, 3000 BC – 3000 AD',
      leaf_level: 'month',
      focus_ring_startup: {
        // no initial_magnified_item: the chain builder lands on the actual
        // current year at runtime — a hardcoded year goes stale every January
        top_navigation_level: 'year'
      },
      hierarchy_levels: {
        year: { display_name: 'Year', color: '#b8860b' },
        month: { display_name: 'Month', color: '#556b2f' }
      }
    },
    month_template,
    years
  }
};

writeFileSync(OUT, JSON.stringify(manifest));
const kb = Math.round(JSON.stringify(manifest).length / 1024);
console.log(`generate-calendar: ${sort} years (${START_YEAR}..${END_YEAR}, no year 0) → ${kb}KB`);
