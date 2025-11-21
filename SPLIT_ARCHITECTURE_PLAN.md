# Split JSON Architecture - Implementation Plan

**Status**: Phase 1 Complete ✅  
**Current Version**: 0.6.6  
**Target Version**: 0.7.0 (Phase 2), 1.0.0 (Phase 6)  
**Started**: November 20, 2025

---

## Overview

Transition from monolithic JSON files (2.1MB) to split architecture with manufacturer/book/artist-level files (~40KB average).

### Goals
- **75% bandwidth reduction** for typical user sessions
- **Faster initial load** (20KB vs 2.1MB)
- **Better scalability** (support 1000+ entities)
- **Lazy loading** (load only what user views)
- **Backward compatibility** during transition

---

## Implementation Phases

### ✅ Phase 1: Version Detection (COMPLETE - Nov 20, 2025)

**Objective**: Add versioning metadata without breaking existing functionality

**Changes Made**:
1. ✅ Added `volume_schema_version: "1.0.0"` to all three JSONs
2. ✅ Added `volume_data_version: "2025.11.20"` to all three JSONs
3. ✅ Added `structure_type: "monolithic"` to all three JSONs
4. ✅ Updated `mobile-data.js` `discoverVolumes()` to capture version metadata
5. ✅ Updated `mobile-data.js` `loadVolume()` to log schema information
6. ✅ Created `SCHEMA_CHANGELOG.md` documentation
7. ✅ Bumped app version to 0.6.6

**Testing**: Load each volume and verify console logs show:
```
📦 Loaded volume schema: 1.0.0 | data: 2025.11.20 | structure: monolithic
```

**Status**: All volumes now explicitly versioned, ready for Phase 2

---

### 🔄 Phase 2: Dual Loader Implementation (NEXT - Target: 1 week)

**Objective**: Support both monolithic and split structures simultaneously

**Tasks**:

#### 2.1: Create Split Structure Classes
```javascript
// mobile-data-split.js (NEW FILE)
class SplitVolumeLoader {
    async loadVolumeIndex(volumeId) {
        // Load mmdm/mmdm_index.json
    }
    
    async loadEntity(volumeId, entityType, entityId) {
        // Load mmdm/manufacturers/ford.json
        // Cache in memory and IndexedDB
    }
    
    async getItemsAtLevel(parentItem, childLevelName) {
        // Lazy load entity data on demand
    }
}
```

#### 2.2: Update DataManager Router
```javascript
// mobile-data.js
async loadVolume(filename) {
    // ... existing code ...
    
    const structureType = displayConfig.structure_type || 'monolithic';
    
    if (structureType === 'split') {
        Logger.info('🔀 Using split structure loader');
        this.loader = new SplitVolumeLoader();
        return await this.loader.loadVolume(filename);
    } else {
        Logger.info('📦 Using monolithic structure loader');
        return this.loadMonolithicVolume(filename);
    }
}
```

#### 2.3: Refactor Existing Loader
```javascript
// mobile-data.js
async loadMonolithicVolume(filename) {
    // Move existing loadVolume() logic here
    // No functional changes, just renamed
}
```

#### 2.4: Create volumes-manifest.json
```json
{
    "manifest_version": "1.0",
    "volumes": [
        {
            "id": "mmdm",
            "name": "MMdM Catalog",
            "schema_version": "1.0.0",
            "structure": "monolithic",
            "files": ["mmdm_catalog.json"]
        }
    ]
}
```

**Testing Criteria**:
- [ ] All three volumes still load with monolithic loader
- [ ] Console shows which loader is used
- [ ] No functional regressions
- [ ] Performance unchanged for v1.0.0 volumes

**Estimated Time**: 20-25 hours
**Target Completion**: Nov 27, 2025
**Version**: 0.7.0

---

### 🎯 Phase 3: Convert MMdM to Split (Target: 1 week after Phase 2)

**Objective**: Split MMdM catalog into 106 manufacturer files, test in production

