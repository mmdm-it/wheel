# Wheel - Universal Hierarchical Data Navigation System

> A revolutionary 2D navigation interface for hierarchical data. Mobile-first ES6 architecture supporting any data domain through JSON configuration.

## 🚀 Quick Start

### Prerequisites
- Modern web browser with ES6 module support (Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+)
- Local web server (for development)

### Running the Application

1. **Start a local server:**
   ```bash
   # Using Python (if available)
   python -m http.server 8000

   # Using Node.js (if available)
   npx serve .

   # Or use any static file server
   ```

2. **Open in browser:**
   - `http://localhost:8000/wheel.html`

3. **Test different catalogs:**
   - Mobile: Opens automatically on mobile devices
   - Desktop: Opens engine catalog directly
   - Force mobile on desktop: `http://localhost:8000/wheel.html?forceMobile=true`

4. **Live testing:**
   - Production URL: `https://howellgibbens.com/mmdm/wheel/wheel.html`
   - Use for testing beyond responsive pane in browser dev tools

## 📋 Table of Contents

- [Architecture](#architecture)
- [Data Catalogs](#data-catalogs)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🏗️ Architecture

### Core Concept
Wheel implements **true 2D navigation** transcending traditional scrolling limitations:

- **Rotational Navigation**: Arc-based "sprocket gear" traversal (CW/CCW)
- **Radial Navigation**: Hierarchical migration (IN/OUT through data levels)
- **Structured Data**: Requires specific JSON formatting with metadata for navigation

### Key Components

#### Mobile Version (`mobile/`)
- **ES6 Native Modules** (zero build process required)
- **SVG-based rendering** with dynamic viewport calculations
- **Touch-optimized** with momentum physics
- **Responsive design** (portrait/landscape detection)

#### Desktop Version (`desktop/`)
- **Traditional script loading** for broader browser compatibility
- **Legacy fallback** for older browsers

### Module Structure
```
mobile/
├── catalog_mobile_modular.js    # Entry point & coordination
├── mobile-app.js               # Main application controller
├── mobile-config.js            # Configuration constants
├── mobile-data.js              # Universal data management
├── mobile-logger.js            # Debug logging system
├── mobile-renderer.js          # SVG rendering & navigation
├── mobile-touch.js             # Touch interaction & physics
├── mobile-viewport.js          # Responsive calculations
├── mobile-childpyramid.js      # Child navigation display
└── mobile-detailsector.js      # Content detail display
```

## 📊 Data Catalogs

### Supported Formats
The system requires hierarchical JSON with specific formatting metadata. Current standalone catalogs:

#### Marine Engine Catalog (`mmdm_catalog.json`)
- **4 Markets** → **18 Countries** → **45+ Manufacturers** → **2000+ Models**
- Complete marine diesel engine specifications
- Used for production deployment

#### Music Library (`hg_mx.json`)
- Artist → Album → Track hierarchy
- Audio playback integration
- Demo catalog for multimedia content

#### Gutenberg Bible (`gutenberg.json`)
- Testament → Book → Chapter → Verse
- Canonical ordering (Genesis through Revelation)
- Text-only content with navigation

### Creating New Catalogs
1. Define hierarchy in JSON with required `hierarchy_levels` configuration
2. Add `wheel_volume_version` property for auto-discovery
3. Include formatting metadata for detail sector display
4. Each catalog version is standalone (Music, Bible, Manifolds, future TBD)
4. Test with `forceMobile=true` for volume selector access

## 💻 Development

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd wheel
   ```

2. **Start development server:**
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js alternative
   npm install -g serve
   serve . -p 8000
   ```

3. **Open development URL:**
   - Local: `http://localhost:8000/wheel.html?forceMobile=true`
   - Live testing: `https://howellgibbens.com/mmdm/wheel/wheel.html?forceMobile=true`

### Development Workflow

#### Code Organization
- **Mobile-first**: All new features developed in `mobile/` directory
- **ES6 Modules**: Direct browser loading, no bundling required
- **Hot reload**: Changes visible immediately on browser refresh
- **Debug logging**: Comprehensive logging via `mobile-logger.js`

#### Key Development Files
- **DESIGNSPEC.md**: Technical specification and coordinate systems
- **STATUS**: Development roadmap and current status
- **REFACTOR_SUMMARY.md**: Architecture evolution documentation

#### Adding New Features
1. Implement in appropriate `mobile/` module
2. Update `DESIGNSPEC.md` if changing spatial model
3. Test on multiple devices/aspect ratios
4. Update STATUS with feature completion

### Browser Compatibility
- **Target**: Modern mobile browsers (iOS Safari, Chrome Mobile)
- **Fallback**: Desktop version for older browsers
- **Testing**: Use browser dev tools device emulation

## 🧪 Testing

### Manual Testing Checklist

#### Navigation Testing
- [ ] All hierarchy levels navigate correctly
- [ ] Parent button returns to top level
- [ ] Child pyramid shows available sub-items
- [ ] Detail sector displays correctly

#### Device Testing
- [ ] Portrait mode (primary target)
- [ ] Landscape mode (table of contents)
- [ ] Different aspect ratios (tall phones, tablets)
- [ ] Touch interactions (swipe, tap, momentum)

#### Content Testing
- [ ] Audio playback (music catalog)
- [ ] Image display (gallery views)
- [ ] Text formatting (info views)
- [ ] Link handling (external URLs)

### Performance Testing
- Test with large catalogs (2000+ items)
- Monitor memory usage during extended use
- Verify smooth 60fps animation on target devices

### Automated Testing
Currently manual testing only. Future enhancement could include:
- Unit tests for data parsing
- Integration tests for navigation flow
- Performance benchmarks

## 🚀 Deployment

### Production Requirements
- **Web server** supporting static files
- **HTTPS** recommended for modern browser features
- **CDN** optional for assets (`assets/` directory)

### Build Process
No build process required! ES6 modules load directly in modern browsers.

### Deployment Steps
1. Upload all files to web server
2. Ensure `wheel.html` is accessible
3. Test catalog loading from different standalone versions
4. Verify audio/image assets load correctly

### Environment Configuration
- **Development**: Local server with `forceMobile=true`
- **Staging**: Test server with production data
- **Production**: Live server at `https://howellgibbens.com/mmdm/wheel/`

## 🤝 Contributing

### Getting Started
1. Read this README completely
2. Review `DESIGNSPEC.md` for technical architecture
3. Check `STATUS` for current development priorities
4. Set up local development environment

### Development Guidelines
- **Mobile-first**: All features must work on mobile
- **Performance**: Maintain 60fps on target devices
- **Compatibility**: Test across iOS Safari, Chrome Mobile, Firefox Mobile
- **Documentation**: Update relevant docs for any changes

### Code Style
- **ES6 Modules**: Use modern JavaScript features
- **Async/Await**: For any asynchronous operations
- **Error Handling**: Comprehensive try/catch blocks
- **Logging**: Use `mobile-logger.js` for debug output

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation as needed
4. Submit PR with clear description
5. Wait for review and approval

## 📚 Documentation

### Technical Documentation
- **[DESIGNSPEC.md](mobile/DESIGNSPEC.md)**: Complete technical specification
- **[STATUS](mobile/STATUS)**: Development status and roadmap
- **[REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md)**: Architecture evolution

### API Documentation
JSDoc comments in all `mobile/*.js` files. Key modules:
- `mobile-data.js`: Data access and navigation methods
- `mobile-renderer.js`: Rendering and UI update methods
- `mobile-app.js`: Application lifecycle methods

## 📄 License

© 2025 Meccanismi Marittimi delle Marche. All rights reserved.

## 🆘 Support

### Common Issues
- **Mobile view not appearing**: Add `?forceMobile=true` to URL
- **Audio not playing**: Check browser audio permissions
- **Performance issues**: Test on actual mobile device (not emulator)

### Getting Help
- Check existing documentation first
- Review STATUS file for known issues
- Test with different catalogs to isolate problems

---

**Version**: 1.0.0
**Last Updated**: November 15, 2025
