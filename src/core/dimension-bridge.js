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

// Each language names itself in its own tongue (Howell 2026-07-21): the
// secondary stratum reads as a native would read it, not as English glosses.
// Keyed by the registry's `language` id. Non-Latin scripts fall back to the
// system font where the ring font lacks the glyphs.
const LANGUAGE_AUTONYMS = {
  hebrew: 'עברית',
  latin: 'Latina',
  greek: 'Ελληνικά',
  english: 'English',
  russian: 'Русский',
  french: 'Français',
  italian: 'Italiano',
  spanish: 'Español',
  portuguese: 'Português'
};

// The tertiary's synthetic node for a placeholder language: one node whose
// magnified label is that language's native "coming soon" (from the language
// registry supplied at boot). Selecting it does nothing — no text to load.
const COMING_SOON_KEY = '__coming_soon__';

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
  const comingSoonText = id => languageEntry(id)?.comingSoonText || '';

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
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: languageId, defaultEdition: options[0] });
      return true;
    },

    // The chooser pyramid settles on a specific translation: adopt it and the
    // language it belongs to. The synthetic "coming soon" node is not a real
    // edition — settling on it commits nothing.
    setTranslation(translationKey) {
      if (translationKey === COMING_SOON_KEY) return false;
      const languageId = languageOf(translationKey);
      if (!languageId) return false;
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
    languagesAvailable() {
      const entries = languageEntries();
      if (entries.length) return entries.map(e => e.id);
      const seen = [];
      for (const t of Object.values(meta?.translations || {})) {
        if (t?.language && !seen.includes(t.language)) seen.push(t.language);
      }
      return seen;
    },

    // The language's own name, for the secondary stratum's labels. Registry
    // autonym first, then the built-in map, then the registry's English name,
    // then the id.
    languageLabel(id) {
      return languageEntry(id)?.autonym
        || LANGUAGE_AUTONYMS[id]
        || Object.values(meta?.translations || {}).find(t => t?.language === id)?.language_name
        || id;
    },

    // A translation's title in ITS OWN language/script (registry `nativeName`)
    // for the magnified node on the tertiary stratum — Οἱ Ἑβδομήκοντα, כתב יד
    // לנינגרד, Vulgata Clementina. The synthetic node yields the current
    // language's native "coming soon". Falls back to the English `name`, then
    // the key. Unselected nodes keep the abbreviation (Howell 2026-07-22).
    translationName(key) {
      if (key === COMING_SOON_KEY) return comingSoonText(currentLanguage());
      const t = meta?.translations?.[key];
      return t?.nativeName || t?.name || key;
    },

    // The UNMAGNIFIED node label on the tertiary: a real edition keeps its
    // abbreviation/key, but the synthetic "coming soon" node must NEVER show its
    // sentinel key — it stays in the native phrase even scrubbed out of the lens
    // (there is no abbreviation for a promise — Howell 2026-07-22).
    translationAbbrev(key) {
      return key === COMING_SOON_KEY ? comingSoonText(currentLanguage()) : key;
    },

    // The tertiary stratum's nodes: every edition KEY in a language, in registry
    // order (VUL before NEO, NAB before DRA). A placeholder language yields a
    // single synthetic "coming soon" node instead. Defaults to the current
    // language, then the first language with editions — never empty.
    translationsOf(languageId) {
      let lang = languageId || currentLanguage();
      if (!lang || (!hasEditions(lang) && !languageEntry(lang))) {
        for (const t of Object.values(meta?.translations || {})) { if (t?.language) { lang = t.language; break; } }
      }
      if (!lang) return [];
      const editions = editionsOf(lang);
      return editions.length ? editions : [COMING_SOON_KEY];
    },

    // The render side registers what "regenerate" means. Re-registering
    // replaces (a gateway reboot brings a fresh renderDetail closure; the
    // old one must not leak or fire on the dead volume — Phase C audit L4
    // was exactly this class of bug).
    onSettle(fn) { renderHook = typeof fn === 'function' ? fn : null; }
  };
}
