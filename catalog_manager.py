import json
import os
from datetime import datetime

# Initial JSON structure (sample data)
INITIAL_DATA = {
    "MMdM": {
        "countries": {
            "USA": {
                "manufacturers": {
                    "Caterpillar": {
                        "cylinders": {
                            "4": [
                                {"model": "C4.4", "manifold": "MM123"},
                                {"model": "C4.4T", "manifold": "MM124"}
                            ],
                            "6": [
                                {"model": "C6.6", "manifold": "MM125"}
                            ]
                        }
                    },
                    "Cummins": {
                        "cylinders": {
                            "6": [
                                {"model": "QSB6.7", "manifold": "MM200"}
                            ]
                        }
                    }
                }
            },
            "Japan": {
                "manufacturers": {
                    "Isuzu": {
                        "cylinders": {
                            "6": [
                                {"model": "6HK1", "manifold": "MM300"}
                            ]
                        }
                    }
                }
            }
        }
    }
}

# File paths
DATA_FILE = "catalog.json"
BACKUP_FILE = "catalog_backup_{}.json"

def load_data():
    """Load JSON data from file or initialize with default if not exists."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return INITIAL_DATA

def save_data(data):
    """Save JSON data with backup."""
    # Create backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            with open(BACKUP_FILE.format(timestamp), 'w') as bf:
                json.dump(json.load(f), bf, indent=4)
    # Save updated data
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def validate_manifold_unique(data, manifold, exclude_path=None):
    """Check if manifold number is unique across all models."""
    def check_manifolds(node, path):
        if isinstance(node, list):
            for item in node:
                if "manifold" in item and item["manifold"] == manifold and path != exclude_path:
                    return False
        elif isinstance(node, dict):
            for key, value in node.items():
                if not check_manifolds(value, path + [key]):
                    return False
        return True
    return check_manifolds(data, [])

def add_entry(data):
    """Add a new entry (country, manufacturer, cylinder, model)."""
    print("Adding new entry...")
    country = input("Enter country (or press Enter to skip): ").strip()
    if country:
        if country not in data["MMdM"]["countries"]:
            data["MMdM"]["countries"][country] = {"manufacturers": {}}
        manufacturer = input("Enter manufacturer: ").strip()
        if manufacturer:
            if manufacturer not in data["MMdM"]["countries"][country]["manufacturers"]:
                data["MMdM"]["countries"][country]["manufacturers"][manufacturer] = {"cylinders": {}}
            cylinders = input("Enter cylinder count (e.g., 4, 6): ").strip()
            if cylinders:
                if cylinders not in data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"]:
                    data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders] = []
                model = input("Enter model number: ").strip()
                manifold = input("Enter MMdM manifold number (e.g., MM123): ").strip()
                if validate_manifold_unique(data, manifold):
                    data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders].append({
                        "model": model,
                        "manifold": manifold
                    })
                    print(f"Added {model} ({manifold}) under {country} > {manufacturer} > {cylinders}")
                else:
                    print("Error: Manifold number must be unique.")
            else:
                print("Error: Cylinder count required.")
        else:
            print("Error: Manufacturer required.")
    else:
        print("Error: Country required.")

def delete_entry(data):
    """Delete an entry (country, manufacturer, cylinder, or model)."""
    print("Deleting entry...")
    country = input("Enter country (or press Enter to list all): ").strip()
    if not country:
        print("Countries:", list(data["MMdM"]["countries"].keys()))
        return
    if country not in data["MMdM"]["countries"]:
        print("Error: Country not found.")
        return
    manufacturer = input("Enter manufacturer (or press Enter to delete country): ").strip()
    if not manufacturer:
        del data["MMdM"]["countries"][country]
        print(f"Deleted country: {country}")
        return
    if manufacturer not in data["MMdM"]["countries"][country]["manufacturers"]:
        print("Error: Manufacturer not found.")
        return
    cylinders = input("Enter cylinder count (or press Enter to delete manufacturer): ").strip()
    if not cylinders:
        del data["MMdM"]["countries"][country]["manufacturers"][manufacturer]
        print(f"Deleted manufacturer: {manufacturer}")
        return
    if cylinders not in data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"]:
        print("Error: Cylinder count not found.")
        return
    model = input("Enter model number (or press Enter to delete cylinder count): ").strip()
    if not model:
        del data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders]
        print(f"Deleted cylinder count: {cylinders}")
        return
    for i, entry in enumerate(data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders]):
        if entry["model"] == model:
            del data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders][i]
            print(f"Deleted model: {model}")
            return
    print("Error: Model not found.")

def update_entry(data):
    """Update an existing model’s details."""
    print("Updating entry...")
    country = input("Enter country: ").strip()
    if country not in data["MMdM"]["countries"]:
        print("Error: Country not found.")
        return
    manufacturer = input("Enter manufacturer: ").strip()
    if manufacturer not in data["MMdM"]["countries"][country]["manufacturers"]:
        print("Error: Manufacturer not found.")
        return
    cylinders = input("Enter cylinder count: ").strip()
    if cylinders not in data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"]:
        print("Error: Cylinder count not found.")
        return
    model = input("Enter model number to update: ").strip()
    for entry in data["MMdM"]["countries"][country]["manufacturers"][manufacturer]["cylinders"][cylinders]:
        if entry["model"] == model:
            new_model = input(f"Enter new model number (current: {model}, press Enter to keep): ").strip()
            new_manifold = input(f"Enter new manifold number (current: {entry['manifold']}, press Enter to keep): ").strip()
            if new_manifold and not validate_manifold_unique(data, new_manifold, [country, manufacturer, cylinders, model]):
                print("Error: Manifold number must be unique.")
                return
            if new_model:
                entry["model"] = new_model
            if new_manifold:
                entry["manifold"] = new_manifold
            print(f"Updated {model} to {entry['model']} ({entry['manifold']})")
            return
    print("Error: Model not found.")

def view_data(data):
    """Display the current data structure."""
    print(json.dumps(data, indent=4))

def main():
    """Main CLI loop."""
    data = load_data()
    while True:
        print("\nManifold Catalog Manager")
        print("1. Add entry")
        print("2. Delete entry")
        print("3. Update entry")
        print("4. View data")
        print("5. Save and exit")
        choice = input("Select an option (1-5): ").strip()
        if choice == "1":
            add_entry(data)
        elif choice == "2":
            delete_entry(data)
        elif choice == "3":
            update_entry(data)
        elif choice == "4":
            view_data(data)
        elif choice == "5":
            save_data(data)
            print("Data saved. Exiting.")
            break
        else:
            print("Invalid option. Try again.")

if __name__ == "__main__":
    main()