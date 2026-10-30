// DECADES AND CENTURIES (O-242, Howell 2026-10-29): two levels above the
// years. "For decades I'm thinking OUGHTS, TEENS, TWENTIES … NINETIES. They
// can repeat in the Focus Ring, just as dates and months do. The Parent
// Button would likewise use words, such as '21st CENTURY'." Centuries read
// "18th CENTURY" or "3rd CENTURY B.C.", the word CENTURY riding beside the
// lens as the Bible's CHAPTER and VERSE do.
//
// THE DIGITS DECIDE, not the strict count. The 21st century here is 2000 to
// 2099 and its OUGHTS are 2000 to 2009, so every decade sits inside one
// century; the strict reckoning (2001 to 2100) would split the OUGHTS across
// two. With no year zero, the decades and centuries that touch the era line
// are a year short: 1–9, 1–99, and the same before Christ.
//
// The words are English, beside the era mark the year formatter already
// carries; a translation moves them here.
export const DECADE_WORDS = ['OUGHTS', 'TEENS', 'TWENTIES', 'THIRTIES', 'FORTIES',
  'FIFTIES', 'SIXTIES', 'SEVENTIES', 'EIGHTIES', 'NINETIES'];
export const CENTURY_WORD = 'CENTURY';
export const CENTURY_ERA_BC = 'B.C.';

const eraOf = y => (y < 0 ? -1 : 1);
/** The century's ordinal number, 1 upward on either side of the era line. */
export const centuryNumberOf = y => Math.floor(Math.abs(y) / 100) + 1;
/** Which decade of its century, 0 (OUGHTS) to 9 (NINETIES). */
export const decadeDigitOf = y => Math.floor(Math.abs(y) / 10) % 10;
export const centuryIdOf = y => `c:${eraOf(y) < 0 ? '-' : ''}${centuryNumberOf(y)}`;
export const decadeIdOf = y => `dd:${eraOf(y) < 0 ? '-' : ''}${Math.floor(Math.abs(y) / 10)}`;
export const millenniumIdOf = y => `m:${eraOf(y) < 0 ? '-' : ''}${Math.floor(Math.abs(y) / 1000)}`;

export function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}

/** "21st", or "3rd B.C." — a ring node's face. */
export const centuryShortLabel = (n, era) => (era < 0 ? `${ordinal(n)} ${CENTURY_ERA_BC}` : ordinal(n));
/** "21st CENTURY", or "3rd CENTURY B.C." — the parent seat's words. */
export const centuryLongLabel = (n, era) => `${ordinal(n)} ${CENTURY_WORD}${era < 0 ? ` ${CENTURY_ERA_BC}` : ''}`;
