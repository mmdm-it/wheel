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
        { x: 150, y: -150 }, // upper-right
        { x: -150, y: 150 }  // lower-left
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
        
        // Smaller images for mobile
        img.setAttribute('x', -60);
        img.setAttribute('y', -20);
        img.setAttribute('width', 120);
        img.setAttribute('height', 40);
        img.style.cursor = 'pointer';
        g.appendChild(img);

        // Larger hit area for touch
        const hitArea = document.createElementNS(ns, 'rect');
        hitArea.setAttribute('class', 'marketHitArea');
        hitArea.setAttribute('x', -60);
        hitArea.setAttribute('y', -20);
        hitArea.setAttribute('width', 120);
        hitArea.setAttribute('height', 40);
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
    
    // Store manufacturers for rotation
    window.currentManufacturers = manufacturers;
    window.currentMarket = market;
    
    // Reset rotation offset
    arcRotationOffset = 0;
    
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
    
    console.log('Updating manufacturer positions with rotation offset:', arcRotationOffset);
    
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
    
    // Update active path with centermost manufacturer
    if (centerMostIndex >= 0) {
        const selectedManufacturer = manufacturers[centerMostIndex];
        activePath = [window.currentMarket, selectedManufacturer.country, selectedManufacturer.key];
        activeType = 'manufacturer';
        console.log('Mobile: Center manufacturer:', selectedManufacturer.key);
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
    
    // Calculate movement along the arc (horizontal movement primarily)
    const deltaX = currentX - lastTouchX;
    
    console.log('Delta X:', deltaX);
    
    // Convert horizontal movement to rotation
    const rotationDelta = deltaX * ROTATION_SENSITIVITY;
    arcRotationOffset += rotationDelta;
    
    console.log('New rotation offset:', arcRotationOffset);
    
    // Store velocity for momentum
    rotationVelocity = rotationDelta;
    
    // Update positions
    updateManufacturerPositions();
    
    // Update last touch position
    lastTouchX = currentX;
    lastTouchY = currentY;
}

// Handle touch end for rotation
function handleTouchEnd(e) {
    console.log('Touch end, was dragging:', isDragging);
    e.preventDefault();
    
    if (!isDragging) return;
    
    isDragging = false;
    
    // Start momentum animation if there's significant velocity
    if (Math.abs(rotationVelocity) > MIN_VELOCITY) {
        console.log('Starting momentum animation with velocity:', rotationVelocity);
        startMomentumAnimation();
    } else {
        console.log('No momentum, snapping to nearest');
        // Snap to nearest manufacturer
        snapToNearestManufacturer();
    }
}

// Momentum animation for smooth coasting
function startMomentumAnimation() {
    function animate() {
        if (Math.abs(rotationVelocity) < MIN_VELOCITY) {
            snapToNearestManufacturer();
            return;
        }
        
        arcRotationOffset += rotationVelocity;
        rotationVelocity *= DECELERATION;
        
        updateManufacturerPositions();
        
        animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
}

// Snap to the nearest manufacturer position
function snapToNearestManufacturer() {
    if (!window.currentManufacturers) return;
    
    const manufacturers = window.currentManufacturers;
    const angleStep = Math.PI / 42;
    const totalArcSpan = (manufacturers.length - 1) * angleStep;
    const diagonalAngle = Math.PI * 1.25;
    const baseStartAngle = diagonalAngle - (totalArcSpan / 2);
    
    // Find the manufacturer that should be closest to center
    let bestIndex = 0;
    let bestOffset = arcRotationOffset;
    let minDistance = Infinity;
    
    manufacturers.forEach((manufacturer, index) => {
        const targetAngle = baseStartAngle + (index * angleStep);
        const targetOffset = targetAngle - (baseStartAngle + arcRotationOffset);
        
        // Calculate what offset would center this manufacturer
        const desiredOffset = arcRotationOffset - targetOffset;
        
        // Calculate distance this manufacturer would be from center with this offset
        const testAngle = baseStartAngle + desiredOffset + (index * angleStep);
        const arcX = Math.cos(testAngle) * 500;
        const arcY = Math.sin(testAngle) * 500;
        const x = arcX - (window.innerWidth * -0.8);
        const y = arcY - 250;
        const distance = Math.sqrt(x * x + y * y);
        
        if (distance < minDistance) {
            minDistance = distance;
            bestIndex = index;
            bestOffset = desiredOffset;
        }
    });
    
    // Animate to the best position
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