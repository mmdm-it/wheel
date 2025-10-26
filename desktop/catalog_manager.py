#!/usr/bin/env python3

import json
import os
import readline
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

class CatalogManager:
    def __init__(self):
        self.catalog_path = "../desktop/catalog.json"
        self.data = self.load_catalog()
        self.current_completions: List[str] = []
        self.input_type = None  # Tracks what type of input we're currently handling
        
        # Setup readline
        readline.parse_and_bind('tab: complete')
        readline.set_completer(self.completer)
        readline.set_completer_delims(' ')

    def load_catalog(self) -> Dict:
        try:
            with open(self.catalog_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"MMdM": {"markets": {}}}
        except json.JSONDecodeError:
            print("Error: Invalid JSON file")
            sys.exit(1)

    def save_catalog(self):
        with open(self.catalog_path, 'w') as f:
            json.dump(self.data, f, indent=4)

    def completer(self, text: str, state: int) -> Optional[str]:
        if state == 0:
            if not text:
                self.current_completions = self.get_completions()
            else:
                self.current_completions = [
                    opt for opt in self.get_completions()
                    if opt.startswith(text)
                ]
        try:
            return self.current_completions[state]
        except IndexError:
            return None

    def get_completions(self) -> List[str]:
        if self.input_type == "command":
            return ['add', 'modify', 'list', 'help', 'exit']
        elif self.input_type == "market":
            return list(self.data['MMdM']['markets'].keys())
        elif self.input_type == "country":
            if hasattr(self, 'current_market'):
                if self.current_market in self.data['MMdM']['markets']:
                    return list(self.data['MMdM']['markets'][self.current_market]['countries'].keys())
            return []
        elif self.input_type == "manufacturer":
            if hasattr(self, 'current_market') and hasattr(self, 'current_country'):
                if (self.current_market in self.data['MMdM']['markets'] and
                    self.current_country in self.data['MMdM']['markets'][self.current_market]['countries']):
                    return list(self.data['MMdM']['markets'][self.current_market]['countries']
                              [self.current_country]['manufacturers'].keys())
            return []
        elif self.input_type == "availability":
            return ["in_stock", "out_of_stock", "discontinued"]
        elif self.input_type == "manifold_type":
            return ["mmdm", "oem", "third_party"]
        return []

    def input_with_completion(self, prompt: str, input_type: str) -> str:
        self.input_type = input_type
        value = input(prompt).strip()
        self.input_type = None
        return value

    def input_media(self, media_type: str) -> Dict[str, Any]:
        media = {
            "path": input(f"{media_type} path: ").strip(),
            "caption" if media_type == "photo" else "title": 
                input("Caption/Title: ").strip(),
            "date_taken" if media_type == "photo" else "date_recorded": 
                input(f"Date {media_type} taken/recorded (YYYY-MM-DD): ").strip() or 
                datetime.now().strftime("%Y-%m-%d"),
            "tags": input("Tags (comma-separated): ").strip().split(",")
        }
        
        if media_type == "photo":
            media["photographer"] = input("Photographer: ").strip()
        else:  # video
            media["duration"] = input("Duration (MM:SS): ").strip()
            media["thumbnail"] = input("Thumbnail path: ").strip()
        
        return media

    def input_specifications(self) -> Dict[str, Any]:
        specs = {}
        specs["material"] = input("Material: ").strip()
        specs["weight"] = input("Weight (with units): ").strip()
        specs["warranty"] = input("Warranty: ").strip()
        
        print("Dimensions:")
        specs["dimensions"] = {
            "height": input("Height (with units): ").strip(),
            "width": input("Width (with units): ").strip(),
            "length": input("Length (with units): ").strip()
        }
        
        return specs

    def add_manifold_alternative(self) -> Dict[str, Any]:
        manifold = {
            "id": f"alt_{os.urandom(4).hex()}",
            "type": self.input_with_completion(
                "Type (mmdm/oem/third_party): ", "manifold_type"),
            "price": float(input("Price: ").strip()),
            "brand": input("Brand: ").strip(),
            "part_number": input("Part number: ").strip(),
            "description": input("Description: ").strip(),
            "rebranded_from": input("Rebranded from (or Enter to skip): ").strip() or "",
            "rebranded_as": input("Rebranded as (or Enter to skip): ").strip() or "",
            "specifications": self.input_specifications(),
            "notes": input("Notes: ").strip(),
            "availability": self.input_with_completion(
                "Availability (in_stock/out_of_stock/discontinued): ", 
                "availability"
            ),
            "stock_level": int(input("Stock level: ").strip()),
            "min_stock_threshold": input("Minimum stock threshold (or Enter to skip): ").strip() or None,
            "lead_time": input("Lead time: ").strip(),
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "media": {"photos": [], "videos": []}
        }
        
        while input("\nAdd photo? (y/n): ").lower().strip() == 'y':
            manifold["media"]["photos"].append(self.input_media("photo"))
        
        while input("\nAdd video? (y/n): ").lower().strip() == 'y':
            manifold["media"]["videos"].append(self.input_media("video"))
        
        return manifold

    def add_manufacturer(self):
        print("\nAdding new manufacturer")
        
        # Get market with completion
        self.input_type = "market"
        self.current_market = self.input_with_completion("Market: ", "market")
        
        # Get country with completion
        self.input_type = "country"
        self.current_country = self.input_with_completion("Country: ", "country")
        
        # Get manufacturer with completion
        self.input_type = "manufacturer"
        manufacturer = self.input_with_completion("Manufacturer name: ", "manufacturer")
        
        # Reset completion state
        self.input_type = None
        
        if self.current_market not in self.data['MMdM']['markets']:
            self.data['MMdM']['markets'][self.current_market] = {'countries': {}}
        if self.current_country not in self.data['MMdM']['markets'][self.current_market]['countries']:
            self.data['MMdM']['markets'][self.current_market]['countries'][self.current_country] = {'manufacturers': {}}
        
        self.data['MMdM']['markets'][self.current_market]['countries'][self.current_country]['manufacturers'][manufacturer] = {
            'year_founded': int(input("Year founded (or Enter for unknown): ").strip() or 0) or None,
            'year_dissolved': int(input("Year dissolved (or Enter for active): ").strip() or 0) or None,
            'cylinders': {}
        }
        
        while True:
            cylinder_count = input("\nAdd cylinder count (or Enter to finish): ").strip()
            if not cylinder_count:
                break
                
            self.data['MMdM']['markets'][self.current_market]['countries'][self.current_country]['manufacturers'][manufacturer]['cylinders'][cylinder_count] = []
            
            while True:
                engine_model = input("Add engine model (or Enter to finish): ").strip()
                if not engine_model:
                    break
                
                engine = {
                    'engine_model': engine_model,
                    'year_introduced': int(input("Year introduced (or Enter for unknown): ").strip() or 0) or None,
                    'year_discontinued': int(input("Year discontinued (or Enter for active): ").strip() or 0) or None,
                    'media': {'photos': [], 'videos': []},
                    'manifold_alternatives': []
                }
                
                # Add engine media
                while input("\nAdd engine photo? (y/n): ").lower().strip() == 'y':
                    engine['media']['photos'].append(self.input_media("photo"))
                
                while input("\nAdd engine video? (y/n): ").lower().strip() == 'y':
                    engine['media']['videos'].append(self.input_media("video"))
                
                # Add manifold alternatives
                while input("\nAdd manifold alternative? (y/n): ").lower().strip() == 'y':
                    engine['manifold_alternatives'].append(self.add_manifold_alternative())
                
                self.data['MMdM']['markets'][self.current_market]['countries'][self.current_country]['manufacturers'][manufacturer]['cylinders'][cylinder_count].append(engine)
        
        self.save_catalog()
        print(f"\nManufacturer {manufacturer} added successfully!")

    def list_catalog(self):
        print("\nCurrent catalog structure:")
        print(json.dumps(self.data, indent=2))

    def main_loop(self):
        print("MMdM Catalog Manager")
        print("Type 'help' for commands, 'exit' to quit")
        
        while True:
            self.input_type = "command"
            command = input("\nEnter command: ").strip().lower()
            self.input_type = None
            
            if command == 'exit':
                break
            elif command == 'help':
                print("\nAvailable commands:")
                print("  add     - Add new manufacturer")
                print("  list    - List current catalog")
                print("  modify  - Modify existing entry (not implemented)")
                print("  exit    - Exit program")
            elif command == 'add':
                self.add_manufacturer()
            elif command == 'list':
                self.list_catalog()
            elif command == 'modify':
                print("Modify function not implemented yet")
            else:
                print("Unknown command. Type 'help' for available commands.")

if __name__ == '__main__':
    manager = CatalogManager()
    try:
        manager.main_loop()
    except KeyboardInterrupt:
        print("\nExiting...")