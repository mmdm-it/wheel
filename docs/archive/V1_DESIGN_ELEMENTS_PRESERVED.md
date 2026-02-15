# v1 Design Elements Preserved in v2
**Date**: December 18, 2025

This document tracks which design elements from v1 DESIGNSPEC.md have been successfully incorporated into v2_DESIGN_SPEC.md.

---

## ✅ SUCCESSFULLY PRESERVED

### 1. Visual Affordance System
**v1 Location**: Lines 8-14  
**v2 Location**: Lines 12-20  
**Status**: ✅ PRESERVED

The 1px black stroke = interactive principle is documented in v2, clarifying which elements respond to clicks vs swipes.

### 2. Off-Screen Zone Definitions
**v1 Location**: Lines 37-55  
**v2 Location**: Lines 129-154  
**Status**: ✅ PRESERVED

Critical visibility rules documented:
- 0° - 90° (3:00 → 6:00) = NEVER VISIBLE
- 180° → 270° → 0° (wrapping) = NEVER VISIBLE
- Visible zone: 90° - 180° (aspect-ratio dependent)

### 3. Animation System Specifications
**v1 Location**: Lines 112-221  
**v2 Location**: Lines 289-422  
**Status**: ✅ PRESERVED (marked Phase 2+)

Complete specifications for:
- **IN Migration**: Child Pyramid → Focus Ring (600ms single phase)
  - Magnifier migration
  - Sibling migration (parallel)
  - Detail Sector expansion (parallel, leaf items only)
  
- **OUT Migration**: Parent Button → Magnifier → Focus Ring sweep (300ms + 300ms)
  - Phase 1: Parent Button to Magnifier
  - Phase 2: Sibling sweep (bi-directional or uni-directional)
  - Phase 3: Detail Sector collapse (parallel)
  
- **Timing Standards**: 600ms universal, ease-in-out quadratic, 60fps
- **Sweep Algorithm**: Bi-directional from middle, uni-directional from edges

### 4. Child Pyramid Detailed Specs
**v1 Location**: Lines 73-80, 505-543  
**v2 Location**: Lines 518-532  
**Status**: ✅ ENHANCED

Preserved details:
- 3 concentric arcs at 85%, 70%, 55% of Focus Ring radius
- 19 total nodes capacity (8 + 7 + 4)
- 8° spacing between nodes (constitutional constant)
- Right triangle with curved arc hypotenuse
- Aspect-ratio-dependent geometry (equilateral → acute)

### 5. Navigation Zone Allocations
**v1 Location**: Lines 57-96  
**v2 Location**: Lines 493-536  
**Status**: ✅ PRESERVED

All four zones documented:
- **Focus Ring**: Variable range ending at 180°, 4.3° node spacing
- **Child Pyramid**: Three arcs radially inward, 8° spacing, 19 nodes
- **Parent Button**: Lower-left corner, OUT migration
- **Detail Sector**: Hub-centered, 98% of Focus Ring radius when expanded

### 6. Magnifier Dynamic Positioning
**v1 Location**: Lines 545-560  
**v2 Location**: Lines 135-164  
**Status**: ✅ ENHANCED with "Lodestar" concept

Preserved calculation:
```javascript
const magnifierAngle = Math.atan2(centerY - hubY, centerX - hubX);
```

Enhanced with:
- Fixed position principle (the "lodestar")
- Focus Ring rotates around Magnifier
- Typical results: ~150.65° for iPhone SE
- Selection changes as items rotate past Magnifier

### 7. Terminology Standards
**v1 Location**: Lines 840-877  
**v2 Location**: Lines 582-637  
**Status**: ✅ PRESERVED

Correct terms documented:
- ✅ IN/OUT (radial hierarchy direction)
- ✅ CW/CCW (rotational direction)
- ✅ Clock positions (3:00, 6:00, 9:00, 12:00)
- ❌ UP/DOWN (ambiguous - avoided)
- ❌ TOP/BOTTOM (ambiguous - avoided)
- ❌ LEFT/RIGHT (use clock positions instead)

### 8. Common Positioning Errors
**v1 Location**: Lines 610-640  
**v2 Location**: Lines 603-625  
**Status**: ✅ PRESERVED

Seven error types documented with fixes:
1. Selected item on Focus Ring
2. Wrong node spacing
3. Starting at wrong angle
4. Magnifier rotates
5. Wrong radius formula
6. Wrong Hub position formula
7. Off-screen nodes

### 9. Development Guidelines
**v1 Location**: Lines 642-684  
**v2 Location**: Lines 639-723  
**Status**: ✅ ENHANCED

Preserved and enhanced:
- **Feature Checklist**: 8 items to verify before implementation
- **Code Review Questions**: 7 critical questions for PR review
- **Debugging Logs**: Console log patterns for troubleshooting
- **Implementation Patterns**: 3 common code patterns with examples

### 10. Hub Constitutional Formula (Center-Origin)
**v1 Location**: Lines 254-282  
**v2 Status**: ✅ DOCUMENTED as v1 approach in comparison table

