// The dimension bridge — D.2, the swap, headless (docs/DIMENSION_SYSTEM.md).
//
// Connects a dimension selection to the interaction store and the render.
// This is the D-era replacement for the portal-era store-navigation-bridge
// (which drove state by manifest-extraction and redirect — the interaction
// model the chooser stratum retires; that file stays dormant until D.7
// deletes it). No visuals live here: the secondary stratum's ring (D.3)
// and the z-travel (D.4) will CALL this; until then the console knob and
// tests do.
//
// Vocabulary: the store's `language` slot holds the chooser ring's value;
// its `edition` slot holds the translation (the chooser pyramid's value).
// A translation belongs to exactly one language, so setting a translation
// implies its language; setting a language picks that language's default
// translation.
//
// Defaults: the first translation listed for a language in the
// translations registry (document order: VUL before NEO, NAB before DRA).
// This stands in for the ruled prominence-as-default until translations
// carry the editorial popularity tier — then the largest star, not the
// first entry, is the default.

import { interactionEvents } from './interaction-store.js';
import { proofreadOverrideActive } from './lan-gate.js';

// (The engine's nine-language autonym table was deleted 2026-07-30: every one
// of the registry's 29 languages carries its own `autonym`, so the table was
// pure dead weight and the last place the engine named a tongue itself.)

// The tertiary's synthetic node for a placeholder language: one node whose
// magnified label is that language's native "coming soon" (from the language
// registry supplied at boot). Selecting it does nothing — no text to load.
const COMING_SOON_KEY = '__coming_soon__';

// Script tags per language, for the rendered text's `lang` attribute (W-1).
// The registry may override per edition (`lang`); this is the fallback map.
// Only the tag matters — the CSS keys RTL on [lang="he"], and the browser
// picks font/shaping from it.
const LANGUAGE_TAGS = {
  hebrew: 'he',
  greek: 'el',
  latin: 'la',
  english: 'en',
  russian: 'ru',
  french: 'fr',
  italian: 'it',
  spanish: 'es',
  portuguese: 'pt'
};

// W-6's substitution footer (Howell ruled 2026-07-27, mark #3): the notice
// under a stood-in verse speaks THE LANGUAGE THE READER CHOSE — a Russian
// reader must be told in Russian that the Latin is standing in. Provisional
// engine map (same caveat as PENDING_NOTICES: belongs in the registry per
// language eventually — rides O-7, Wilbur). English is the fallback.
const SUBSTITUTION_NOTICES = {
  english: 'latin text · translation not available',
  italian: 'testo latino · traduzione non disponibile',
  spanish: 'texto latino · traducción no disponible',
  portuguese: 'texto latino · tradução indisponível',
  french: 'texte latin · traduction non disponible',
  russian: 'латинский текст · перевод недоступен',
  greek: 'λατινικό κείμενο · μετάφραση μη διαθέσιμη',
  // Hebrew added 2026-07-28 (a Hebrew reader was getting the English
  // notice). ⚠ Engine-authored — wants a native speaker's eye before it
  // ships far; like the rest of this map it belongs in the registry (O-7).
  hebrew: 'טקסט לטיני · התרגום אינו זמין'
};

