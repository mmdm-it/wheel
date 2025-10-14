import csv
import json
import os

# Path to the CSV file
CSV_FILE = "manufacturers.csv"
# Path to the JSON file
JSON_FILE = "catalog.json"

def create_catalog():
    # Initialize the catalog structure
    catalog = {"MMdM": {"markets": {}}}
    
    # Read the CSV file
    if not os.path.exists(CSV_FILE):
        print(f"Error: {CSV_FILE} not found.")
        return
    
    with open(CSV_FILE, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        # Skip header row
        next(reader, None)
        for row in reader:
            if len(row) < 3:
                continue  # Skip invalid rows
            market = row[0].strip()
            country = row[1].strip()
            manufacturer = row[2].strip()
            
            if not market or not country or not manufacturer:
                continue  # Skip empty fields
            
            # Ensure market exists
            if market not in catalog["MMdM"]["markets"]:
                catalog["MMdM"]["markets"][market] = {"countries": {}}
            
            # Ensure country exists
            countries = catalog["MMdM"]["markets"][market]["countries"]
            if country not in countries:
                countries[country] = {"manufacturers": {}}
            
            # Ensure manufacturer exists
            manufacturers = countries[country]["manufacturers"]
            if manufacturer not in manufacturers:
                manufacturers[manufacturer] = {
                    "year_founded": None,
                    "year_dissolved": None,
                    "cylinders": {}
                }
    
    # Save the catalog
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=4)
    
    print(f"Catalog created successfully with data from {CSV_FILE}.")

if __name__ == "__main__":
    create_catalog()