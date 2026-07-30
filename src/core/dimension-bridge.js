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

  // A servable edition is one we can actually show the reader: NOT held back
  // for licensing (pendingLicense) and NOT still unsourced (comingSoon). The
  // language's DEFAULT must be servable — landing a reader on NAB (pending)
  // when Douay is right there was the "default is a translation we don't have"
  // bug (Howell 2026-07-26).
  // NO ASTERISKS (Howell, RULED 2026-07-30 — see HANDOFF CONTRACT). An edition
  // is offered only if the data DECLARES it complete. Completeness is never
  // measured here: counting verses cannot tell a structural gap (never
  // written) from a provisional one (not yet sourced), and guessing would
  // unseat a finished edition or seat an unfinished one. Wilbur marks
  // `complete: true` when he is satisfied; until then the edition does not
  // exist for the reader — on the LAN and on the web alike, since Howell
  // rejected separate filters for the two.
  //
  // An edition still held for licensing or still unsourced is excluded as
  // before; `complete` is an additional gate, not a replacement.
  const isServable = t => t && t.complete === true && !t.pendingLicense && !t.comingSoon;
  const servableEditionsOf = languageId => Object.entries(meta?.translations || {})
    .filter(([, t]) => t?.language === languageId && isServable(t))
    .map(([key]) => key);

  const languageOf = translationKey => meta?.translations?.[translationKey]?.language || null;

  // The chronological language registry supplied at boot. When present it is
  // the ONE source of the secondary ring's order and labels; without it we
  // fall back to whatever languages the translations happen to carry (tests).
  const languageEntries = () => (Array.isArray(langMeta?.languages) ? langMeta.languages : []);
  const languageEntry = id => languageEntries().find(l => l.id === id) || null;
  // Ground truth for "does selecting this change the reader": a language is real
  // iff it actually has editions. The comingSoon flag is the registry's promise;
  // this is the fact. (So a promoted placeholder needs no flag flip to work.)
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
      // Default to the first SERVABLE edition (skip pendingLicense/comingSoon),
      // not merely the first listed. English lists NAB (pending) before DRA —
      // the reader must land on Douay. A language with editions but NO
      // servable one (all held for licensing — W-11) is DISPLAY-ONLY, like a
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
    // edition — settling on it commits nothing. A pendingLicense/comingSoon
    // edition is on the shelf but in the vault (W-11): settling on it also
    // commits nothing — the lens shows its notice, the reader keeps reading.
    setTranslation(translationKey) {
      if (translationKey === COMING_SOON_KEY) return false;
      const languageId = languageOf(translationKey);
      if (!languageId) return false;
      if (!isServable(meta?.translations?.[translationKey])) return false; // W-11: visible, never committed
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
      const complete = new Set();
      for (const t of Object.values(meta?.translations || {})) {
        if (t?.language && isServable(t)) complete.add(t.language);
      }
      // Registry order when we have it — it is chronological and deliberate —
      // else whatever order the editions give.
      const entries = languageEntries();
      if (entries.length) return entries.map(e => e.id).filter(id => complete.has(id));
      return [...complete];
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
      // The unselected node's short label in its OWN script (Howell 2026-07-26):
      // Greek editions must show a Greek abbreviation, not the Latin key
      // (LXX/BYZ), just as the magnified node already shows the Greek nativeName.
      // Reads the registry's nativeAbbrev; falls back to the key until the data
      // carries one, so no regression before Wilbur populates it (O-6).
      return meta?.translations?.[key]?.nativeAbbrev || key;
    },

    // The tertiary stratum's nodes: the SERVABLE edition keys of a language,
    // in registry order (W-4 + W-11, Howell's final ruling 2026-07-27): the
    // shelf shows ONLY what actually opens. comingSoon (unsourced) and
    // pendingLicense (held) editions alike have no seat — licensing is our
    // trouble, not the reader's, and an edition that can't be read is inside
    // baseball on a ring. A language with nothing servable yields the single
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
