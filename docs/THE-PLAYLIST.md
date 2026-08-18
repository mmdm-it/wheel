# THE PLAYLIST — the single source of major truth

*Last audited: 2026-08-18 by Orville — Q3 (does it assert a state that is now
false?). This sitting: row 2 gains `BRENT` (W-87 adopted it into the corpus,
so the code claim is true again), the criterion-1 rationale is re-grounded
per Howell's W-86 retraction, and the H-28 ruling replaces the open volume
question. **No other document under `docs/` carries this stamp and nothing
enforces it**, so WF-13's rotation cannot yet be sorted by staleness the way
the rule describes; that gap is noted in O-63 and is not fixed here.*

Every translation enters at the date of its act. No leapfrogging. Nothing
below 100%. **This file is authoritative**: it is the one place that records
which editions exist or are planned, when each was made, in what language,
and how far along it is. Nothing here is derived from anywhere else, and
where another file disagrees with this one, this one is right.

**AUTHORITATIVE OVER DECISIONS, NOT SELF-VERIFYING ABOUT STATE — and the
difference cost us four days** (O-63, 2026-08-17). Which editions we intend and
in what order is a decision, and this file is where it is made. But the
`complete` and `proofread` columns assert a state of the CORPUS, which lives in
the other repository and can change without a word appearing here.

**On 2026-08-17 this file was false in sixteen places**: thirteen stale edition
codes, one wrong `proofread` cell, and two references to files that no longer
exist. None of it was caught by a test. It was caught by a human reading the
sheet before starting work and being told the Septuagint was finished — and
then only five of the sixteen were visible from that reading. The other eleven
turned up while the first five were being fixed.

`test/playlist-truth.test.js` cannot catch that, and is not pretending to. It
checks this table's SHAPE — that it parses, numbers contiguously, carries a
year and a language, spells the rungs as booleans, climbs the ladder in order,
repeats no code. **It cannot tell a true `yes` from a false one.** The three
cells that once correlated this file against the corpus were deleted on
2026-08-13, correctly — that was the suite crossing the wall where the code no
longer does — and no replacement was named. Only cargo's CI can honestly hold
that check. Until it does, **these two columns are worth exactly as much as the
last human who looked.**

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
nothing is seated: not yet seated, or **no longer seated**. The second case was
not anticipated when this rule was written, and on 2026-08-17 **thirteen of the
fourteen codes in this table were false** (O-63) — every one but `WLC`. The old
corpus answered to WLC, VUL, SYN, NEO, DRA, SAC, KAL, ALL, CAN, LXX, BYZ, FIN,
THEOD and TBS; today it answers to `WLC` alone, and the other thirteen went on
naming editions that H-21 had deleted. **A code here is a claim that the corpus
will answer to it today**, and it is the cheapest claim in this file to check:
compare this column against the corpus's declared editions.

Nine of those thirteen were found only because the rule above was being
rewritten. The report that opened this audit named four; the same defect sat in
nine further rows nobody had looked at. Everything the program needs beyond this table (native
names, colophon text, book names and abbreviations) lives in
`wheel-cargo/gutenberg/declaration.json` and `wheel-cargo/gutenberg/naming/`;
those are dictionaries, not decisions, and they are not major truths.
*(This named `translations.json` until 2026-08-17, when that file was deleted
along with `manifest.json`, `canon.json`, `coverage.json` and `languages.json`
— the builder now takes one source and one declaration. O-63.)*

Expectation on the unresearched entries, ruled by Howell: half will not
survive five minutes of research — and half of them landed would be
impressive. A translation that bogs down at any rung is dropped and the
playlist moves on.

