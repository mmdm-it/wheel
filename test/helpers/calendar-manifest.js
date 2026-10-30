// A manifest of the volume's shape, generated here: the corpus's own is a
// symlink into a private tree that CI cannot see.
export function calendarManifest(first = -3000, last = 3000) {
  const MONTHS = [['jan', 'January'], ['feb', 'February'], ['mar', 'March'], ['apr', 'April'], ['may', 'May'], ['jun', 'June'],
    ['jul', 'July'], ['aug', 'August'], ['sep', 'September'], ['oct', 'October'], ['nov', 'November'], ['dec', 'December']];
  const WEEK = ['sun', 'Sunday', 'mon', 'Monday', 'tue', 'Tuesday', 'wed', 'Wednesday', 'thu', 'Thursday', 'fri', 'Friday', 'sat', 'Saturday'];
  const month_template = {};
  MONTHS.forEach(([id, name], i) => { month_template[id] = { id, name, month_number: i + 1 }; });
  const weekday_template = {};
  for (let i = 0; i < 7; i += 1) weekday_template[WEEK[2 * i]] = { id: WEEK[2 * i], name: WEEK[2 * i + 1], weekday_number: i };
  const years = {};
  let sort = 1;
  for (let y = first; y <= last; y += 1) {
    if (y === 0) continue;
    const id = String(y);
    years[id] = { id, name: y < 0 ? `${Math.abs(y)} BC` : String(y), year_number: y, sort_number: sort };
    sort += 1;
  }
  return { Calendar: { display_config: { leaf_level: 'day' }, month_template, weekday_template, years } };
}
