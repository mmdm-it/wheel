# Wheel

A mobile-first hierarchical data browser with novel rotational touch navigation. Navigate deep tree structures intuitively using circular gestures.

**Version 0.8.119** | December 2025

## Biblia Catholica

**Coming December 2025**: [bibliacatholica.org](https://bibliacatholica.org) - The complete Catholic Bible (73 books) in 9 languages, navigated through Wheel's rotational interface.

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

## 🚀 Help Wanted

**Wheel is ~70% complete and needs collaborators to ship v1.0.**

We're looking for:

### Android Developer (High Priority)
**Time commitment:** 5-10 hours/week for 6-8 weeks  
**What you'll do:**
- Create WebView wrapper for existing JavaScript/HTML Wheel
- Handle Android packaging and permissions
- Integrate native features (storage, sharing)
- Prepare for Google Play submission

**What you get:** Co-author credit on Play Store, portfolio piece showcasing novel UX

### Data Engineer (High Priority)
**Time commitment:** 10-15 hours over 2-3 weeks (sprint-based)  
**What you'll do:**
- Design hierarchical JSON schema for various datasets
- Transform Bible data (Gutenberg Vulgate + KJV) into schema format
- Create data validation pipeline
- Document schema for other data types

**What you get:** Interesting data architecture problem, open source credit

### QA/Tester (Medium Priority)
**Time commitment:** 3-5 hours/week during testing sprints  
**What you'll do:**
- Manual testing across Android devices and OS versions
- Document bugs and edge cases
- Verify navigation accuracy across different datasets

**What you get:** QA portfolio item, early access to unique app

### How to Contribute

1. **Star this repo** to show interest
2. **Open an issue** introducing yourself and which role interests you
3. **Check "good first issue"** labels for easy starting points
4. **Join discussions** - see GitHub Discussions for planning

**This is volunteer/open source** - no payment currently, but full credit and attribution guaranteed. Early contributors will be recognized if commercial success follows.

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

Contributions welcome! See issues labeled **"good first issue"** for starting points, or the **Help Wanted** section above for priority needs.

**Before contributing:**
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- Check existing issues to avoid duplicate work
- Test on real mobile devices when possible

## License

© 2025 Meccanismi Marittimi delle Marche. All rights reserved.

## Contact

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Repository**: https://github.com/mmdm-it/wheel

---

**Version 0.8.119** | December 2025
