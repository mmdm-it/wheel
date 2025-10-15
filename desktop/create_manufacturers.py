import csv
import json

# Initialize the catalog with default markets
catalog = {
    "MMdM": {
        "markets": {
            "Europe & Asia": {"countries": {}},
            "North & South America": {"countries": {}}
        }
    }
}

# Read the CSV file
with open("manufacturers.csv", "r") as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        if not row:
            continue
        market, country, manufacturer, cylinders, engine_model = [item.strip() for item in row]
        
        markets = catalog["MMdM"]["markets"]
        if market not in markets:
            markets[market] = {"countries": {}}
        
        countries = markets[market]["countries"]
        if country not in countries:
            countries[country] = {"manufacturers": {}}
        
        manufacturers = countries[country]["manufacturers"]
        if manufacturer not in manufacturers:
            manufacturers[manufacturer] = {
                "year_founded": None,
                "year_dissolved": None,
                "cylinders": {}
            }
        
        cyls = manufacturers[manufacturer]["cylinders"]
        if cylinders not in cyls:
            cyls[cylinders] = []
        
        engine_list = cyls[cylinders]
        if not any(eng["engine_model"] == engine_model for eng in engine_list):
            engine_list.append({
                "engine_model": engine_model,
                "year_introduced": None,
                "year_discontinued": None
            })

# Save the catalog to JSON
with open("catalog.json", "w") as jsonfile:
    json.dump(catalog, jsonfile, indent=4)