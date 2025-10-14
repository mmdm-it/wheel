import json
import os
import readline
import sys
from datetime import date
import uuid  # For generating unique IDs

# Path to the JSON file
JSON_FILE = "catalog.json"

# Initialize or load the catalog
def load_catalog():
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r') as f:
            return json.load(f)
    else:
        return {"MMdM": {"markets": {"Europe & Asia": {"countries": {}}, "North & South America": {"countries": {}}}}}

# Save the catalog
def save_catalog(catalog):
    with open(JSON_FILE, 'w') as f:
        json.dump(catalog, f, indent=4)

# Generate a unique ID for alternatives
def generate_alt_id():
    return f"alt_{str(uuid.uuid4())[:8]}"

# Completer function generator
def completer(options):
    def complete(text, state):
        matches = [opt for opt in options if opt.startswith(text)]
        if state < len(matches):
            return matches[state]
        else:
            return None
    return complete

# Helper to get input with default
def get_input(prompt, last_entered, key, completer_maker=None):
    last_value = last_entered.get(key, '')
    default_text = f" (default: '{last_value}') " if last_value else " "
    full_prompt = f"{prompt}{default_text}: "
    
    if completer_maker:
        actual_completer = completer_maker()
        readline.set_completer(actual_completer)
        readline.parse_and_bind('tab: complete')
    
    value = input(full_prompt).strip()
    if completer_maker:
        def dummy_complete(text, state):
            return None
        readline.set_completer(dummy_complete)
    
    if not value and last_value:
        value = last_value
    last_entered[key] = value
    return value

