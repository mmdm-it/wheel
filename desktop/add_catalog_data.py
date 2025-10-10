import json
import os
import readline
import sys

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
        # Update years if needed, but for simplicity, assume set once
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
        
        new_alt = {"type": alt_type}
        
        if alt_type == 'oem':
            new_alt["brand"] = get_input("Enter brand (default: manufacturer)", last_entered, 'oem_brand')
            if not new_alt["brand"]:
                new_alt["brand"] = manufacturer
            new_alt["oem_manifold"] = get_input("Enter OEM manifold number", last_entered, 'oem_manifold')
            price_str = get_input("Enter price (integer)", last_entered, 'oem_price')
            new_alt["price"] = int(price_str) if price_str else 0
            notes = input("Enter notes (optional): ").strip()
            if notes:
                new_alt["notes"] = notes
        elif alt_type == 'mmdm':
            new_alt["brand"] = "MMdM"
            new_alt["part_number"] = get_input("Enter MMdM part number", last_entered, 'mmdm_part_number')
            price_str = get_input("Enter price (integer)", last_entered, 'mmdm_price')
            new_alt["price"] = int(price_str) if price_str else 0
            # MMdM manifold details
            description = get_input("Enter description", last_entered, 'description')
            material = get_input("Enter material", last_entered, 'material')
            weight = get_input("Enter weight (e.g., 25kg)", last_entered, 'weight')
            warranty = get_input("Enter warranty (e.g., 2 years)", last_entered, 'warranty')
            height = get_input("Enter height (e.g., 20cm)", last_entered, 'height')
            width = get_input("Enter width (e.g., 30cm)", last_entered, 'width')
            length = get_input("Enter length (e.g., 50cm)", last_entered, 'length')
            # Photos
            photos = []
            last_photo = last_entered.get('photo', '')
            while True:
                photo_prompt = "Enter photo path (or leave blank to finish)"
                if last_photo:
                    photo_prompt += f" (default: '{last_photo}')"
                photo = input(f"{photo_prompt}: ").strip()
                if not photo:
                    if photos:
                        break
                    else:
                        photo = last_photo
                        if not photo:
                            break
                photos.append(photo)
                last_entered['photo'] = photo
                last_photo = photo
            new_alt["mmdm_manifold"] = {
                "description": description,
                "specifications": {
                    "material": material,
                    "weight": weight,
                    "warranty": warranty,
                    "dimensions": {
                        "height": height,
                        "width": width,
                        "length": length
                    }
                },
                "photos": photos
            }
        elif alt_type == 'third_party':
            new_alt["brand"] = get_input("Enter third-party brand", last_entered, 'third_brand')
            new_alt["part_number"] = get_input("Enter part number", last_entered, 'third_part_number')
            price_str = get_input("Enter price (integer)", last_entered, 'third_price')
            new_alt["price"] = int(price_str) if price_str else 0
            rebrand_options = ['none', 'mmdm_sells_third_party', 'third_party_rebrands_mmdm']
            def rebrand_completer_maker():
                return completer(rebrand_options)
            rebrand_type = get_input("Enter rebrand type (none/mmdm_sells_third_party/third_party_rebrands_mmdm, tab to complete)", last_entered, 'rebrand_type', rebrand_completer_maker)
            if rebrand_type not in rebrand_options:
                rebrand_type = 'none'
            new_alt["rebrand_type"] = rebrand_type
            # Specs (always prompt, but note if rebrand)
            if rebrand_type != 'none':
                inherit = input(f"Auto-inherit specs from linked MMdM? (y/n): ").strip().lower()
                if inherit == 'y':
                    # For simplicity, assume user knows and skips prompts; in real, would need to select linked mmdm
                    print("Specs inherited (prompts skipped).")
                    new_alt["specifications"] = {}  # Placeholder; link in UI
                else:
                    # Fall through to prompts
                    pass
            material = get_input("Enter material", last_entered, 'third_material')
            weight = get_input("Enter weight (e.g., 25kg)", last_entered, 'third_weight')
            warranty = get_input("Enter warranty (e.g., 2 years)", last_entered, 'third_warranty')
            height = get_input("Enter height (e.g., 20cm)", last_entered, 'third_height')
            width = get_input("Enter width (e.g., 30cm)", last_entered, 'third_width')
            length = get_input("Enter length (e.g., 50cm)", last_entered, 'third_length')
            new_alt["specifications"] = {
                "material": material,
                "weight": weight,
                "warranty": warranty,
                "dimensions": {
                    "height": height,
                    "width": width,
                    "length": length
                }
            }
            notes = input("Enter notes (optional): ").strip()
            if notes:
                new_alt["notes"] = notes
        
        # Check cap: e.g., no more than 6 third_party total (simplified)
        third_count = sum(1 for alt in manifold_alts if alt["type"] == "third_party")
        if alt_type == "third_party" and third_count >= 6:
            print("Max 6 third-party alternatives reached. Skipping add.")
            continue
        
        manifold_alts.append(new_alt)
    
    print("Data added successfully.")

# Main interactive function to delete data
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
    # List them briefly
    print("Available alternatives:")
    for i, alt in enumerate(manifold_alts):
        print(f"{i}: {alt['type']} - {alt.get('brand', 'N/A')} {alt.get('oem_manifold', alt.get('part_number', 'N/A'))}")
    
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