v1 formula preserved in documentation:
```javascript
// v1 (center origin)
hubX = LSd - (SSd / 2);
hubY = -(LSd / 2);
```

v2 formula documented as authoritative:
```javascript
// v2 (top-left origin) - CORRECT
hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2;
hubY = 0;
```

Comparison table shows both for reference.

### 11. Aspect Ratio Impact
**v1 Location**: Lines 98-110  
**v2 Location**: Lines 113-127  
**Status**: ✅ PRESERVED

Examples preserved:
- Square (1:1): 90° arc visible
- iPhone (~2.2:1): ~60° arc visible
- Z Fold 5 (~2.4:1): ~60° arc visible
- Tall Android (~2.5:1): ~55° arc visible
- Ultra-Tall (10:1): ~20° arc visible

### 12. Angle Reference Tables
**v1 Location**: Lines 686-722  
**v2 Location**: Lines 337-352  
**Status**: ✅ PRESERVED

Clock position to angle mapping with visibility status.

---

## 🔄 MODIFIED FOR v2

### Hub Position Formula
**Change**: Center-origin (v1) → Top-left origin (v2)  
**Justification**: Web-standard coordinate system  
**Status**: ✅ Authoritative v2 formula correctly replaces v1

### Coordinate System Origin
**Change**: Nuc at (0,0) center (v1) → Screen top-left at (0,0) (v2)  
**Justification**: Standard SVG/Canvas conventions  
**Status**: ✅ Improves code clarity and web standards compliance

### Nuc Concept
**Change**: Dual Hub/Nuc perspective (v1) → Single Hub perspective (v2)  
**Justification**: Simplified mental model, reduced complexity  
**Status**: ✅ Nuc eliminated, Hub is sole reference point

---

## 📋 NOT YET IMPLEMENTED (Phase 2+)

### Animation System
**Status**: Fully documented, not yet implemented  
**Reason**: Phase 1 focuses on static layout and rotation  
**Priority**: High for Phase 2

### Detail Sector Content Rendering
**Status**: Specs preserved from v1, not yet implemented in v2  
**Reason**: Phase 1 focuses on Focus Ring navigation  
**Priority**: Medium for Phase 2

### Child Pyramid Interaction
**Status**: Specs preserved, not yet implemented  
**Reason**: Phase 1 focuses on Focus Ring and Magnifier  
**Priority**: High for Phase 2

### Parent Button Navigation
**Status**: Specs preserved, not yet implemented  
**Reason**: Phase 1 focuses on horizontal navigation  
**Priority**: High for Phase 2

---

## 🚫 DELIBERATELY EXCLUDED

### Pseudo Parent System
**v1 Location**: Lines 906-1104  
**Reason**: JSON configuration detail, not coordinate system design  
**Status**: Appropriate exclusion - belongs in separate config documentation

### Landscape Viewport
**v1 Location**: Lines 105-110  
**Reason**: Future implementation, not current focus  
**Status**: Appropriate exclusion - v2 focuses on portrait first

### Detail Sector Metadata Layout
**v1 Location**: Lines 562-608  
**Reason**: Content rendering detail, not coordinate system design  
**Status**: Appropriate exclusion - implementation-specific

---

## SUMMARY

### Coverage Statistics
- **Lines in v1 DESIGNSPEC**: 1,171 total
- **Lines in v2_DESIGN_SPEC**: 1,039 total
- **Sections preserved**: 12 major sections
- **Sections enhanced**: 3 (Magnifier, Child Pyramid, Development Guidelines)
- **Sections modified**: 3 (Hub formula, coordinate origin, Nuc concept)

### Quality Assessment

✅ **Excellent Preservation**: All critical v1 design principles preserved  
✅ **Proper Translation**: v1 center-origin → v2 top-left origin correctly handled  
✅ **Enhanced Clarity**: Lodestar concept, selection-driven model documented  
✅ **Ready for Implementation**: Complete specification for Phase 1 development  

### Missing Elements Analysis

❌ **None Critical**: All essential v1 design elements preserved in v2  
⚠️ **Phase 2+ Features**: Animation system documented but marked as future work  
✅ **Appropriate Exclusions**: JSON config details belong in separate documents  

---

## CONCLUSION

The v2_DESIGN_SPEC.md successfully preserves all critical design elements from v1 while correctly translating the coordinate system from center-origin to top-left-origin. The specification is **complete and ready for implementation**.

**Key Achievement**: "v1 design was very good" has been preserved. "v1 code was very bad" has been addressed through the v2 coordinate system transformation and modern ES6 architecture.

---

**Document Version**: 1.0  
**Date**: December 18, 2025  
**Related Documents**:
- `v2_DESIGN_SPEC.md` (authoritative v2 specification)
- `archive/DESIGNSPEC.md` (v1 archived specification)
- `DESIGN_CLARIFICATIONS.md` (answers to critical design questions)
- `V1_V2_DESIGN_COMPARISON.md` (detailed formula comparison)