| # | Year | Edition | Language | Code | complete | proofread | Notes |
|---|------|---------|----------|------|----------|-----------|-------|
| 1 | c.1200–165 BC | Hebrew Bible (Tanakh) | Hebrew | WLC | yes | yes | seated; proofread 2026-08-17, 39 of 39 books |
| 2 | c.250–100 BC | Septuagint | Greek | BRENT | no | no | Brenton adopted (W-87): phase A seats 18 of 39 books, identity-mapped; 21 await a versification source. Prior assembly deleted under H-21 |
| 3 | c.50–100 AD | Greek New Testament | Greek |  | no | no | ⏱ source hunt. Prior assembly (Byzantine, Robinson-Pierpont) deleted under H-21 |
| 4 | c.150 | Theodotion's Daniel | Greek |  | no | no | ⏱ the pinned Swete candidate carries Daniel twice, OG and Theodotion (W-86) — row 4 may arrive inside row 2's successor source. Prior assembly deleted under H-21 |
| 5 | 4th c. | Tobit (Codex Sinaiticus) | Greek |  | no | no | ⏱ rides on the Septuagint's source question. Prior assembly deleted under H-21 |
| 6 | 382–405 | Vulgate (Jerome) | Latin |  | no | no | prologues owed; prior assembly deleted under H-21 (code was VUL) |
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
| 24 | 1667–1696 | de Sacy | French |  | no | no | audit owed; prior assembly deleted under H-21 (code was SAC) |
| 25 | 1671–1673 | Biblia Sacra Arabica (Propaganda Fide) | Arabic |  | no | no | ⏱ source hunt — first complete printed Arabic Bible; Vatican project |
| 26 | 1735 | Mekhitarist translation | Armenian |  | no | no | ⏱ source hunt — first major Armenian Catholic (Mekhitarist) Bible project, Venice |
| 27 | 1749–1752 | Douay-Rheims (Challoner revision) | English |  | no | no | audit owed; prior assembly deleted under H-21 (code was DRA) |
| 28 | 1769–1781 | Martini | Italian |  | no | no | ⏱ source hunt |
| 29 | 1776 | Biblia 1776 | Finnish |  | no | no | audit owed; prior assembly deleted under H-21 (code was FIN) |
| 30 | 1778–1790 | Pereira de Figueiredo | Portuguese |  | no | no | ⏱ the BFBS trap |
| 31 | 1780 | Szveti evangyeliomi (Küzmics) | Slovene (Prekmurje) |  | no | no | ⏱ source hunt — Gospels only |
| 32 | 1784 | Seonggyeong Jikhae | Korean |  | no | no | ⏱ source hunt (commentary, not continuous text) |
| 33 | c.1790 | Poirot translation | Chinese |  | no | no | ⏱ source hunt |
| 34 | 1793 | Scío de San Miguel | Spanish |  | no | no | ⏱ source hunt |
| 35 | 1805 | Zohrabian edition | Armenian |  | no | no | ⏱ source hunt — regarded as most valuable critical edition; Mekhitarist, Venice |
| 36 | 1823–1825 | Torres Amat | Spanish |  | no | no | ⏱ provenance trap |
| 37 | 1831 | Katančić Bible | Croatian |  | no | no | ⏱ source hunt |
| 38 | 1860 | Bagratuni edition | Armenian |  | no | no | ⏱ source hunt — Mekhitarist critical edition; translator d. 1866, PD clear |
| 39 | 1865 | Káldi–Tárkányi (revision) | Hungarian |  | no | no | audit owed; prior assembly deleted under H-21 (code was KAL) |
| 40 | 1876 | Synodal | Russian |  | no | no | audit owed — verify Catholic vs Orthodox provenance; prior assembly deleted under H-21 (code was SYN) |
| 41 | 1877 | Delitzsch New Testament | Hebrew |  | no | no | import owed |
| 42 | 1887 (Gospels/Acts) | Manjummal translation | Malayalam |  | no | no | ⏱ date + source hunt (year uncertain) |
| 43 | 1894–1923 | Crampon | French |  | no | no | audit owed; prior assembly deleted under H-21 (code was NEO) |
| 44 | 1902 | Glaire-Vigouroux | French |  | no | no | ⏱ source hunt |
| 45 | 1910 | Raguet New Testament | Japanese |  | no | no | ⏱ death-year check (life+70) |
| 46 | 1911–1937 | Skvireckas Bible | Lithuanian |  | no | no | NOT PD — translator d. 1959; copyrighted until 2029 |
| 47 | 1913–1916 | Cố Chính Linh (Schlicklin) | Vietnamese |  | no | no | ⏱ death-year check (life+70) |
| 48 | c.1913–1935 | Westminster Version (Lattey) | English |  | no | no | ⏱ source hunt — PD status mixed/uncertain by volume |
| 49 | 1914 | Allioli–Arndt | German |  | no | no | audit owed; prior assembly deleted under H-21 (code was ALL) |
| 50 | 1924 | Pancha Granthy | Malayalam |  | no | no | ⏱ source hunt |
| 51 | 1929 | Vienna Mekhitarist edition | Armenian |  | no | no | ⏱ source hunt — final edition in this lineage |
| 52 | 1929–1939 | Petrus Canisius | Dutch |  | no | no | audit owed; prior assembly deleted under H-21 (code was CAN) |
| 53 | 1933/1938 | Pyhä Raamattu | Finnish |  | no | no | ⏱ source in hand |
| 54 | 1940 | Catholic NT (complete) | Malayalam |  | no | no | audit owed |
| 55 | 1941 | Confraternity New Testament | English |  | no | no | ⏱ renewal search |
| 56 | 1957 | Khomenko Bible | Ukrainian |  | no | no | NOT PD — first genuinely Catholic Ukrainian translation, too recent. Note: Kulish Bible (1903) is NOT Catholic |

