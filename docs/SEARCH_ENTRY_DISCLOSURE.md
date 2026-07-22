# Defensive Publication: Ring-Based Character Entry with Live Corpus Pruning

**Date of first publication:** 2026-07-22
**Author:** Howell Gibbens (ORCID 0009-0000-9904-9864)
**Context:** wheel v3 (this repository), v3.18.0 — the search instrument
**License note:** engine code GPL-3.0; this document is a prior-art disclosure
placing the described interaction method in the public domain as of the date
above, so that it remains free for all to use.

## The problem

Text search on a touch device conventionally summons an on-screen QWERTY
keyboard — an interface foreign to any purpose-built instrument, oversized
for the task of *finding an item that already exists* in a closed corpus.

## The method disclosed

A search-entry mechanism for hierarchical data navigators, comprising in
combination:

1. **A rotatable ring of characters** (A–Z, a visual seam, 0–9) presented in
   the navigator's own focus-ring idiom: characters are chain links, rotated
   by drag/flick through a fixed magnifier lens; the character nearest the
   lens enlarges. No keyboard chrome of any kind.

2. **The strike:** tapping the lens itself commits the settled character to
   the query string. This is the lens's only click affordance, active only
   in search mode.

3. **The carriage:** the committed string sits just left of the lens,
   rotated on the lens's own axis, end-anchored so each strike pushes prior
   characters leftward (typewriter platen behavior). **Each committed
   character is its own backspace key**: tapping character *k* truncates the
   string to *k−1*, returns character *k* to the lens as the settled
   selection, and widens the candidate set accordingly — one gesture serving
   single and multi-level undo with no delete key.

4. **Live pruning against a closed corpus:** after each strike the ring
   rebuilds to only those characters with which some corpus entry can
   continue the current prefix — the ring visibly shortens as the query
   converges. Matching is normalized (case-insensitive; separators ignored).
   Because the corpus is closed (names of items that exist), pruning can
   never exclude a reachable target; a dead-end strike is refused.

5. **Candidates as children:** completions for (prefix + character-in-lens)
   populate the navigator's child-preview region (here, the "child pyramid"),
   updating live as characters stream through the lens during rotation. The
   candidate display reuses the navigator's ordinary child rendering — search
   results are not a separate list UI.

6. **Scope inheritance:** the search corpus is the subtree of the user's
   current position; the scope is *where you are standing*, requiring no
   scope selector.

7. **Arrival as migration:** choosing a candidate does not teleport. The
   candidate travels from the child-preview into the lens; its true sibling
   set pours onto the ring; the character ring departs as any outgoing ring
   does; the lens's fill disc (bare, unlabeled) travels to the parent vessel
   to begin its restoration; and the navigator's back-out path is planted as
   the honest ancestor stack, so ascending from the found item walks the
   real hierarchy.

Measured on this repository's catalog corpus (1,032 model names): a mean of
~2.1 strikes places the target among ≤14 visible candidates; worst case 5.

## Distinctions from known prior art

- **Index typewriters** (Hall 1881, Lambert 1902): pointer-per-character
  transcription without pruning or candidate display; slow because every
  character of arbitrary text is paid for. The method here is disambiguation
  over a closed corpus — logarithmic, not linear.
- **T9 / predictive text:** prediction over a keypad; no rotary entry, no
  visible corpus pruning, no carriage-as-backspace.
- **TV / console selectors (e.g., linear letter strips):** no pruning, no
  live candidates in a spatial child region, no strike/carriage model.
- **Dasher (Ward & MacKay):** continuous probabilistic zooming for open text;
  not a ring/lens instrument, no discrete strike or carriage.
- **Arcade initials entry:** rotary letter selection without pruning,
  candidates, or corpus.

The combination of (1)–(7) — in particular the prune-shortened ring, the
lens-tap strike, the tappable carriage as backspace, and candidate display
and arrival expressed entirely in the host navigator's own navigation
grammar — is, to the author's knowledge, first published here.
