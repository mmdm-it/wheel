# JSON Schema Changelog

This document tracks breaking changes to the Wheel JSON volume structure.

## Version Numbering

### Schema Version (Semantic Versioning)
- **Major** (X.0.0): Breaking structural changes requiring code updates
- **Minor** (1.X.0): New optional fields, backward compatible
- **Patch** (1.0.X): Documentation or comment changes only

### Data Version (Date-Based)
- Format: `YYYY.MM.DD`
- Updated when content changes (e.g., adding engines, fixing data)
- Does not require code changes

### Structure Type
- `monolithic`: Single JSON file contains all data
- `split`: Separate files per manufacturer/book/artist

---

## [1.0.0] - 2025-11-20

### Initial Schema Version

First formal versioning of existing monolithic structure.

#### Structure
```json
{
    "VolumeKey": {
        "display_config": {
            "wheel_volume_version": "1.0",
            "volume_schema_version": "1.0.0",
            "volume_data_version": "2025.11.20",
            "structure_type": "monolithic",
            ...
        },
        "data": { ... }
    }
}
```

#### Volumes Using This Schema
- **MMdM Catalog** (mmdm_catalog.json) - 2000+ marine engine models
- **Gutenberg Bible** (gutenberg.json) - 67 books, Old/New Testament
- **HG Music Library** (hg_mx.json) - 3 artists, 28 albums

#### Supported By
- Wheel app v0.6.6+
- Code: `mobile-data.js` `loadVolume()` method

---

## [2.0.0] - Planned (Not Yet Implemented)

### Breaking Changes - Split File Architecture

Split monolithic JSONs into separate files per entity to enable lazy loading.

#### Planned Structure
```
volumes/
├── volumes-manifest.json          # Volume discovery
├── mmdm/
│   ├── mmdm_config.json          # Config + hierarchy
│   ├── mmdm_index.json           # Markets/countries/mfr list
│   └── manufacturers/
│       ├── ford.json             # 180KB - Ford engines only
│       ├── caterpillar.json      # 220KB - Caterpillar only
│       └── ... (104 more)
├── gutenberg/
│   ├── gutenberg_config.json
│   ├── gutenberg_index.json
│   └── books/
│       ├── genesis.json          # 50 chapters + verses
│       ├── exodus.json
│       └── ... (65 more)
└── hg_mx/
    ├── hg_mx_config.json
    ├── hg_mx_index.json
    └── artists/
        ├── rolling-stones.json   # All albums + tracks
        └── ...
```

#### Migration Path
1. **Phase 1 (✅ Complete)**: Add version metadata to v1.0.0 JSONs
2. **Phase 2**: Implement dual loader (supports both monolithic and split)
3. **Phase 3**: Convert MMdM to split structure, test in production
4. **Phase 4**: Convert Gutenberg and HG Music
5. **Phase 5**: Deprecate monolithic loader (30 days notice)
6. **Phase 6**: Remove legacy code

#### Benefits
- **75% bandwidth reduction** - Load only needed manufacturers
- **Faster initial load** - 20KB vs 2.1MB for MMdM
- **Better caching** - Manufacturer files cached individually
- **Scalability** - Can handle 1000+ manufacturers without performance loss

#### Minimum Requirements
- Wheel app v0.7.0+
- Browser with fetch() and Promise support
- Optional: Service worker for offline caching

#### Breaking Changes
- Apps < v0.7.0 cannot load v2.0.0 volumes
- File structure incompatible with v1.0.0 loaders
- Requires new discovery mechanism (volumes-manifest.json)

---

## Migration Guide

### For Developers

#### Detecting Schema Version in Code
```javascript
const displayConfig = dataManager.getDisplayConfig();
const schemaVersion = displayConfig.volume_schema_version || '1.0.0';
const structureType = displayConfig.structure_type || 'monolithic';

if (structureType === 'split') {
    // Use split loader (v2.0.0+)
    await this.loadSplitVolume(volumeId);
} else {
    // Use monolithic loader (v1.0.0)
    await this.loadMonolithicVolume(volumeId);
}
```

#### Upgrading from 1.0.0 to 2.0.0
1. Update Wheel app to v0.7.0+
2. Deploy new split JSON files
3. Update service worker cache version
4. Test with browser DevTools (Network tab)
5. Monitor console for version warnings

### For Content Curators

#### Adding Data (No Version Change)
- Adding manufacturers, engines, books, songs
- Updating existing data fields
- **Action**: Bump `volume_data_version` to today's date
- **Schema version**: Stays the same

#### Adding Optional Fields (Minor Version Bump)
- New optional properties (e.g., `turbocharger_type`)
- New display_config options
- **Action**: Bump to 1.1.0, update docs
- **Backward compatible**: Old apps ignore new fields

#### Structural Changes (Major Version Bump)
- Changing file structure (monolithic → split)
- Renaming required fields
- Changing hierarchy levels
- **Action**: Bump to 2.0.0, follow migration guide
- **Breaking change**: Requires app update

---

## Validation

### Schema v1.0.0 Validation Checklist
- [ ] `wheel_volume_version` exists
- [ ] `volume_schema_version` = "1.0.0"
- [ ] `volume_data_version` = "YYYY.MM.DD" format
- [ ] `structure_type` = "monolithic"
- [ ] `hierarchy_levels` object exists
- [ ] Data follows monolithic structure

### Schema v2.0.0 Validation Checklist (Future)
- [ ] `volume_schema_version` = "2.0.0"
- [ ] `structure_type` = "split"
- [ ] `volumes-manifest.json` exists
- [ ] Index file lists all entities
- [ ] Entity files follow naming convention
- [ ] All referenced files exist

---

## Versioning Policy

### When to Bump Schema Version
- **Major**: Breaking changes, structural reorganization
- **Minor**: New optional features, backward compatible additions
- **Patch**: Documentation, comments, whitespace changes

### When to Bump Data Version
- Daily content updates (add/edit/remove entities)
- Data corrections or improvements
- New content without structural changes

### Deprecation Policy
- **Warning Period**: 30 days minimum before removing support
- **Logging**: Deprecated schemas trigger console warnings
- **Documentation**: Update migration guide before breaking changes

---

**Last Updated**: November 20, 2025  
**Current Production Schema**: 1.0.0 (monolithic)  
**Next Planned Schema**: 2.0.0 (split) - Q1 2026
