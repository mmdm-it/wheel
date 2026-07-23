# The Premise

*The first principle, above architecture and above every phase. Stated by
Howell 2026-07-20; unwritten until now though the whole program already
obeyed it.*

**The user knows what they are looking for, and roughly where it is.**

From that one assumption everything follows:

- **There is no search window, and there never has been.** The instrument
  scans; it does not query.
- **It will never trigger a QWERTY keyboard.** No typing, anywhere, ever.
  (The adapter contract carries a `search` capability — and all four
  volumes decline it. The premise was in the code before it was in prose.)
- **It does one thing well: it scans large sets of hierarchical data
  elegantly and quickly.** Testaments → books → chapters → verses; markets →
  countries → manufacturers → cylinders → models; the six-millennia
  calendar. Two motions cover all of it — **orbital** (rotate the ring to
  browse siblings) and **radial** (in and out between levels).

## The instrument is a reader, not an editor

The program *displays* a body of data; it does not *accept* one. This is a
deliberate stance, not a gap. Data enters the instrument the way the
calendar's does today — **computed** (sunrise, moon, the reckoning itself)
or **ingested** from an authored source (the tide tables extracted from the
wall calendar, the curated catalog, the Gutenberg corpus) — never typed at
the glass.

The open frontier this leaves — how does a *personal* calendar layer get
its events? — is acknowledged and deliberately unsolved. The eventual
answer, if one comes, arrives **from outside**: email or text the program
from another app, and it ingests. The wheel never grows a keyboard to do
it. Input is a separate concern, kept out of band, so the instrument stays
pure.

## Why the strata design is the right one

The premise is the reason **dimensions/strata** (Phase D) are elegant
rather than ornamental. Without typing, how does a user narrow a huge space
— pick a language, a sort order, a set of layers? Not with a search box and
not with a flag-button cycling a fixed list. With **another wheel**: a
chooser strata, keyboard-free, where the common choice is already the
largest node (prominence *is* the default). Anything a user would normally
toggle through a list becomes a navigable space instead. The no-keyboard
premise and the strata mechanism are two statements of one idea.
