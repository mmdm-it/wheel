# Contributing to Wheel

Thank you for your interest in contributing to Wheel! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ or Python 3+ (for local development server)
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)
- Git

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/wheel.git
   cd wheel
   ```

2. **Start development server:**
   ```bash
   # Using Python
   python -m http.server 8000

   # Or using Node.js
   npx serve . -p 8000
   ```

3. **Open in browser:**
   - Development: `http://localhost:8000/wheel.html?forceMobile=true`
   - Test different catalogs and device sizes

4. **Verify setup:**
   - Volume selector should appear
   - Navigation should work smoothly
   - No console errors

## 📋 Development Workflow

### Branching Strategy
- `main`: Production-ready code
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `docs/*`: Documentation updates

### Commit Guidelines
- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on single changes

### Pull Request Process
1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test:**
   - Test on multiple browsers/devices
   - Run manual testing checklist
   - Ensure no regressions

3. **Update documentation:**
   - Update relevant docs for API changes
   - Add JSDoc comments for new functions
   - Update STATUS if changing functionality

4. **Submit PR:**
   - Clear title and description
   - Reference related issues
   - Request review from maintainers

## 🏗️ Architecture Guidelines

### Code Organization
- **Mobile-first**: All features must work on mobile devices
- **ES6 Modules**: Use modern JavaScript, no bundling required
- **Separation of concerns**: Each module has single responsibility
- **Error handling**: Comprehensive try/catch and graceful degradation

### Key Principles
- **Performance**: Maintain 60fps on target mobile devices
- **Accessibility**: Consider touch targets and screen reader support
- **Compatibility**: Test across iOS Safari, Chrome Mobile, Firefox Mobile
- **Maintainability**: Clear code with comprehensive documentation

### Module Structure
```
mobile/
├── catalog_mobile_modular.js    # Entry point - keep minimal
├── mobile-app.js               # Application lifecycle
├── mobile-config.js            # Constants only
├── mobile-data.js              # Data access layer
├── mobile-logger.js            # Logging utilities
├── mobile-renderer.js          # UI rendering
├── mobile-touch.js             # User interaction
├── mobile-viewport.js          # Layout calculations
├── mobile-childpyramid.js      # Child navigation
└── mobile-detailsector.js      # Content display
```

## 📝 Coding Standards

### JavaScript Style
- **ES6+ features**: Use const/let, arrow functions, async/await
- **Descriptive names**: `getUserData()` not `getData()`
- **Single responsibility**: Functions should do one thing well
- **Error handling**: Use try/catch with meaningful error messages

### Documentation
- **JSDoc comments**: For all public functions
- **Inline comments**: For complex logic
- **README updates**: For new features or setup changes

### Example JSDoc
```javascript
/**
 * Gets items at specified hierarchy level
 * @param {Object} parentItem - Parent item with metadata
 * @param {string} childLevelName - Name of child level to retrieve
 * @returns {Array|null} Array of child items or null if level skipped
 */
function getItemsAtLevel(parentItem, childLevelName) {
    // Implementation
}
```

## 🧪 Testing Requirements

### Manual Testing Checklist
Before submitting PR, verify:

#### Navigation
- [ ] All hierarchy levels navigate correctly
- [ ] Parent button works (returns to top)
- [ ] Child pyramid displays properly
- [ ] Detail sector shows content

#### Devices
- [ ] Portrait mode (primary)
- [ ] Landscape mode
- [ ] Different aspect ratios
- [ ] Touch interactions

#### Content
- [ ] Audio playback (if applicable)
- [ ] Image loading
- [ ] Text formatting
- [ ] External links

### Performance
- [ ] Smooth 60fps animation
- [ ] No memory leaks
- [ ] Works with 2000+ items

## 📊 Adding New Catalogs

### JSON Structure Requirements
```json
{
  "wheel_volume_version": "1.0",
  "hierarchy_levels": {
    "level1": { "color": "#color", "sort_type": "alpha" },
    "level2": { "color": "#color", "sort_type": "numeric" }
  },
  "data": {
    "level1_items": [...]
  }
}
```

### Testing New Catalogs
1. Add JSON file to root directory
2. Test with `?forceMobile=true`
3. Verify navigation through all levels
4. Check detail sector display

## 🚨 Issue Reporting

### Bug Reports
- Use GitHub Issues with "bug" label
- Include browser/device information
- Provide steps to reproduce
- Attach screenshots if visual issue

### Feature Requests
- Use GitHub Issues with "enhancement" label
- Describe use case and benefits
- Consider implementation complexity

### Questions
- Check documentation first (README, DESIGNSPEC.md, STATUS)
- Use GitHub Discussions for questions
- Search existing issues

## 📚 Documentation Updates

### When to Update Docs
- New features or functionality
- API changes
- Setup or deployment changes
- Breaking changes

### Documentation Files
- **README.md**: Setup, usage, architecture overview
- **DESIGNSPEC.md**: Technical specifications
- **STATUS**: Development status
- **CHANGELOG.md**: Version history

## 🎯 Code Review Process

### Review Checklist
- [ ] Code follows style guidelines
- [ ] Functions have JSDoc comments
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed
- [ ] Tests pass (manual testing)
- [ ] Documentation updated
- [ ] No console errors or warnings

### Review Comments
- Be constructive and specific
- Suggest improvements, don't just criticize
- Reference coding standards when applicable

## 📞 Getting Help

### Resources
- **README.md**: Complete setup and usage guide
- **DESIGNSPEC.md**: Technical architecture details
- **STATUS**: Current development status
- **REFACTOR_SUMMARY.md**: Architecture evolution

### Communication
- **Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Pull Requests**: Code contributions

## 🙏 Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Acknowledged in release notes
- Invited to future development discussions

Thank you for contributing to Wheel! 🎉