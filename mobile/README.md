# Mobile Catalog - Modular Architecture

## ⚠️ IMPORTANT: NO BUNDLING REQUIRED

This mobile catalog system uses **native ES6 modules** and does NOT require any bundling process.

## 📁 File Structure

### Active Files (Use These):
- `catalog_mobile_modular.js` - Main entry point loaded by catalog.html
- `mobile-config.js` - Configuration constants
- `mobile-logger.js` - Logging utility
- `mobile-viewport.js` - Viewport calculations and responsive behavior
- `mobile-touch.js` - Touch interaction handling
- `mobile-data.js` - Data loading and management  
- `mobile-renderer.js` - DOM manipulation and rendering
- `mobile-app.js` - Main application coordinator
- `catalog_mobile.css` - Styles

### Retired Files (Do Not Use):
- `catalog_mobile_bundled_bak.js` - **BACKUP ONLY** - Old bundled version (1,651 lines)

## 🚀 Development Workflow

1. **Edit modules directly** - Make changes to individual `mobile-*.js` files
2. **Test immediately** - Just refresh browser, no build step needed
3. **Modern browser support** - All target browsers (Android 10+) support native modules
4. **Better performance** - Modules load in parallel, cache individually

## ❌ What NOT to Do

- ❌ Do not create new bundled files
- ❌ Do not set up build processes 
- ❌ Do not concatenate modules
- ❌ Do not modify the backup file

## ✅ Why Modular is Better

- **Maintainability** - Clear separation of concerns
- **Development speed** - No build step, instant testing
- **Performance** - HTTP/2 parallel loading, better caching
- **Modern approach** - Native ES6 modules are the standard (2025)

## 📊 Migration History

- **Before**: Single bundled file (1,651 lines) with sync issues
- **After**: 7 focused modules (1,744 lines total) with enhanced functionality
- **Migration date**: October 29, 2025
- **Browser compatibility**: Android 10+ (2019), all modern browsers

The modular version is **superior** to the bundled version with additional features and better organization.