// Simple volume validation helper for data-agnostic loading
// Returns { ok, errors, warnings }
export function validateVolumeRoot(volumeRoot) {
  const errors = [];
  const warnings = [];

  if (!volumeRoot || typeof volumeRoot !== 'object') {
    errors.push('volume root is missing or not an object');
    return { ok: false, errors, warnings };
  }

  const cfg = volumeRoot.display_config;
  if (!cfg || typeof cfg !== 'object') {
    warnings.push('display_config is missing');
  } else {
    if (!cfg.hierarchy_levels || typeof cfg.hierarchy_levels !== 'object') {
      warnings.push('display_config.hierarchy_levels is missing');
    } else if (Object.keys(cfg.hierarchy_levels).length === 0) {
      warnings.push('display_config.hierarchy_levels is empty');
    }
    if (!cfg.leaf_level) {
      warnings.push('display_config.leaf_level is missing');
    }
    if (!cfg.structure_type) {
      warnings.push('display_config.structure_type is missing');
    }
    if (!cfg.volume_type) {
      warnings.push('display_config.volume_type is missing');
    }
  }

  const root = volumeRoot.root;
  if (!root || typeof root !== 'object') {
    warnings.push('root node is missing');
  } else if (!Array.isArray(root.children)) {
    warnings.push('root.children should be an array');
  }

  return { ok: errors.length === 0, errors, warnings };
}
