// Mobile version of MMdM Catalog
// Updated: October 27, 2025

// Wait for DOM to be fully loaded before accessing elements
let svg, mainGroup, centralGroup, marketsGroup, pathLinesGroup, manufacturersGroup, cylindersGroup, modelsGroup;

let activeType = null;
let activePath = [];
let data = null;
let selectedMarket = null;

// Mobile-specific constants - updated to match desktop
const ns = "http://www.w3.org/2000/svg";
const HIT_PADDING = 5; // Match desktop
const MOBILE_RADIUS = 10; // Match desktop unselected
const MOBILE_SELECTED_RADIUS = 18; // Match desktop selected

// Add rotation state variables
let arcRotationOffset = 0; // Current rotation offset in radians
let isDragging = false;
let lastTouchX = 0;
let lastTouchY = 0;
let rotationVelocity = 0;
let animationId = null;

// Add the missing rotation constants
const ROTATION_SENSITIVITY = 0.003; // How fast rotation responds to touch movement
const DECELERATION = 0.95; // How quickly momentum decays
const MIN_VELOCITY = 0.001; // Minimum velocity before stopping
const SNAP_THRESHOLD = 0.05; // How close to center before snapping to manufacturer

// Initialize DOM elements safely
function initializeElements() {
    svg = document.getElementById('catalogSvg');
    mainGroup = document.getElementById('mainGroup');
    centralGroup = document.getElementById('centralGroup');
    marketsGroup = document.getElementById('markets');
    pathLinesGroup = document.getElementById('pathLines');
    manufacturersGroup = document.getElementById('manufacturers');
    cylindersGroup = document.getElementById('cylinders');
    modelsGroup = document.getElementById('models');
    
    console.log('DOM elements found:', {
        svg: !!svg,
        mainGroup: !!mainGroup,
        centralGroup: !!centralGroup,
        marketsGroup: !!marketsGroup,
        pathLinesGroup: !!pathLinesGroup,
        manufacturersGroup: !!manufacturersGroup,
        cylindersGroup: !!cylindersGroup,
        modelsGroup: !!modelsGroup
    });
    
    // Verify all elements exist
    if (!svg || !mainGroup || !centralGroup || !marketsGroup || !manufacturersGroup) {
        console.error('Mobile: Required DOM elements not found');
        return false;
    }
    
    return true;
}

// Adjust SVG size for mobile
function adjustSVGForMobile() {
    if (!svg || !mainGroup) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    svg.setAttribute('width', viewportWidth);
    svg.setAttribute('height', viewportHeight);
    
    // Adjust main group translation for mobile center
    mainGroup.setAttribute('transform', `translate(${viewportWidth/2}, ${viewportHeight/2})`);
}

// Mock add to cart function
window.addToCart = function(model) {
    console.log('Added to cart:', model);
    // Mobile-friendly alert or modal would go here
    if (confirm(`Add ${model} to cart?`)) {
        alert(`Added ${model} to cart!`);
    }
};

// Load JSON data
async function loadData() {
    try {
        const res = await fetch('./catalog.json');
        data = await res.json();
        console.log('Mobile: Data loaded', data);
        renderMarkets();
    } catch (error) {
        console.error('Mobile: Failed to load data', error);
    }
}

// Mobile-specific market rendering (corners positioning)
function renderMarkets() {
    if (!marketsGroup) return;
    
    marketsGroup.innerHTML = '';
    if (!data || !data.MMdM || !data.MMdM.markets) return;
    
    const markets = Object.keys(data.MMdM.markets);
    
    // Position markets in corners: upper-right and lower-left
    const positions = [
        { x: 75, y: -220 }, // upper-right
        { x: -75, y: 220 }  // lower-left
    ];
    
    markets.forEach((market, index) => {
        if (index >= positions.length) return; // Only handle 2 markets for now
        
        const pos = positions[index];
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        g.setAttribute('class', 'marketGroup');
        g.setAttribute('data-market', market);

        const img = document.createElementNS(ns, 'image');
        const url = `./assets/markets/${market}.png`;

        img.setAttribute('href', url);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
        
        // Reduced to 3/4 size - now 270x90
        img.setAttribute('x', -135);  // Changed from -180
        img.setAttribute('y', -45);   // Changed from -60
        img.setAttribute('width', 270);  // Changed from 360
        img.setAttribute('height', 90);  // Changed from 120
        img.style.cursor = 'pointer';
        g.appendChild(img);

        // Larger hit area for touch - also reduced to 3/4 size
        const hitArea = document.createElementNS(ns, 'rect');
        hitArea.setAttribute('class', 'marketHitArea');
        hitArea.setAttribute('x', -135);  // Changed from -180
        hitArea.setAttribute('y', -45);   // Changed from -60
        hitArea.setAttribute('width', 270);  // Changed from 360
        hitArea.setAttribute('height', 90);  // Changed from 120
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'pointer';
        g.appendChild(hitArea);

        // Touch events for mobile
        hitArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleMarketSelection(market, g);
        });
        
        hitArea.addEventListener('click', (e) => {
            e.preventDefault();
            handleMarketSelection(market, g);
        });

        marketsGroup.appendChild(g);
    });
}

