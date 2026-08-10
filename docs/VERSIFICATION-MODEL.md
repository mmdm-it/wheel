# The utterance model

**Drafted by Wilbur, 2026-07-30, at Howell's instruction.** For Howell and
Orville to argue with. Nothing here is built; nothing here is ruled.

> **STALE AS OF 2026-08-08 — that last sentence is no longer true, and it is
> the sentence a reader trusts first.** H-2 (a label is a quotation), H-11
> (the post-migration layout) and W-38 rule large parts of this model, and
> H-12 phase 1b schedules its generator work. The document has not been
> reworked to match; **the MODEL rework is phase 1 work and still owed.**
>
> **The RIGHTS half is done (F2, 2026-08-10):** the title no longer says
> "proposal", and the worked examples carry coordinates — which are structure,
> and granted (NOTICE §1b) — without verse text from outside the fixture, which
> is not (H-5). Wilbur drafted the redaction; Orville committed it, per WF-15.
>
> **Three rulings migrated here from `DECISIONS.md`** when the catch-all was
> retired, because this is their subject and they had no blueprint home:
>
> - **Versification auto-corrects per edition.** *"She should also see the
>   blurry primary stratum focus ring rotate to verse 19."* RULED, open —
>   the engine half is H-12 phase 1, the data half Wilbur's tables (O-13).
> - **Verse numbering keeps faith with each tradition.** *"I am considering
>   keeping the numbering true"*, then ruled by the Malachi design. H-2 now
>   states the general form: a label is a quotation, and tradition-script
>   numerals are a liked default rather than law.
> - **Versification is NOT a fourth stratum.** *"I'm not sure I see the need
>   [for] a fourth stratum."* It is a property of the edition, not a
>   dimension the reader navigates — which is why the seating chart lives
>   under the edition and not beside the strata.

Howell's principle, in his words:

> The text was never meant to belong anywhere. It exists eternally in space. It
> just is. What we are attempting to do is track the various ways in which
> humans have pulled these bits of wisdom out of the ether and given them
> addresses. To ask "What text goes in Malachi 3:18?" is to ask the wrong
> question. The better question is "Where does *And you shall return and shall
> see the difference between the just and the wicked* belong according to the
> Latin Vulgate or the WLC?"

In engineering terms he has inverted the primary key. We store `address → text`.
He is describing `text → addresses`.

---

## 1. Why the current model cannot hold the answer

A chapter file today is a map of slots, and each slot holds one string per
edition:

```jsonc
"verses": { "22": { "seq": 22, "v_in": {...}, "text": { "VUL": "…", "NEO": "…" } } }
```

This encodes one proposition: **slot N is the same stretch of scripture in every
edition.** Where that is true — most of the corpus — it works. Where the
traditions cut the text at different points it is false, and there is nowhere to
put the truth. On import the divergence gets forced into the 1:1 shape, and the
forcing is what leaves wreckage:

| Reality | What the model can say | What actually happened |
|---|---|---|
| Latin cuts once where French cuts twice | nothing | the two French verses were welded into one Latin string, and every later verse in the chapter slid up a number |
| The Greek has material the Latin never had | "Latin slot is empty" | reported as a gap in Latin, which is a lie about the Vulgate |
| Hebrew Malachi ends at chapter 3 | `chapter_in: {MT: 4}` | asserts a Masoretic chapter that does not exist |

`v_in` was the first attempt at a fix, and it is genuinely right as far as it
goes — Psalm 9 already records the Masoretic restart at slot 21. But its value
is a **scalar**: one number per scheme. A merge is one address on the left and
two on the right. The instrument we both specified for O-13 cannot express the
commonest form of the problem it exists to solve.

---

## 2. The model

Three ideas, and the third is the only unfamiliar one.

1. **The utterance is the atom.** A stable, opaque identity for a stretch of
   scripture. Not a number, not an address — an identity. Utterances are held in
   the spine's order (Howell's book-order ruling, extended one level down: order
   is our editorial stance, stated once).
2. **An address is an annotation.** `VUL 50:22` is not where a verse *lives*; it
   is what the Clementine editors *called* something.
3. **An address may span more than one utterance.** This is the whole change.
   Everything else follows.

Text belongs to the **(edition, address)** pair, not to the utterance — because
the string *is* that tradition's own cutting of the words. The utterance carries
identity, not prose. This matters practically: it means we never have to split a
Latin sentence ourselves in order to say the Latin covers two utterances. We
record the Latin verse whole and say what it spans.

### Shape

```jsonc
{
  "chapter_id": "GENE_050",
  "_schema_version": "3.0",

  // Ordered, opaque, stable. Order is the spine's.
  "utterances": ["u1", "u2", "…", "u26"],

  "editions": {
    "VUL": {
      "text":  { "22": "…" },     // elided: Genesis 50 is outside the
                                  // granted fixture (H-5)
      "spans": { "22": ["u22", "u23"], "23": ["u24"], "24": ["u25"], "25": ["u26"] }
    }
  }
}
```

