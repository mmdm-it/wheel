# MMDM Catalog

Universal wheel-based catalog system for Meccanismi Marittimi delle Marche.

## Architecture

This catalog uses a hierarchical wheel interface to navigate through different types of data:

- **Engine Catalog** (`mmdm_catalog.json`) - Marine engine parts and components
- **Music Library** (`hg_mx.json`) - Music collection with audio playback
- **Gutenberg Bible** (`gutenberg.json`) - Latin Vulgate Bible text

## Files

### Production
- `wheel.html` - Main entry point (responsive: mobile vs desktop versions)

## Usage

### Production
- Open `wheel.html` in a browser
- On mobile devices: Shows volume selector with all catalogs
- On desktop: Shows engine catalog directly

### Testing Music Catalog on Desktop
- Open `wheel.html?forceMobile=true` to test mobile version (with volume selector) on desktop

### Audio Testing
The music catalog includes audio playback functionality:
1. Select "HG Music Library" from volume selector
2. Navigate: The Rolling Stones → Some Girls → Far Away Eyes
3. Audio player appears in detail sector

## Development

- Mobile version: `mobile/` directory (ES6 modules)
- Desktop version: `desktop/` directory (traditional script)
- Audio files: `assets/mx/` directory
- Images: `assets/markets/` directory
