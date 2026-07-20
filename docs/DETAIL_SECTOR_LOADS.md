# Detail Sector Loads — the schema scoping (ruled 2026-07-20)

Scoped BEFORE Phases D/E per Howell's 2026-07-19 ruling: presentation
belongs to Phase E, but new *kinds* of content need their schema settled
first, so population can proceed while other phases run. This document
records what each volume's Detail Sector must eventually hold, what is
ruled, and what stays open. Presentation (layout, typography, the dossier's
look) is deliberately absent — that is E's business.

## The three content kinds

The sector serves the leaf, and only the leaf (see the e-reader doctrine).
Each volume feeds it a different way:

| Volume | Kind | Arrives |
|---|---|---|
| Bible | **fetched text** | per-chapter files, read-ahead (shipped) |
| Catalog | **stored dossier** | fields in the model's `data{}` + media files fetched on leaf-open |
| Calendar | **computed ephemeris** | engines run on a small set of stored constants — never per-day storage (2.19M days) |

## Catalog — the model dossier

Ruling (Howell 2026-07-20): **only photos and video are live concerns now;
everything else is placeholder fields in the JSON.** An embryonic catalog
for an embryonic company — coverage grows organically.

### Live now

- **`media.photo`** — one image file per model, aspirational, sparse
  forever (1,032 models; growth is organic). Separate files fetched when
  the leaf opens — NEVER inline in the manifest (the 170KB wire boot is
  sacred; the bible's `externalFile` pattern is the precedent).
- **`media.video`** — the slot is built and tested but currently EMPTY
  (Howell 2026-07-20: "remove the video for now… not important at this
  point" — presentation notes belong to Phase E). The one intended entry,
  recorded for when it returns: **`lockwood-ash:twin-6hp`** (LOCKWOOD-ASH
  → 2 CIL → Twin 6 HP), the Dick Gibbens batteau film —
  `https://howellgibbens.com/blog/wp-content/uploads/2025/08/dick_gibbens_batteau.m4v`
  (verified live 2026-07-20; 52.9MB, `video/x-m4v`). Self-hosted on
  Howell's own domain — survives into the Phase F apps; may move under
  mmdm.it later. A personal-connection exception to the sui-generis
  doctrine, ruled like the FE 360 curator's note.

### Placeholders (schema'd now, populated when strategy settles)

Per model, `data{}` gains optional fields — every one of them may be
absent, and prose-only rendering stays valid forever:

```jsonc
"data": {
  "key_notes": "…",            // existing
  "description": "…",          // existing (Italian prose)
  "specs": {
    "displacement_l": 5.7,     // and/or
    "displacement_cid": 350
  },
  "manifolds": [               // a LIST — LH/RH pairs, center- vs
    {                          // end-riser variants are the NORM on
      "position": "single | port | starboard | center",   // V-engines
      "oem":  { "part_number": "…", "dimensions_mm": [L, W, D],
                "weight_kg": 0, "price_eur": 0 },
      "mmdm": { "part_number": "…", "dimensions_mm": [L, W, D],
                "weight_kg": 0, "price_eur": 0,
                "provenance": "original | rebrand" },
      "photo": "…"
    }
  ],
  "gaskets": [ { "part_number": "…", "price_eur": 0 } ],
  "media": { "photo": "…", "video": "…" }
}
```

Notes held from the discussion, undecided until the fields go live:
prices in EUR with `"su richiesta"` permitted as a value (covers the
pre-Fano fulfillment era); dimensions stored metric, display-layer
conversion for imperial-minded audiences; the campaign's hedge-flag
honesty convention extends to part-number data.

## Calendar — the day ephemeris (Fano, permanently)

The wall calendar is the print edition of this sector; its day cell is
the specification. Rulings (Howell 2026-07-20):

- **The station is Fano (PU), permanently.** (~43°50′N 13°01′E.) A
  location change would be a Phase D dimension by shape — noted, not
  planned. The printed legend is the doctrine: "gli orari … si
  riferiscono a Fano (PU)."
- **Sunrise / sunset: the whole six millennia.** Pure astronomy, computed
  client-side, no data payload. Moon phase likewise (the four quarters,
  as printed).
- **Tides: stored, bounded, honest.** Source of truth = the 2026 wall
  calendar (12 months, SVGs to be provided; per-day highest-high and
  lowest-low, time + height, as printed), then forward through **2029**.
  ~1,460 days × 4 values — trivially small. Outside the window the sector
  simply shows no tides: a tide prediction for 1490 would be fiction, and
  the instrument does not invent (Gregory's-gap doctrine). The window
  extends a year with each calendar edition — the print run feeds the app.
- **The clock: civil time in the civil era, solar time before.** Proposed
  seam: 1893, when Italy adopted CET (Rome mean time before that, local
  solar at Fano's longitude ≈ UTC+52min for the deep past). Modern era
  includes ora legale where the tz history knows it. [Seam year awaiting
  Howell's confirmation.]
- **Red days: Sundays + the feast set of the wall calendar.** To be
  extrapolated from the full 2026 edition (12 months). Fixed feasts are
  rules; movable feasts are the computus — already ruled into the plan
  2026-07-17 ("movable feasts computed forward"), and fittingly, Easter
  arithmetic is why the volume's gateway patron is Gregorio XIII.

### What is actually stored (the whole calendar "schema")

```jsonc
"ephemeris": {
  "station": { "name": "Fano (PU)", "lat": 43.84, "lon": 13.02,
               "timezone": "Europe/Rome", "solar_before": 1893 },
  "tides": { "window": [2026, 2029],
             "days": { "2026-07-01": { "high": ["00:26", 0.9],
                                        "low":  ["07:01", 0.0] } } },
  "feasts": { "fixed": [ /* rules */ ], "movable": "computus" }
}
```

## Open items

- [x] The video's engine: `lockwood-ash:twin-6hp` (named 2026-07-20; URL
      recorded above)
- [x] The 2026 wall calendar sources: delivered 2026-07-20 to
      `data/calendar/sources/calendario-2026/` — all 12 months, PDF + SVG,
      original production files (dated Oct 2025 — provenance in itself).
      SVG probe confirms clean text nodes: sunrise/sunset times, tide
      time+height pairs ("0:26, 0.9 m"), moon-quarter labels — extraction
      script is next.
- [ ] 2027–2029 tide source: official predictions vs harmonic computation —
      decide at extraction time, against the 2026 data as ground truth
- [ ] Solar/civil seam year (1893 proposed)
- [ ] Bible: no new loads — text only, by ruling ("pretty much text only")
