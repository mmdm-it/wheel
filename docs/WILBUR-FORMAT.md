# The WILBUR format — 1.0

**A format for hierarchical corpora that hold several parallel views of the
same material, and the contract by which the Wheel displays them.**

Named for Wilbur Wright, and for the half of this project that carries rather
than flies. Drafted 2026-08-03; reviewed by the engine side and revised
through 2026-08-06.

**The format described here may be freely implemented** by anyone, in any
language, for any purpose, without permission or fee (Howell's ruling,
2026-08-06). What is granted is the format — the model, the schema, the
contract. The text of this document is © MMdM, all rights reserved. A format
nobody may implement is not a format; it is a document about one.

**Scope: this is the volume contract, not merely a data shape.** It defines
what a corpus must be for the Wheel to display it.

**What is settled and what is not.** The model, the identity rules and the
conformance list are ruled and implemented or scheduled. The **corpus is not
yet conformant**: the Bible volume is Vulgate-shaped at every level and its
migration to opaque identity is in progress — see *Identity*, where the gap is
marked rather than glossed. Where this document and the engine disagree,
assume this document is wrong and tell us.

---

## The problem

A volume is a hierarchy ending in leaves: scripture ending in utterances, a
calendar ending in units of time, a catalogue ending in models, a library
ending in recordings. The difficulty is never the hierarchy. It is that
**more than one authority divides the same material, and they disagree.**

The Latin's Jonah 1:17 is the Hebrew's 2:1. A Julian date and a Gregorian
date name the same hour differently, and a liturgical calendar divides the
day where a civil one does not. Two manufacturers' catalogues give one engine
two part numbers, and a later catalogue merges two models into one listing.
A reissue combines two tracks into a single index.

The usual answers are to pick one authority and flatten the rest to it, or to
map between them through a hub. Both lose whatever the chosen authority
cannot express, and the choice is usually made on availability rather than
fitness.

## The idea

**An address is an annotation on a leaf, not a container for it.**

A leaf is one thing, once. Every leaf any authority attests has an identity
in the **spine** — an ordered sequence that belongs to no authority. Each
view's own numbering, naming and grouping is then a *label*, applied to
leaves that exist independently of it.

**The spine's granularity is declared by the volume, and the finest division
any view uses sets it.** A calendar whose views mark hours has hourly leaves;
one that marks nanoseconds has nanosecond leaves. Scripture's leaves are
utterances. A catalogue's are models. Nothing in the format fixes the unit;
everything in it requires that the unit be fine enough for every view.

**No view is the hub.** The spine is constructed as a superset precisely so
that no tradition, edition or catalogue is drafted into service as the
coordinate system for the others.

> **THIS IS THE GOAL, NOT THE CURRENT STATE.** The Bible volume today is
> Vulgate-shaped at every level — see *Identity*, below. The claim above is
> what the format requires; the corpus does not yet meet it.

## What follows

Five things WILBUR expresses, each of which appears in more than one volume:

1. **One address may cover several leaves.** The Latin's Genesis 50:22 holds
   two Clementine verses; a reissue's track 7 holds two original tracks; a
   later catalogue's one listing holds two earlier models.
2. **A view may divide finer than another.** Sub-leaves hang off the leaf
   they belong to, so a view that cuts finer is not misnumbered from there
   down.
3. **Absence is asserted, with a reason, in two kinds.** *Never held* is not
   *held and lost*. Vaticanus never had a verse the Vulgate has; a
   manufacturer made a model whose every record is gone. Silence means
   unknown, which is the honest default.
4. **Coordinates may be shared by convention only.** Two recensions of Judith
   sit at the same addresses without corresponding; two catalogues may reuse
   a part number for unrelated parts. A WILBUR corpus says so, so that no
   consumer claims a correspondence that does not exist.
5. **Grouping and labels are a render-time projection.** Which chapters exist,
   what they are called, and which leaves they contain belong to the view —
   never to the spine.

---

## The corpus

### The volume declaration
Every volume declares its own shape: a schema version, a data version, the
levels of its hierarchy, and **which level is the leaf**. The Wheel reads
these rather than assuming; a volume of four levels and a volume of six are
the same kind of thing to it.

