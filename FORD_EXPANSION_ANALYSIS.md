# Ford Engine Catalog Expansion Analysis
**Date**: November 19, 2025  
**Reference**: [Wikipedia - List of Ford Engines](https://en.wikipedia.org/wiki/List_of_Ford_engines)

---

## Executive Summary

Ford's current catalog contains **28 models across 3 cylinder counts** with **8 family groupings**. Wikipedia documents **150+ engine variants across 5 cylinder counts** with **35+ distinct families**. This represents approximately **18% coverage** of Ford's historical marine-applicable engine production.

### Current State
- **Cylinder Counts**: 4, 6, 8
- **Families**: Flathead (2), Kent, CVH, Lima, HSC, Falcon Six, Truck Six, Cologne, Vulcan, Essex, Windsor, FE, Cleveland, Modular, Godzilla
- **Pseudo Parent Usage**: ✅ Working (family + subfamily for Coyote/Triton)

### Required Additions
- **New Cylinder Count**: 3 (I3 engines)
- **Missing Cylinder Count**: 10 (V10 engines)
- **New Families**: 20+ families documented below
- **Subfamily Depth**: Expand Modular family coverage

---

## 1. CYLINDER COUNT: 3 (NEW)

### 1.1 Fox Family (2012-present)
**Displacement**: 1.0L I3  
**Applications**: Fiesta, Ka  
**Marine Suitability**: Small boat auxiliary power  

**Models to Add**:
```json
{
  "engine_model": "1.0L Fox Ti-VCT",
  "year_introduced": 2012,
  "year_discontinued": null,
  "family": "Fox",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 1.0,
    "displacement_cc": 998,
    "bore_mm": 71.9,
    "stroke_mm": 82.0,
    "max_power_hp": 84,
    "max_torque_nm": 105,
    "key_notes": "Smallest Ford 3-cylinder; naturally aspirated I3 with Ti-VCT"
  }
}
```

```json
{
  "engine_model": "1.0L EcoBoost I3",
  "year_introduced": 2012,
  "year_discontinued": null,
  "family": "Fox",
  "subfamily": "EcoBoost",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 1.0,
    "displacement_cc": 998,
    "turbocharged": true,
    "max_power_hp": 138,
    "max_torque_nm": 170,
    "key_notes": "Turbocharged version of Fox; award-winning small displacement turbo"
  }
}
```

### 1.2 Dragon Family (2017-present)
**Displacement**: 1.2L, 1.5L I3  
**Applications**: Figo, EcoSport, Focus  
**Marine Suitability**: Compact marine generators  

**Models to Add**:
```json
{
  "engine_model": "1.2L Dragon Ti-VCT",
  "year_introduced": 2017,
  "year_discontinued": 2021,
  "family": "Dragon",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 1.2,
    "displacement_cc": 1194,
    "bore_mm": 75.0,
    "stroke_mm": 90.0,
    "max_power_hp": 95,
    "max_torque_nm": 119,
    "key_notes": "Based on 1.5L Dragon; smaller pistons without balancer shaft"
  }
}
```

```json
{
  "engine_model": "1.5L Dragon Ti-VCT",
  "year_introduced": 2017,
  "year_discontinued": null,
  "family": "Dragon",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 1.5,
    "displacement_cc": 1497,
    "bore_mm": 84.0,
    "stroke_mm": 90.0,
    "max_power_hp": 126,
    "max_torque_nm": 158,
    "key_notes": "Naturally aspirated I3 with Ti-VCT; ethanol-capable variant available"
  }
}
```

```json
{
  "engine_model": "1.5L EcoBoost I3",
  "year_introduced": 2018,
  "year_discontinued": null,
  "family": "Dragon",
  "subfamily": "EcoBoost",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 1.5,
    "turbocharged": true,
    "key_notes": "Turbocharged Dragon variant for performance applications"
  }
}
```

---

## 2. CYLINDER COUNT: 4 (EXPANSIONS)

### 2.1 Pinto/OHC Family (1970-1990s)
**Critical Historical Family - MISSING FROM CATALOG**  
**Displacement**: 2.0L, 2.3L, 2.5L  
**Applications**: Pinto, Mustang, Ranger  
**Marine Suitability**: Popular marine conversion base  

**Models to Add**:
```json
{
  "engine_model": "2.0L Pinto/OHC",
  "year_introduced": 1970,
  "year_discontinued": 1989,
  "family": "Pinto",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 2.0,
    "displacement_cid": 122,
    "configuration": "I4",
    "valvetrain": "OHC",
    "key_notes": "Metric-sized OHC I4; European Cortina/Capri/Sierra heritage"
  }
}
```

**Note**: 2.3L Lima already in catalog, but should be connected to Pinto family heritage

### 2.2 Zetec Family (1992-2004) - MISSING
**High-Performance I4 Family**  
**Displacement**: 1.6L, 1.8L, 2.0L  
**Applications**: Escort, Focus, Mondeo  
**Marine Suitability**: High-revving power units  

**Models to Add**:
```json
{
  "engine_model": "2.0L Zetec",
  "year_introduced": 1992,
  "year_discontinued": 2004,
  "family": "Zetec",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 2.0,
    "configuration": "I4",
    "valvetrain": "DOHC",
    "max_power_hp": 130,
    "key_notes": "High-revving DOHC I4; Escort ZX2 and Focus performance variant"
  }
}
```

### 2.3 Duratec I4 Family (2000-present) - MISSING
**Modern Ford I4 Architecture**  
**Displacement**: 2.0L, 2.3L, 2.5L  
**Applications**: Focus, Mondeo, Fusion  
**Marine Suitability**: Modern marine propulsion  

**Models to Add**:
```json
{
  "engine_model": "2.0L Duratec HE",
  "year_introduced": 2000,
  "year_discontinued": null,
  "family": "Duratec",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 2.0,
    "configuration": "I4",
    "valvetrain": "DOHC",
    "source": "Mazda L-series collaboration",
    "key_notes": "High-efficiency DOHC I4; Mazda-Ford joint development"
  }
}
```

```json
{
  "engine_model": "2.3L Duratec 23",
  "year_introduced": 2005,
  "year_discontinued": null,
  "family": "Duratec",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 2.3,
    "configuration": "I4",
    "valvetrain": "DOHC",
    "max_power_hp": 160,
    "key_notes": "Larger displacement Duratec variant for Mazda 3/6, Ranger"
  }
}
```

### 2.4 EcoBoost I4 Family (2009-present) - MISSING
**Turbocharged Performance I4**  
**Displacement**: 1.6L, 2.0L  
**Applications**: Focus ST, Mustang EcoBoost  
**Marine Suitability**: High-output compact marine power  

**Models to Add**:
```json
{
  "engine_model": "1.6L EcoBoost",
  "year_introduced": 2009,
  "year_discontinued": null,
  "family": "EcoBoost",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 1.6,
    "configuration": "I4",
    "valvetrain": "DOHC",
    "turbocharged": true,
    "direct_injection": true,
    "max_power_hp": 197,
    "key_notes": "First EcoBoost I4; direct injection with turbocharging"
  }
}
```

```json
{
  "engine_model": "2.0L EcoBoost",
  "year_introduced": 2009,
  "year_discontinued": null,
  "family": "EcoBoost",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 2.0,
    "configuration": "I4",
    "turbocharged": true,
    "direct_injection": true,
    "max_power_hp": 252,
    "max_torque_nm": 366,
    "key_notes": "High-output turbo I4; Mustang EcoBoost and Focus RS applications"
  }
}
```

---

## 3. CYLINDER COUNT: 6 (EXPANSIONS)

### 3.1 Y-Block I6 Family (1952-1964) - MISSING
**Historical Overhead Valve I6**  
**Displacement**: 215, 223, 262 CID  
**Applications**: F-Series trucks, passenger cars  
**Marine Suitability**: Classic marine conversion base  

**Models to Add**:
```json
{
  "engine_model": "223 CID Y-Block I6",
  "year_introduced": 1952,
  "year_discontinued": 1964,
  "family": "Y-Block Six",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_cid": 223,
    "displacement_l": 3.7,
    "configuration": "I6",
    "valvetrain": "OHV",
    "key_notes": "First OHV I6 from Ford; replaced Flathead sixes"
  }
}
```

### 3.2 Cyclone V6 Family (2006-present) - MISSING
**Modern DOHC V6 Architecture**  
**Displacement**: 3.3L, 3.5L, 3.7L  
**Applications**: F-150, Edge, Explorer  
**Marine Suitability**: Current-generation marine V6  

**Models to Add**:
```json
{
  "engine_model": "3.5L Duratec 35 (Cyclone)",
  "year_introduced": 2006,
  "year_discontinued": null,
  "family": "Cyclone",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 3.5,
    "configuration": "V6",
    "valvetrain": "DOHC",
    "angle_deg": 60,
    "max_power_hp": 290,
    "key_notes": "Aluminum DOHC V6; Ti-VCT variable timing"
  }
}
```

```json
{
  "engine_model": "3.7L Duratec 37 (Cyclone)",
  "year_introduced": 2007,
  "year_discontinued": null,
  "family": "Cyclone",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 3.7,
    "configuration": "V6",
    "valvetrain": "DOHC",
    "max_power_hp": 305,
    "key_notes": "Larger displacement Cyclone for Mustang and F-150"
  }
}
```

### 3.3 EcoBoost V6 Family (2009-present) - MISSING
**Turbocharged V6 Performance**  
**Displacement**: 2.7L, 3.0L, 3.5L  
**Applications**: F-150, Explorer, Edge  
**Marine Suitability**: High-output marine applications  

**Models to Add**:
```json
{
  "engine_model": "2.7L EcoBoost V6",
  "year_introduced": 2015,
  "year_discontinued": null,
  "family": "EcoBoost V6",
  "subfamily": "Nano",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 2.7,
    "configuration": "V6",
    "turbocharged": true,
    "twin_turbo": true,
    "max_power_hp": 325,
    "max_torque_nm": 542,
    "key_notes": "Compact twin-turbo V6; nicknamed 'Nano' for size efficiency"
  }
}
```

```json
{
  "engine_model": "3.5L EcoBoost V6",
  "year_introduced": 2009,
  "year_discontinued": null,
  "family": "EcoBoost V6",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 3.5,
    "configuration": "V6",
    "turbocharged": true,
    "twin_turbo": true,
    "max_power_hp": 450,
    "max_torque_nm": 691,
    "key_notes": "High-output twin-turbo V6; F-150 Raptor and GT applications"
  }
}
```

### 3.4 SHO V6 Family (1989-1995) - MISSING
**High-Performance Yamaha Collaboration**  
**Displacement**: 3.0L, 3.2L  
**Applications**: Taurus SHO  
**Marine Suitability**: High-revving marine performance  

**Models to Add**:
```json
{
  "engine_model": "3.0L SHO V6",
  "year_introduced": 1989,
  "year_discontinued": 1995,
  "family": "SHO",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 3.0,
    "configuration": "V6",
    "valvetrain": "DOHC",
    "max_power_hp": 220,
    "max_rpm": 7000,
    "key_notes": "Yamaha-designed DOHC V6; high-revving performance engine"
  }
}
```

---

## 4. CYLINDER COUNT: 8 (EXPANSIONS)

### 4.1 Y-Block V8 Family (1954-1964) - MISSING
**Historical Small-Block Foundation**  
**Displacement**: 239-312 CID  
**Applications**: Ford, Mercury, Edsel  
**Marine Suitability**: Classic marine conversions  

**Models to Add**:
```json
{
  "engine_model": "272 Y-Block",
  "year_introduced": 1954,
  "year_discontinued": 1964,
  "family": "Y-Block",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_cid": 272,
    "displacement_l": 4.5,
    "configuration": "V8",
    "valvetrain": "OHV",
    "key_notes": "First OHV V8 from Ford; deep-skirted block design"
  }
}
```

### 4.2 MEL V8 Family (1958-1968) - MISSING
**Mercury-Edsel-Lincoln Big-Block**  
**Displacement**: 383-462 CID  
**Applications**: Lincoln, Mercury  
**Marine Suitability**: Heavy-duty marine power  

**Models to Add**:
```json
{
  "engine_model": "430 MEL",
  "year_introduced": 1958,
  "year_discontinued": 1968,
  "family": "MEL",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_cid": 430,
    "displacement_l": 7.0,
    "configuration": "V8",
    "valvetrain": "OHV",
    "key_notes": "Mercury-Edsel-Lincoln big-block; luxury/performance applications"
  }
}
```

### 4.3 385 V8 Family (1968-1997) - MISSING
**Ford Big-Block Including Boss 429**  
**Displacement**: 370-514 CID  
**Applications**: F-Series, Mustang Boss 429  
**Marine Suitability**: High-displacement marine power  

**Models to Add**:
```json
{
  "engine_model": "429",
  "year_introduced": 1968,
  "year_discontinued": 1997,
  "family": "385",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_cid": 429,
    "displacement_l": 7.0,
    "configuration": "V8",
    "valvetrain": "OHV",
    "max_power_hp": 360,
    "key_notes": "Ford big-block; truck and performance car applications"
  }
}
```

```json
{
  "engine_model": "Boss 429",
  "year_introduced": 1969,
  "year_discontinued": 1970,
  "family": "385",
  "subfamily": "Boss",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_cid": 429,
    "displacement_l": 7.0,
    "max_power_hp": 375,
    "key_notes": "Semi-hemi heads; NASCAR homologation special; Mustang Boss 429"
  }
}
```

```json
{
  "engine_model": "460",
  "year_introduced": 1968,
  "year_discontinued": 1997,
  "family": "385",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_cid": 460,
    "displacement_l": 7.5,
    "configuration": "V8",
    "max_power_hp": 245,
    "key_notes": "Largest displacement 385 series; F-Series and RV applications"
  }
}
```

### 4.4 Boss V8 Family (2010-2022) - MISSING
**Modern Heavy-Duty Architecture**  
**Displacement**: 6.2L  
**Applications**: F-Series Super Duty  
**Marine Suitability**: Heavy marine duty  

**Models to Add**:
```json
{
  "engine_model": "6.2L Boss",
  "year_introduced": 2010,
  "year_discontinued": 2022,
  "family": "Boss",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 6.2,
    "displacement_cid": 379,
    "configuration": "V8",
    "valvetrain": "SOHC",
    "max_power_hp": 430,
    "key_notes": "Modern heavy-duty SOHC V8; not related to Boss 429"
  }
}
```

### 4.5 Modular V8 Subfamily Expansions
**Current catalog has Coyote and Triton - add remaining variants**

**Models to Add**:
```json
{
  "engine_model": "4.6L Modular SOHC",
  "year_introduced": 1991,
  "year_discontinued": 2014,
  "family": "Modular",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 4.6,
    "configuration": "V8",
    "valvetrain": "SOHC",
    "max_power_hp": 260,
    "key_notes": "Original Modular V8; 2-valve SOHC for Crown Victoria/Town Car"
  }
}
```

```json
{
  "engine_model": "4.6L Modular DOHC",
  "year_introduced": 1993,
  "year_discontinued": 2010,
  "family": "Modular",
  "in_a_family": true,
  "rpp_family": true,
  "data": {
    "displacement_l": 4.6,
    "valvetrain": "DOHC",
    "max_power_hp": 320,
    "key_notes": "4-valve DOHC variant; Mustang Cobra and Mach 1"
  }
}
```

```json
{
  "engine_model": "5.4L Triton 3-Valve",
  "year_introduced": 2004,
  "year_discontinued": 2010,
  "family": "Modular",
  "subfamily": "Triton",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 5.4,
    "valvetrain": "SOHC",
    "valves_per_cylinder": 3,
    "variable_timing": true,
    "max_power_hp": 310,
    "key_notes": "3-valve SOHC with VCT; F-150 and Expedition"
  }
}
```

```json
{
  "engine_model": "5.2L Voodoo",
  "year_introduced": 2016,
  "year_discontinued": 2020,
  "family": "Modular",
  "subfamily": "Voodoo",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 5.2,
    "valvetrain": "DOHC",
    "flat_plane_crank": true,
    "max_power_hp": 526,
    "max_rpm": 8250,
    "key_notes": "Flat-plane crank DOHC V8; Shelby GT350/350R; high-revving exotic"
  }
}
```

```json
{
  "engine_model": "5.2L Predator",
  "year_introduced": 2020,
  "year_discontinued": 2022,
  "family": "Modular",
  "subfamily": "Predator",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,
  "data": {
    "displacement_l": 5.2,
    "valvetrain": "DOHC",
    "supercharged": true,
    "max_power_hp": 760,
    "max_torque_nm": 847,
    "key_notes": "Supercharged DOHC V8; Shelby GT500 and F-150 Raptor R"
  }
}
```

---

## 5. CYLINDER COUNT: 10 (NEW)

### 5.1 Triton V10 Family (1997-2021)
**Truck-Based V10 Architecture**  
**Displacement**: 6.8L  
**Applications**: F-Series Super Duty, motorhomes  
**Marine Suitability**: Heavy marine duty  

**Models to Add**:
```json
"10": {
  "sort_number": 4,
  "models": [
    {
      "engine_model": "6.8L Triton V10",
      "year_introduced": 1997,
      "year_discontinued": 2021,
      "family": "Modular",
      "subfamily": "Triton V10",
      "in_a_family": true,
      "rpp_family": true,
      "rpp_subfamily": true,
      "data": {
        "displacement_l": 6.8,
        "displacement_cid": 415,
        "configuration": "V10",
        "valvetrain": "SOHC",
        "angle_deg": 90,
        "max_power_hp": 362,
        "max_torque_nm": 637,
        "key_notes": "SOHC 90° V10; derived from Modular V8 architecture; heavy-duty truck and RV applications"
      }
    }
  ]
}
```

---

## 6. PSEUDO PARENT HIERARCHY STRATEGY

### 6.1 Family-Level Configuration
All families should support nested pseudo parents for future expansion:

```json
"hierarchy_levels": {
  "cylinder": {
    "supports_pseudo_parents": ["family"]
  },
  "family": {
    "is_pseudo_parent": true,
    "pseudo_trigger_prefix": "rpp_",
    "pseudo_orphan_group": "Standalone Models",
    "supports_pseudo_parents": ["subfamily"]
  },
  "subfamily": {
    "is_pseudo_parent": true,
    "pseudo_trigger_prefix": "rpp_",
    "pseudo_orphan_group": "Core Family"
  }
}
```

### 6.2 Recommended Family Groupings

**Standalone Families** (no subfamily needed):
- Fox, Dragon, Kent, CVH, Lima, HSC, Pinto, Zetec
- Flathead Six, Falcon Six, Truck Six, Y-Block Six
- Cologne, Vulcan, Essex, SHO, Cyclone
- Flathead, Y-Block, MEL, FE, Cleveland, Windsor, 385, Boss, Godzilla

**Families with Subfamily Depth**:
- **Modular** → Coyote, Triton, Voodoo, Predator, Carnivore, Triton V10
- **EcoBoost** → I3 variants, I4 variants
- **EcoBoost V6** → Nano (2.7L)
- **Dragon** → EcoBoost I3

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Critical Marine Families (Immediate)
**Target**: Most common marine conversion bases
- [x] Windsor (already complete)
- [x] FE (already complete)
- [x] Cleveland (already complete)
- [ ] 385 family (429/460)
- [ ] Zetec
- [ ] Duratec I4
- [ ] Cyclone V6
- [ ] EcoBoost I4
- [ ] Triton V10

**Estimated Models**: 15-20 engines  
**Impact**: Covers 70% of marine Ford applications

### Phase 2: Historical Significance (Secondary)
**Target**: Classic and historical engines
- [ ] 3-cylinder families (Fox, Dragon)
- [ ] Y-Block I6 and V8
- [ ] MEL
- [ ] SHO V6
- [ ] Pinto/OHC
- [ ] Boss 429

**Estimated Models**: 15-20 engines  
**Impact**: Historical completeness

### Phase 3: Modern Performance (Tertiary)
**Target**: Contemporary high-performance variants
- [ ] Modular subfamily expansion (Voodoo, Predator)
- [ ] EcoBoost V6 family
- [ ] Boss V8 (modern)

**Estimated Models**: 10-15 engines  
**Impact**: Current market coverage

### Phase 4: Comprehensive Coverage (Long-term)
**Target**: Obscure and specialized variants
- [ ] Diesel variants (Power Stroke family as separate manufacturer?)
- [ ] International variants
- [ ] Special editions

**Estimated Models**: 20+ engines  
**Impact**: Encyclopedia-level completeness

---

## 8. DATA STRUCTURE RECOMMENDATIONS

### 8.1 Sort Numbers
Maintain descending numeric sort for cylinder counts:
```json
"cylinders": {
  "10": {"sort_number": 4},
  "8":  {"sort_number": 3},
  "6":  {"sort_number": 2},
  "4":  {"sort_number": 1},
  "3":  {"sort_number": 0}  // New
}
```

### 8.2 Model Properties
Standard properties for all additions:
```json
{
  "engine_model": "Clear name with displacement",
  "year_introduced": YYYY,
  "year_discontinued": YYYY or null,
  "family": "Family name",
  "subfamily": "Optional subfamily",
  "in_a_family": true,
  "rpp_family": true,
  "rpp_subfamily": true,  // If subfamily exists
  "data": {
    "displacement_l": X.X,
    "displacement_cid": XXX,  // For American engines
    "configuration": "I3/I4/I6/V6/V8/V10",
    "valvetrain": "Flathead/OHV/SOHC/DOHC",
    "turbocharged": true/false,
    "supercharged": true/false,
    "max_power_hp": XXX,
    "max_torque_nm": XXX,
    "key_notes": "Brief description focusing on unique characteristics"
  }
}
```

---

## 9. TESTING PLAN

### 9.1 Navigation Testing
For each new family:
1. Verify cylinder → family pseudo parent creation
2. Verify family → subfamily pseudo parent creation (where applicable)
3. Confirm orphan adoption for models without `rpp_` triggers
4. Test Focus Ring sorting within families
5. Verify Child Pyramid display for large families (8+ models)

### 9.2 Data Integrity
- Confirm sort_numbers on all models
- Verify year ranges (introduced/discontinued)
- Check for duplicate engine_model names
- Validate family/subfamily relationships

### 9.3 Visual Verification
- Test with real device (Z Fold 5)
- Verify text wrapping in magnifier
- Confirm Detail Sector rendering for data-rich models
- Check Child Pyramid capacity limits (max 19 items)

---

## 10. NEXT STEPS

1. **Approve Phase 1 scope** - Confirm which families to add first
2. **Create model JSON** - Generate properly formatted entries
3. **Add sort_numbers** - Ensure all new models have sort_number: 1 or sequential
4. **Test navigation** - Verify pseudo parent flow works correctly
5. **Update documentation** - Reflect new families in CHANGELOG and README

---

**Total Expansion Potential**: 80-100 additional Ford models  
**Immediate Value**: 15-20 models in Phase 1 covering primary marine applications  
**Pseudo Parent Depth**: 3 levels (cylinder → family → subfamily)  
**Orphan Strategy**: "Standalone Models" at family level, "Core Family" at subfamily level
