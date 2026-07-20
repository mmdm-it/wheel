#!/usr/bin/env python3
"""extract-calendario.py — read the MMdM wall calendar SVGs (the print
edition, data/calendar/sources/calendario-<year>/) into the app's stored
ephemeris (data/calendar/ephemeris-<year>.json).

The wall calendar is the SOURCE OF TRUTH for tides and red days (Howell
2026-07-20, docs/DETAIL_SECTOR_LOADS.md). Sunrise/sunset are extracted too,
but only as the acceptance test for the app's own astronomy: the script
computes them independently (NOAA algorithm, Fano, civil time) and reports
the deviation from print. Moon quarters likewise.

Per day cell the print carries: alba/tramonto (bare H:MM), the day's
highest high and lowest low tide ("H:MM, D.D m" — heights can be negative),
an optional moon-quarter label, and a red numeral on Sundays/feasts.

Usage: python3 scripts/extract-calendario.py [year]   (default 2026)
"""
import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'data', 'calendar', 'sources', f'calendario-{YEAR}')
OUT_PATH = os.path.join(ROOT, 'data', 'calendar', f'ephemeris-{YEAR}.json')

# Fano (PU) — the permanent station (printed legend: "si riferiscono a Fano").
LAT, LON = 43.8433, 13.0172

MOON_LABELS = {'LUNA NUOVA': 'nuova', 'PRIMO QUARTO': 'primo',
               'LUNA PIENA': 'piena', 'ULTIMA QUARTO': 'ultima'}
