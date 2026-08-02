# THE PLAYLIST — the single source of major truth

Every translation enters at the date of its act. No leapfrogging. Nothing
below 100%. **This file is authoritative**: it is the one place that records
which editions exist or are planned, when each was made, in what language,
and how far along it is. Nothing here is derived from anywhere else, and
where another file disagrees with this one, this one is right.

**Two rungs, two booleans** (ruled 2026-08-01; the earlier three-rung ladder
retired CERTIFIED as a category that never earned its own row):

- **complete** — Wilbur declares it: all the data the edition needs,
  correctly placed, at the artifact's full extent, to the best of his
  knowledge.
- **proofread** — a human has read it in the wheel against an independent
  copy of the source and fixed what was wrong. This is the ONLY gate the
  program obeys; nothing reaches a reader without it. The suites are in
  `wheel-cargo/docs/PROOFREAD-SUITE.md`.

Both start `no`. An edition may be complete and not proofread; it may not be
proofread without being complete first.

**Code** is the join key — the edition's code in the corpus, blank where
nothing is seated yet. Everything the program needs beyond this table (native
names, versification tables, colophon text, book names and abbreviations)
lives in `wheel-cargo/gutenberg/translations.json`; those are dictionaries,
not decisions, and they are not major truths.

Expectation on the unresearched entries, ruled by Howell: half will not
survive five minutes of research — and half of them landed would be
impressive. A translation that bogs down at any rung is dropped and the
playlist moves on.

