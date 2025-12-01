# Setup Guide

How to get Wheel running locally for development or testing.

## Prerequisites

- **Modern web browser** with ES6 module support:
  - Chrome 61+
  - Firefox 60+
  - Safari 10.1+
  - Edge 16+

- **Local web server** (required for ES6 modules):
  - Python 3 (easiest option)
  - Node.js + serve
  - Any static file server

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mmdm-it/wheel.git
cd wheel
```

**Note for Contributors:** Active development is on ext4 filesystem (`/media/howell/dev_workspace/mmdm/website/wheel`). A backup exists on FAT32 PHOTOS volume but should not be used for development. Always verify your working directory before committing.

### 2. Start a Local Server

**Option A: Python (recommended)**
```bash
python -m http.server 8000
```

**Option B: Node.js**
```bash
npx serve . -p 8000
```

**Option C: Other**
Use any static file server that serves the current directory on port 8000 (or any port you prefer).

### 3. Open in Browser

**For mobile testing (primary use case):**
```
http://localhost:8000/wheel.html?forceMobile=true
```

**Without forceMobile parameter:**
- Mobile devices: automatically loads mobile interface
- Desktop: loads desktop version (legacy)

## Testing on Mobile Devices

### Option 1: Browser DevTools
1. Open Chrome/Firefox DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (iPhone, Android)
4. Refresh page

**Limitation**: Touch gestures simulated with mouse, not perfect

### Option 2: Real Device (recommended)

1. Find your computer's local IP address:
   ```bash
   # Linux/Mac
   ifconfig | grep inet
   
   # Windows
   ipconfig
   ```

2. On mobile device, connect to same WiFi network

3. Open browser on mobile device:
   ```
   http://[YOUR_IP]:8000/wheel.html
   ```
   Example: `http://192.168.1.100:8000/wheel.html`

### Option 3: Live Demo
Test without local setup:
```
https://howellgibbens.com/mmdm/wheel/wheel.html
```

## URL Parameters

- `?forceMobile=true` - Force mobile interface on desktop
- `?loglevel=4` - Enable debug logging (0=none, 4=debug, 5=verbose)

Example: `http://localhost:8000/wheel.html?forceMobile=true&loglevel=4`

## Common Issues

### "Failed to load module" errors
- **Cause**: ES6 modules require a web server (not `file://` URLs)
- **Solution**: Make sure you're using a local server, not opening HTML directly

### Mobile view not appearing on desktop
- **Cause**: Desktop detection enabled by default
- **Solution**: Add `?forceMobile=true` to URL

### Gestures not working on mobile device
- **Cause**: Testing in browser DevTools with mouse
- **Solution**: Test on actual device for accurate touch behavior

### Catalog not loading
- **Cause**: JSON file not found or invalid format
- **Solution**: Check browser console for errors, verify JSON syntax

### Port 8000 already in use
```bash
# Use a different port
python -m http.server 8080

# Then access at http://localhost:8080/wheel.html
```

## Development Workflow

1. Start local server
2. Open `http://localhost:8000/wheel.html?forceMobile=true`
3. Make code changes in `mobile/*.js` files
4. Refresh browser to see changes (no build step needed)
5. Check browser console for errors/logs

## File Structure

```
wheel/
├── wheel.html              # Entry point
├── mobile/                 # Mobile implementation (ES6 modules)
│   ├── catalog_mobile_modular.js
│   ├── mobile-app.js
│   ├── mobile-config.js
│   ├── mobile-data.js
│   ├── mobile-logger.js
│   ├── mobile-renderer.js
│   ├── mobile-touch.js
│   ├── mobile-viewport.js
│   ├── mobile-childpyramid.js
│   └── mobile-detailsector.js
├── desktop/                # Desktop version (legacy)
├── assets/                 # Images, audio, etc.
├── mmdm_catalog.json      # Marine catalog data
├── gutenberg.json         # Bible data
└── hg_mx.json             # Music library data
```

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for technical overview
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- Try creating your own catalog JSON

## Getting Help

- **GitHub Issues**: Report bugs or ask questions
- **Live Demo**: Test features at https://howellgibbens.com/mmdm/wheel/
- **Documentation**: See README.md for feature overview
