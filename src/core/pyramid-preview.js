import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildPyramidInstructions } from '../view/detail/pyramid-view.js';

const normalizeViewport = viewport => {
  if (viewport?.SSd && viewport?.LSd && viewport?.width && viewport?.height) return viewport;
  if (viewport?.width && viewport?.height) return getViewportInfo(viewport.width, viewport.height);
  return getViewportInfo(1280, 720);
};

const deriveChildrenFromNormalized = ({ normalized, selected }) => {
  if (!normalized || !selected?.id) return [];
  const items = Array.isArray(normalized.items) ? normalized.items : [];
  if (!items.length) return [];
  const direct = items.filter(item => item?.parentId === selected.id);
  if (direct.length) return direct;
  const links = Array.isArray(normalized.links) ? normalized.links : [];
  if (!links.length) return [];
  const childIds = links
    .filter(link => link?.from === selected.id)
    .map(link => link?.to)
    .filter(Boolean);
  if (!childIds.length) return [];
  return childIds
    .map(id => items.find(item => item?.id === id))
    .filter(Boolean);
};

const resolveLayoutSpec = ({ adapter, layoutSpec, normalized, viewport }) => {
  const source = layoutSpec || adapter?.layoutSpec;
  if (!source) return null;
  try {
    if (typeof source === 'function') {
      if (!normalized) return null;
      return source(normalized, viewport);
    }
    if (typeof source === 'object') return source;
    return null;
  } catch (_err) {
    return null;
  }
};

export function buildPyramidPreview({
  viewport,
  selected,
  getChildren,
  pyramidConfig = null,
  normalized = null,
  adapter = null,
  layoutSpec = null
} = {}) {
  const vp = normalizeViewport(viewport);
  const spec = resolveLayoutSpec({ adapter, layoutSpec, normalized, viewport: vp });
  const config = pyramidConfig ?? spec?.pyramid ?? {};

  const getChildrenFn = typeof getChildren === 'function'
    ? getChildren
    : normalized
      ? args => deriveChildrenFromNormalized({ normalized, selected: args?.selected })
      : null;

  if (typeof getChildrenFn !== 'function') return [];

  const children = getChildrenFn({ selected, viewport: vp, normalized }) || [];
  if (!Array.isArray(children) || children.length === 0) return [];

  const capacity = config.capacity ?? calculatePyramidCapacity(vp, config);
  const sampler = config.sample ?? null;
  const sampled = sampler ? sampler(children, capacity) : children;
  if (!Array.isArray(sampled) || sampled.length === 0) return [];

  const placer = config.place ?? ((siblings, view, opts) => placePyramidNodes(siblings, view, { ...opts, capacity }));
  const placements = placer(sampled, vp, { capacity });
  if (!Array.isArray(placements) || placements.length === 0) return [];

  const builder = config.buildInstructions
    ?? ((placementList, opts) => buildPyramidInstructions(placementList, { ...opts, nodeRadius: config.nodeRadius }));
  return builder(placements, { capacity, viewport: vp });
}