### The spine
The ordered sequence of leaves, grouped by the volume's levels. Leaf
identities are stable and never renumbered: they are what every view points
at. Where a view divides finer, the spine carries the finer division and the
coarser view spans it.

### The views
Each view — an edition, a reckoning, a catalogue, a pressing — declares its
own identity, the reckoning it follows, its text direction where that
applies, what it composes over, its rights and provenance, and the prose a
reader is shown about it. A view may cover the whole spine or one book of it.

### The reckonings
Spine address → that reckoning's own address, **non-identity entries only**.
A reckoning is named for itself rather than for a view that follows it, since
several views may share one.

### The seating charts
The generated projection: for one view, its own groups in its own order, each
with its own labels and the spine leaves each label covers. Three forms, in
increasing explicitness — a bare integer where a group is identity, a *run*
where a group is N consecutive leaves labelled 1..N, and a *seat list* where
it is anything else.

**A group is all-positional or all-explicit, never mixed.** Bare integers are
legal only where the view's groups correspond one-to-one and in order with
the spine's. The moment any group splits, merges, reorders or relabels, every
entry names its own source — because position can then only order, never
identify.

**Charts are generated and never hand-edited.** They are a projection, and a
projection that can be edited independently of its source is a lie waiting.

### The naming kits
Per language: the name of every level and every node, the short forms, the
volume's own title, and the reading vocabulary. A volume is not multilingual
because its leaves are translated; it is multilingual when its *furniture* is.

---

## Identity — RULED 2026-08-04, extended to containers 2026-08-05

**A leaf's identity is opaque, permanent and meaningless.** It is a key and
nothing else: distinct from every other, never changed, never reused.

Howell's challenge, and the reason: an id like `14b` says that `14` is the
more foundational thing — and `14` is the *Vulgate's* number. No edition
should be described in another's terms. A reader asking which of two
traditions puts a passage in the right chapter deserves the answer
**neither**: chapter divisions are Langton's, c.1227, and verse divisions
Estienne's, 1551. The words are given; the drawers are ours.

A leaf id must therefore encode **none** of the following, and each
exclusion earns its place:

- **No edition.** Otherwise one tradition is the frame and the rest are
  described as departures from it.
- **No order.** If ids sort, inserting a leaf either renumbers everything
  after it or produces ids that lie about position. Order lives in a
  **sequence**, in exactly one place.
- **No container.** No book, no chapter. A view must be free to regroup
  without re-identifying anything.
- **No content.** Identity has to survive correction: 22,000 verses of this
  corpus were edited in a single week without becoming different verses. And
  content does not individuate anyway — Judges 17:6 and 21:25 are the same
  sentence twice.
- **No relationships.** Not "part of", not "child of" — see splitting.

### Splitting and merging

Granularity is a **choice, not a discovery**. One can always cut finer:
verse, clause, phrase, word. The refinement rule does not find the true
atoms; it says *be at least as fine as any view we hold*. So a new view that
divides more finely is not evidence we were wrong — it raises the corpus's
**resolution**, and it is a normal event rather than an exceptional one.

**When a leaf splits, it is RETIRED and REPLACED.** The old id dies; new
ordinary ids are born, indistinguishable from any other. A **tombstone**
records `old → [new…]` so that stored references and saved reading positions
resolve. A suffix (`u7f3a-b`) is explicitly rejected: it would privilege not
a tradition but *the moment before we knew better*, and would reintroduce the
two-shapes-of-id crack that sub-leaves grew from.

**Merging is the same operation reversed** — two ids die, one is born. That
the inverse needs no special case is the strongest evidence the rule is right.

**Views that do not split are unaffected.** They keep their labels and their
text, and their address simply spans the finer leaves — which is what an
address has always been. No edition is ever retroactively wrong: the
Clementine says in 2026 exactly what it said in 1592, and only our ability to
describe where traditions agree has grown finer.

### Authoring

Opaque storage costs human proofreadability, and that cost is real: defects
in this corpus have repeatedly been caught by *reading* the data. So the
authoring layer keeps human-readable addresses and the opaque storage is
**generated** from it — the same relationship the seating charts already have
to the chapter files. The id nobody can decode is also the id nobody had to
type.