# Main interactive function to add data
def add_data(catalog, last_entered):
    markets = catalog["MMdM"]["markets"]
    
    # Step 1: Market
    def market_completer_maker():
        return completer(list(markets.keys()))
    market = get_input("Enter market (tab to complete existing)", last_entered, 'market', market_completer_maker)
    if not market:
        print("Market cannot be empty.")
        return
    if market not in markets:
        print(f"Market '{market}' not found. Available: {list(markets.keys())}")
        return
    
    countries = markets[market]["countries"]
    
    # Step 2: Country
    def country_completer_maker():
        return completer(list(countries.keys()))
    country = get_input(f"Enter country for {market} (tab to complete existing)", last_entered, 'country', country_completer_maker)
    if not country:
        print("Country cannot be empty.")
        return
    is_new_country = country not in countries
    if is_new_country:
        countries[country] = {"manufacturers": {}}
    
    manufacturers = countries[country]["manufacturers"]
    
    # Step 3: Manufacturer
    def manuf_completer_maker():
        return completer(list(manufacturers.keys()))
    manufacturer = get_input(f"Enter manufacturer for {country} (tab to complete existing)", last_entered, 'manufacturer', manuf_completer_maker)
    if not manufacturer:
        print("Manufacturer cannot be empty.")
        return
    is_new_manuf = manufacturer not in manufacturers
    if is_new_manuf:
        manufacturers[manufacturer] = {"year_founded": None, "year_dissolved": None, "cylinders": {}}
    
    if is_new_manuf:
        # Year founded
        year_founded_str = input(f"Enter year founded for {manufacturer} (integer or leave blank for null): ").strip()
        manufacturers[manufacturer]["year_founded"] = int(year_founded_str) if year_founded_str else None
        
        # Year dissolved
        year_dissolved_str = input(f"Enter year dissolved for {manufacturer} (integer or leave blank for null): ").strip()
        manufacturers[manufacturer]["year_dissolved"] = int(year_dissolved_str) if year_dissolved_str else None
    
    cylinders = manufacturers[manufacturer]["cylinders"]
    
    # Step 4: Cylinder count
    def cyl_completer_maker():
        return completer(list(cylinders.keys()))
    cylinder = get_input(f"Enter cylinder count for {manufacturer} (e.g., 8, tab to complete existing)", last_entered, 'cylinder', cyl_completer_maker)
    if not cylinder:
        print("Cylinder count cannot be empty.")
        return
    is_new_cyl = cylinder not in cylinders
    if is_new_cyl:
        cylinders[cylinder] = []
    
    engine_list = cylinders[cylinder]
    
    # Step 5: Engine model
    existing_engines = [eng["engine_model"] for eng in engine_list]
    def engine_completer_maker():
        return completer(existing_engines)
    engine_model = get_input(f"Enter engine model for {cylinder} cylinders (tab to complete existing)", last_entered, 'engine_model', engine_completer_maker)
    if not engine_model:
        print("Engine model cannot be empty.")
        return
    
    existing_engine = next((eng for eng in engine_list if eng["engine_model"] == engine_model), None)
    if existing_engine:
        print(f"Engine model {engine_model} already exists. Adding to its alternatives.")
        manifold_alts = existing_engine["manifold_alternatives"]
    else:
        year_intro_str = get_input("Enter year introduced for engine (integer or blank for null)", last_entered, 'year_introduced')
        year_intro = int(year_intro_str) if year_intro_str else None
        
        year_disc_str = get_input("Enter year discontinued for engine (integer or blank for null)", last_entered, 'year_discontinued')
        year_disc = int(year_disc_str) if year_disc_str else None
        
        new_engine = {
            "engine_model": engine_model,
            "year_introduced": year_intro,
            "year_discontinued": year_disc,
            "manifold_alternatives": []
        }
        engine_list.append(new_engine)
        manifold_alts = new_engine["manifold_alternatives"]
    
    # Step 6: Add manifold alternatives (loop)
    while True:
        add_more = input("Add another manifold alternative? (y/n): ").strip().lower()
        if add_more != 'y':
            break
        
        # Type selection
        types = ['oem', 'mmdm', 'third_party']
        def type_completer_maker():
            return completer(types)
        alt_type = get_input("Enter type (oem/mmdm/third_party, tab to complete)", last_entered, 'alt_type', type_completer_maker)
        if alt_type not in types:
            print("Invalid type.")
            continue
        
        new_alt = {
            "id": generate_alt_id(),
            "type": alt_type,
            "price": 0,
            "description": "",
            "rebranded_from": "",
            "rebranded_as": "",
            "specifications": {
                "material": "",
                "weight": "",
                "warranty": "",
                "dimensions": {
                    "height": "",
                    "width": "",
                    "length": ""
                }
            },
            "photos": [],
            "photo_count": 0,
            "has_photos": False,
            "notes": "",
            "availability": "in_stock",
            "stock_level": 0,
            "min_stock_threshold": None,
            "lead_time": "",
            "last_updated": date.today().isoformat()
        }
        
        # Type-specific basics
        if alt_type == 'oem':
            new_alt["brand"] = get_input("Enter brand (default: manufacturer)", last_entered, 'oem_brand')
            if not new_alt["brand"]:
                new_alt["brand"] = manufacturer
            new_alt["part_number"] = get_input("Enter OEM manifold number", last_entered, 'oem_manifold')
        elif alt_type == 'mmdm':
            new_alt["brand"] = "MMdM"
            new_alt["part_number"] = get_input("Enter MMdM part number", last_entered, 'mmdm_part_number')
        elif alt_type == 'third_party':
            new_alt["brand"] = get_input("Enter third-party brand", last_entered, 'third_brand')
            new_alt["part_number"] = get_input("Enter part number", last_entered, 'third_part_number')
        
        # Price (universal)
        price_str = get_input("Enter price (integer)", last_entered, f'{alt_type}_price')
        new_alt["price"] = int(price_str) if price_str else 0
        
        # Description (universal, optional)
        description = get_input("Enter description (optional)", last_entered, f'{alt_type}_description')
        if description:
            new_alt["description"] = description
        else:
            del new_alt["description"]  # Omit if empty
        
        # Rebrand cross-references
        rebrand_from = get_input("Rebranded from (alt ID or part number, or blank)", last_entered, 'rebrand_from')
        new_alt["rebranded_from"] = rebrand_from if rebrand_from else ""
        
        rebrand_as = get_input("Rebranded as (alt ID or part number, or blank)", last_entered, 'rebrand_as')
        new_alt["rebranded_as"] = rebrand_as if rebrand_as else ""
        
        # Inherit if rebrand
        if new_alt["rebranded_from"]:
            inherit = input("Inherit specs/photos/stock/lead_time from source? (y/n): ").strip().lower()
            if inherit == 'y':
                # Simplified: assume user provides source alt_idx for copy; in full, search by ID/part
                source_idx_str = input("Enter index of source alt in list (or ID/part to search): ").strip()
                source_alt = None
                if source_idx_str.isdigit():
                    source_idx = int(source_idx_str)
                    if 0 <= source_idx < len(manifold_alts):
                        source_alt = manifold_alts[source_idx]
                else:
                    # Search by ID or part
                    for alt in manifold_alts:
                        if alt["id"] == source_idx_str or alt["part_number"] == source_idx_str:
                            source_alt = alt
                            break
                if source_alt:
                    new_alt["specifications"] = source_alt["specifications"].copy()
                    new_alt["photos"] = source_alt["photos"].copy()
                    new_alt["stock_level"] = source_alt["stock_level"]
                    new_alt["lead_time"] = source_alt["lead_time"]
                    # Update photo metadata if inheriting
                    new_alt["photo_count"] = source_alt.get("photo_count", len(source_alt["photos"]))
                    new_alt["has_photos"] = source_alt.get("has_photos", bool(source_alt["photos"]))
                    print("Inherited successfully.")
                else:
                    print("Source not found; proceeding with defaults.")
        
        # Specifications (universal)
        material = get_input("Enter material", last_entered, f'{alt_type}_material')
        new_alt["specifications"]["material"] = material
        
        weight = get_input("Enter weight (e.g., 25kg)", last_entered, f'{alt_type}_weight')
        new_alt["specifications"]["weight"] = weight
        
        warranty = get_input("Enter warranty (e.g., 2 years)", last_entered, f'{alt_type}_warranty')
        new_alt["specifications"]["warranty"] = warranty
        
        height = get_input("Enter height (e.g., 20cm)", last_entered, f'{alt_type}_height')
        new_alt["specifications"]["dimensions"]["height"] = height
        
        width = get_input("Enter width (e.g., 30cm)", last_entered, f'{alt_type}_width')
        new_alt["specifications"]["dimensions"]["width"] = width
        
        length = get_input("Enter length (e.g., 50cm)", last_entered, f'{alt_type}_length')
        new_alt["specifications"]["dimensions"]["length"] = length
        
        # Photos (universal, loop with smart prepend)
        def dummy_complete(text, state):
            return None
        readline.set_completer(dummy_complete)
        photos = []
        last_photo = last_entered.get('photo', '')
        while True:
            current_dir = os.path.dirname(last_photo) if last_photo else ''
            dir_hint = f" (current dir: {current_dir})" if current_dir else ""
            photo_prompt = f"Enter photo path{dir_hint} (or leave blank to finish)"
            photo_input = input(f"{photo_prompt}: ").strip()
            if not photo_input:
                if photos:
                    break
                else:
                    if last_photo:
                        photos.append(last_photo)
                        last_entered['photo'] = last_photo
                    break
            # If input doesn't start with / or . and there's a current_dir, prepend it
            if photo_input and not (photo_input.startswith('/') or photo_input.startswith('.')) and current_dir:
                photo_input = os.path.join(current_dir, photo_input)
            photos.append(photo_input)
            last_entered['photo'] = photo_input
            last_photo = photo_input
        
        new_alt["photos"] = photos
        new_alt["photo_count"] = len(photos)
        new_alt["has_photos"] = bool(photos)
        
        # Notes (universal)
        notes = input("Enter notes (optional): ").strip()
        if notes:
            new_alt["notes"] = notes
        
        # Availability/Stock/Threshold (universal)
        availability_options = ['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued']
        def avail_completer_maker():
            return completer(availability_options)
        new_alt["availability"] = get_input("Enter availability (tab to complete)", last_entered, 'availability', avail_completer_maker)
        
        stock_str = get_input("Enter stock level (integer, 0 for none)", last_entered, 'stock_level')
        new_alt["stock_level"] = int(stock_str) if stock_str else 0
        
        if new_alt["stock_level"] > 0:
            threshold_str = get_input("Enter min stock threshold (optional integer)", last_entered, 'min_stock_threshold')
            new_alt["min_stock_threshold"] = int(threshold_str) if threshold_str else None
        else:
            new_alt["min_stock_threshold"] = None
        
        # Lead time (universal)
        new_alt["lead_time"] = get_input("Enter lead time (e.g., '1-3 days')", last_entered, 'lead_time')
        if not new_alt["lead_time"]:
            if alt_type == 'oem':
                new_alt["lead_time"] = "Immediate"
            elif alt_type == 'mmdm':
                new_alt["lead_time"] = "1 week"
            else:
                new_alt["lead_time"] = "2 weeks"
        
        # Check cap for third_party
        third_count = sum(1 for alt in manifold_alts if alt["type"] == "third_party")
        if alt_type == "third_party" and third_count >= 6:
            print("Max 6 third-party alternatives reached. Skipping add.")
            continue
        
        manifold_alts.append(new_alt)
    
    print("Data added successfully.")

