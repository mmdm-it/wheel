import json
import os
from datetime import datetime
import csv
from typing import Dict, Any

JSON_FILE = "catalog.json"
BACKUP_DIR = "backups"

def load_catalog() -> Dict[str, Any]:
    """Load existing catalog or create minimal structure if not exists"""
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r') as f:
            return json.load(f)
    
    return {
        "MMdM": {
            "markets": {
                "eurasia": {"countries": {}},
                "americhe": {"countries": {}}
            }
        }
    }

def create_backup():
    """Create timestamped backup of current catalog"""
    if not os.path.exists(JSON_FILE):
        return
    
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f"{BACKUP_DIR}/catalog_{timestamp}.json"
    
    with open(JSON_FILE, 'r') as src, open(backup_file, 'w') as dst:
        dst.write(src.read())
    
    print(f"Backup created: {backup_file}")

def save_catalog(catalog: Dict[str, Any]):
    """Save catalog with backup"""
    create_backup()
    with open(JSON_FILE, 'w') as f:
        json.dump(catalog, f, indent=4)
    print("Catalog saved successfully")

def validate_market(market: str) -> bool:
    """Validate market name"""
    return market in ["eurasia", "americhe"]

def get_nested_dict(d: Dict[str, Any], *keys: str) -> Dict[str, Any]:
    """Safely get nested dictionary, creating if needed"""
    for key in keys:
        if key not in d:
            d[key] = {}
        d = d[key]
    return d

def add_manufacturer(catalog: Dict[str, Any]):
    """Add new manufacturer interactively"""
    while True:
        market = input("Market (eurasia/americhe): ").strip().lower()
        if validate_market(market):
            break
        print("Invalid market name")
    
    country = input("Country: ").strip()
    manufacturer = input("Manufacturer: ").strip()
    
    market_data = get_nested_dict(catalog["MMdM"]["markets"][market], "countries")
    if country not in market_data:
        market_data[country] = {}
    if manufacturer not in market_data[country]:
        market_data[country][manufacturer] = {"cylinders": {}}
        print(f"Added manufacturer {manufacturer} to {country} in {market}")
    else:
        print(f"Manufacturer {manufacturer} already exists")

def add_cylinder(catalog: Dict[str, Any]):
    """Add cylinder configuration to manufacturer"""
    while True:
        market = input("Market (eurasia/americhe): ").strip().lower()
        if validate_market(market):
            break
        print("Invalid market name")
    
    country = input("Country: ").strip()
    manufacturer = input("Manufacturer: ").strip()
    cylinder_count = input("Cylinder count: ").strip()
    
    path = ["MMdM", "markets", market, "countries", country, manufacturer, "cylinders"]
    current = catalog
    for key in path[:-1]:
        if key not in current:
            print(f"Path not found: {key}")
            return
        current = current[key]
    
    if cylinder_count not in current["cylinders"]:
        current["cylinders"][cylinder_count] = {"models": []}
        print(f"Added {cylinder_count} cylinder configuration")
    else:
        print(f"Cylinder count {cylinder_count} already exists")

def add_model(catalog: Dict[str, Any]):
    """Add engine model to cylinder configuration"""
    while True:
        market = input("Market (eurasia/americhe): ").strip().lower()
        if validate_market(market):
            break
        print("Invalid market name")
    
    country = input("Country: ").strip()
    manufacturer = input("Manufacturer: ").strip()
    cylinder_count = input("Cylinder count: ").strip()
    model_name = input("Model name: ").strip()
    
    path = ["MMdM", "markets", market, "countries", country, manufacturer, "cylinders", cylinder_count]
    current = catalog
    for key in path[:-1]:
        if key not in current:
            print(f"Path not found: {key}")
            return
        current = current[key]
    
    if "models" not in current[cylinder_count]:
        current[cylinder_count]["models"] = []
    
    # Check if model already exists
    for model in current[cylinder_count]["models"]:
        if model["engine_model"] == model_name:
            print(f"Model {model_name} already exists")
            return
    
    # Add new model with manifold alternatives
    model_data = {
        "engine_model": model_name,
        "manifold_alternatives": []
    }
    current[cylinder_count]["models"].append(model_data)
    print(f"Added model {model_name}")

def add_manifold(catalog: Dict[str, Any]):
    """Add manifold alternative to engine model"""
    while True:
        market = input("Market (eurasia/americhe): ").strip().lower()
        if validate_market(market):
            break
        print("Invalid market name")
    
    country = input("Country: ").strip()
    manufacturer = input("Manufacturer: ").strip()
    cylinder_count = input("Cylinder count: ").strip()
    model_name = input("Model name: ").strip()
    
    manifold_data = {
        "manifold_id": input("Manifold ID: ").strip(),
        "price": float(input("Price: ").strip()),
        "available": input("Available (yes/no): ").strip().lower() == "yes",
        "stock": int(input("Stock quantity: ").strip())
    }
    
    path = ["MMdM", "markets", market, "countries", country, manufacturer, 
            "cylinders", cylinder_count]
    current = catalog
    for key in path[:-1]:
        if key not in current:
            print(f"Path not found: {key}")
            return
        current = current[key]
    
    # Find the model and add manifold
    for model in current[cylinder_count]["models"]:
        if model["engine_model"] == model_name:
            model["manifold_alternatives"].append(manifold_data)
            print(f"Added manifold {manifold_data['manifold_id']} to {model_name}")
            return
    
    print(f"Model {model_name} not found")

def main():
    """Main interactive loop"""
    catalog = load_catalog()
    
    while True:
        print("\nMMdM Catalog Editor")
        print("1. Add manufacturer")
        print("2. Add cylinder configuration")
        print("3. Add engine model")
        print("4. Add manifold alternative")
        print("5. Save and exit")
        print("6. Exit without saving")
        
        choice = input("\nChoice: ").strip()
        
        if choice == "1":
            add_manufacturer(catalog)
        elif choice == "2":
            add_cylinder(catalog)
        elif choice == "3":
            add_model(catalog)
        elif choice == "4":
            add_manifold(catalog)
        elif choice == "5":
            save_catalog(catalog)
            break
        elif choice == "6":
            if input("Exit without saving? (yes/no): ").lower() == "yes":
                break
        else:
            print("Invalid choice")

if __name__ == "__main__":
    main()