## The Greek source question (raised as O-63, 2026-08-17; hunt landed its first edition 2026-08-18)

**What the corpus holds today** (measured 2026-08-18 by reading `volume.json`;
re-run by reading it again): **two editions.** `WLC` over 39 units, all 39
confirmed — and `BRENT`, Brenton's Septuagint, phase A: 18 books seated where
the Greek and Masoretic versifications are a perfect key bijection, the other
21 waiting on a real versification mapping rather than an invented alignment
(W-87). The section below was written when the count was one and the hunt had
not started; it is kept because its warnings and its criteria governed the
hunt that landed BRENT, and still govern the rest of it.

**Do not go looking for our earlier Greek work.** It was real — the pre-doctrine
corpus held a Septuagint over 52 books, a complete Byzantine New Testament over
27, Theodotion's Daniel and the Sinaiticus Tobit — and **all of it is
unusable**, for two independent reasons. H-21 (2026-08-13) ruled that every
edition assembled before the utterance doctrine is deleted because none can
pass H-17; and on 2026-08-17 the pinned Greek working sources were deleted too.
Neither the artifacts nor the inputs survive as anything we may build on.
*(WF-19 has since made this a standing rule rather than a local warning.)*

**THE LICENSING LANDSCAPE.** Researched by Wilbur, 2026-08-17–18:

- **Rahlfs** — a correspondence away, not dead *(reworded 2026-08-18 under
  W-86; this read "Dead for us: bibliacatholica.com is a product" until
  Howell struck that premise — see the criterion note below)*. CCAT/DBG
  permission is obtainable for free apps; what it buys is revocable goodwill
  rather than a licence, a dependency PD sources simply do not have.
- **Brenton** — ADOPTED as `BRENT` (W-87). The package's own copyright page
  says Public Domain in so many words, pinned beside the source files.
- **Swete via Open Greek and Latin** — pinned by address as candidate one
  (W-86): CC-BY-SA-4.0, commercial redistribution permitted, verse index in
  the bytes, the artifact's own Greek titles. One hole (Ecclesiastes has no
  text file) and a share-alike rider that binds the text column downstream.
- **STEPBible TAGOT** (Tyndale House, CC BY 4.0) — the right licence and the
  right shape, and **not released**. Worth watching.

