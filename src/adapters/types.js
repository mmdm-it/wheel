// Adapter contract sketch for v4 architecture.
// Each dimension implements these functions; this is a type-hinting scaffold.

export const adapterCapabilities = Object.freeze({
  SEARCH: 'search',
  DEEP_LINK: 'deepLink',
  THEMING: 'theming'
});

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
  capabilities
});

export const adapterShapeDescription = `
Adapter contract (per dimension):
- loadManifest(env): Promise<RawManifest>
- validate(raw): ValidationResult
- normalize(raw): { items, links, meta }
- layoutSpec(normalized, viewport): LayoutSpec
- capabilities: { search?: boolean, deepLink?: boolean, theming?: boolean }
Optional hooks (not enforced here): onSelect, onHover, resolveDeepLink, search(query)
`;
