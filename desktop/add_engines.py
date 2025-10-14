import json
import os

# Path to the JSON file
JSON_FILE = "catalog.json"

def add_engines():
    # Load the catalog
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found.")
        return
    
    with open(JSON_FILE, 'r') as f:
        catalog = json.load(f)
    
    # Prompt for number of engine models
    try:
        num_models = int(input("How many engine models per cylinder count?: "))
        if num_models < 1:
            print("Number must be positive.")
            return
    except ValueError:
        print("Invalid input. Must be an integer.")
        return
    
    # Traverse and update engines for each cylinder count
    markets = catalog["MMdM"]["markets"]
    for market in markets.values():
        countries = market["countries"]
        for country in countries.values():
            manufacturers = country["manufacturers"]
            for manuf_name, manuf_data in manufacturers.items():
                prefix = manuf_name[:2].upper()
                cylinders = manuf_data["cylinders"]
                for cyl, engine_list in cylinders.items():
                    for i in range(1, num_models + 1):
                        new_engine = {
                            "engine_model": f"{prefix}{cyl}.{i}",
                            "year_introduced": None,
                            "year_discontinued": None,
                            "manifold_alternatives": []
                        }
                        engine_list.append(new_engine)
    
    # Save the updated catalog
    with open(JSON_FILE, 'w') as f:
        json.dump(catalog, f, indent=4)
    
    print(f"Added {num_models} engine models to each cylinder count successfully.")

if __name__ == "__main__":
    add_engines()