#### 3.1: Create File Structure
```
mmdm/
├── mmdm_config.json              # hierarchy_levels, display_config
├── mmdm_index.json               # markets, countries, manufacturer list
└── manufacturers/
    ├── ford.json                 # ~180KB
    ├── caterpillar.json          # ~220KB
    ├── lockwood-ash.json         # ~12KB
    └── ... (103 more)
```

#### 3.2: Split Script
```python
# scripts/split-mmdm-catalog.py
import json

def split_catalog():
    with open('mmdm_catalog.json') as f:
        data = json.load(f)
    
    # Extract config
    config = extract_config(data)
    save_json('mmdm/mmdm_config.json', config)
    
    # Extract index
    index = build_index(data)
    save_json('mmdm/mmdm_index.json', index)
    
    # Split manufacturers
    for mfr in data['MMdM']['manufacturers']:
        mfr_data = extract_manufacturer(data, mfr)
        save_json(f'mmdm/manufacturers/{mfr["id"]}.json', mfr_data)
```

#### 3.3: Update volumes-manifest.json
```json
{
    "id": "mmdm",
    "schema_version": "2.0.0",
    "data_version": "2025.11.27",
    "structure": "split",
    "config_file": "mmdm/mmdm_config.json",
    "index_file": "mmdm/mmdm_index.json",
    "data_pattern": "mmdm/manufacturers/{id}.json"
}
```

#### 3.4: Testing Plan
1. **Local Testing**:
   - Load MMdM volume
   - Navigate to Ford
   - Verify 180KB fetch (not 2.1MB)
   - Navigate to Caterpillar
   - Verify second 220KB fetch
   - Check browser cache
   
2. **Device Testing**:
   - Test on Z Fold 5
   - Monitor Network tab
   - Verify performance improvement
   - Check offline capability

3. **Rollback Plan**:
   - Keep mmdm_catalog.json as backup
   - Can revert manifest to point to monolithic
   - Service worker invalidation if needed

**Success Criteria**:
- [ ] Initial load < 100KB (vs 2.1MB)
- [ ] Manufacturer navigation < 1 second
- [ ] No functional regressions
- [ ] Browser DevTools shows lazy loading

**Estimated Time**: 15-20 hours
**Target Completion**: Dec 4, 2025
**Version**: 0.7.1

---

### 📚 Phase 4: Convert Gutenberg & HG Music (Target: 1 week after Phase 3)

**Objective**: Apply split architecture to remaining volumes

#### 4.1: Gutenberg Bible Split
```
gutenberg/
├── gutenberg_config.json
├── gutenberg_index.json          # Testament structure
└── books/
    ├── genesis.json              # 50 chapters + verses (~30KB)
    ├── exodus.json
    ├── matthew.json
    └── ... (64 more books)
```

#### 4.2: HG Music Split
```
hg_mx/
├── hg_mx_config.json
├── hg_mx_index.json              # Artist list
└── artists/
    ├── rolling-stones.json       # 24 albums + tracks (~200KB)
    ├── leon-redbone.json
    └── lonesome-strangers.json
```

**Testing**: Same criteria as Phase 3

**Estimated Time**: 10-15 hours
**Target Completion**: Dec 11, 2025
**Version**: 0.7.2

---

### 📢 Phase 5: Deprecation Notice (Target: Immediately after Phase 4)

**Objective**: Announce monolithic loader will be removed

#### 5.1: Add Console Warnings
```javascript
if (structureType === 'monolithic') {
    Logger.warn('⚠️  DEPRECATION: Monolithic structure will be removed Jan 10, 2026');
    Logger.warn('⚠️  Please update to split structure. See SCHEMA_CHANGELOG.md');
}
```

#### 5.2: Update Documentation
- README.md: Add deprecation notice
- SCHEMA_CHANGELOG.md: Set removal date
- STATUS: Update roadmap

#### 5.3: Communication
- Update production site with notice
- Email any beta testers
- GitHub release notes

**Duration**: 30 days minimum
**Removal Date**: January 10, 2026

---

### 🧹 Phase 6: Remove Legacy Code (Target: Jan 10, 2026)

