// THE DOOR ONTO THE HOME SCREEN (O-273, Howell 2026-11-07).
//
// A volume that declares a web app manifest can be installed from the
// browser's menu and opens standalone — under its own name and icon, with no
// address bar, the status bar painted in its ground colour. The manifest is
// the volume's own file under its data root, beside its emblem (W-114), so
// the engine links whatever a volume declares and names none itself.
//
// Everything here is written into <head> at boot rather than into
// index.html, because index.html is one page for every volume and a manifest
// is one volume's. A document with no <head> (the test stub) gets nothing
// and nothing fails.

function upsertHeadTag(doc, tag, match, attrs) {
  const head = doc?.head;
  if (!head || typeof doc.createElement !== 'function') return null;
  const [key, value] = match;
  let el = null;
  if (typeof head.querySelector === 'function') el = head.querySelector(`${tag}[${key}="${value}"]`);
  if (!el) {
    el = doc.createElement(tag);
    el.setAttribute(key, value);
    head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => { if (v != null) el.setAttribute(k, String(v)); });
  return el;
}

/**
 * Declare the page installable for the current volume.
 * @param {Document} doc
 * @param {{ manifestHref?: string, themeColor?: string, icon?: string, title?: string }} spec
 * @returns {{ manifest: boolean, themeColor: boolean, icon: boolean }} what was written
 */
export function declareHomeScreen(doc, spec = {}) {
  const out = { manifest: false, themeColor: false, icon: false };
  if (!doc) return out;
  if (spec.themeColor) {
    out.themeColor = Boolean(upsertHeadTag(doc, 'meta', ['name', 'theme-color'], { content: spec.themeColor }));
  }
  if (!spec.manifestHref) return out;
  out.manifest = Boolean(upsertHeadTag(doc, 'link', ['rel', 'manifest'], { href: spec.manifestHref }));
  // The two capability metas are what older Android browsers and iOS Safari
  // read instead of the manifest's display mode; the apple-touch-icon is
  // what iOS puts on the home screen, since it ignores the manifest's icons.
  upsertHeadTag(doc, 'meta', ['name', 'mobile-web-app-capable'], { content: 'yes' });
  upsertHeadTag(doc, 'meta', ['name', 'apple-mobile-web-app-capable'], { content: 'yes' });
  upsertHeadTag(doc, 'meta', ['name', 'apple-mobile-web-app-status-bar-style'], { content: 'default' });
  if (spec.title) upsertHeadTag(doc, 'meta', ['name', 'apple-mobile-web-app-title'], { content: spec.title });
  if (spec.icon) {
    out.icon = Boolean(upsertHeadTag(doc, 'link', ['rel', 'apple-touch-icon'], { href: spec.icon }));
  }
  return out;
}