// Handle market selection for mobile
function handleMarketSelection(market, g) {
    if (selectedMarket === market) return;
    
    selectedMarket = market;
    
    // Clean up any existing rotation controls
    cleanupRotationControls();
    
    // Make center MMdM node inactive (opaque)
    if (centralGroup) {
        centralGroup.classList.add('inactive');
    }
    
    // Add timestamp for testing purposes
    addTimestampToCenter();
    
    // Visual feedback for selection - only unselected markets change
    const marketGroups = document.querySelectorAll('.marketGroup');
    marketGroups.forEach(group => {
        if (group === g) {
            // Selected market stays normal
            group.classList.remove('inactive');
            group.classList.add('active');
        } else {
            // Unselected markets become smaller and opaque
            group.classList.remove('active');
            group.classList.add('inactive');
        }
    });
    
    activeType = 'market';
    activePath = [market];
    
    console.log('Mobile: Selected market', market);
    
    // Render manufacturer arc
    renderManufacturerArc(market);
}

// Render manufacturer arc for mobile - updated with rotation support
function renderManufacturerArc(market) {
    console.log('Mobile: Rendering manufacturer arc for', market);
    
    if (!manufacturersGroup) {
        console.error('Mobile: manufacturersGroup not found');
        return;
    }
    
    if (!data || !data.MMdM || !data.MMdM.markets || !data.MMdM.markets[market]) {
        console.error('Mobile: Invalid data structure for market:', market);
        return;
    }
    
    // Clear existing manufacturers
    manufacturersGroup.innerHTML = '';
    manufacturersGroup.classList.remove('hidden');
    
    // Get all manufacturers for this market
    const marketData = data.MMdM.markets[market];
    const manufacturers = [];
    
    // Collect all manufacturers from all countries in this market
    Object.keys(marketData.countries || {}).forEach(country => {
        const countryData = marketData.countries[country];
        Object.keys(countryData.manufacturers || {}).forEach(manufacturer => {
            manufacturers.push({
                key: manufacturer,
                country: country,
                data: countryData.manufacturers[manufacturer]
            });
        });
    });
    
    if (manufacturers.length === 0) {
        console.log('Mobile: No manufacturers found for market:', market);
        return;
    }
    
    console.log('Mobile: Found manufacturers:', manufacturers.length);
    
    // Sort manufacturers like desktop (Z-A)
    manufacturers.sort((a, b) => b.key.localeCompare(a.key));
    
    console.log('Sorted manufacturers:', manufacturers.map(m => m.key));
    
    // Store manufacturers for rotation
    window.currentManufacturers = manufacturers;
    window.currentMarket = market;
    
    // Use desktop-style centering: center the middle manufacturer (by index) at Southwest (135°)
    const angleStep = Math.PI / 42;
    const centerAngle = Math.PI * 0.75; // 135° = Southwest (4:30 o'clock position)
    
    // Simple centering like desktop: middle manufacturer at center angle
    const middleIndex = Math.floor((manufacturers.length - 1) / 2);
    const middleManufacturer = manufacturers[middleIndex];
    
    console.log('Centering manufacturer at index:', middleIndex, 'of', manufacturers.length, 'manufacturers');
    console.log('Centered manufacturer:', middleManufacturer?.key);
    
    // Calculate rotation offset to place the middle manufacturer at centerAngle
    // Following desktop formula: angle = centerAngle + (index - middle) * angleStep
    // For middle manufacturer: centerAngle = centerAngle + (middleIndex - middle) * angleStep = centerAngle
    // So we want: baseStartAngle + offset + (middleIndex * angleStep) = centerAngle
    // Therefore: offset = centerAngle - baseStartAngle - (middleIndex * angleStep)
    const totalArcSpan = (manufacturers.length - 1) * angleStep;
    const baseStartAngle = centerAngle - (totalArcSpan / 2);
    arcRotationOffset = 0; // With properbaseStartAngle, no offset needed for simple centering
    
    console.log('Setting rotation to center middle manufacturer at Southwest (135°):', centerAngle * 180 / Math.PI + '°');
    
    // Set up touch events for rotation
    setupRotationControls();
    
    // Initial render
    updateManufacturerPositions();
}