**The identity default, which is what keeps this affordable:** if `spans` has no
entry for an address, that address maps to the identically-named utterance. The
1:1 majority of the corpus therefore carries **no `spans` block at all**. We
write spans only at the seams.

### Two derived facts the engine gets for free

- **Containment** (O-16's coverage index): an edition contains utterance *u* iff
  some address of that edition spans *u*. No separate index to maintain, no
  chance of it drifting from the text.
- **Rotation**: given the reader's utterance and a target edition, the seat is
  the address that spans it. That is the exact query visual versification needs,
  and the current schema cannot answer it at all.

---

## 2b. The easy case first — Genesis 1:1, and why most of the corpus is free

Before the hard cases, the ordinary one. Genesis 1 is the granted fixture
(H-1), and it is also the shape the whole corpus mostly has: **all three
seating charts run it as an identity run 1..31, with no sub-slots and no
divergence anywhere in the chapter.**

```jsonc
{
  "chapter_id": "GENE_001",
  "utterances": ["u1", "u2", "…", "u31"],
  "editions": {
    "VUL": { "text": { "1": "In principio creavit Deus cælum et terram." } },
    "DRA": { "text": { "1": "In the beginning God created heaven and earth." } }
  }
}
```

**Note what is absent: there is no `spans` block.** Address 1 maps to `u1`
because nothing says otherwise — that is the identity default, and it is why
the model costs nothing across the overwhelming majority of the corpus. Spans
are written only at the seams, and Genesis 1 has none.

This is also the limit of what the fixture can teach. **Genesis 1 contains no
versification divergence at all**, so a merge cannot be quoted from it — there
is no merge in it to quote. The hard cases below therefore keep their
coordinates, which are structure and granted (NOTICE §1b), and lose their verse
text, which is not (H-5).

---

## 3. The four hard cases

### A · Genesis 50 — a merge (and our own defect, made visible)

Our Latin verse 22 runs two clauses together where the French cuts them
in two: one address on the left, two utterances on the right.

```jsonc
"utterances": ["u1", "…", "u21",
  "u22",  // the first half of what the Vulgate numbers 22
  "u23",  // the second half — the merge this example exists to show
  "u24", "u25", "u26"],

"editions": {
  "VUL": { "spans": { "22": ["u22","u23"], "23": ["u24"], "24": ["u25"], "25": ["u26"] } },
  "DRA": { "spans": { "22": ["u22","u23"], "23": ["u24"], "24": ["u25"], "25": ["u26"] } },
  "NEO": { }   // identity — 22→u22 … 26→u26
}
```

Note what this does that nothing else has: **the Latin's off-by-one becomes
explicit and legible.** Today it is invisible unless you read the Latin against
a French Bible. Here it is four lines of data that a reviewer can check.

It also stays neutral on a question we have not settled — whether the Clementine
truly merges here or our source erred. The schema records *what we hold*. If we
later restore the split, the fix is to change VUL's spans; no utterance moves,
and no other edition is touched.

### B · Malachi — a chapter that does not exist in Hebrew

Today: `chapter_in: {MT: 4}`, asserting a Masoretic Malachi 4. There isn't one —
the Hebrew runs 3:19–24. The declaration is simply false, and the file also has
no WLC, LXX, SYN, FIN, NEO or SAC text at all.

Under the model there is no `chapter_in` to lie with. Chapter mapping is not a
property of a chapter; it is implied by each edition's addresses:

```jsonc
"editions": {
  "VUL": { "spans": {} },                                    // 4:1 … 4:6, identity
  "WLC": { "spans": { "3:19": ["u1"], "3:20": ["u2"], "…": [] } }
}
```

**The false assertion becomes inexpressible.** That is the strongest argument
for the model: not that it can say more, but that it can say less that is wrong.

(The Hebrew and Greek text of these six verses is still absent from the corpus
and must be restored either way — W-18 deliverable 4.)

### C · Psalm 9 — a seam across a chapter boundary

Vulgate Psalm 9 is Masoretic 9 **and** 10. Our file already records this
correctly at verse granularity, which is the encouraging part: `v_in` restarts
MT at 1 on slot 21, and slot 39 has a `VUL` number with no `MT` counterpart.

The model keeps that and fixes the one thing `v_in` cannot do — cross the
chapter line — by making addresses `chapter:verse` rather than bare verses:

```jsonc
"editions": {
  "VUL": { "spans": {} },                                    // 9:1 … 9:39
  "WLC": { "spans": { "9:1": ["u1"], "…": [], "10:1": ["u21"], "10:18": ["u38"] } }
}
```

**Consequence worth flagging:** an edition's block may address utterances in a
different chapter file than the one it sits in. Either the spans live at book
level, or a chapter file may name foreign addresses. I lean book-level for the
seams and chapter-level for everything else, but this is a real design fork and
I would rather Orville chose it, since he pays the loading cost.

### D · Judith 11 — utterances the Latin never had

The Vulgate's Judith is a shorter recension than the Septuagint's. Verses 22 and
23 hold Greek and Russian text; there is no Latin and never was.

```jsonc
"utterances": ["u1", "…", "u21", "u22", "u23"],
"editions": {
  "VUL": { "spans": {} },              // addresses 1 … 21 only. Stops.
  "LXX": { "spans": {} },              // 1 … 23
  "SYN": { "spans": {} }
}
```

No empty slot. No gap. No third verdict. The Latin's last address is 21 and
that is the entire statement — **the Vulgate is not missing anything.** Under
`has/hasn't` this same fact has to be encoded as "Latin lacks verse 22", which
misdescribes the Vulgate in order to fit our table.

---

## 4. What this does *not* solve, stated plainly

- **Where the traditions witness different texts, alignment is a judgment, not a
  discovery.** Judith, Jeremiah, Esther and Daniel are recensions, not cuttings.
  The model holds them fine (few addresses per utterance) but it will not tell
  us where the seams are. That is reading, and I have already recorded that the
  scoring tools cannot substitute for it.
- **It does not fix a single existing defect.** Genesis 50's weld, the 67 absent
  Hebrew psalm verses, the 45 Latin tail chapters — all still exactly as broken.
  The model makes them *expressible and checkable*, which is a precondition for
  fixing them and nothing more.
- **Compensating merge-plus-split inside one chapter remains invisible** until
  someone aligns the content. Counts match, no slot is empty, every check we own
  passes. I do not know how many exist. Finding out is content alignment,
  chapter by chapter, and it is the largest unscoped item on my side.

---

## 5. Migration — three steps, and only the first is urgent

**Step 1 · Permit spans. Populate nothing.** ✅ **DONE 2026-07-30** (cargo,
uncommitted pending Howell's OK). Add `editions[ED].spans` to the schema with
the identity default. No existing file changes; no engine change; no behaviour
change. This is the whole of what I need before authoring O-13's tables, because
it is the difference between recording the seams in a shape that can hold them
and manufacturing the next Genesis 50 by hand, at scale.

What landed:
- `schemas/gutenberg-chapter.schema.json` — the **first schema chapter files
  have ever had**. They were governed only by invariant tests; the shape was
  folklore. It describes what exists, marks `chapter_in` and scalar `v_in` as
  legacy with a note on why each is insufficient, and opens the `editions` door.
- `test/chapter-schema.test.js` — all 1,215 files validate, plus the span
  contract as seven rules: spans name real utterances; no utterance is claimed
  by two addresses of one edition; a multi-utterance span is contiguous (coarser
  than the spine is legitimate, a gerrymander is not); text keyed by an
  edition's own address must have a span to seat it; nothing is both spanned and
  declared absent; no edition holds one utterance in both text stores.

The contract would be **vacuous** against a corpus that carries no `editions`
block, so it also runs against worked fixtures of all four hard cases above, and
against six ways of getting it wrong that it must refuse. Those fixtures are the
specification: if the model changes, they are what has to be argued with.
44 tests pass, 0 fail.

One addition the proposal did not have: **`absent`**, an optional per-edition
list. It asserts *this tradition demonstrably never held these utterances* — a
fact about the Vulgate's Judith — as distinct from our simply not having
imported them. Unset means unknown, which is the honest default and what every
chapter says today.

**Step 2 · Write spans at the known seams only** — the Psalter, Malachi, the
Latin tail chapters as I read them. The coverage index (O-16) derives from this
rather than being maintained beside it.

**Measured cost of step 2, so it is not a guess.** Of 1,215 chapter files, the
ones showing any sign of divergence today — a non-identity `v_in`, a
`chapter_in` that disagrees with its own Vulgate number, or any edition ending
before the spine does:

| | chapters | |
|---|---|---|
| would need a `spans` block | **299** | 24.6% |
| identity only, untouched | **916** | 75.4% |

Both directions of error are worth stating. It **over**-counts, because some of
those tails are our own defects (Genesis 50, the 67 Hebrew psalm verses) and
become identity once repaired. It **under**-counts, because a chapter that
merges once and splits once keeps its verse count and shows no signal at all —
those are found by reading, not by scanning. Treat 299 as the shape of the work,
not its size.

**Step 3 · Retire `chapter_in` and scalar `v_in`** once spans cover what they
covered. Not before, and there is no hurry.

Ring omission (W-19/O-16) does **not** wait on any of this. It is correct today
and stays correct after.

---

## 6. Open questions — for Howell and Orville, not for me

1. **Book-level or chapter-level spans?** Cross-chapter seams (Psalm 9) need one
   or the other. Orville's call — he pays the loading cost.
2. **Where does the magnifier land when two seats fuse?** Reading Hebrew Genesis
   50:23 and rotating to Latin, the reader's utterance is the *second half* of
   Latin 22. Show the whole Latin verse — which includes a sentence they weren't
   reading — or something else? The model guarantees the return trip is exact,
   because identity is carried by the utterance rather than the number. It does
   not decide what the seat displays.
3. **Do fused seats announce themselves?** Two nodes becoming one is the most
   vivid demonstration of visual versification available to us, and it happens
   inside a chapter where a reader can take it in at a glance. Whether it should
   be *legible as an event* or simply be the new shape is a taste question, and
   Howell's.
