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
    
    // Calculate initial rotation offset to center Lyon
    const lyonIndex = manufacturers.findIndex(m => m.key === 'Lyon');
    console.log('Lyon index:', lyonIndex);
    
    if (lyonIndex !== -1) {
        // Calculate what offset would center Lyon
        const angleStep = Math.PI / 42;
        const totalArcSpan = (manufacturers.length - 1) * angleStep;
        const diagonalAngle = Math.PI * 1.25;
        const baseStartAngle = diagonalAngle - (totalArcSpan / 2);
        
        // To center Lyon: baseStartAngle + offset + (lyonIndex * angleStep) = diagonalAngle
        // Therefore: offset = diagonalAngle - baseStartAngle - (lyonIndex * angleStep)
        arcRotationOffset = diagonalAngle - baseStartAngle - (lyonIndex * angleStep);
        console.log('Setting initial rotation offset to center Lyon:', arcRotationOffset * 180 / Math.PI + '°');
    } else {
        // If Lyon not found, start at 0
        arcRotationOffset = 0;
        console.log('Lyon not found, starting at rotation offset 0');
    }
    
    // Set up touch events for rotation
    setupRotationControls();
    
    // Initial render
    updateManufacturerPositions();
}

// Update manufacturer positions based on current rotation
function updateManufacturerPositions() {
    if (!window.currentManufacturers || !manufacturersGroup) {
        console.log('Cannot update positions - missing data or elements');
        return;
    }
    
    const manufacturers = window.currentManufacturers;
    
    // Arc parameters - match desktop spacing
    const arcRadius = 500;
    const angleStep = Math.PI / 42; // Match desktop manufacturer spacing (4.3°)
    const totalArcSpan = (manufacturers.length - 1) * angleStep;
    
    // Center the arc around the diagonal (from upper-left to lower-right)
    const diagonalAngle = Math.PI * 1.25; // 225 degrees (center of diagonal)
    const baseStartAngle = diagonalAngle - (totalArcSpan / 2);
    
    // Apply rotation offset
    const startAngle = baseStartAngle + arcRotationOffset;
    
    // Arc center coordinates
    const arcCenterX = window.innerWidth * -0.8;
    const arcCenterY = 250;
    
    // Clear and rebuild manufacturer nodes
    manufacturersGroup.innerHTML = '';
    
    let centerMostIndex = -1;
    let minDistanceToCenter = Infinity;
    
    manufacturers.forEach((manufacturer, index) => {
        const angle = startAngle + (index * angleStep);
        
        // Calculate position relative to arc center
        const arcX = Math.cos(angle) * arcRadius;
        const arcY = Math.sin(angle) * arcRadius;
        
        // Translate from arc center to screen center (mainGroup origin)
        const x = arcX - arcCenterX;
        const y = arcY - arcCenterY;
        
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

// Replace the calculateRotationLimits function with this debug version
function calculateRotationLimits() {
    if (!window.currentManufacturers || window.currentManufacturers.length === 0) {
        return { min: -Infinity, max: Infinity };
    }
    
    const manufacturers = window.currentManufacturers;
    const angleStep = Math.PI / 42;
    const totalArcSpan = (manufacturers.length - 1) * angleStep;
    const diagonalAngle = Math.PI * 1.25;
    const baseStartAngle = diagonalAngle - (totalArcSpan / 2);
    
    console.log('=== ROTATION LIMITS DEBUG ===');
    console.log('Manufacturers (sorted Z-A):', manufacturers.map(m => m.key));
    console.log('Total manufacturers:', manufacturers.length);
    console.log('First manufacturer (index 0):', manufacturers[0].key);
    console.log('Last manufacturer (index ' + (manufacturers.length - 1) + '):', manufacturers[manufacturers.length - 1].key);
    
    // Let's calculate what offset would center EACH manufacturer and see the pattern
    manufacturers.forEach((manufacturer, index) => {
        const targetOffset = diagonalAngle - baseStartAngle - (index * angleStep);
        console.log(`Manufacturer ${index} (${manufacturer.key}): targetOffset = ${targetOffset * 180 / Math.PI}°`);
    });
    
    // The limits should be the offsets for the first and last manufacturers
    const maxOffset = diagonalAngle - baseStartAngle - (0 * angleStep);
    const minOffset = diagonalAngle - baseStartAngle - ((manufacturers.length - 1) * angleStep);
    
    console.log('Calculated limits:');
    console.log('maxOffset (for ' + manufacturers[0].key + '):', maxOffset * 180 / Math.PI + '°');
    console.log('minOffset (for ' + manufacturers[manufacturers.length - 1].key + '):', minOffset * 180 / Math.PI + '°');
    console.log('=== END DEBUG ===');
    
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

// Replace the snapToNearestManufacturer function with this corrected version
function snapToNearestManufacturer() {
    if (!window.currentManufacturers) return;
    
    const manufacturers = window.currentManufacturers;
    const angleStep = Math.PI / 42;
    const totalArcSpan = (manufacturers.length - 1) * angleStep;
    const diagonalAngle = Math.PI * 1.25;
    const baseStartAngle = diagonalAngle - (totalArcSpan / 2);
    
    // Find which manufacturer should be centered based on current rotation
    let bestIndex = 0;
    let bestOffset = arcRotationOffset;
    let minDistanceFromCurrent = Infinity;
    
    manufacturers.forEach((manufacturer, index) => {
        // To center manufacturer at index i, we need the angle to equal diagonalAngle:
        // baseStartAngle + offset + (index * angleStep) = diagonalAngle
        // Therefore: offset = diagonalAngle - baseStartAngle - (index * angleStep)
        const targetOffset = diagonalAngle - baseStartAngle - (index * angleStep);
        
        const distanceFromCurrent = Math.abs(targetOffset - arcRotationOffset);
        
        if (distanceFromCurrent < minDistanceFromCurrent) {
            minDistanceFromCurrent = distanceFromCurrent;
            bestIndex = index;
            bestOffset = targetOffset;
        }
    });
    
    // Now check if this offset is within our calculated limits
    const limits = calculateRotationLimits();
    
    // If the best offset is outside limits, clamp it
    if (bestOffset < limits.min) {
        bestOffset = limits.min;
    } else if (bestOffset > limits.max) {
        bestOffset = limits.max;
    }
    
    console.log('Snapping to manufacturer:', manufacturers[bestIndex].key, 'with offset:', bestOffset * 180 / Math.PI + '°', 'limits:', limits);
    
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