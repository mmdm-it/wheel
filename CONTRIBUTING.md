# Contributing to Wheel

We welcome contributions! This project needs testing, feedback, and code improvements.

## Getting Started

See [SETUP.md](SETUP.md) for installation instructions.

Quick setup:
```bash
git clone https://github.com/mmdm-it/wheel.git
cd wheel
python -m http.server 8000
# Open http://localhost:8000/wheel.html?forceMobile=true
```

## How to Contribute

### Reporting Bugs

**Before submitting:**
- Check existing issues
- Test on latest version
- Try with `?loglevel=4` for debug info

**Bug report should include:**
- Browser and device (e.g., "Chrome Mobile on Pixel 6")
- Steps to reproduce
- Expected vs. actual behavior
- Console errors if any
- Screenshots if visual issue

### Suggesting Features

Open an issue with:
- Clear description of the feature
- Use case: what problem does it solve?
- Expected behavior
- Any implementation ideas (optional)

### Code Contributions

1. **Find or create an issue** to discuss the change
2. **Fork the repository**
3. **Create a branch**: `git checkout -b fix-rotation-bug`
4. **Make your changes:**
   - Keep changes focused
   - Test on mobile device (not just DevTools)
   - Add comments for complex logic
5. **Test thoroughly** (see checklist below)
6. **Commit**: `git commit -m "Fix rotation wraparound at 360°"`
7. **Push**: `git push origin fix-rotation-bug`
8. **Open Pull Request** with clear description

## Testing Checklist

Before submitting PR, test:

**Navigation:**
- [ ] Swipe rotates Focus Ring smoothly
- [ ] Tapping item navigates deeper
- [ ] Parent button returns to previous level
- [ ] Can navigate through all hierarchy levels
- [ ] Rotation wraps around (end to start)

**Device Testing:**
- [ ] Works on actual mobile device (not just DevTools)
- [ ] Touch gestures feel responsive
- [ ] No console errors
- [ ] Smooth 60fps animation

**Edge Cases:**
- [ ] Works with small datasets (< 10 items)
- [ ] Works with large datasets (100+ items)
- [ ] Handles missing data gracefully
- [ ] Portrait and landscape orientation

## Code Style

**Keep it simple:**
- ES6 syntax (const/let, arrow functions, async/await)
- Descriptive function/variable names
- Comments for non-obvious logic
- One function = one purpose

## Volume-Agnostic Coding

Wheel is designed to work with ANY hierarchical data, not just specific volumes like MMdM or Gutenberg. Follow these guidelines to keep the codebase domain-agnostic:

### ❌ DON'T: Use domain-specific terms in code

```javascript
// BAD - hardcoded volume-specific logic
if (volume_name === 'Gutenberg Bible') {
    skipHeader = true;
}

// BAD - domain-specific property access
const name = item.manufacturer || item.engine_model;

// BAD - hardcoded hierarchy level names
if (item.__level === 'song') {
    context.artist = item.__path[0];
}
```

### ✅ DO: Use config-driven patterns

```javascript
// GOOD - use config flags
const levelConfig = displayConfig?.hierarchy_levels?.[context.level];
const skipHeader = levelConfig?.detail_sector?.skip_header === true;

// GOOD - use the getItemDisplayName() helper
const name = this.getItemDisplayName(item, 'Unnamed');

// GOOD - use generic ancestor numbering
item.__path.forEach((segment, index) => {
    context[`ancestor${index + 1}`] = segment;
});
```

### Config Flags Reference

| Flag | Location | Purpose |
|------|----------|---------|
| `detail_sector.mode` | hierarchy_levels.{level} | `"text_display"` for large text rendering |
| `detail_sector.skip_header` | hierarchy_levels.{level} | Skip redundant header |
| `is_numeric` | hierarchy_levels.{level} | Numeric level (chapters, verses) |
| `leaf_level` | display_config | Terminal hierarchy level |

### Pre-commit Hook

Install the pre-commit hook to catch domain-specific code before commit:

```bash
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

See [DOMAIN_AUDIT.md](DOMAIN_AUDIT.md) for complete guidelines.

---

**Error handling:**
```javascript
try {
    // Your code
} catch (error) {
    Logger.error('What failed:', error);
    // Graceful fallback
}
```

**Add JSDoc for public functions:**
```javascript
/**
 * Rotates the focus ring by specified angle
 * @param {number} degrees - Rotation angle in degrees
 * @returns {boolean} True if rotation succeeded
 */
function rotate(degrees) {
    // ...
}
```

## Areas Where We Need Help

**High Priority:**
- Testing on various Android devices (we're iOS-heavy currently)
- Performance optimization for older devices
- Accessibility improvements (keyboard navigation, screen readers)
- Documentation examples and tutorials

**Feature Development:**
- Complete Child Pyramid navigation (partially implemented)
- Landscape mode improvements
- Automated testing framework
- Better error messages

**Content Creation:**
- Try Wheel with your own data
- Report what works and what doesn't
- Suggest improvements to JSON format

**Design:**
- UX feedback on gesture interactions
- Visual polish and consistency
- Mobile-specific improvements

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details

## Code of Conduct

- Be respectful and constructive
- Focus on the problem, not the person
- Welcome newcomers
- Give credit where due

---

Thank you for helping make Wheel better!