### Containers are identified the same way — extended 2026-08-05

Howell, reading the sentence *"our Psalm 23 is the Hebrew's Psalm 24"*:

> That's a terrible statement. There is no "our". There are only utterances,
> which are ethereal, and belong to no tradition. That's the whole point.

He was right, and the fault was not in the phrasing. This document already
claims that **no view is the hub** — and then says, forty lines later, that
*"the spine follows the Clementine Vulgate's divisions as a superset."* Both
sentences are ours. The data settles which is true: **38,165 of this corpus's
leaf ids are the Vulgate's verse numbers.** The Vulgate IS the hub. It is
simply an undeclared one, which is the only thing distinguishing it from the
KJV pivot this format was written to avoid.

**Opaque leaf ids alone do not fix this.** *"Our Psalm 23"* is a claim about a
CONTAINER. If leaves become opaque while still living in "chapter 23 of PSAL",
the Vulgate remains the coordinate system one level up and the sentence stays
sayable — with better-looking ids.

**So every node of the hierarchy carries an opaque id, not only the leaves.**
A book is an id. A chapter is an id. Every tradition's name and number for it
— the Vulgate's included, with no privilege of any kind — is a **label applied
by that view's chart**. No level of the spine is named in any tradition's
terms.

**The test the format must pass:** it must be impossible to write a true
sentence of the form *"our chapter N"*. The only true sentences are of the
form *"`e3qm48` is Psalm 23 in the Vulgate and Psalm 24 in the Hebrew."*

Three consequences, accepted:

1. **The spine becomes unreadable to a human without a chart.** Same answer as
   for leaves: the authoring layer keeps readable addresses and the opaque
   form is generated from it.
2. **The migration is much larger than the leaf ruling alone.** It reaches the
   manifest, the rings, the pyramid, deep links, the resume position, every
   seating chart and every reckoning table — most of the volume model.
3. **No proofreading survives it.** A `proofread` flag describes a build, and
   this replaces the build. Howell's ruling, 2026-08-05: *"I certainly don't
   trust any proofreading that we do now, once we have implemented such a
   major overhaul of the architecture and spine. That work precedes
   everything."* The Hebrew suite therefore stops at seat 2 and resumes after
   migration.

*NOT YET IMPLEMENTED. The corpus today carries Vulgate-shaped ids with letter
suffixes at leaf level and Vulgate book-and-chapter numbering above it; the
sections above describe what stands today, and this ruling supersedes it.
Migration touches 38,275 leaves, 462 spans, 919 absences, 6,027 versification
entries, every chart, and the whole container hierarchy. It is
all-or-nothing.*

## Conformance

A corpus is WILBUR 1.0 if:

1. **Leaf identities** are ordered, stable, and fine enough that no view must
   divide below them.
2. **Ordinals derive from that order**, never from key order in a file.
3. **No leaf is claimed twice** by one view.
4. **Every view's content sits at an address that view actually uses**, and
   everything it holds is reachable from its chart.
5. **Absence is asserted, never implied.** A leaf a view lacks is spanned,
   asserted absent or lost, or accounted for by its reckoning. An unexplained
   hole is a defect, not a silence.
6. **Charts are generated**, obey the all-positional-or-all-explicit rule, and
   a run expands to exactly the seats its long form would produce.
7. **Every claim is traceable.** Each view names its source; alignment derived
   from a source is re-derivable from it.

## Versioning

**1.0**, versioned from birth deliberately: the format changed three times in
the week before it was named. Consumers read the declared version and refuse
what they do not understand.

## What it does not claim

WILBUR covers the model, the schema, the contract and the alignment data —
the record of which leaf is which across views, which is work performed
rather than fact found. **It makes no claim on the material itself.**
Scripture, catalogue photographs, recordings and ephemerides carry their own
rights, declared per view.

### The format is granted; the content is not

Howell's ruling, 2026-08-06: **the WILBUR format may be freely implemented; the
text of this document is reserved.** Those are different things, and conflating
them is what makes people wary of specifications. A format nobody may implement
is not a format — it is a document about one — and conformance needs a legal
footing or the word means nothing.

