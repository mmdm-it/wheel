// Adapter contract sketch for v4 architecture.
// Each volume implements these functions; this is a type-hinting scaffold.

export const adapterCapabilities = Object.freeze({
  SEARCH: 'search',
  DEEP_LINK: 'deepLink',
  THEMING: 'theming'
});

export const normalizeCapabilities = (capabilities = {}) => ({
  search: Boolean(capabilities.search),
  deepLink: Boolean(capabilities.deepLink),
  theming: Boolean(capabilities.theming)
});

export const assertLayoutSpecShape = spec => {
  if (!spec || typeof spec !== 'object') {
    throw new Error('layoutSpec must be an object');
  }
  return spec;
};

export const createAdapterContract = ({
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  capabilities = {}
} = {}) => ({
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  capabilities: normalizeCapabilities(capabilities)
});

export const adapterShapeDescription = `
Adapter contract (per volume):
- loadManifest(env): Promise<RawManifest>
- validate(raw): ValidationResult
- normalize(raw): { items, links, meta }
- layoutSpec(normalized, viewport): LayoutSpec
- capabilities: { search?: boolean, deepLink?: boolean, theming?: boolean }
Optional hooks (not enforced here): onSelect, onHover, resolveDeepLink, search(query)
`;
