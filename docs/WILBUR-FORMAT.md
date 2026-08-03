# The WILBUR format, version 1.0

**A data format for holding many editions of scripture at once, without
pretending they divide it the same way.**

Named for Wilbur Wright, and for the half of this project that carries rather
than flies. Specified 2026-08-03. This document is the definition; where an
implementation and this text disagree, this text is wrong and should be
corrected rather than worked around.

---

## What problem it solves

Every tradition cuts scripture differently. The Latin's Jonah 1:17 is the
Hebrew's and the Greek's 2:1. The Latin's Psalm 9 is the Hebrew's 9 **and**
10. Greek Jeremiah reads its oracles in an order the Latin does not.
Vaticanus lacks verses the Vulgate has; the Vulgate has verses no Greek
witness ever held. Sirach's Greek transposes whole blocks the Latin keeps in
order.

Existing formats meet this in one of two ways. Most — OSIS, USFM, Zefania —
carry a single edition's text with its own numbering and say nothing about
any other. SWORD's `av11n` carries several numbering schemes and maps between
them by pivoting through the KJV. The pivot is the problem: whatever the hub
tradition cannot express is lost in transit, and the hub was chosen for
availability rather than fitness.

WILBUR does neither. It keeps one coordinate system that is a **constructed
superset** — every utterance any tradition attests has an identity in it —
and treats each edition's chapter-and-verse numbering as a *label* rather
than a location.

## What it does not claim

WILBUR is a format and a method. **It makes no claim on scripture.** The
texts a WILBUR corpus holds carry their own rights, stated per edition. What
the format covers is the model, the schema, and the alignment data — the
record of which utterance is which across traditions, which is work someone
performed rather than a fact anyone found.

---

## The model

**An address is an annotation on scripture, not a container for it.** The
unit of identity is the **utterance** — one thing said, once. An edition's
address ("Genesis 50:22") points at one or more utterances; it does not own
them.

**The spine** is the ordered sequence of every utterance in the corpus,
divided into books and chapters. A spine address is `BOOK chapter:slot`. The
spine is a superset by construction: where any tradition divides finer than
the others, the finer division wins and the coarser edition spans it. In this
implementation the spine follows the Clementine Vulgate's divisions, but
nothing in the format requires that — only that the spine be a superset and
that it be constructed rather than borrowed from a tradition still in use.

Five things follow, and each is expressible in WILBUR and in none of the
formats above:

1. **One address may cover several utterances.** The Latin's Genesis 50:22
   holds two Clementine verses; recording that does not require welding two
   verses into one string or leaving a dead slot behind.
2. **An edition may divide finer than the spine's integers.** Sub-slots
   (`15b`) hang off the integer they belong to, so a tradition that cuts
   mid-verse is not misnumbered from there down.
3. **Absence is asserted, with a reason, and in two kinds.** `absent` means
   this edition demonstrably never held these utterances. `lost` means its
   translator or copyist produced them and no witness we follow preserved
   them. Silence means unknown, which is the honest default. No other format
   distinguishes a gap from a fact.
4. **Coordinates may be shared by convention only.** Jerome's Judith and the
   Greek Judith are different recensions at the same addresses; a WILBUR
   corpus says so, so that no consumer claims a correspondence that does not
   exist.
5. **An edition's chapters and verse numbers are a render-time projection.**
   Membership, grouping and labels belong to the edition, not to the spine.

---

## The artifacts

A WILBUR corpus is a directory containing:

### `manifest.json` — the spine's structure
Books in order, each with its chapters, each chapter with a display name and
a verse count. Chapter names need not be numbers: a preface chapter may be
named (`Πρόλογος`) and is sequenced at 0.

### `chapters/<BOOK>/<NNN>.json` — the utterances
```jsonc
{
  "_schema_version": "2.0",
  "chapter_id": "ECCLU_010", "book_key": "ECCLU", "sequence": 10,
  "testament": "…", "section": "…",
  "verses": {
    "1":   { "text": { "VUL": "Judex sapiens…", "LXX": "Κριτὴς σοφὸς…" } },
    "15b": { "text": { "LXX": "ὅτι ἀρχὴ ὑπερηφανίας…" } }
  },
  "editions": {
    "LXX": { "spans": { "13": ["15b", "16"] }, "absent": ["21"] }
  }
}
```
- **`verses`** is the utterance list. Integer slot ids run `1..N` unbroken; a
  sub-slot is an integer followed by a letter and hangs off that integer.