This is also why the defensive publications exist: so that nobody, MMdM
included, may patent the methods. A specification that cannot be implemented
does not serve that purpose.

The corresponding restriction, and it is the operating rule rather than a
sentiment:

> **Anything published carries no corpus content — the text itself, or the
> editorial work product that established it — unless it has been deliberately
> granted.**

Structure is given away on purpose. Content is not. The distinction cuts
*through* our documents rather than around them, so it cannot be enforced by
which repository a file sits in: a public document describing how a reading was
established leaks the same work product as the reading would.

**Reserved by default.** Rights are enumerated for what is *granted*; anything
unnamed is reserved by construction. Enumerating the reservations instead does
not scale — every new file becomes a rights edit, and the day one is forgotten
the failure runs toward accidental publication, which is the expensive
direction. Default-deny, applied to rights.

## What a view promises the reader

A WILBUR view carries one flag that is a promise rather than a description:
**`proofread`**. Everything else in a view's declaration is a fact about the
data; this is a claim made to whoever reads it, and the format therefore fixes
what it means.

**`proofread: true` means: what you see is faithfully what our source says,
and we name the source.**

It is deliberately NOT a claim that the material is correct. That would be a
claim about the source, which is not the publisher's to make. The distinction
is Howell's (2026-08-05): *"My role model is Gutenberg, not Wycliffe."*
Gutenberg did not establish the Vulgate; he reproduced a named exemplar
faithfully, and the achievement was the press. A WILBUR corpus makes the
printer's claim, not the scholar's — a smaller claim, and one that very few
publishers of any hierarchical corpus actually make.

Concretely, a view earns the flag when four independent things have been
checked, because four different things can be wrong and no single witness
catches more than one:

| what could be wrong | what catches it |
|---|---|
| the view was imported or edited wrongly | compare to the declared source, every leaf, mechanically |
| the *source* transcribed its original wrongly | the original, or a facsimile |
| right content at the wrong address | an independent edition, compared where it can honestly witness |
| the engine does not display what the data holds | the running app, against the data |

**Where a view has no independent witness, the flag must record that** rather
than imply a check that never happened. A flag that says which of the four
were possible is worth more than one that quietly means fewer.

The suite of seats, and the ranking that lets a checker stop early and still
claim honestly, live outside this format in the corpus's own
docs/PROOFREAD-SUITE.md — the format fixes the *meaning*, not the roster.

## Editorial policy is declared, not inherited

Where a source offers a view more than one defensible reading of the same
material, the choice between them is **work performed, not fact found** — and
WILBUR requires it be declared rather than left to whatever a converter
happened to do.

The test is simple: if two honest editions built from the same source would
differ, the difference is a policy, and a policy that is not written down is
an accident wearing a decision's clothes. A consumer must be able to learn
what was chosen without diffing us against someone else.

### The Bible volume: qere over ketiv (Howell's ruling, 2026-08-05)

The Masoretes recorded, beside the consonantal text, how it is to be *read*:
the **ketiv** is what is written, the **qere** what is spoken. The two differ
in 1,102 verses of our corpus. A third case, **ketiv velo qere**, marks a word
written and read as nothing at all — 6 verses, encoded in our source as a qere
element that is present but empty.

**We present the text as read.** Where a qere exists we show it; where the
qere is empty we show nothing. This is the majority convention — Mechon-Mamre,
Koren, and nearly every translation follow it — and it follows from the
premise: the Wheel is an instrument for reading, not a critical apparatus. A
reader meeting a bare unpointed word has met a problem, not a text.

Two consequences we accept openly rather than discover later:

1. **It is sometimes a substantive choice, not a formatting one.** At
   1 Samuel 2:3 the qere reads *"and by him actions are weighed"* where the
   ketiv reads *"and not weighed"* — opposite senses. We take the received
   reading, as the translations do, and say so here rather than let it look
   like a typo.