**WHAT A CANDIDATE MUST SATISFY** — so a find can be judged in an afternoon
instead of after a week of extraction:

1. **A licence permitting COMMERCIAL redistribution.** Not "free to read", not
   "non-commercial", not "academic use". This is the criterion that kills most
   digital Septuagints, and it is checked first because it is the only one that
   cannot be worked around.

   **Why — re-grounded by Howell, 2026-08-18 (W-86), retracting the old
   rationale.** This criterion was justified with "bibliacatholica.com is a
   product," and that premise is struck: *"nobody knows"* when, how, or if
   this makes money; we are in the *"just make a cool product"* phase; and
   the Bible will never carry the calendar — the volumes stay financially
   separate, no cross-subsidy framing for either. The criterion survives on
   **optionality, deliberately purchased**: Howell registered bibliacatholica
   .com, .org AND .net on purpose — *"We can be whatever we want."* A
   public-domain text column is the same purchase in data. It keeps every
   posture open at no extra cost, where a non-commercial source would quietly
   burn the .com before anyone chose to. Prefer unencumbered sources not
   because we are a product, but because the posture decision is Howell's to
   make later, and a text licence must not make it for him.
2. **A self-describing verse index** — text addressable as book/chapter/verse
   in the file itself, not a word stream needing a join against a separate
   concordance. The join is doable and it is where errors hide.
3. **Attested division names, or none.** Under H-2 a label is a QUOTATION. If
   the edition's own divisions carry no attested name, the honest result is no
   label at all, not an invented one. A source that names its divisions is
   worth materially more than one that does not.
4. **A stated relationship to the Hebrew's 39 units** — see the open question
   below, which this choice partly settles.

**RULED — H-28 (2026-08-17), the day it was raised:** a Greek edition is a
**second edition of the Bible volume**, never a volume of its own. Volumes are
few (Catalog, Calendar, Bible); editions are many, inside the Bible. Criterion
4 above is accordingly a hard criterion, not a question — and BRENT's phase A
answered it the strict way: books seat only where the versifications key
perfectly onto the Hebrew's units, and the rest wait for a mapping rather
than an invention. How the unit list eventually grows beyond the Tanakh's 39
(a Greek NT shares none; a Septuagint adds roughly thirteen) is deliberately
undesigned until the source that needs it is in hand (WF-19).

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

## The ring said more than this table did — THE FILE IS GONE, THE RESEARCH IS NOT (2026-08-01; superseded 2026-08-17, O-63)

**THE RECONCILIATION IS MOOT AS STATED.** `wheel-cargo/gutenberg/languages.json`
was deleted on 2026-08-17 with the rest of the pre-doctrine scaffolding, so
there are no longer 29 ring languages, no ring years, and no drift between that
file and this one. **Nothing below is owed against a live file.** Verified by
listing `wheel-cargo/gutenberg/` on 2026-08-17: it holds `declaration.json`,
`naming/`, `proofread.json`, `versification/` and the dated volume directory.

What is kept, and why: the RESEARCH below cost real hours and is still true
about the world — whether 1417 Czech names an identifiable act, whether 1685
Irish is Bedell's Protestant Old Testament, whether 1688 Romanian is the
Orthodox Bucharest Bible. Those questions outlive the file that raised them and
will be asked again the moment a second ring is populated. **What is dead is
the mechanism** — the drift, the years, and the reconciliation owed.

The original text follows, unedited, as the record of what was found.

`wheel-cargo/gutenberg/languages.json` held **29 languages** the reader could
already see on the secondary ring, each with a YEAR that set its position on
the arc. Seven of them had no row above: they arrived with the 42-language PD
sweep of 2026-07-28 as quick `comingSoon` hooks, before this table was
expanded on the 31st, and nobody reconciled the two. A ring year is a factual
claim about when a translation act happened, so these were display facts, not
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
