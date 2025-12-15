#!/usr/bin/env python3
"""
Restructure manufacturer motor data from pseudo-parent to explicit hierarchy.

Before: cylinders → models (with rpp_family/rpp_subfamily flags)
After:  cylinders → families → subfamilies → models

This eliminates the need for runtime pseudo-parent generation.
"""

import json
import sys
from collections import defaultdict

def restructure_manufacturer_data(mfr_data, mfr_name):
    """
    Restructure a manufacturer's cylinders collection to have explicit families and subfamilies.
    
    Args:
        mfr_data: Dictionary containing manufacturer data
        mfr_name: Name of the manufacturer (for logging)
        
    Returns:
        Tuple of (restructured_data, model_count, has_pseudo_parents)
    """
    restructured = {
        "year_founded": mfr_data.get("year_founded"),
        "year_dissolved": mfr_data.get("year_dissolved"),
        "cylinders": {}
    }
    
    total_models = 0
    has_pseudo_parents = False
    
    # Process each cylinder count
    for cyl_key, cyl_data in mfr_data.get("cylinders", {}).items():
        sort_number = cyl_data.get("sort_number")
        models = cyl_data.get("models", [])
        
        # Check if this manufacturer uses pseudo-parents
        uses_families = any(m.get("rpp_family", False) for m in models)
        uses_subfamilies = any(m.get("rpp_subfamily", False) for m in models)
        
        if not uses_families:
            # No pseudo-parents - keep structure as-is
            restructured["cylinders"][cyl_key] = cyl_data
            total_models += len(models)
            continue
        
        has_pseudo_parents = True
        total_models += len(models)
        
        # Group models by family and subfamily
        family_groups = defaultdict(lambda: {
            "sort_number": None,
            "subfamilies": defaultdict(lambda: {
                "sort_number": None,
                "models": []
            }),
            "models": []  # Models without subfamily
        })
        
        orphan_models = []  # Models without family
        
        for model in models:
            has_family = model.get("rpp_family", False)
            family_name = model.get("family")
            has_subfamily = model.get("rpp_subfamily", False)
            subfamily_name = model.get("subfamily")
            
            # Clean up the model - remove pseudo-parent metadata
            clean_model = {k: v for k, v in model.items() 
                          if k not in ["rpp_family", "rpp_subfamily", "in_a_family", 
                                      "in_a_subfamily", "family", "subfamily"]}
            
            if has_family and family_name:
                # Model belongs to a family
                if has_subfamily and subfamily_name:
                    # Model has both family and subfamily
                    family_groups[family_name]["subfamilies"][subfamily_name]["models"].append(clean_model)
                else:
                    # Model has family but no subfamily
                    family_groups[family_name]["models"].append(clean_model)
            else:
                # Model has no family
                orphan_models.append(clean_model)
        
        # Build the new structure
        if family_groups or orphan_models:
            new_cyl_structure = {"sort_number": sort_number}
            
            if family_groups:
                new_cyl_structure["families"] = {}
                
                for family_name, family_content in sorted(family_groups.items()):
                    new_family = {}
                    
                    # Add subfamily structure if any subfamilies exist
                    if family_content["subfamilies"]:
                        new_family["subfamilies"] = {}
                        for subfamily_name, subfamily_content in sorted(family_content["subfamilies"].items()):
                            new_family["subfamilies"][subfamily_name] = {
                                "models": subfamily_content["models"]
                            }
                    
                    # Add models directly under family if any
                    if family_content["models"]:
                        new_family["models"] = family_content["models"]
                    
                    new_cyl_structure["families"][family_name] = new_family
            
            # Add orphan models directly under cylinder if any
            if orphan_models:
                new_cyl_structure["models"] = orphan_models
            
            restructured["cylinders"][cyl_key] = new_cyl_structure
    
    return restructured, total_models, has_pseudo_parents


def main():
    if len(sys.argv) != 3:
        print("Usage: python restructure_ford_hierarchy.py <input_catalog.json> <output_catalog.json>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Load catalog
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    
    # Find and restructure all manufacturers with pseudo-parents
    restructured_count = 0
    markets = catalog.get("MMdM", {}).get("markets", {})
    
    for market_name, market_data in markets.items():
        countries = market_data.get("countries", {})
        for country_name, country_data in countries.items():
            manufacturers = country_data.get("manufacturers", {})
            for mfr_name, mfr_data in manufacturers.items():
                # Restructure this manufacturer
                restructured_mfr, model_count, has_pseudo = restructure_manufacturer_data(mfr_data, mfr_name)
                
                if has_pseudo:
                    print(f"✓ {mfr_name} ({market_name}/{country_name}): Restructured {model_count} models")
                    manufacturers[mfr_name] = restructured_mfr
                    restructured_count += 1
    
    if restructured_count == 0:
        print("No manufacturers with pseudo-parents found")
        sys.exit(1)
    
    print(f"\nTotal: Restructured {restructured_count} manufacturers")
    
    # Save restructured catalog
    print(f"\nSaving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=4, ensure_ascii=False)
    
    print("✓ Complete! Catalog restructured successfully.")
    print(f"\nNext steps:")
    print(f"1. Review the output: diff {input_file} {output_file}")
    print(f"2. Replace original: mv {output_file} {input_file}")
    print(f"3. Test manufacturer navigation in the UI")


if __name__ == "__main__":
    main()