DAYS_IN_MONTH = [31, 29 if YEAR % 4 == 0 and (YEAR % 100 != 0 or YEAR % 400 == 0) else 28,
                 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

SVG_NS = '{http://www.w3.org/2000/svg}'
CELL_W = 240      # column pitch of the day grid (px, page space)
ROW_BAND = 70     # a value belongs to a numeral within this vertical band
NUMERAL_MIN_PX = 25  # effective font size that distinguishes day numerals

TIME_RE = re.compile(r'^(\d{1,2}):(\d{2})$')
TIDE_RE = re.compile(r'^(\d{1,2}):(\d{2}),\s*(-?\d+(?:[.,]\d+)?)\s*m$')


def mat_mul(m1, m2):
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def parse_transform(tr):
    m = (1, 0, 0, 1, 0, 0)
    if not tr:
        return m
    for op, args in re.findall(r'(matrix|translate|scale|rotate)\(([^)]*)\)', tr):
        v = [float(x) for x in re.split(r'[,\s]+', args.strip()) if x]
        if op == 'matrix' and len(v) == 6:
            m = mat_mul(m, tuple(v))
        elif op == 'translate':
            m = mat_mul(m, (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0))
        elif op == 'scale':
            sx = v[0]
            sy = v[1] if len(v) > 1 else sx
            m = mat_mul(m, (sx, 0, 0, sy, 0, 0))
        elif op == 'rotate':
            th = math.radians(v[0])
            m = mat_mul(m, (math.cos(th), math.sin(th), -math.sin(th), math.cos(th), 0, 0))
    return m


def style_of(el):
    return el.get('style') or ''


def font_size(style):
    m = re.search(r'font-size:([\d.]+)', style)
    return float(m.group(1)) if m else 0.0


def fill_of(style):
    m = re.search(r'fill:#([0-9a-fA-F]{6})', style)
    return m.group(1).lower() if m else None


def is_red(hex6):
    if not hex6:
        return False
    r, g, b = int(hex6[0:2], 16), int(hex6[2:4], 16), int(hex6[4:6], 16)
    return r > 150 and g < 80 and b < 80


def collect_texts(svg_path):
    """Yield (text, X, Y, effective_font_px, fill) with ALL ancestor
    transforms composed — day 1 and 31 hide behind group transforms."""
    tree = ET.parse(svg_path)

    out = []

    def walk(el, matrix):
        matrix = mat_mul(matrix, parse_transform(el.get('transform')))
        if el.tag == f'{SVG_NS}text':
            st = style_of(el)
            base_fs, base_fill = font_size(st), fill_of(st)
            ex = float((el.get('x') or '0').split()[0])
            ey = float((el.get('y') or '0').split()[0])
            for ts in el.iter(f'{SVG_NS}tspan'):
                txt = (ts.text or '').strip()
                if not txt:
                    continue
                tst = style_of(ts)
                fs = font_size(tst) or base_fs
                fill = fill_of(tst) or base_fill
                tx = float((ts.get('x') or str(ex)).split()[0])
                ty = float((ts.get('y') or str(ey)).split()[0])
                a, b, c, d, e, f = matrix
                out.append((txt, a * tx + c * ty + e, b * tx + d * ty + f,
                            fs * math.hypot(a, b), fill))
        for child in el:
            walk(child, matrix)

    walk(tree.getroot(), (1, 0, 0, 1, 0, 0))
    return out


def parse_month(svg_path, month, errors):
    texts = collect_texts(svg_path)
    n_days = DAYS_IN_MONTH[month - 1]

    # Day-cell anchors: large integers 1..n_days. The mini-month insets use
    # small fonts, so the size gate separates them.
    numerals = [(int(t), x, y, is_red(fill)) for t, x, y, fs, fill in texts
                if t.isdigit() and 1 <= int(t) <= n_days and fs >= NUMERAL_MIN_PX]
    seen = {}
    for day, x, y, red in numerals:
        if day in seen:
            errors.append(f'{YEAR}-{month:02d}: day numeral {day} appears twice at size — check gates')
        seen[day] = (x, y, red)
    for day in range(1, n_days + 1):
        if day not in seen:
            errors.append(f'{YEAR}-{month:02d}-{day:02d}: day numeral not found')

    def owner(x, y):
        best, best_dx = None, None
        for day, (nx, ny, _red) in seen.items():
            if nx <= x < nx + CELL_W and abs(y - ny) <= ROW_BAND:
                dx = x - nx
                if best_dx is None or dx < best_dx:
                    best, best_dx = day, dx
        return best

    days = {day: {'sun': [], 'tide': [], 'luna': None} for day in seen}
    for t, x, y, fs, fill in texts:
        if fs >= NUMERAL_MIN_PX:
            continue
        mt = TIME_RE.match(t)
        md = TIDE_RE.match(t)
        label = MOON_LABELS.get(t.upper())
        if not (mt or md or label):
            continue
        day = owner(x, y)
        if day is None:
            continue  # legend / inset / header text outside any cell
        if mt:
            days[day]['sun'].append((int(mt.group(1)), int(mt.group(2))))
        elif md:
            h, mi = int(md.group(1)), int(md.group(2))
            height = float(md.group(3).replace(',', '.'))
            days[day]['tide'].append(((h, mi), height))
        elif label:
            days[day]['luna'] = label

    month_out = {}
    for day in sorted(days):
        rec = days[day]
        key = f'{YEAR}-{month:02d}-{day:02d}'
        if len(rec['sun']) != 2:
            errors.append(f'{key}: expected 2 sun times, found {len(rec["sun"])}')
            continue
        if len(rec['tide']) != 2:
            errors.append(f'{key}: expected 2 tides, found {len(rec["tide"])}')
            continue
        alba, tramonto = sorted(rec['sun'])
        (t1, h1), (t2, h2) = rec['tide']
        alta, bassa = ((t1, h1), (t2, h2)) if h1 >= h2 else ((t2, h2), (t1, h1))
        month_out[key] = {
            'alba': f'{alba[0]}:{alba[1]:02d}',
            'tramonto': f'{tramonto[0]}:{tramonto[1]:02d}',
            'alta': [f'{alta[0][0]}:{alta[0][1]:02d}', alta[1]],
            'bassa': [f'{bassa[0][0]}:{bassa[0][1]:02d}', bassa[1]],
            'luna': rec['luna'],
            'festivo': seen[day][2]
        }
    return month_out


# ── Acceptance test: NOAA sunrise/sunset for Fano vs the printed times ──────

def eu_dst_offset_hours(month, day):
    """Europe/Rome for the modern era: CET (+1) / CEST (+2), DST from the
    last Sunday of March to the last Sunday of October. Day-resolution is
    enough here — the boundary Sundays differ by an hour at most."""
    def last_sunday(m):
        d = 31 if m == 3 else 25
        while True:
            wd = (day_of_week(YEAR, m, d))
            if wd == 0:
                return d
            d -= 1
    if 3 < month < 10:
        return 2
    if month == 3:
        return 2 if day >= last_sunday(3) else 1
    if month == 10:
        return 1 if day >= last_sunday(10) else 2
    return 1


def day_of_week(y, m, d):
    t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    if m < 3:
        y -= 1
    return (y + y // 4 - y // 100 + y // 400 + t[m - 1] + d) % 7  # 0 = Sunday


def solar_events_utc(y, m, d):
    """NOAA solar calculation; returns (sunrise, sunset) in fractional UTC
    hours, or None in polar conditions (not at Fano's latitude)."""
    n1 = 275 * m // 9
    n2 = (m + 9) // 12
    n3 = 1 + (y - 4 * (y // 4) + 2) // 3
    n = n1 - n2 * n3 + d - 30
    out = []
    for rising in (True, False):
        lng_hour = LON / 15
        t = n + ((6 - lng_hour) / 24 if rising else (18 - lng_hour) / 24)
        mean = (0.9856 * t) - 3.289
        l = mean + 1.916 * math.sin(math.radians(mean)) + 0.020 * math.sin(math.radians(2 * mean)) + 282.634
        l %= 360
        ra = math.degrees(math.atan(0.91764 * math.tan(math.radians(l)))) % 360
        ra += (l // 90) * 90 - (ra // 90) * 90
        ra /= 15
        sin_dec = 0.39782 * math.sin(math.radians(l))
        cos_dec = math.cos(math.asin(sin_dec))
        zenith = math.radians(90.833)
        cos_h = (math.cos(zenith) - sin_dec * math.sin(math.radians(LAT))) / (cos_dec * math.cos(math.radians(LAT)))
        if not -1 <= cos_h <= 1:
            return None
        h = (360 - math.degrees(math.acos(cos_h))) if rising else math.degrees(math.acos(cos_h))
        h /= 15
        mean_t = h + ra - 0.06571 * t - 6.622
        ut = (mean_t - lng_hour) % 24
        out.append(ut)
    return out


def hm_to_min(hm):
    h, m = hm.split(':')
    return int(h) * 60 + int(m)


def main():
    if not os.path.isdir(SRC_DIR):
        sys.exit(f'source dir missing: {SRC_DIR}')
    errors = []
    all_days = {}
    for month in range(1, 13):
        path = os.path.join(SRC_DIR, f'{YEAR}_{month:02d}_calendario.svg')
        if not os.path.exists(path):
            errors.append(f'missing SVG: {path}')
            continue
        all_days.update(parse_month(path, month, errors))

    # Cross-checks
    total = sum(DAYS_IN_MONTH)
    print(f'days extracted: {len(all_days)}/{total}')
    reds = [k for k, v in all_days.items() if v['festivo']]
    sundays = [k for k in all_days if day_of_week(*[int(p) for p in k.split('-')]) == 0]
    non_sunday_reds = sorted(set(reds) - set(sundays))
    missed_sundays = sorted(set(sundays) - set(reds))
    print(f'red days: {len(reds)} (Sundays: {len(sundays)}; feast reds: {len(non_sunday_reds)})')
    print('  feasts:', ', '.join(non_sunday_reds) or '(none)')
    if missed_sundays:
        errors.append(f'Sundays NOT red (suspicious): {missed_sundays}')
    moons = [(k, v['luna']) for k, v in sorted(all_days.items()) if v['luna']]
    print(f'moon quarters: {len(moons)}')

    # Astronomy acceptance: printed vs computed sunrise/sunset
    worst = (0, None)
    total_dev = 0
    checked = 0
    for key, rec in sorted(all_days.items()):
        y, m, d = [int(p) for p in key.split('-')]
        ev = solar_events_utc(y, m, d)
        if not ev:
            continue
        off = eu_dst_offset_hours(m, d)
        for printed, ut in ((rec['alba'], ev[0]), (rec['tramonto'], ev[1])):
            local = (ut + off) % 24
            comp_min = round(local * 60)
            dev = abs(comp_min - hm_to_min(printed))
            dev = min(dev, 1440 - dev)
            total_dev += dev
            checked += 1
            if dev > worst[0]:
                worst = (dev, (key, printed, f'{comp_min // 60}:{comp_min % 60:02d}'))
    if checked:
        print(f'astronomy check: {checked} events, mean deviation '
              f'{total_dev / checked:.1f} min, worst {worst[0]} min at {worst[1]}')

    for e in errors:
        print('ERROR:', e)
    if errors:
        sys.exit(1)

    out = {
        'station': {'name': 'Fano (PU)', 'lat': LAT, 'lon': LON,
                    'timezone': 'Europe/Rome'},
        'source': f'MMdM wall calendar {YEAR} (print edition; '
                  'data/calendar/sources/)',
        'days': all_days
    }
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {OUT_PATH} ({os.path.getsize(OUT_PATH)} bytes)')


if __name__ == '__main__':
    main()
