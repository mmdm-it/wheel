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

export function createDimensionBridge({ store, translationsMeta = null } = {}) {
  if (!store) throw new Error('createDimensionBridge: store is required');

  let meta = translationsMeta;
  let renderHook = null;
  let lastNotified = store.getState().edition ?? null;

  // Regenerate ON SETTLE only (Howell ruling 2026-07-20): one notification
  // per committed change, never a stream. The store is synchronous, so
  // "settle" here means the dispatched value actually changed.
  store.subscribe(state => {
    const translation = state.edition ?? null;
    if (translation === lastNotified) return;
    lastNotified = translation;
    if (typeof renderHook === 'function') renderHook(translation);
  });

  const translationsOf = languageId => Object.entries(meta?.translations || {})
    .filter(([, t]) => t?.language === languageId)
    .map(([key]) => key);

  const languageOf = translationKey => meta?.translations?.[translationKey]?.language || null;

  return {
    // A gateway reboot re-creates adapters but the store (and this bridge)
    // survive at the host level; only the registry is refreshed.
    setTranslationsMeta(next) { meta = next || null; },

    // The chooser ring settles on a language: adopt it, with that
    // language's default translation.
    setLanguage(languageId) {
      const options = translationsOf(languageId);
      if (!options.length) return false;
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: languageId, defaultEdition: options[0] });
      return true;
    },

    // The chooser pyramid settles on a specific translation: adopt it and
    // the language it belongs to.
    setTranslation(translationKey) {
      const languageId = languageOf(translationKey);
      if (!languageId) return false;
      store.dispatch({ type: interactionEvents.SET_LANGUAGE, language: languageId, defaultEdition: translationKey });
      return true;
    },

    getSelection() {
      const state = store.getState();
      return { language: state.language ?? null, translation: state.edition ?? null };
    },

    languagesAvailable() {
      const seen = [];
      for (const t of Object.values(meta?.translations || {})) {
        if (t?.language && !seen.includes(t.language)) seen.push(t.language);
      }
      return seen;
    },

    // The language's own name, for the secondary stratum's labels. Falls back
    // to the id (then whatever the registry calls it) if no autonym is known.
    languageLabel(id) {
      return LANGUAGE_AUTONYMS[id]
        || Object.values(meta?.translations || {}).find(t => t?.language === id)?.language_name
        || id;
    },

    // The tertiary stratum's nodes: every translation KEY in a language, in
    // registry order (VUL before NEO, NAB before DRA). Defaults to the
    // selected language, then to the first language in the registry — so the
    // tertiary is never empty when a dimension exists.
    translationsOf(languageId) {
      let lang = languageId || store.getState().language;
      if (!lang) {
        for (const t of Object.values(meta?.translations || {})) { if (t?.language) { lang = t.language; break; } }
      }
      return lang ? translationsOf(lang) : [];
    },

    // The render side registers what "regenerate" means. Re-registering
    // replaces (a gateway reboot brings a fresh renderDetail closure; the
    // old one must not leak or fire on the dead volume — Phase C audit L4
    // was exactly this class of bug).
    onSettle(fn) { renderHook = typeof fn === 'function' ? fn : null; }
  };
}