// Calculate arc parameters using simple dimension-based formula
function calculateArcParameters() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Determine longer and shorter dimensions
    const longSide = Math.max(viewportWidth, viewportHeight);
    const shortSide = Math.min(viewportWidth, viewportHeight);
    const isPortrait = viewportHeight > viewportWidth;
    
    // Radius = length of longer screen dimension
    const radius = longSide;
    
    // Calculate center coordinates - always positive (northeast quadrant)
    let centerX, centerY;
    
    if (isPortrait) {
        // Portrait mode: x = longSide - shortSide/2, y = longSide/2
        centerX = longSide - (shortSide / 2);
        centerY = longSide / 2;
    } else {
        // Landscape mode: x = longSide/2, y = longSide - shortSide/2
        centerX = longSide / 2;
        centerY = longSide - (shortSide / 2);
    }
    
    console.log('=== ARC PARAMETERS DEBUG ===');
    console.log('Viewport:', viewportWidth, 'x', viewportHeight);
    console.log('Long/Short sides:', longSide, '/', shortSide);
    console.log('Orientation:', isPortrait ? 'portrait' : 'landscape');
    console.log('Calculated center:', centerX, ',', centerY);
    console.log('Calculated radius:', radius);
    console.log('Expected for iPhone SE portrait: center=(480,334), radius=667');
    console.log('==============================');
    
    return {
        centerX: centerX,
        centerY: centerY,
        radius: radius
    };
}

