// THE PHONE'S OWN TONGUE (O-176, Howell 2026-09-22): "should it even be based
// on an IP address, or is there some way to detect the user's phone's
// settings?" There is. Every browser hands a page the languages its owner set
// on the phone, ranked, with no lookup, no request and no address involved.
// This turns that list into the first language a volume can offer — the
// reader's own first choice if we have it, their second if not, and nothing
// if none of theirs is on the shelf, so the volume's default stands.
//
// The volume names its languages in English words (the naming kits' own file
// names); the phone speaks in tags. This is the one bridge between the two,
// and it is engine-general: a kit that does not exist yet is simply never
// matched until it does.
const TAG_TO_LANGUAGE = {
  en: 'english', it: 'italian', la: 'latin', el: 'greek', grc: 'greek', he: 'hebrew', iw: 'hebrew',
  fi: 'finnish', fr: 'french', de: 'german', es: 'spanish', pt: 'portuguese', nl: 'dutch',
  hu: 'hungarian', ru: 'russian', pl: 'polish', sv: 'swedish', da: 'danish', no: 'norwegian', nb: 'norwegian',
  cs: 'czech', sk: 'slovak', ro: 'romanian', hr: 'croatian', sl: 'slovenian', uk: 'ukrainian', ar: 'arabic',
  tr: 'turkish', ja: 'japanese', zh: 'chinese', ko: 'korean',
};

/** The primary subtag of a language tag: 'it-IT' → 'it', 'zh-Hant-TW' → 'zh'. */
export function primaryOf(tag) {
  return String(tag || '').trim().toLowerCase().split(/[-_]/)[0] || '';
}

/**
 * The first of the phone's languages that the volume offers, or null.
 * `tags` is the browser's ranked list; `offered` the language names the volume
 * declares available. Case-insensitive on both sides.
 */
export function firstOfferedLanguage(tags, offered) {
  const have = new Set((Array.isArray(offered) ? offered : []).map(l => String(l).toLowerCase()));
  if (!have.size) return null;
  for (const tag of Array.isArray(tags) ? tags : []) {
    const name = TAG_TO_LANGUAGE[primaryOf(tag)];
    if (name && have.has(name)) return name;
  }
  return null;
}

/** The phone's ranked languages, as the browser reports them; empty where there is no browser. */
export function phoneLanguages() {
  try {
    if (typeof navigator === 'undefined') return [];
    if (Array.isArray(navigator.languages) && navigator.languages.length) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
  } catch { return []; }
}
