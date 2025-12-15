#!/usr/bin/env python3
"""
Clean up unused family metadata from manufacturers that don't use families.

Removes "family", "in_a_family", "subfamily", "in_a_subfamily" properties
from models that have them but whose manufacturers don't have family hierarchy.
"""

import json
import sys

def clean_manufacturer_metadata(mfr_data, mfr_name):
    """
    Clean unused family metadata from a manufacturer's models.
    
    Returns: (cleaned_data, models_cleaned_count)
    """
    models_cleaned = 0
    
    for cyl_key, cyl_data in mfr_data.get("cylinders", {}).items():
        models = cyl_data.get("models", [])
        
        # Check if this cylinder has families collection
        has_families = "families" in cyl_data
        
        if not has_families and models:
            # No families collection - clean up any family metadata from models
            for model in models:
                if any(key in model for key in ["family", "in_a_family", "subfamily", "in_a_subfamily"]):
                    model.pop("family", None)
                    model.pop("in_a_family", None)
                    model.pop("subfamily", None)
                    model.pop("in_a_subfamily", None)
                    models_cleaned += 1
    
    return mfr_data, models_cleaned


def main():
    if len(sys.argv) != 2:
        print("Usage: python clean_unused_family_metadata.py <catalog.json>")
        sys.exit(1)
    
    catalog_file = sys.argv[1]
    
    # Load catalog
    print(f"Loading {catalog_file}...")
    with open(catalog_file, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    
    # Clean all manufacturers
    total_cleaned = 0
    markets = catalog.get("MMdM", {}).get("markets", {})
    
    for market_name, market_data in markets.items():
        countries = market_data.get("countries", {})
        for country_name, country_data in countries.items():
            manufacturers = country_data.get("manufacturers", {})
            for mfr_name, mfr_data in manufacturers.items():
                cleaned_mfr, count = clean_manufacturer_metadata(mfr_data, mfr_name)
                if count > 0:
                    print(f"  {mfr_name}: Cleaned {count} models")
                    manufacturers[mfr_name] = cleaned_mfr
                    total_cleaned += count
    
    if total_cleaned == 0:
        print("No unused family metadata found")
        return
    
    print(f"\nTotal: Cleaned {total_cleaned} models")
    
    # Save cleaned catalog
    print(f"Saving to {catalog_file}...")
    with open(catalog_file, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=4, ensure_ascii=False)
    
    print("✓ Complete!")


if __name__ == "__main__":
    main()