// Update manufacturer positions based on current rotation
function updateManufacturerPositions() {
    if (!window.currentManufacturers || !manufacturersGroup) {
        console.log('Cannot update positions - missing data or elements');
        return;
    }
    
    const manufacturers = window.currentManufacturers;
    
    // Arc parameters - calculate dynamic radius and spacing
    const angleStep = Math.PI / 42; // Match desktop manufacturer spacing (4.3°)
    
    // Center angle for mobile: Southwest (135°) like desktop uses South (90°)
    const centerAngle = Math.PI * 0.75; // 135 degrees (Southwest)
    
    // Apply rotation offset to the center angle
    const adjustedCenterAngle = centerAngle + arcRotationOffset;
    
    // Clear and rebuild manufacturer nodes
    manufacturersGroup.innerHTML = '';
    
    let centerMostIndex = -1;
    let minDistanceToCenter = Infinity;
    
    // Calculate dynamic arc parameters based on viewport and target coordinates
    const arcParams = calculateArcParameters();
    
    manufacturers.forEach((manufacturer, index) => {
        // Use desktop-style angle calculation: centerAngle + (index - middle) * angleStep
        const angle = adjustedCenterAngle + (index - (manufacturers.length - 1) / 2) * angleStep;
        
        // Calculate position on screen relative to center (0,0)
        // Use a fixed radius that works well for mobile screens
        const radius = 200; // Smaller than desktop's 375 for mobile screens
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        // Debug log for first manufacturer only
        if (index === 0) {
            console.log('First manufacturer position debug:');
            console.log('  Angle:', angle * 180 / Math.PI, '°');
            console.log('  Radius:', radius);
            console.log('  Final position (screen-relative):', x, ',', y);
        }
        
        // Calculate distance to screen center for selection
        const distanceToCenter = Math.sqrt(x * x + y * y);
        if (distanceToCenter < minDistanceToCenter) {
            minDistanceToCenter = distanceToCenter;
            centerMostIndex = index;
        }
        
        // Create manufacturer node
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        g.setAttribute('class', 'manufacturerGroup');
        g.setAttribute('data-manufacturer', manufacturer.key);
        g.setAttribute('data-country', manufacturer.country);
        g.setAttribute('data-index', index);
        
        // Determine if this is the selected (centermost) node
        const isSelected = index === centerMostIndex;
        
        // Create circle for manufacturer - match desktop styling
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('r', isSelected ? MOBILE_SELECTED_RADIUS : MOBILE_RADIUS);
        circle.setAttribute('fill', '#f1b800'); // Match desktop yellow
        circle.setAttribute('stroke', isSelected ? 'black' : 'none');
        circle.setAttribute('stroke-width', isSelected ? '1' : '0');
        g.appendChild(circle);
        
        // Create text label with desktop-style positioning and rotation
        const r = isSelected ? MOBILE_SELECTED_RADIUS : MOBILE_RADIUS;
        const offset = -(r + 5); // Text outside circle like desktop
        const textX = offset * Math.cos(angle);
        const textY = offset * Math.sin(angle);
        let rotation = angle * 180 / Math.PI;
        let textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
        let dy = '0.3em';
        
        // Handle text rotation like desktop
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.setAttribute('dy', dy);
        text.setAttribute('text-anchor', textAnchor);
        text.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        text.setAttribute('fill', 'black');
        text.setAttribute('font-size', '12px');
        text.setAttribute('font-family', 'Montserrat, sans-serif');
        text.textContent = manufacturer.key;
        g.appendChild(text);
        
        manufacturersGroup.appendChild(g);
    });
    
    // Update active path with centermost manufacturer and LOG it
    if (centerMostIndex >= 0) {
        const selectedManufacturer = manufacturers[centerMostIndex];
        activePath = [window.currentMarket, selectedManufacturer.country, selectedManufacturer.key];
        activeType = 'manufacturer';
        console.log('CENTERED MANUFACTURER: Index', centerMostIndex, 'Name:', selectedManufacturer.key, 'Rotation:', arcRotationOffset * 180 / Math.PI + '°');
    }
}

// Set up touch controls for rotation - only when manufacturers are visible
function setupRotationControls() {
    console.log('Setting up rotation controls');
    
    if (!svg || !manufacturersGroup) {
        console.error('Mobile: Cannot setup rotation - missing elements');
        return;
    }
    
    // Remove any existing rotation listeners
    cleanupRotationControls();
    
    // Add rotation listeners specifically to areas that won't conflict with markets
    document.addEventListener('touchstart', handleTouchStartGlobal, { passive: false });
    document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
    document.addEventListener('touchend', handleTouchEndGlobal, { passive: false });
    
    console.log('Touch event listeners attached');
}

// Clean up rotation controls
function cleanupRotationControls() {
    document.removeEventListener('touchstart', handleTouchStartGlobal);
    document.removeEventListener('touchmove', handleTouchMoveGlobal);
    document.removeEventListener('touchend', handleTouchEndGlobal);
}

// Global touch handlers that check if we should handle rotation
function handleTouchStartGlobal(e) {
    // Only handle rotation if manufacturers are visible and we're not touching a market
    if (!window.currentManufacturers || !manufacturersGroup || manufacturersGroup.classList.contains('hidden')) {
        return;
    }
    
    // Check if touch is on a market button
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && (element.classList.contains('marketHitArea') || element.closest('.marketGroup'))) {
        console.log('Touch on market button, ignoring for rotation');
        return;
    }
    
    console.log('Touch start detected for rotation');
    handleTouchStart(e);
}

function handleTouchMoveGlobal(e) {
    if (!isDragging) return;
    handleTouchMove(e);
}

function handleTouchEndGlobal(e) {
    if (!isDragging) return;
    handleTouchEnd(e);
}