export function createDimensionBridge({ store, translationsMeta = null, languagesMeta = null } = {}) {
  if (!store) throw new Error('createDimensionBridge: store is required');

  let meta = translationsMeta;
  let langMeta = languagesMeta;
  let renderHook = null;
  let lastNotified = store.getState().edition ?? null;
  // A placeholder language has no edition to commit, so selecting it must NOT
  // touch the store (that would blank the reader). We remember it here instead;
  // the reader keeps its current edition, only the strata display follows along.
  let displayLanguage = null;
  // THE EDITIONS THAT HOLD WHERE THE READER IS STANDING (H-29's carry-out,
  // Howell 2026-08-19). `null` means NO RESTRICTION — the root, or a volume
  // whose adapter does not answer this — and is emphatically not the same as
  // the empty array, which means the reader is somewhere no other edition
  // reaches. The host pushes it; the adapter computes it; nothing here knows
  // what a chart is.
  let here = null;

  // Regenerate ON SETTLE only (Howell ruling 2026-07-20): one notification
  // per committed change, never a stream. The store is synchronous, so
  // "settle" here means the dispatched value actually changed.
  store.subscribe(state => {
    const translation = state.edition ?? null;
    if (translation === lastNotified) return;
    lastNotified = translation;
    if (typeof renderHook === 'function') renderHook(translation);
  });

  const editionsOf = languageId => Object.entries(meta?.translations || {})
    .filter(([, t]) => t?.language === languageId)
    .map(([key]) => key);

  // A servable edition is one we can actually show the reader. The language's
  // DEFAULT must be servable — landing a reader on NAB (pending) when Douay is
  // right there was the "default is a translation we don't have" bug (Howell
  // 2026-07-26).
  // NO ASTERISKS (Howell, RULED 2026-07-30 — see HANDOFF CONTRACT). An edition
  // is offered only if the data DECLARES it fit to show. That is never
  // measured here: counting verses cannot tell a structural gap (never
  // written) from a provisional one (not yet sourced), and guessing would
  // unseat a finished edition or seat an unfinished one.
  //
  // THE LADDER (Howell, RULED 2026-08-01) — COMPLETE (Wilbur: all the data,
  // correctly placed) → CERTIFIED (Howell: displays correctly in the wheel) →
  // PROOFREAD (a human checked the text against an independent source). Only
  // the LAST rung lives in the data, because only the last rung is a promise
  // to the reader; the others are labels in the playlist, which crossed the
  // wall into cargo on 2026-08-18 (W-89) — the engine no longer holds it and
  // must not describe its contents as though it could check them. So the
  // gate reads `proofread`, and nothing reaches ANY venue — the bench, or
  // either public site — until a human has read it against another witness.
  // Every venue shows IDENTICAL content; the question is never what, only
  // when.
  //
  // THE CERTIFICATION OVERRIDE (Howell 2026-07-31): `?proofread=true` lifts
  // that gate so an edition can be INSPECTED before it has been read.
  // Without it the doctrine deadlocks — a flag is false because the kit is
  // missing something, but judging what is missing requires seeing the
  // edition, and a false flag hides it.
  //
  // Two limits keep this an expression of the no-asterisks rule rather than a
  // hole in it:
  //   1. LAN ONLY. On a public host the parameter is inert, so it cannot be
  //      appended to bibliacatholica.com to read half-finished scripture. The
  //      escape hatch does not exist in production rather than being a hole we
  //      trust nobody to find.
  //   2. IT LIFTS `proofread` AND NOTHING ELSE — and under O-29 that is now
  //      the only human-facing condition, so the override is TOTAL on the LAN.
  //      Stated and accepted in the ruling: it is what the flag is for. The
  //      CHART half is not lifted, and cannot be, because it is not a judgement
  //      about readiness — an edition with no chart has no seats to inspect.
  //
  // THE LAN TEST LIVES IN ONE PLACE (2026-08-11). This was an inline regex,
  // and it was a bare PREFIX test: `10.example.com` matched `^10\.`, and so did
  // `127.evil.com` and `192.168.evil.tld` — all real, registrable public
  // hostnames. Any of them lifted this override and showed unproofread
  // scripture on a public host, which is the one thing limit 1 above exists to
  // prevent. Measured, not theorised: the old expression returns true for all
  // three; `isOnLan` returns false.
  //
  // It now calls the shared gate, which requires a genuine dotted quad before
  // it will believe a private range. Two implementations of one question is
  // how they drift apart, and this pair had already drifted.
  // Now ONE implementation, in lan-gate beside the LAN test (2026-08-15): the
  // flag gained a second consumer when it began deciding which books exist,
  // and this file's own comment says what two implementations of one question
  // do to each other.
  const overrideProofread = proofreadOverrideActive();
  // SERVABLE = PROOFREAD && HASCHART (O-29, ruled 2026-08-06, landed
  // 2026-08-12 at the 1a exit gate, which refused without it).
  //
  // It read `proofread && !pendingLicense && !comingSoon`. Neither of those two
  // was ever set on any of the fourteen editions — dead code wearing the
  // costume of a safeguard, which is the worst kind, because the system looks
  // like it is protecting you while nothing is. Under the wall they are dead by
  // construction: the registry is synthesised from `volume.json`, which has no
  // such fields to carry.
  //
  // The architectural half is W-34's: a licence governs DISTRIBUTION, not
  // display. The deploy filter decides what ships; if an unlicensed text is on
  // the device the filter has already failed, and a display check then does not
  // prevent the leak, it hides the evidence of one.
  //
  // AND `hasChart` IS NOT MOOT UNDER THE WALL, which was the tempting reading.
  // Measured: an edition declaring `hasChart: false` still produces all 31
  // seats, because the seat expander reads the chart FILE and this reads the
  // DECLARATION. They can disagree in both directions — a present file under a
  // false flag, or a true flag over a missing one — and nothing reconciles
  // them. So the declaration governs the SHELF: an edition that does not claim
  // a chart is not offered, whatever happens to sit on disk.
  // AMENDED 2026-08-15 (H-25 point 4's carry-out): AN EDITION EARNS THE SHELF
  // WITH ITS FIRST CONFIRMED BOOK, not with its last.
  //
  // The gap Howell found by opening the volume on the LAN with no
  // `?proofread=true` and getting nothing: the edition carried
  // `proofread: false` alongside three confirmed units, so this gate refused
  // it outright and the language fell through to the coming-soon placeholder.
  // Three units he had personally OK'd were unreachable without a debug flag.
  //
  // Per-book was deliberately NOT wired into this gate when the badge was
  // built, and that part stands: asking "is the CURRENT book confirmed" here
  // would make an edition appear and vanish as the reader moved through the
  // corpus. The fix is not to ask a per-book question — it is to ask a
  // cheaper edition-level one. Does this edition hold ANY confirmed book?
  // Then it is fit to be offered, whole, and the NOT PROOFREAD mark carries
  // the per-book truth (H-25 point 4) book by book, which is what the mark
  // was built for. Nothing flickers, because servability still does not
  // depend on where the reader is standing.
  //
  // `proofread: true` still admits an edition with no per-book marks at all,
  // so every other edition behaves exactly as before.
  const hasConfirmedUnit = t => Array.isArray(t?.proofreadUnits) && t.proofreadUnits.length > 0;

  // CHECKED IS THE GATE (W-239, Howell 2026-09-02: "KNOWN, CHECKED, and
  // PROOFREAD it is"). Three rungs: KNOWN is what the machine measures;
  // CHECKED is first, last and a middle verse of EVERY BOOK compared by his
  // own eye, and it is what qualifies an edition to go online; PROOFREAD is
  // the verse-by-verse pass, per chapter, and takes the under-review mark off
  // a chapter — it does not open the shelf. `checked` is baked by the corpus
  // build as "every book this edition holds is in the checked record", so
  // this file needs no denominator and names no volume (O-43).
  //
  // UNTIL THE CORPUS BAKES IT, THE FIELD IS ABSENT AND THE OLD RULE STANDS —
  // one confirmed unit — because the record splits on the corpus's next slot,
  // a day after this ships. Once `checked` is present it decides, and a
  // proofread list that is merely non-empty no longer admits anyone: after
  // the split that list holds chapters the pass has read, and a pass over
  // some chapters is not a check of every book. The fallback dies with the
  // corpus change; its presence here is the seam between two days.
  const isChecked = t => t?.checked === true;
  const gateOpen = t => t?.checked !== undefined ? isChecked(t) : hasConfirmedUnit(t);
  const isServable = t => t
    && (t.proofread === true || gateOpen(t) || overrideProofread)
    && t.hasChart === true;

  // IS THIS EDITION HERE? (H-29's carry-out.)
  //
  // Servability asks whether an edition may be shown to anyone; this asks
  // whether it has anything to show AT THIS SPOT. They are different questions
  // and they are kept apart deliberately — an edition that fails the first is
  // not fit to read, an edition that fails the second is perfectly good and
  // simply does not contain the verse under the reader's finger.
  //
  // A COMMENT ABOVE THIS ONE USED TO SAY servability "does not depend on where
  // the reader is standing", and while a volume held one edition covering all
  // of it that was true of everything here. It is no longer true of the
  // CHOOSER, and Howell ruled the difference in both directions: at the root
  // every language and edition is offered; at a leaf that one edition alone
  // attests, the others are not — offering them would commit the reader to
  // something that cannot show them where they stand.
  //
  // NOTHING HERE KNOWS WHICH VOLUME THAT IS, and the suite enforces it: this
  // file may not name one. The adapter computes the list, the host pushes it,
  // and this compares strings.
  const isHere = key => !here || here.includes(key);

  // Servable AND here. The default-edition pick reads this, so a language
  // chosen at a leaf lands on an edition that actually holds that leaf.
  const servableEditionsOf = languageId => Object.entries(meta?.translations || {})
    .filter(([key, t]) => t?.language === languageId && isServable(t) && isHere(key))
    .map(([key]) => key);

  const languageOf = translationKey => meta?.translations?.[translationKey]?.language || null;

  // The chronological language registry supplied at boot. When present it is
  // the ONE source of the secondary ring's order and labels; without it we
  // fall back to whatever languages the translations happen to carry (tests).
  const languageEntries = () => (Array.isArray(langMeta?.languages) ? langMeta.languages : []);
  const languageEntry = id => languageEntries().find(l => l.id === id) || null;
  // Ground truth for "does selecting this change the reader": a language is real
  // iff it actually has editions — a FACT about the registry rather than a
  // promise in it. (So a promoted placeholder needs no flag flip to work.)
  const hasEditions = id => editionsOf(id).length > 0;
  const currentLanguage = () => displayLanguage ?? store.getState().language ?? null;
  // A language the registry hasn't given a native "coming soon" yet shows
  // an ellipsis — a promise without words beats an empty node. (Wilbur owes
  // the native phrases for any language that can stand shelf-less — O-10.)
  const comingSoonText = id => languageEntry(id)?.comingSoonText || '…';

  return {
    // A gateway reboot re-creates adapters but the store (and this bridge)
    // survive at the host level; only the registry is refreshed.
    setTranslationsMeta(next) { meta = next || null; },
    setLanguagesMeta(next) { langMeta = next || null; },

    // The host reports where the reader is standing, as the list of edition
    // codes that hold it — or null for "no restriction", which is the root and
    // is also what every volume without an adapter answer gets. An ARRAY, even
    // an empty one, is a measurement; null is the absence of one, and the two
    // must not be confused (the same distinction `chartedUnitsOf` draws under
    // O-71, for the same reason).
    setEditionsHere(codes) { here = Array.isArray(codes) ? codes.slice() : null; },

    // The current position filter, for diagnostics and for the one cell that
    // can observe O-75: null means no restriction. Read-only — a copy, so a
    // caller cannot reach in and change what the chooser offers.
    editionsHere() { return here ? [...here] : null; },

    // The chooser ring settles on a language. A REAL language adopts it with its
    // default edition (the reader repaints). A placeholder (no editions) is
    // remembered for the display only — nothing is dispatched, so the reader
    // keeps reading whatever it had; the tertiary will show its "coming soon".
    setLanguage(languageId) {
      if (!languageId) return false;
      const options = editionsOf(languageId);
      // A language must be REAL (has editions) or a known registry placeholder;
      // an unknown id is refused without touching state.
      if (!options.length && !languageEntry(languageId)) return false;
      displayLanguage = languageId;
      if (!options.length) return true; // placeholder: display-only, reader untouched
      // Default to the first SERVABLE edition, not merely the first listed:
      // english once listed an unshowable edition before DRA and the reader
      // landed on it. A language with editions but NO servable one (W-11) is
      // DISPLAY-ONLY, like a
      // placeholder: the shelf shows its held editions, the reader keeps
      // reading what it had. Committing options[0] here used to point the
      // reader at text the deploy filter has stripped — a blank page wearing
      // a real edition's name.
      const servable = servableEditionsOf(languageId);
      if (!servable.length) return true; // W-11: pending language, reader untouched
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: languageId, defaultEdition: servable[0] });
      return true;
    },

    // The chooser pyramid settles on a specific translation: adopt it and the
    // language it belongs to. The synthetic "coming soon" node is not a real
    // edition — settling on it commits nothing. An unservable edition (W-11)
    // commits nothing either: the lens shows its notice, the reader keeps
    // reading.
    setTranslation(translationKey) {
      if (translationKey === COMING_SOON_KEY) return false;
      const languageId = languageOf(translationKey);
      if (!languageId) return false;
      if (!isServable(meta?.translations?.[translationKey])) return false; // W-11: visible, never committed
      // Never offered here, so never committed here — belt as well as braces,
      // because a stale preview or a deep link can name an edition the ring
      // has already stopped showing.
      if (!isHere(translationKey)) return false;
      displayLanguage = languageId;
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: languageId, defaultEdition: translationKey });
      return true;
    },

    getSelection() {
      const state = store.getState();
      return { language: currentLanguage(), translation: state.edition ?? null };
    },

    // The secondary ring's nodes: the whole chronological registry when it is
    // loaded (a thumbnail history of the church's expansion), else just the
    // languages the translations carry.
    // NO PROMISES EITHER (Howell, 2026-07-30, extending the NO ASTERISKS
    // ruling): *"When I said no asterisks, that includes 'coming soon'... I
    // don't even wanna see languages in the tertiary stratum focus ring. The
    // app has nothing to offer, not even a promise."*
    //
    // So the ring holds ONLY languages with at least one edition declared
    // complete. A language whose editions are unsourced, held for licensing,
    // or merely certified-pending does not appear AT ALL — no placeholder, no
    // native "coming soon", no seat. When nothing is complete the ring is
    // empty, which is the honest picture of a volume with nothing to read.
    // (This supersedes W-11's placeholder-language display.)
    languagesAvailable() {
      const shown = new Set();
      // Filtered by WHERE THE READER STANDS as well as by servability (H-29's
      // carry-out): a language whose every edition is elsewhere earns no seat,
      // which is what removes Hebrew from the ring at Matthew 5:16.
      for (const [key, t] of Object.entries(meta?.translations || {})) {
        if (t?.language && isServable(t) && isHere(key)) shown.add(t.language);
      }
      // Registry order when we have it — it is chronological and deliberate —
      // else whatever order the editions give.
      const entries = languageEntries();
      if (entries.length) return entries.map(e => e.id).filter(id => shown.has(id));
      return [...shown];
    },

    // The language's own name, for the secondary stratum's labels. Registry
    // autonym first, then the built-in map, then the registry's English name,
    // then the id.
    languageLabel(id) {
      return languageEntry(id)?.autonym
        || Object.values(meta?.translations || {}).find(t => t?.language === id)?.language_name
        || id;
    },

    // A translation's title in ITS OWN language/script (registry `nativeName`)
    // for the magnified node on the tertiary stratum — Οἱ Ἑβδομήκοντα, כתב יד
    // לנינגרד, Vulgata Clementina. The synthetic node yields the current
    // language's native "coming soon". Falls back to the English `name`, then
    // the key. Unselected nodes keep the abbreviation (Howell 2026-07-22).
    translationName(key, languageHint = null) {
      if (key === COMING_SOON_KEY) return comingSoonText(languageHint || currentLanguage());
      const t = meta?.translations?.[key];
      return t?.nativeName || t?.name || key;
    },

    // The UNMAGNIFIED node label on the tertiary: a real edition keeps its
    // abbreviation/key, but the synthetic "coming soon" node must NEVER show its
    // sentinel key — it stays in the native phrase even scrubbed out of the lens
    // (there is no abbreviation for a promise — Howell 2026-07-22).
    translationAbbrev(key, languageHint = null) {
      if (key === COMING_SOON_KEY) return comingSoonText(languageHint || currentLanguage());
      // THE RING SPEAKS SHORT, IN ITS OWN SCRIPT (O-97, Howell 2026-08-23),
      // choosing between three of his own rulings that had collided on this
      // one surface:
      //   2026-07-26  a Greek edition shows a GREEK abbreviation, not a Latin
      //               key — this function, reading `nativeAbbrev` (O-6).
      //   2026-08-01  the shelf speaks IN FULL: the native full name on every
      //               node, magnified or not. It retired nativeAbbrev before a
      //               single value had been written, and left this function
      //               with no caller at all.
      //   2026-08-23  Map (MT / LXX / NT Graece) should label these nodes.
      //
      // He ruled for the SHORT NATIVE FORM: not Map, because Map is Latin
      // script, and his own 2026-08-01 reason is the one that survives — a
      // Latin-letter code "reads as a filing label in a volume whose whole
      // point is that each tongue speaks for itself".
      //
      // THE FALLBACK IS THE FULL NAME, NOT THE KEY. It used to be the key,
      // which is `50grc` — a filing label of the worst sort, and precisely
      // what he has now rejected twice. Until the data carries a short form,
      // a node wears its full native name: too long, and honest about it. A
      // long true name beats a short false one, and the collision it causes
      // is the visible reminder that the data is owed.
      //
      // ── FOR WHOEVER MAKES THIS CONDITIONAL, and it is not owed yet ───────
      // Wilbur's rule, worked out with him on 2026-08-23 and recorded here
      // rather than left in a message: an edition shows the SHORTEST ATTESTED
      // THING THAT DISTINGUISHES IT FROM ITS RIVALS — a siglum where a
      // scripture has rivals, the scripture's own name where it does not.
      //
      // THE TEST IS THE LEAVES, NOT ANY LABEL. Two editions are rivals when
      // they seat the same utterances, and `bookSeatingUtterance` already
      // answers that, so nothing new need be invented. Division labels are
      // the near-miss that looks right and is not: a Sinaiticus Tobit would
      // divide as Τωβίτ rather than Ἡ Παλαιὰ Διαθήκη, so it fails a label
      // test while being exactly the rival the rule exists for.
      //
      // AND IT MUST BE RUN PER ARC. This stratum's items are
      // `translationsOf(language)` — an edition only ever shares a ring with
      // editions of its own tongue. Run globally the test gives the WRONG
      // answer and forces sigla onto a ring they never share. Measured on the
      // seated corpus, 2026-08-23:
      //     1200BCheb vs 250BCgrc   different arcs   22,804 shared leaves
      //     250BCgrc  vs 50grc      SAME arc              0 shared leaves
      //     1200BCheb vs 50grc      different arcs        0 shared leaves
      // The Hebrew and the Greek Old Testament are rivals in substance and
      // are never asked to sit together; the two that DO sit together share
      // not one leaf. So today every node takes its name — the rule agreeing
      // with the eye rather than a coincidence.
      //
      // NOT BUILT, DELIBERATELY, on Howell's rule of that morning: find the
      // line that reads it, and if there is none there is nothing to build.
      // No arc holds two editions of one scripture today. The rows that would
      // create one are row 4, SKIPPED by Howell (W-119), and row 5, unseated
      // behind a licence letter not yet sent. When a real rival lands, look
      // at the two editions before writing the test — arguing from what the
      // data WILL need rather than from what reads it now is the error both
      // sessions made once in the hour this rule was worked out.
      const t = meta?.translations?.[key];
      return t?.nativeAbbrev || t?.nativeName || t?.name || key;
    },

    // The tertiary stratum's nodes: the SERVABLE edition keys of a language,
    // in registry order (W-4 + W-11, Howell's final ruling 2026-07-27): the
    // shelf shows ONLY what actually opens. An edition that is not servable
    // has no seat — our trouble is not the reader's, and an edition that
    // cannot be read is inside baseball on a ring. A language with nothing
    // servable yields the single
    // synthetic "coming soon" node, in its own tongue. Defaults to the
    // current language, then the first language with editions — never empty.
    // Every edition the reader may actually be shown. The host prunes the
    // volume's structure to what these cover: with none, the volume has no
    // testaments, no books, no chapters and no verses — it truly shows
    // nothing, rather than an empty shell of names (Howell 2026-07-30).
    offeredEditions() {
      return Object.entries(meta?.translations || {})
        .filter(([, t]) => isServable(t)).map(([k]) => k);
    },

    // Is this edition offered to the reader at all? (NO ASTERISKS.) The host
    // asks before honouring a volume's pinned default, so an uncertified
    // edition is never read merely because a config named it.
    isServableEdition(key) { return isServable(meta?.translations?.[key]); },

    // The RAW certification, ignoring the override — so the host can mark an
    // edition it is only showing because `?proofread=true` asked it to.
    isCertifiedEdition(key) { return meta?.translations?.[key]?.proofread === true; },

    // PER BOOK, FOR THE BADGE ONLY (H-25, Howell 2026-08-15). He confirms one
    // seat per book as he goes, and the badge is where he already looks to see
    // where he left off — so its question became "is THIS book confirmed in
    // this edition", not "is this edition finished".
    //
    // THE PAIR IS THE UNIT: a book proofread in Hebrew is not proofread in
    // Greek, which is why `proofreadUnits` hangs off the edition rather than
    // off the book.
    //
    // AND IT IS DELIBERATELY NOT WIRED TO `isServable` ABOVE. The shelf asks a
    // different question — is this edition fit to be offered at all (O-29) —
    // and answering it per book would have made an edition appear on the
    // public shelf for its confirmed books and vanish for the rest, flickering
    // as the reader moved. That change was never asked for and is invisible
    // from the one place it would be tested, since `?proofread=true` satisfies
    // the shelf gate regardless. Two questions, two tests.
    //
    // The fallback keeps every edition that never grows per-book marks exactly
    // where it was: no `proofreadUnits`, no change.
    // WITH NO BOOK IN HAND the edition's own flag answers, in BOTH cases —
    // marked or unmarked. The first cut returned false for a marked edition
    // asked about no book, while its only caller fell through to
    // isCertifiedEdition, so the function and its caller answered the same
    // question differently. Nothing exercised it, because the caller never
    // passed null; the second caller would have inherited the disagreement,
    // and a genuinely finished edition would have worn NOT PROOFREAD on the
    // root ring. Wilbur's flag on review: make the contract match the
    // behaviour already chosen.
    // SINCE W-231 THE LIST MAY HOLD CHAPTER ADDRESSES AS WELL AS UNIT IDS, and
    // this stays a bare membership test on purpose: the roll-up (is a book
    // done when every chapter is) needs to know what a book's chapters ARE,
    // which is the volume's knowledge and not this file's (O-43). The volume
    // adapter answers that in `isNodeConfirmed`; this remains the fallback
    // for volumes that never grew finer marks.
    isCertifiedUnit(key, unitId) {
      const t = meta?.translations?.[key];
      if (!t) return false;
      const units = t.proofreadUnits;
      if (!unitId || !Array.isArray(units)) return t.proofread === true;
      return units.includes(unitId);
    },
    // Whether the gate is currently lifted (LAN + ?proofread=true).
    completeOverrideActive() { return overrideProofread; },

    // The placeholder key, so the host can tell a real edition from a
    // display-only "coming soon" node without hardcoding the sentinel.
    comingSoonKey: COMING_SOON_KEY,

    translationsOf(languageId) {
      let lang = languageId || currentLanguage();
      if (!lang || (!hasEditions(lang) && !languageEntry(lang))) {
        for (const t of Object.values(meta?.translations || {})) { if (t?.language) { lang = t.language; break; } }
      }
      if (!lang) return [];
      const seated = servableEditionsOf(lang);
      return seated.length ? seated : [COMING_SOON_KEY];
    },

    // The substituted-verse footer, in the READER'S chosen tongue (W-6,
    // mark #3): the person who asked for Russian is told in Russian.
    // THE REGISTRY LEADS (W-15, 2026-07-29): Howell found a German verse
    // wearing an English footer — the hardcoded map below was an engine
    // list of 8 languages and Wilbur had just imported a 9th, so EVERY new
    // tongue silently regressed to English until someone patched the engine.
    // `languages.json` now carries `substitutionNotice` per language, so a
    // newly imported language arrives already speaking. The map stays as a
    // belt for a registry that hasn't loaded or lacks the field.
    substitutionNotice() {
      const lang = currentLanguage();
      return languageEntry(lang)?.substitutionNotice
        || SUBSTITUTION_NOTICES[lang]
        || SUBSTITUTION_NOTICES.english;
    },

    // The reader's reading vocabulary — the words for "chapter" and "verse"
    // and the era marks — from the REGISTRY (2026-07-29, the W-15 lesson
    // generalized: the engine's own VOCAB table is another hardcoded list of
    // 9 languages that every newly imported tongue silently falls out of,
    // landing on English). Returns null until the registry carries the
    // field, so the engine map stays the belt.
    languageVocabulary(id = null) {
      const entry = languageEntry(id || currentLanguage());
      return entry?.vocabulary || null;
    },

    // W-1: how an edition's script RUNS — the registry's own declaration
    // (`direction: "rtl"` on WLC), never guessed from the language. The
    // detail sector stamps the rendered text with this so the Hebrew reads
    // right-to-left; the CSS has been ready since the D-era, it simply had
    // nothing telling it which way the words go.
    editionDirection(key) {
      const k = key || store.getState().edition || null;
      return meta?.translations?.[k]?.direction === 'rtl' ? 'rtl' : 'ltr';
    },

    // The BCP-47-ish tag for the rendered text: the CSS keys its RTL rules
    // on [lang="he"], and a lang attribute is also what tells the browser
    // which font and shaping to use for the script.
    editionLang(key) {
      const k = key || store.getState().edition || null;
      const t = meta?.translations?.[k];
      return t?.lang || LANGUAGE_TAGS[t?.language] || null;
    },

    // The render side registers what "regenerate" means. Re-registering
    // replaces (a gateway reboot brings a fresh renderDetail closure; the
    // old one must not leak or fire on the dead volume — Phase C audit L4
    // was exactly this class of bug).
    onSettle(fn) { renderHook = typeof fn === 'function' ? fn : null; }
  };
}