**Objective**: Clean up monolithic loader, simplify codebase

#### 6.1: Code Removal
```javascript
// Delete these methods:
- loadMonolithicVolume()
- All monolithic-specific logic
- Backward compatibility checks
```

#### 6.2: File Cleanup
```bash
# Move to archive/
mv mmdm_catalog.json archive/
mv gutenberg.json archive/
mv hg_mx.json archive/
```

#### 6.3: Version Bump
- App version: **1.0.0** (feature complete!)
- Schema version: 2.0.0 is now minimum

**Testing**: Full regression testing on all volumes

**Estimated Time**: 5-10 hours
**Version**: 1.0.0 🎉

---

## File Size Analysis

### Current (Monolithic)
```
mmdm_catalog.json:     2,147,483 bytes  (2.1 MB)
gutenberg.json:          695,000 bytes  (695 KB)
hg_mx.json:              782,000 bytes  (782 KB)
Total:                 3,624,483 bytes  (3.6 MB)
```

### After Split (Estimated)
```
MMdM:
  mmdm_config.json:         5,000 bytes
  mmdm_index.json:         15,000 bytes
  106 manufacturer files: avg 40,000 bytes each

Gutenberg:
  gutenberg_config.json:    5,000 bytes
  gutenberg_index.json:    10,000 bytes
  67 book files:         avg 30,000 bytes each

HG Music:
  hg_mx_config.json:        5,000 bytes
  hg_mx_index.json:        10,000 bytes
  3 artist files:        avg 200,000 bytes each
```

### Typical User Session
```
Current:
  Load MMdM → 2.1 MB

After Split:
  Load mmdm_config.json → 5 KB
  Load mmdm_index.json → 15 KB
  Browse Ford → 180 KB
  Browse Caterpillar → 220 KB
  Total: 420 KB (80% reduction!)
```

---

## Risk Mitigation

### Technical Risks

1. **IndexedDB Quota Issues**
   - **Risk**: Mobile browsers limit storage
   - **Mitigation**: Implement LRU cache eviction
   - **Fallback**: Memory-only cache

2. **Network Failures**
   - **Risk**: Manufacturer file fails to load
   - **Mitigation**: Retry with exponential backoff
   - **Fallback**: Show cached data if available

3. **Performance Regression**
   - **Risk**: Multiple fetches slower than one
   - **Mitigation**: Prefetch next likely entity
   - **Testing**: Benchmark before/after

### Business Risks

1. **User Disruption**
   - **Risk**: Breaking changes confuse users
   - **Mitigation**: Dual loader maintains compatibility
   - **Timeline**: 30-day deprecation period

2. **Development Delays**
   - **Risk**: Split implementation takes longer than estimated
   - **Mitigation**: Phase-by-phase approach allows adjustment
   - **Contingency**: Can pause after Phase 3 if needed

---

## Success Metrics

### Performance
- [ ] Initial load time < 2 seconds (vs 5+ seconds)
- [ ] Manufacturer navigation < 1 second
- [ ] 75%+ bandwidth reduction in typical session
- [ ] Works offline after first load

### Quality
- [ ] Zero functional regressions
- [ ] All three volumes working
- [ ] Console errors = 0
- [ ] Memory usage stable

### Architecture
- [ ] Dual loader working
- [ ] Cache strategy effective
- [ ] Code maintainability improved
- [ ] Documentation complete
- [ ] **Logo animation logic moved from mobile-renderer.js to mobile-detailsector.js** (Better separation of concerns - Detail Sector should own its logo behavior)

---

## Current Status

**Phase 1**: ✅ COMPLETE (Nov 20, 2025)
- All JSONs now versioned
- Logging infrastructure in place
- Documentation created
- Ready to proceed to Phase 2

**Next Steps**:
1. Review this plan for any adjustments
2. Begin Phase 2 implementation
3. Create `mobile-data-split.js` file
4. Implement dual loader router

**Questions/Blockers**: None currently

---

**Last Updated**: November 20, 2025  
**Document Owner**: Development Team  
**Review Frequency**: Weekly during active development
