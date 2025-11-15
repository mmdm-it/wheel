# Changelog

All notable changes to **Wheel** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CONTRIBUTING.md with comprehensive developer guidelines
- Expanded README.md with setup instructions and architecture overview
- JSDoc documentation framework for API methods

### Changed
- Reorganized DESIGNSPEC.md into Part I (Code) and Part II (JSON Configuration)
- Updated README.md with modern documentation structure

### Fixed
- Parent button navigation now correctly returns to top level
- Improved touch interaction responsiveness

## [1.0.0] - 2025-11-15

### Added
- **Universal hierarchical data navigation system**
- **2D navigation interface** with rotational and radial movement
- **Mobile-first ES6 module architecture**
- **SVG-based rendering** with dynamic viewport calculations
- **Touch-optimized controls** with momentum physics
- **Multi-catalog support** with volume selector
- **Audio playback integration** for music catalog
- **Responsive design** (portrait/landscape detection)
- **Comprehensive logging system** for debugging

### Supported Catalogs
- **Marine Engine Catalog** (`mmdm_catalog.json`) - 2000+ marine diesel models
- **Music Library** (`hg_mx.json`) - Artist/Album/Track with audio
- **Gutenberg Bible** (`gutenberg.json`) - Complete Latin Vulgate text

### Technical Features
- **Zero build process** - Direct ES6 module loading
- **Universal data architecture** - Works with any JSON hierarchy
- **Pseudo-parent level system** for dynamic hierarchies
- **Detail sector templating** with metadata-driven content
- **Child pyramid navigation** with configurable sorting
- **Coordinate system mathematics** (Hub/Nuc polar/Cartesian)
- **Performance optimized** for 2000+ items

### Documentation
- **DESIGNSPEC.md** - Complete technical specification
- **STATUS** - Development roadmap and current status
- **REFACTOR_SUMMARY.md** - Architecture evolution documentation

---

## Types of Changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Versioning
This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

---

**Legend:**
- 🚀 New feature
- 🐛 Bug fix
- 📚 Documentation
- 🔧 Maintenance
- 💥 Breaking change