# Main interactive function to delete data (updated minimally for new structure)
def delete_data(catalog):
    markets = catalog["MMdM"]["markets"]
    
    if not markets:
        print("No markets to delete from.")
        return
    
    # Step 1: Select Market
    def market_completer_maker_del():
        return completer(list(markets.keys()))
    actual_completer = market_completer_maker_del()
    readline.set_completer(actual_completer)
    readline.parse_and_bind('tab: complete')
    market = input("Select market to delete from (tab to complete): ").strip()
    def dummy_complete(text, state):
        return None
    readline.set_completer(dummy_complete)
    if market not in markets:
        print("Market not found.")
        return
    
    countries = markets[market]["countries"]
    
    print(f"\nOptions for {market}:")
    print("1. Delete entire market")
    print("2. Proceed to countries")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete entire market '{market}'? (y/n): ").strip().lower()
        if confirm == 'y':
            del markets[market]
            print("Market deleted.")
        else:
            print("Delete cancelled.")
        return
    elif subchoice != "2":
        print("Invalid choice.")
        return
    
    if not countries:
        print("No countries in this market.")
        return
    
    # Step 2: Select Country
    def country_completer_maker_del():
        return completer(list(countries.keys()))
    actual_completer = country_completer_maker_del()
    readline.set_completer(actual_completer)
    readline.parse_and_bind('tab: complete')
    country = input("Select country (tab to complete): ").strip()
    readline.set_completer(dummy_complete)
    if country not in countries:
        print("Country not found.")
        return
    
    manufacturers = countries[country]["manufacturers"]
    
    print(f"\nOptions for {country}:")
    print("1. Delete entire country")
    print("2. Proceed to manufacturers")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete entire country '{country}'? (y/n): ").strip().lower()
        if confirm == 'y':
            del countries[country]
            print("Country deleted.")
        else:
            print("Delete cancelled.")
        return
    elif subchoice != "2":
        print("Invalid choice.")
        return
    
    if not manufacturers:
        print("No manufacturers in this country.")
        return
    
    # Step 3: Select Manufacturer
    def manuf_completer_maker_del():
        return completer(list(manufacturers.keys()))
    actual_completer = manuf_completer_maker_del()
    readline.set_completer(actual_completer)
    readline.parse_and_bind('tab: complete')
    manufacturer = input("Select manufacturer (tab to complete): ").strip()
    readline.set_completer(dummy_complete)
    if manufacturer not in manufacturers:
        print("Manufacturer not found.")
        return
    
    cylinders = manufacturers[manufacturer]["cylinders"]
    
    print(f"\nOptions for {manufacturer}:")
    print("1. Delete entire manufacturer")
    print("2. Proceed to cylinders")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete entire manufacturer '{manufacturer}'? (y/n): ").strip().lower()
        if confirm == 'y':
            del manufacturers[manufacturer]
            print("Manufacturer deleted.")
        else:
            print("Delete cancelled.")
        return
    elif subchoice != "2":
        print("Invalid choice.")
        return
    
    if not cylinders:
        print("No cylinder groups for this manufacturer.")
        return
    
    # Step 4: Select Cylinder count
    def cyl_completer_maker_del():
        return completer(list(cylinders.keys()))
    actual_completer = cyl_completer_maker_del()
    readline.set_completer(actual_completer)
    readline.parse_and_bind('tab: complete')
    cylinder = input("Select cylinder count (tab to complete): ").strip()
    readline.set_completer(dummy_complete)
    if cylinder not in cylinders:
        print("Cylinder count not found.")
        return
    
    engine_list = cylinders[cylinder]
    
    print(f"\nOptions for {cylinder} cylinders:")
    print("1. Delete entire cylinder group")
    print("2. Proceed to engines")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete entire {cylinder} cylinder group? (y/n): ").strip().lower()
        if confirm == 'y':
            del cylinders[cylinder]
            print("Cylinder group deleted.")
        else:
            print("Delete cancelled.")
        return
    elif subchoice != "2":
        print("Invalid choice.")
        return
    
    if not engine_list:
        print("No engines for this cylinder group.")
        return
    
    # Step 5: Select Engine
    existing_engines = [eng["engine_model"] for eng in engine_list]
    def engine_completer_maker_del():
        return completer(existing_engines)
    actual_completer = engine_completer_maker_del()
    readline.set_completer(actual_completer)
    readline.parse_and_bind('tab: complete')
    engine_model = input("Select engine model (tab to complete): ").strip()
    readline.set_completer(dummy_complete)
    engine_idx = next((i for i, eng in enumerate(engine_list) if eng["engine_model"] == engine_model), None)
    if engine_idx is None:
        print("Engine model not found.")
        return
    
    manifold_alts = engine_list[engine_idx]["manifold_alternatives"]
    
    print(f"\nOptions for engine '{engine_model}':")
    print("1. Delete entire engine")
    print("2. Proceed to manifold alternatives")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete entire engine '{engine_model}'? (y/n): ").strip().lower()
        if confirm == 'y':
            del engine_list[engine_idx]
            print("Engine deleted.")
        else:
            print("Delete cancelled.")
        return
    elif subchoice != "2":
        print("Invalid choice.")
        return
    
    if not manifold_alts:
        print("No manifold alternatives for this engine.")
        return
    
    # Step 6: Select Manifold alternative
    # List them briefly (updated for new fields, with .get() for legacy compatibility)
    print("Available alternatives:")
    for i, alt in enumerate(manifold_alts):
        avail = alt.get('availability', 'unknown')
        stock = alt.get('stock_level', 0)
        print(f"{i}: {alt['type']} - {alt.get('brand', 'N/A')} {alt.get('part_number', 'N/A')} (Avail: {avail}, Stock: {stock})")
    
    alt_str = input("Select by index (e.g., 0) or describe (type/brand): ").strip()
    try:
        alt_idx = int(alt_str)
        if 0 <= alt_idx < len(manifold_alts):
            selected_alt = manifold_alts[alt_idx]
        else:
            print("Invalid index.")
            return
    except ValueError:
        # Fallback search by type/brand
        matches = [i for i, alt in enumerate(manifold_alts) if alt['type'] == alt_str or alt.get('brand', '') == alt_str]
        if len(matches) == 1:
            alt_idx = matches[0]
            selected_alt = manifold_alts[alt_idx]
        else:
            print("Ambiguous or not found.")
            return
    
    print(f"\nOptions for alternative '{selected_alt['type']}/{selected_alt.get('brand', 'N/A')}':")
    print("1. Delete entire alternative")
    subchoice = input("Choose: ").strip()
    if subchoice == "1":
        confirm = input(f"Confirm delete alternative? (y/n): ").strip().lower()
        if confirm == 'y':
            del manifold_alts[alt_idx]
            print("Alternative deleted.")
        else:
            print("Delete cancelled.")
    else:
        print("Invalid choice.")

# Main loop
def main():
    catalog = load_catalog()
    last_entered = {}
    print("Note: This updated script uses a unified structure for alternatives. Existing data may need manual migration.")
    while True:
        print("\nOptions:")
        print("1. Add data")
        print("2. Delete data")
        print("3. Exit")
        choice = input("Choose option: ").strip()
        if choice == "1":
            add_data(catalog, last_entered)
            save_catalog(catalog)
        elif choice == "2":
            delete_data(catalog)
            save_catalog(catalog)
        elif choice == "3":
            sys.exit(0)
        else:
            print("Invalid choice.")

if __name__ == "__main__":
    main()