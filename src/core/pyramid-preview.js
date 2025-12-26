import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildPyramidInstructions } from '../view/detail/pyramid-view.js';

const normalizeViewport = viewport => {
  if (viewport?.SSd && viewport?.LSd && viewport?.width && viewport?.height) return viewport;
  if (viewport?.width && viewport?.height) return getViewportInfo(viewport.width, viewport.height);
  return getViewportInfo(1280, 720);
};

export function buildPyramidPreview({ viewport, selected, getChildren, pyramidConfig = {} } = {}) {
  if (typeof getChildren !== 'function') return [];
  const vp = normalizeViewport(viewport);
  const children = getChildren({ selected, viewport: vp }) || [];
  if (!Array.isArray(children) || children.length === 0) return [];

  const capacity = pyramidConfig.capacity ?? calculatePyramidCapacity(vp, pyramidConfig);
  const sampler = pyramidConfig.sample ?? sampleSiblings;
  const sampled = sampler(children, capacity?.total ?? capacity);
  if (!Array.isArray(sampled) || sampled.length === 0) return [];

  const placer = pyramidConfig.place ?? ((siblings, view, opts) => placePyramidNodes(siblings, view, { ...opts, capacity }));
  const placements = placer(sampled, vp, { capacity });
  if (!Array.isArray(placements) || placements.length === 0) return [];

  const builder = pyramidConfig.buildInstructions
    ?? ((placementList, opts) => buildPyramidInstructions(placementList, { ...opts, nodeRadius: pyramidConfig.nodeRadius }));
  return builder(placements, { capacity, viewport: vp });
}