2. **A diplomatic edition is not a witness against us.** AndBible's WLC module
   displays the ketiv, so it disagrees with us in those 1,102 verses BY DESIGN.
   Anyone proofreading against it will meet 1,102 differences and no defects.
   See docs/PROOFREAD-SUITE.md.

This entry exists because the corpus arrived at the qere by import accident
and not by choosing. Landing on the majority convention is the DEFAULT, so the
policy is no evidence of thought; the record of the reasoning is. That is what
makes it a decision.

### Where the traditions divide the text differently

The three below are not readings but **divisions** — the same words, cut into
leaves at different places. They are recorded for the same reason as the qere:
a reader comparing us to another edition will find them, and should meet a
stated decision rather than an apparent defect.

All three were found by the seat audit of 2026-08-05, which compared all
23,213 WLC seats against an independent Aleppo-tradition edition. They are the
**only** divisions in the entire Hebrew Bible where we and that tradition
disagree — every other seat aligned.

**1. The Decalogue (Exodus 20, Deuteronomy 5).** Two ancient accentuation
traditions divide the Ten Commandments differently. The LOWER division
(*ta'am tachton*) gives each short commandment its own verse; the UPPER
(*ta'am elyon*), used for public reading, combines them.

We follow the **lower** division, with BHS and the Leningrad Codex: Exodus 20
has 26 verses to the upper's 23, Deuteronomy 5 has 33 to its 30. A reader who
knows the text from synagogue knows the upper division, and may reasonably
think us wrong. We are not; we are following our declared source.

**2. Joshua 21:36–37.** The Levitical cities of Reuben. These two verses are
**absent from much of the Ben-Asher tradition** and from many medieval
Masoretic manuscripts; rabbinic Bibles often print them small or note the
absence. They are present in the Leningrad Codex, in BHS and in the
Septuagint.

We hold them, because our source holds them. Note that the Aleppo tradition
keeps the verse NUMBERS and empties them rather than renumbering, so the
chapter has 45 verses either way and no seat shifts.

**3. Numbers 25:19 / 26:1.** One verse — *"and it came to pass after the
plague"* — which we seat as 25:19 and the other tradition seats as 26:1. A
documented seam, already carried in our MT reckoning table.

## Worked example: the Bible volume

The hardest instance, and the one that forced the model into existence.
Leaves are utterances; the spine follows the Clementine Vulgate's divisions
*as a superset*, holding sub-leaves wherever the Hebrew, the Greek or a
vernacular cuts finer. Views are editions — the Westminster Leningrad Codex,
Swete's Septuagint, Theodotion composing over it, the Vulgate, the
vernaculars. Reckonings are MT, LXX, BYZ, THEOD. Every one of the five claims
above appears: folds at Genesis 50:22, sub-leaves through Sirach, absence
asserted across 821 addresses in two kinds, convention-only coordinates in
Judith and Tobit, and every edition's chapters projected at render time —
Hebrew Malachi in three chapters where the Latin has four.

---

## Open questions

Raised by the data side and still open, in the order they matter. Answers and
corrections are welcome from anyone implementing this.

1. **Does this describe what the engine actually needs?** I have specified the
   corpus thoroughly and the Wheel's side of the bargain barely — the adapter
   contract, the display configuration, what a volume must declare for the
   rings and the pyramid to build. That half is yours and I have gestured at
   it rather than written it.
2. **Is the volume declaration sufficient?** Today a volume declares its
   levels and which one is the leaf. Is that enough for an engine that must
   build a ring, a pyramid, a chapter grouping and a detail sector without
   knowing in advance what kind of volume it has?
3. **Does the model hold for the calendar?** Howell's ruling that a leaf may
   be an hour or a nanosecond makes the calendar the Bible's twin rather than
   its simpler cousin — two reckonings dividing one duration, needing a spine
   belonging to neither. I believe the model covers it. I have not tested it,
   and the calendar volume is frozen until Leicester Square, so belief is all
   I have.
4. **Is "all-positional or all-explicit" the right rule at volume scope**, or
   is it a seating-chart rule I have promoted too far?
5. **What have I named that should not be named yet?** A specification freezes
   things. This format changed three times in the week before it was written,
   and I would rather you struck a paragraph now than that we versioned
   something we regret.
