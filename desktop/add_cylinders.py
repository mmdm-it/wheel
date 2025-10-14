import json
import os

# Path to the JSON file
JSON_FILE = "catalog.json"

def add_cylinders():
    # Load the catalog
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found.")
        return
    
    with open(JSON_FILE, 'r') as f:
        catalog = json.load(f)
    
    # Prompt for number of cylinder groups
    try:
        num_groups = int(input("How many cylinder groups per manufacturer?: "))
        if num_groups < 1:
            print("Number must be positive.")
            return
    except ValueError:
        print("Invalid input. Must be an integer.")
        return
    
    # Traverse and update cylinders for each manufacturer
    markets = catalog["MMdM"]["markets"]
    for market in markets.values():
        countries = market["countries"]
        for country in countries.values():
            manufacturers = country["manufacturers"]
            for manufacturer in manufacturers.values():
                # Set cylinders to sequential groups starting from 1
                manufacturer["cylinders"] = {str(i): [] for i in range(1, num_groups + 1)}
    
    # Save the updated catalog
    with open(JSON_FILE, 'w') as f:
        json.dump(catalog, f, indent=4)
    
    print(f"Added {num_groups} cylinder groups to each manufacturer successfully.")

if __name__ == "__main__":
    add_cylinders()