- **`text`** is keyed by edition code. An absent, null or empty value all mean
  the same thing: this edition does not hold this utterance here.
- **`editions[CODE].spans`** maps one of that edition's *addresses* to the
  utterances it covers. **The identity default**: an address with no entry
  covers the identically-named utterance, so the majority of chapters carry
  no `editions` block at all.
- **A span never cuts a string.** The text lives whole at the span's first
  slot; the remaining slots are covered, not populated.

### `versification/<RECKONING>.json` — each tradition's own labels
```jsonc
{ "books": { "IONA": { "entries": [["1:17", "2:1"]], "remap": 1 } } }
```
Spine address → that reckoning's address. **Non-identity entries only.** A
reckoning is named for itself, not for an edition that follows it: several
editions may share `MT`.

### `seating/<CODE>.json` — the edition's own shape, generated
```jsonc
{ "edition": "LXX", "books": {
    "GENE": [ 31, 25, … ],
    "PSAL": [ …, {"u": ["9", 1, 21]}, {"c": "10", "u": ["9", 22, 39]}, … ],
    "ECCLU": [ {"u": ["0", 1, 22]}, {"s": [{"l": "1", "u": ["1", 1, 1]}, …]} ]
} }
```
Three forms, in increasing explicitness:
- **A bare integer** — N identity seats at the spine chapter in the same
  position.
- **A run** `{c?, u: [spineChapter, first, last]}` — N seats labelled `1..N`
  drawn from one contiguous stretch of one spine chapter.
- **A seat list** `{c?, s: [{l, u}]}` — where `l` is the edition's own label
  and `u` is one `[spineChapter, first, last]` triple, or several for a fold
  whose parts are not contiguous.

`c` is omitted where the edition's label equals that of the spine chapter its
span names; the chapter then inherits the spine's display identity.

**The governing rule: a book is all-positional or all-explicit, never mixed.**
Bare integers are legal only where the edition's chapters correspond
one-to-one, in order, with the spine's. The moment any chapter splits, merges,
reorders or relabels, every entry in that book names its own source — because
position can then only order, never identify.

**Seating charts are generated and never hand-edited.** They are a projection
of the chapter files, regenerated whenever those change.

### `translations.json` — the edition registry
Per edition: name, native name, language, text direction, which reckoning it
follows, what it composes over, its rights status and provenance, and the
prose a reader is shown about it. Per language: the naming kit — testament,
section and book names, book abbreviations, the volume's title, and the
reading vocabulary.

### Generated indices
`coverage.json` (what each edition serves, per book and chapter) and any
`.gz` siblings. All are derived, all are regenerated, none are authored.

---

## Conformance

A corpus is WILBUR 1.0 if:

1. **Slot ids** are integers `1..N` unbroken, optionally with sub-slots, each
   hanging off an integer that exists.
2. **Ordinals are derived by sorting** — integers ascending, each sub-slot
   immediately after its integer — **never from key order in the file.**
3. **No utterance is claimed twice** by one edition.
4. **Every edition's text sits at an address that edition actually uses**, and
   every utterance it holds is reachable from its seating chart.
5. **Absence is asserted, never implied.** An utterance an edition lacks is
   either covered by a span, asserted `absent` or `lost`, or accounted for by
   its reckoning. An unexplained hole is a defect.
6. **Seating charts are generated**, obey the all-positional-or-all-explicit
   rule, and a run expands to exactly the seats its long form would produce.
7. **Every claim is traceable.** Each edition names its source; alignment
   derived from a source is re-derivable from it.

## Versioning

**1.0**, and versioned from birth deliberately: this format changed three
times in the week before it was named. A named format that mutates silently
is worse than an unnamed one. Consumers should read `_schema_version` and
refuse what they do not understand.

## Relationship to other formats

WILBUR is not a replacement for OSIS or USFM, which describe a single
edition's text and do it well; a WILBUR corpus is commonly *built from* them.
It is an alternative to `av11n` for the narrow question of holding several
traditions at once, and it differs in refusing a pivot: there is no hub
tradition through which meaning must pass, because the spine is nobody's
edition and every tradition's utterances are first-class in it.
