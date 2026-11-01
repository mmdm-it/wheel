// THE HALO IS A LAYER OF ITS OWN, UNDER THE DISC (O-257, Howell 2026-10-31).
//
// The lens label and the parent label wear a stroke in the ground's colour
// so a ring label passing beneath them is dimmed where it meets the name
// (O-233, O-254). Painted on the label itself it also lay OVER the vessel's
// own disc — a smear of ground colour across the glass behind every numeral.
// Howell: "I only want this glowing outline to be visible or work beyond
// the node itself."
//
// So the halo becomes a second drawing of the same label — a <use> of it,
// placed BEFORE the disc in the document, showing its stroke and none of
// its ink — and the label itself keeps its ink and loses its stroke. The
// disc paints over the halo and under the letters; what reaches the reader
// is the glow outside the glass and nothing inside it. A <use> follows its
// source live — every word, seat, rotation and visibility change the view
// makes to the label reaches the halo for free — and nothing in the
// document can select it, so no tap and no reader of the label ever meets
// the copy. The CSS: a label's stroke is on only under `.label-halo`, its
// ink is off there.
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
let serial = 0;

/**
 * Give `label` a halo drawn beneath `disc`. The label gets an id if it has
 * none; the halo is a <use> of it inserted just before the disc.
 * @returns {Element} the halo element
 */
export function attachLabelHalo(label, disc) {
  if (!label || !disc?.parentNode) return null;
  if (!label.getAttribute('id')) label.setAttribute('id', `label-halo-src-${++serial}`);
  const halo = document.createElementNS(SVG_NS, 'use');
  halo.setAttribute('class', 'label-halo');
  halo.setAttribute('href', `#${label.getAttribute('id')}`);
  halo.setAttributeNS(XLINK_NS, 'xlink:href', `#${label.getAttribute('id')}`);
  halo.setAttribute('aria-hidden', 'true');
  disc.parentNode.insertBefore(halo, disc);
  return halo;
}