// Handle touch start for rotation
function handleTouchStart(e) {
    console.log('Starting rotation drag');
    e.preventDefault();
    
    if (e.touches.length !== 1) return;
    
    isDragging = true;
    rotationVelocity = 0;
    
    const touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    
    console.log('Touch start at:', lastTouchX, lastTouchY);
    
    // Stop any ongoing momentum animation
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Handle touch move for rotation
function handleTouchMove(e) {
    console.log('Touch move detected, isDragging:', isDragging);
    e.preventDefault();
    
    if (!isDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    
    // Calculate movement in both directions
    const deltaX = currentX - lastTouchX;
    const deltaY = currentY - lastTouchY;
    
    console.log('Delta X:', deltaX, 'Delta Y:', deltaY);
    
    // Convert movement to rotation
    // Horizontal: left swipe = counter-clockwise (negative)
    // Vertical: down swipe = counter-clockwise (negative)
    const horizontalRotation = -deltaX * ROTATION_SENSITIVITY;
    const verticalRotation = -deltaY * ROTATION_SENSITIVITY;
    
    // Combine both movements
    const rotationDelta = horizontalRotation + verticalRotation;
    const newRotationOffset = arcRotationOffset + rotationDelta;
    
    // Calculate rotation limits to prevent extreme manufacturers from going past center
    const rotationLimits = calculateRotationLimits();
    
    // Apply limits
    if (newRotationOffset < rotationLimits.min) {
        console.log('Hit minimum rotation limit');
        arcRotationOffset = rotationLimits.min;
        rotationVelocity = 0; // Stop momentum at boundary
    } else if (newRotationOffset > rotationLimits.max) {
        console.log('Hit maximum rotation limit');
        arcRotationOffset = rotationLimits.max;
        rotationVelocity = 0; // Stop momentum at boundary
    } else {
        arcRotationOffset = newRotationOffset;
        // Store velocity for momentum only if not hitting boundaries
        rotationVelocity = rotationDelta;
    }
    
    console.log('New rotation offset:', arcRotationOffset);
    
    // Update positions
    updateManufacturerPositions();
    
    // Update last touch position
    lastTouchX = currentX;
    lastTouchY = currentY;
}

// Add this function after handleTouchMove
function handleTouchEnd(e) {
    console.log('Touch end, starting momentum or snap');
    e.preventDefault();
    
    isDragging = false;
    
    // If there's significant velocity, start momentum animation
    if (Math.abs(rotationVelocity) > MIN_VELOCITY) {
        console.log('Starting momentum with velocity:', rotationVelocity);
        startMomentumAnimation();
    } else {
        // Otherwise, snap to nearest manufacturer
        console.log('Snapping to nearest manufacturer');
        snapToNearestManufacturer();
    }
}

// Calculate rotation limits using desktop-style approach
function calculateRotationLimits() {
    if (!window.currentManufacturers || window.currentManufacturers.length === 0) {
        return { min: -Infinity, max: Infinity };
    }
    
    const manufacturers = window.currentManufacturers;
    const angleStep = Math.PI / 42;
    const centerAngle = Math.PI * 0.75; // Southwest (135°)
    
    // Calculate how much we can rotate in each direction
    // Maximum rotation should center the first manufacturer (index 0)
    // Minimum rotation should center the last manufacturer (index length-1)
    
    // When arcRotationOffset = 0, middle manufacturer is centered
    // To center first manufacturer: we need to rotate by -(middleIndex * angleStep)
    // To center last manufacturer: we need to rotate by +((length-1-middleIndex) * angleStep)
    
    const middleIndex = (manufacturers.length - 1) / 2;
    const maxOffset = -(0 - middleIndex) * angleStep; // Center first manufacturer
    const minOffset = -((manufacturers.length - 1) - middleIndex) * angleStep; // Center last manufacturer
    
    console.log('Rotation limits for', manufacturers.length, 'manufacturers:');
    console.log('maxOffset (for first manufacturer', manufacturers[0].key + '):', maxOffset * 180 / Math.PI + '°');
    console.log('minOffset (for last manufacturer', manufacturers[manufacturers.length - 1].key + '):', minOffset * 180 / Math.PI + '°');
    
    return {
        min: minOffset,
        max: maxOffset
    };
}

// Update momentum animation to respect limits
function startMomentumAnimation() {
    function animate() {
        if (Math.abs(rotationVelocity) < MIN_VELOCITY) {
            snapToNearestManufacturer();
            return;
        }
        
        const newOffset = arcRotationOffset + rotationVelocity;
        const limits = calculateRotationLimits();
        
        // Check boundaries and stop momentum if hit
        if (newOffset < limits.min) {
            arcRotationOffset = limits.min;
            snapToNearestManufacturer();
            return;
        } else if (newOffset > limits.max) {
            arcRotationOffset = limits.max;
            snapToNearestManufacturer();
            return;
        }
        
        arcRotationOffset = newOffset;
        rotationVelocity *= DECELERATION;
        
        updateManufacturerPositions();
        
        animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
}

// Snap to nearest manufacturer using desktop-style approach
function snapToNearestManufacturer() {
    if (!window.currentManufacturers) return;
    
    const manufacturers = window.currentManufacturers;
    const angleStep = Math.PI / 42;
    const middleIndex = (manufacturers.length - 1) / 2;
    
    // Find which manufacturer should be centered based on current rotation
    let bestIndex = 0;
    let minDistanceFromCurrent = Infinity;
    
    manufacturers.forEach((manufacturer, index) => {
        // To center manufacturer at index i:
        // We want: centerAngle + offset + (index - middle) * angleStep = centerAngle + (0 - middle) * angleStep
        // Therefore: offset = -(index - middle) * angleStep = (middle - index) * angleStep
        const targetOffset = (middleIndex - index) * angleStep;
        
        const distanceFromCurrent = Math.abs(targetOffset - arcRotationOffset);
        
        if (distanceFromCurrent < minDistanceFromCurrent) {
            minDistanceFromCurrent = distanceFromCurrent;
            bestIndex = index;
        }
    });
    
    // Calculate the target offset for the best manufacturer
    let bestOffset = (middleIndex - bestIndex) * angleStep;
    
    // Check if this offset is within our calculated limits
    const limits = calculateRotationLimits();
    
    // If the best offset is outside limits, clamp it
    if (bestOffset < limits.min) {
        bestOffset = limits.min;
    } else if (bestOffset > limits.max) {
        bestOffset = limits.max;
    }
    
    console.log('Snapping to manufacturer at index', bestIndex, '(' + manufacturers[bestIndex].key + ') with offset:', bestOffset * 180 / Math.PI + '°');
    
    // Animate to the position
    animateToOffset(bestOffset);
}

// Smooth animation to a target offset
function animateToOffset(targetOffset) {
    const startOffset = arcRotationOffset;
    const difference = targetOffset - startOffset;
    const duration = 300; // milliseconds
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        arcRotationOffset = startOffset + (difference * easeProgress);
        updateManufacturerPositions();
        
        if (progress < 1) {
            animationId = requestAnimationFrame(animate);
        }
    }
    
    animationId = requestAnimationFrame(animate);
}

// Add timestamp for testing purposes
function addTimestampToCenter() {
    // Remove any existing timestamp
    const existingTimestamp = document.getElementById('mobileTimestamp');
    if (existingTimestamp) {
        existingTimestamp.remove();
    }
    
    // Create timestamp text with fixed save time
    const timestampElement = document.createElementNS(ns, 'text');
    timestampElement.setAttribute('id', 'mobileTimestamp');
    timestampElement.setAttribute('x', '0');
    timestampElement.setAttribute('y', '80'); // Below the MMdM logo
    timestampElement.setAttribute('text-anchor', 'middle');
    timestampElement.setAttribute('fill', '#f2f2e6');
    timestampElement.setAttribute('font-size', '14px');
    timestampElement.setAttribute('font-family', 'Montserrat, sans-serif');
    timestampElement.setAttribute('font-weight', 'bold');
    timestampElement.textContent = 'Updated: Oct 28, 4:45 PM';
    
    // Add to central group
    if (centralGroup) {
        centralGroup.appendChild(timestampElement);
    }
}

// Initialize mobile version
function initMobile() {
    console.log('Initializing mobile catalog');
    
    // Initialize DOM elements first
    if (!initializeElements()) {
        console.error('Mobile: Failed to initialize DOM elements');
        return;
    }
    
    adjustSVGForMobile();
    loadData();
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            adjustSVGForMobile();
        }, 100);
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        adjustSVGForMobile();
    });
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobile);
} else {
    // DOM is already loaded
    initMobile();
}