| # | Year | Edition | Language | Code | complete | proofread | Notes |
|---|------|---------|----------|------|----------|-----------|-------|
| 1 | c.1200–165 BC | Hebrew Bible (Tanakh) | Hebrew | WLC | yes | no | seated |
| 2 | c.250–100 BC | Septuagint | Greek | LXX | yes | no | seated |
| 3 | c.50–100 AD | Greek New Testament | Greek | BYZ | yes | no | seated |
| 4 | c.150 | Theodotion's Daniel | Greek | THEOD | yes | no | seated |
| 5 | 4th c. | Tobit (Codex Sinaiticus) | Greek | TBS | yes | no | seated |
| 6 | 382–405 | Vulgate (Jerome) | Latin | VUL | no | no | prologues owed |
| 7 | 1466 | Mentelin Bible | German |  | no | no | ⏱ source hunt |
| 8 | 1471 | Malermi | Italian |  | no | no | ⏱ OCR trial |
| 9 | 1471 (ed. 1882–87) | Negroni/Jenson edition | Italian |  | no | no | ⏱ source hunt |
| 10 | 1527 | Emser New Testament | German |  | no | no | ⏱ source hunt |
| 11 | 1528 | Vorsterman Bible | Dutch |  | no | no | ⏱ source hunt |
| 12 | 1534 | Dietenberger Bible (Die Katholische Bibel) | German |  | no | no | ⏱ source hunt |
| 13 | 1547 | Leuven Vulgate (Hentenian Bible) | Latin |  | no | no | ⏱ source hunt — standardized Vulgate text, pre-Sistine/Clementine |
| 14 | 1547–1548 | Blanckart Bible (rival Cologne edition) | Dutch |  | no | no | ⏱ source hunt |
| 15 | 1548 | Leuven Bible (Van Winghe) | Dutch |  | no | no | ⏱ source hunt — standard Dutch Catholic Bible for centuries; revised 1599 |
| 16 | 1550 | Nicolas de Leuze Bible | French |  | no | no | ⏱ source hunt — predates de Sacy by over a century |
| 17 | 1561 | Leopolita's Bible | Polish |  | no | no | ⏱ source hunt |
| 18 | 1582–1610 | Douay-Rheims (original, pre-Challoner) | English |  | no | no | ⏱ source hunt — confirmed PD, digitized (Gutenberg #1581; Internet Archive) |
| 19 | 1599 | Wujek Bible | Polish |  | no | no | ⏱ source in hand (digitized, Wielkopolska Digital Library) |
| 20 | 1622–1638 (pub. 1999) | Kašić Bible | Croatian |  | no | no | ⏱ source hunt + edition-copyright check |
| 21 | 1626 | Káldi Bible (original) | Hungarian |  | no | no | ⏱ source hunt — first complete Catholic Hungarian Bible; d. 1634 |
| 22 | 1630 | Ulenberg revision | German |  | no | no | ⏱ source hunt |
| 23 | 1661 | Jesuit Mainz Bible | German |  | no | no | ⏱ source hunt |
| 24 | 1667–1696 | de Sacy | French | SAC | no | no | audit owed |
| 25 | 1671–1673 | Biblia Sacra Arabica (Propaganda Fide) | Arabic |  | no | no | ⏱ source hunt — first complete printed Arabic Bible; Vatican project |
| 26 | 1735 | Mekhitarist translation | Armenian |  | no | no | ⏱ source hunt — first major Armenian Catholic (Mekhitarist) Bible project, Venice |
| 27 | 1749–1752 | Douay-Rheims (Challoner revision) | English | DRA | no | no | audit owed |
| 28 | 1769–1781 | Martini | Italian |  | no | no | ⏱ source hunt |
| 29 | 1776 | Biblia 1776 | Finnish | FIN | no | no | audit owed |
| 30 | 1778–1790 | Pereira de Figueiredo | Portuguese |  | no | no | ⏱ the BFBS trap |
| 31 | 1780 | Szveti evangyeliomi (Küzmics) | Slovene (Prekmurje) |  | no | no | ⏱ source hunt — Gospels only |
| 32 | 1784 | Seonggyeong Jikhae | Korean |  | no | no | ⏱ source hunt (commentary, not continuous text) |
| 33 | c.1790 | Poirot translation | Chinese |  | no | no | ⏱ source hunt |
| 34 | 1793 | Scío de San Miguel | Spanish |  | no | no | ⏱ source hunt |
| 35 | 1805 | Zohrabian edition | Armenian |  | no | no | ⏱ source hunt — regarded as most valuable critical edition; Mekhitarist, Venice |
| 36 | 1823–1825 | Torres Amat | Spanish |  | no | no | ⏱ provenance trap |
| 37 | 1831 | Katančić Bible | Croatian |  | no | no | ⏱ source hunt |
| 38 | 1860 | Bagratuni edition | Armenian |  | no | no | ⏱ source hunt — Mekhitarist critical edition; translator d. 1866, PD clear |
| 39 | 1865 | Káldi–Tárkányi (revision) | Hungarian | KAL | no | no | audit owed |
| 40 | 1876 | Synodal | Russian | SYN | no | no | audit owed — verify Catholic vs Orthodox provenance |
| 41 | 1877 | Delitzsch New Testament | Hebrew |  | no | no | import owed |
| 42 | 1887 (Gospels/Acts) | Manjummal translation | Malayalam |  | no | no | ⏱ date + source hunt (year uncertain) |
| 43 | 1894–1923 | Crampon | French | NEO | no | no | audit owed |
| 44 | 1902 | Glaire-Vigouroux | French |  | no | no | ⏱ source hunt |
| 45 | 1910 | Raguet New Testament | Japanese |  | no | no | ⏱ death-year check (life+70) |
| 46 | 1911–1937 | Skvireckas Bible | Lithuanian |  | no | no | NOT PD — translator d. 1959; copyrighted until 2029 |
| 47 | 1913–1916 | Cố Chính Linh (Schlicklin) | Vietnamese |  | no | no | ⏱ death-year check (life+70) |
| 48 | c.1913–1935 | Westminster Version (Lattey) | English |  | no | no | ⏱ source hunt — PD status mixed/uncertain by volume |
| 49 | 1914 | Allioli–Arndt | German | ALL | no | no | audit owed |
| 50 | 1924 | Pancha Granthy | Malayalam |  | no | no | ⏱ source hunt |
| 51 | 1929 | Vienna Mekhitarist edition | Armenian |  | no | no | ⏱ source hunt — final edition in this lineage |
| 52 | 1929–1939 | Petrus Canisius | Dutch | CAN | no | no | audit owed |
| 53 | 1933/1938 | Pyhä Raamattu | Finnish |  | no | no | ⏱ source in hand |
| 54 | 1940 | Catholic NT (complete) | Malayalam |  | no | no | audit owed |
| 55 | 1941 | Confraternity New Testament | English |  | no | no | ⏱ renewal search |
| 56 | 1957 | Khomenko Bible | Ukrainian |  | no | no | NOT PD — first genuinely Catholic Ukrainian translation, too recent. Note: Kulish Bible (1903) is NOT Catholic |

## Considered and excluded — not editions we plan to add

These were researched and ruled out. They are kept so the reasoning is not
re-litigated, and deliberately kept OUT of the numbered table above, which is
a roster of editions we have or intend to have.

| Year | Edition | Language | Why excluded |
|------|---------|----------|--------------|
| 5th c. (c.405–434) | Original Armenian translation (Mesrob Mashtots) | Armenian | NOTE ONLY — predates any Catholic/Apostolic split; "Catholic" not a meaningful qualifier for this root text |
| 1422–1430 | Alba Bible | Spanish | EXCLUDED: Jewish translation under Catholic patronage; not Catholic properly speaking |
| 1514–1517 | Complutensian Polyglot | Latin/Hebrew/Greek/Aramaic | note: scholarly polyglot, not vernacular |
| 1549 | Xavier's Matthew fragment | Japanese | historical trace only — no continuous text survives |
| 1613 | Jesuit Kyoto NT | Japanese | ✝ LOST, no copy known |

## The ring says more than this table does — RECONCILIATION OWED (2026-08-01)

`wheel-cargo/gutenberg/languages.json` holds **29 languages** the reader can
already see on the secondary ring, each with a YEAR that sets its position on
the arc. Seven of them have no row above: they arrived with the 42-language PD
sweep of 2026-07-28 as quick `comingSoon` hooks, before this table was
expanded on the 31st, and nobody reconciled the two. A ring year is a factual
claim about when a translation act happened, so these are display facts, not
just bookkeeping.

| ring language | ring year | owed |
|---|---|---|
| Czech (Čeština) | 1417 | ⏱ no row — 1417 is very early; identify the act (Olomouc/Padeřov lineage?) |
| Irish (Gaeilge) | 1685 | ⏱ no row — 1685 is Bedell's PROTESTANT OT; a Catholic candidate must be found or the year is wrong |
| Romanian (Română) | 1688 | ⏱ no row — 1688 is the Bucharest Bible, ORTHODOX; same question as Russian/Synodal |
| Slovak (Slovenčina) | 1759 | ⏱ no row — Camaldolese Bible? (would be genuinely Catholic) |
| Turkish (Türkçe) | 1827 | ⏱ no row — Howell has sat at Mass with Turkey's Catholics; the shelf criterion says find what they use |
| Tagalog | 1905 | ⏱ no row — identify the act |
| Maltese (Malti) | 1959 | ⏱ no row — 1959 is almost certainly NOT PD |

**Years the ring and this table disagree on** — one of the two is wrong, and
the ring is what a reader sees:

| language | ring year | this table | note |
|---|---|---|---|
| Arabic | 867 | 1671 (Propaganda Fide) | 867 predates the entry entirely — what act is the ring claiming? |
| Korean | 1887 | 1784 (Seonggyeong Jikhae) | |
| Japanese | 1880 | 1549 fragment / 1910 Raguet | |
| Lithuanian | 1735 | 1911 (Skvireckas) | 1735 smells Protestant (Quandt); the shelf criterion cares |

**In this table but NOT on the ring:** Chinese, Vietnamese, Malayalam — three
languages with research rows and no door.

**Proposed rule (Howell's to accept):** this table is the source of truth, and
every `languages.json` entry must trace to a row here — the way chapter text
traces to a pinned source. Nothing reaches the ring on a hunch.

## Languages with no candidate
- **Swahili** — NO CATHOLIC-AUTHORED CANDIDATE EXISTS. Confirmed by scholarly
  source: Catholic missionaries (White Fathers) never completed a full Bible
  translation, unlike Protestants. Modern Swahili Catholics use the 2007
  Revised Swahili Union Version (ecumenical, Bible Society project) in its
  Catholic edition w/ deuterocanon. Same pattern as Ukrainian/Finland/
  Philippines but with NO early candidate at all.

## Known gaps still to research
- Spanish: confirmed no clean pre-Scío Catholic vernacular candidate; Alba
  Bible excluded (not Catholic); Complutensian Polyglot is scholarly, not
  vernacular.
- Russian: flagged for provenance check — Synodal Bible is an Orthodox
  project; unclear if it belongs in a Catholic-only table or should be
  reframed as ecumenical/borrowed like Finland's pattern.
- Not yet researched at all: Portuguese-Brazilian variants and other major
  Catholic-population languages. (Armenian and Swahili resolved this round.)

## Cross-cutting notes
- Several entries are "translation is PD, but the only surviving printed
  edition is a much later critical edition" — Negroni/Jenson (Italian),
  Kašić (Croatian). Treat the underlying translation and the specific
  edition's copyright as separate questions.
- Early publication date does NOT mean automatic PD — Lithuanian (Skvireckas)
  is the clearest case: started 1911, but the translator's 1959 death date
  under life+70 keeps it copyrighted until 2029. Always check the translator's
  death year, not just the publication year, for any 20th-century entry.
- The Asian and Slavic entries generally show one clean 18th/19th-century (or
  earlier) Catholic-authored candidate, then a long gap filled by
  shared/ecumenical texts, mirroring the Finland/Turkey/Philippines pattern
  rather than Europe's multi-generation lineages. Ukrainian is the exception —
  no early Catholic-authored candidate exists at all; the first is already too
  recent (1957).
- Armenian is the richest addition this round — a genuine multi-generation
  Catholic-specific lineage (Mekhitarist Congregation, distinct from the
  non-Catholic Armenian Apostolic Church) comparable to the European lineages
  rather than the thin single-entry pattern seen in most other non-European
  languages.
- Swahili and Ukrainian are now the two confirmed cases with NO usable early
  Catholic-authored candidate at all — both rely entirely on modern
  (20th/21st-century) ecumenical or Catholic-commissioned texts with no PD
  option in the lineage.

### The stages
  1. Hebrew + Greek open the screening room at mmdm.it — which then shows
     every translation as it certifies (LAN = editing suite; mmdm.it =
     screening room; bibliacatholica.com = Leicester Square)
  2. The playlist's survivors, each at 100%, at bibliacatholica.com
  3. The BC.com database and engine ported native to Android, on Google Play
  4. Letters to the copyright holders, inviting them aboard
