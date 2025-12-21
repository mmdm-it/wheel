# Wheel

A mobile-first hierarchical data browser with novel rotational touch navigation. Navigate deep tree structures intuitively using circular gestures.

**Version 0.8.188** | December 2025

## Biblia Catholica

**Coming December 2025**: [bibliacatholica.org](https://bibliacatholica.org) - The complete Catholic Bible (73 books) in 9 languages, navigated through Wheel's rotational interface.

**Status**: 66/73 books populated with ~231,000 verse translations across 7 languages (Hebrew, Greek, Latin, English, French, Spanish, Italian, Russian).

Languages: Hebrew · Greek · Latin · English · French · Spanish · Italian · Portuguese · Russian

## Demo Applications

Wheel works with any hierarchical data. Current demos include:

- **📖 Biblia Catholica** (Complete Catholic Bible in 9 languages) - Books → Chapters → Verses
- **🔧 Marine Parts Catalog** - Manufacturers → Models → Systems → Parts (2000+ models)
- **🎵 Music Library** - Artists → Albums → Tracks
- **💬 Social Feed** - Categories → Threads → Posts

[**Live demo**](https://howellgibbens.com/mmdm/wheel/wheel.html) | See it in action with real data

## Why Wheel?

Traditional hierarchical navigation (breadcrumbs, back buttons, folder trees) becomes clunky on mobile. Wheel uses rotational gestures and radial layout to make deep navigation feel natural and fast.

**Key features:**
- **Rotational navigation**: Swipe left/right to rotate through items at current level
- **Touch-optimized**: Designed for mobile with momentum physics
- **Large datasets**: Handles thousands of items with viewport filtering
- **No build process**: Direct ES6 module loading in modern browsers

## 🚀 Status on Collaboration

We are not currently seeking additional collaborators. Please use GitHub Issues for bug reports and feature requests.

## Quick Start

1. **Start a local server:**
   ```bash
   python -m http.server 8000
   # or: npx serve .
   ```

2. **Open in browser:**
   ```
   http://localhost:8000/wheel.html?forceMobile=true
   ```

3. **Live demo:**
   ```
   https://howellgibbens.com/mmdm/wheel/wheel.html
   ```

## Features

- **Rotational navigation**: Swipe left/right to rotate through items at current level
- **Animated transitions**: Smooth nzone migration with 600ms animations when navigating levels
- **Hierarchical browsing**: Tap to navigate deeper, use parent button to go back
- **Touch-optimized**: Designed for mobile with momentum physics and gesture detection
- **Translation toggle**: Switch between translations (e.g., Latin/English for Gutenberg Bible)
- **Split JSON architecture**: Lazy-load large volumes with per-book files and IndexedDB caching
- **Error auto-dismiss**: Error messages automatically clear on user interaction (rotation)
- **Large datasets**: Handles 2000+ items with viewport filtering
- **No build process**: Direct ES6 module loading in modern browsers

## Documentation

- **[SETUP.md](SETUP.md)** - Installation and local development
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical overview and module structure
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and testing checklist
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

## Browser Support

- Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+
- Primarily designed for mobile touchscreens
- Desktop works with `?forceMobile=true` parameter

## Status

**Current state**: Working prototype (~75% complete)

**What works:**
- Rotational navigation with touch gestures and momentum
- Multi-level hierarchy browsing with animated nzone migration
- Detail Sector with arc-aware text layout (Gutenberg Bible verses)
- Dynamic font sizing relative to viewport (SSd-based)
- Multiple catalog/dataset support
- Viewport filtering for large datasets
- Error handling with auto-dismiss on rotation
- Parent Button contextual breadcrumbs

**In progress:**
- Performance optimization
- Android packaging
- Comprehensive device testing
- Additional volume types

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## Creating Your Own Datasets

Wheel works with any hierarchical JSON data. Basic structure:

```json
{
  "YourDataset": {
    "display_config": {
      "hierarchy_levels": {
        "level1": { "color": "#FF6B6B" },
        "level2": { "color": "#4ECDC4" }
      }
    },
    "data": { /* your nested data */ }
  }
}
```

See `mmdm_catalog.json` (parts catalog) or `gutenberg.json` (Bible) for complete examples.

## Contributing

Contributions are currently paused. Please file issues for bugs or requests; we may reopen contributions later.

## License

© 2025 Meccanismi Marittimi delle Marche. All rights reserved.

## Contact

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Repository**: https://github.com/mmdm-it/wheel

---

**Version 0.8.188** | December 2025
