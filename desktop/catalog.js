// Updated: October 22, 2025
const svg = document.getElementById('catalogSvg');
const mainGroup = document.getElementById('mainGroup');
const centralGroup = document.getElementById('centralGroup');
const marketsGroup = document.getElementById('markets');
const pathLinesGroup = document.getElementById('pathLines');
const manufacturersGroup = document.getElementById('manufacturers');
const cylindersGroup = document.getElementById('cylinders');
const modelsGroup = document.getElementById('models');
let activeType = null;
let activePath = []; // Track the active path (e.g., ['Europe & Asia', 'Finland', 'Sisu', '8', 's8'])
let data = null;
const modelAngles = {}; // Store initial model angles globally
const cylinderAngles = {}; // Store initial cylinder angles for consistent model rendering
const manufacturerAngles = {}; // Store manufacturer angles
const ns = "http://www.w3.org/2000/svg";
const HIT_PADDING = 5;
const UNSELECTED_RADIUS = 10;
const GAP = -30;

// Mock add to cart function
window.addToCart = function(model) {
    console.log('Added to cart:', model);
    alert(`Added ${model} to cart!`);
};

// Load JSON data
async function loadData() {
    try {
        const res = await fetch('./catalog.json');
        data = await res.json();
        console.log('Data loaded', data);
        // Render markets immediately with no delay/animation
        renderMarkets();
        // keep any other initialization here if needed
    } catch (error) {
        console.error('Failed to load data', error);
    }
}

// Render markets as images above central
function renderMarkets() {
    marketsGroup.innerHTML = '';
    if (!data || !data.MMdM || !data.MMdM.markets) return;
    const markets = Object.keys(data.MMdM.markets);
    const spacing = 520; // horizontal spacing between market buttons
    const yPos = -80;   // vertical position above center
    const startX = -((markets.length - 1) * spacing) / 2;

    markets.forEach((market, index) => {
        const x = startX + index * spacing;
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${x}, ${yPos})`);
        g.setAttribute('class', 'marketGroup');

        // Single image per market (place your single image files under ./assets/markets/)
        const img = document.createElementNS(ns, 'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `./assets/markets/${market}.png`);
        img.setAttribute('x', -180);
        img.setAttribute('y', -20);
        img.setAttribute('width', 315);
        img.setAttribute('height', 103);
        img.style.cursor = 'pointer';
        g.appendChild(img);


        // Insert into DOM
        // Update interaction handlers to keep markets visible
        g.addEventListener('mouseover', () => {
            // First remove all classes from all markets
            document.querySelectorAll('.marketGroup').forEach(group => {
                group.classList.remove('active', 'inactive');
                // Force a reflow to ensure transitions work
                void group.offsetWidth;
                group.classList.add('inactive');
            });
            
            // Then set active on current market
            g.classList.remove('inactive');
            // Force a reflow to ensure transitions work
            void g.offsetWidth;
            g.classList.add('active');
            
            activeType = 'market';
            activePath = [market];
            renderNextLevel('market', market, Math.PI / 2);
            renderPathLines();
        });

        g.addEventListener('mouseout', () => {
            // Only reset if not in active path
            if (!activePath.includes(market)) {
                g.classList.remove('active', 'inactive');
                // Force a reflow
                void g.offsetWidth;
            }
        });

        marketsGroup.appendChild(g);
    });
}

// Show model info in central with staged animation
function showModelInfo(modelFullKey) {
    const parts = modelFullKey.split('/');
    const market = parts[0], country = parts[1], manuf = parts[2], cyl = parts[3], model = parts[4];
    const engineObj = data.MMdM.markets[market].countries[country].manufacturers[manuf].cylinders[cyl].find(m => m.engine_model === model);
    if (!engineObj) return;

    const mmdmAlt = engineObj.manifold_alternatives.find(alt => alt.type === "mmdm");
    if (!mmdmAlt) return;

    const mmdmModel = mmdmAlt.part_number;
    const price = mmdmAlt.price;
    const description = mmdmAlt.description;

    // Remove any existing foreignObject
    const existingFo = centralGroup.querySelector('foreignObject');
    if (existingFo) existingFo.remove();

    // Get existing circle and logo
    const circle = centralGroup.querySelector('circle');
    const logo = centralGroup.querySelector('image');

    // Add stroke to circle if not present
    circle.setAttribute('stroke', 'black');
    circle.setAttribute('stroke-width', '2');

    // Get current values for animation start
    let startRadius = parseFloat(circle.getAttribute('r')) || 40;
    let startX = parseFloat(logo.getAttribute('x')) || -70;
    let startY = parseFloat(logo.getAttribute('y')) || -32;
    let startW = parseFloat(logo.getAttribute('width')) || 140;
    let startH = parseFloat(logo.getAttribute('height')) || 44;

    // Target values
    let endRadius = 150;
    let endX = -120;
    let endY = -200;
    let endW = 240;
    let endH = 75; // Approximate 240 * (126/400) ≈ 75.6

    let duration = 2000; // ms, slowed down for debugging
    let startTime = performance.now();

    console.log('Animation start');

    function animateGrowth(currentTime) {
        let elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);
        // Ease out quadratic
        progress = 1 - Math.pow(1 - progress, 2);
        console.log('Frame called, elapsed:', elapsed, 'progress:', progress);
        let currentRadius = startRadius + (endRadius - startRadius) * progress;
        let currentX = startX + (endX - startX) * progress;
        let currentY = startY + (endY - startY) * progress;
        let currentW = startW + (endW - startW) * progress;
        let currentH = startH + (endH - startH) * progress;
        circle.setAttribute('r', currentRadius);
        logo.setAttribute('x', currentX);
        logo.setAttribute('y', currentY);
        logo.setAttribute('width', currentW);
        logo.setAttribute('height', currentH);

        if (progress < 1) {
            requestAnimationFrame(animateGrowth);
        } else {
            console.log('Animation complete');
            // Stage 1 complete: Add foreignObject with text elements hidden
            const fo = document.createElementNS(ns, 'foreignObject');
            fo.setAttribute('x', '-150');
            fo.setAttribute('y', '-150');
            fo.setAttribute('width', '300');
            fo.setAttribute('height', '300');

            const containerDiv = document.createElement('div');
            containerDiv.style.cssText = 'font-size: 12px; padding: 80px 10px 10px 10px; overflow: auto; text-align: center; line-height: 1.2; cursor: pointer; color: #f2f2e6; position: relative; height: 100%;';

            // Description div
            const descDiv = document.createElement('div');
            descDiv.id = 'desc';
            descDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out;';
            descDiv.innerHTML = `MMdM: ${mmdmModel}<br>${description}`;
            containerDiv.appendChild(descDiv);

            // Price div
            const priceDiv = document.createElement('div');
            priceDiv.id = 'price';
            priceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
            priceDiv.innerHTML = `Price: $${price}`;
            containerDiv.appendChild(priceDiv);

            // Link div
            const linkDiv = document.createElement('div');
            linkDiv.id = 'link';
            linkDiv.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s ease-in-out;';
            linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart('${mmdmModel}'); return false;">Add to Cart</a>`;
            containerDiv.appendChild(linkDiv);

            fo.appendChild(containerDiv);
            centralGroup.appendChild(fo);

            // Stage in text elements with delays
            setTimeout(() => {
                descDiv.style.opacity = '1';
            }, 500);

            setTimeout(() => {
                priceDiv.style.opacity = '1';
            }, 1000);

            setTimeout(() => {
                linkDiv.style.opacity = '1';
            }, 1500);
        }
    }

    requestAnimationFrame(animateGrowth);
}

// Revert central to original
function revertCentral() {
    centralGroup.innerHTML = `
        <circle class="node" cx="0" cy="0" r="40" fill="#362e6a" id="mmdmNode" />
        <image href="./assets/catalog_logo.png" x="-70" y="-28" width="140" height="44" />
    `;
    document.getElementById('mmdmNode').addEventListener('click', () => {
        console.log('Resetting to MMdM view');
        resetView(true);
    });
}

// Check if a node is part of the active path
function isInActivePath(type, keyParts) {
    if (activePath.length === 0) return false;
    switch (type) {
        case 'manufacturer':
            if (activePath.length < 3) return false;
            return activePath[0] === keyParts[0] && activePath[1] === keyParts[1] && activePath[2] === keyParts[2];
        case 'cylinder':
            if (activePath.length < 4) return false;
            return activePath[0] === keyParts[0] && activePath[1] === keyParts[1] && activePath[2] === keyParts[2] && activePath[3] === keyParts[3];
        case 'model':
            if (activePath.length < 5) return false;
            return activePath[0] === keyParts[0] && activePath[1] === keyParts[1] && activePath[2] === keyParts[2] && activePath[3] === keyParts[3] && activePath[4] === keyParts[4];
        default:
            return false;
    }
}

// Render manufacturers for a specific market (375px ring)
function renderManufacturers(market, selectedManufacturerKey = null) {
    console.log('Rendering manufacturers for market', market, 'selected:', selectedManufacturerKey);
    manufacturersGroup.innerHTML = '';
    const countries = data.MMdM.markets[market].countries;
    const allManufacturers = [];
    Object.keys(countries).forEach(country => {
        Object.keys(countries[country].manufacturers).forEach(manufacturer => {
            allManufacturers.push({ name: manufacturer, country: country, market: market });
        });
    });
    // Sort alphabetically by manufacturer name Z to A
    allManufacturers.sort((a, b) => b.name.localeCompare(a.name));
    const angleSpread = Math.PI / 42; // ~4.29 degrees in radians
    const centerAngle = Math.PI / 2;
    allManufacturers.forEach((item, index) => {
        const manufacturer = item.name;
        const country = item.country;
        const manufacturerKey = `${market}/${country}/${manufacturer}`;
        const keyParts = [market, country, manufacturer];
        const isSelected = selectedManufacturerKey === manufacturerKey;
        const radius = 375; // Fixed 375px for position
        const angle = centerAngle + (index - (allManufacturers.length - 1) / 2) * angleSpread;
        manufacturerAngles[manufacturerKey] = angle; // Store angle
        const r = isSelected ? 18 : 10;
        const offset = - (r + 5);
        const textX = offset * Math.cos(angle);
        const textY = offset * Math.sin(angle);
        let rotation = angle * 180 / Math.PI;
        let textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
        let dy = '0.3em';
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        const g = document.createElementNS(ns, 'g');
        g.classList.add('manufacturer');
        g.setAttribute('transform', `translate(${radius * Math.cos(angle)}, ${radius * Math.sin(angle)})`);
        g.innerHTML = `
            <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('manufacturer', manufacturer)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
            <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black">${manufacturer}</text>
        `;
        const hitCircle = document.createElementNS(ns, 'circle');
        hitCircle.setAttribute('cx', '0');
        hitCircle.setAttribute('cy', '0');
        hitCircle.setAttribute('r', (r + HIT_PADDING).toString());
        hitCircle.setAttribute('fill', 'transparent');
        hitCircle.setAttribute('stroke', 'none');
        g.appendChild(hitCircle);
        manufacturersGroup.appendChild(g);
        addHitListeners(hitCircle, g, 'manufacturer', manufacturerKey, angle, isSelected);
    });
}

// Get manufacturer angle for a specific manufacturer
function getManufacturerAngle(market, country, manufacturer) {
    const manufacturerKey = `${market}/${country}/${manufacturer}`;
    return manufacturerAngles[manufacturerKey] || Math.PI / 2; // Fallback
}

// Render cylinder nodes (280px ring)
function renderCylinders(market, country, manufacturer, manufacturerAngle, selectedCylinder = null) {
    console.log('Rendering cylinders for', market, country, manufacturer, 'selected:', selectedCylinder);
    cylindersGroup.innerHTML = '';
    const cylinders = data.MMdM.markets[market].countries[country].manufacturers[manufacturer]?.cylinders;
    if (!cylinders) {
        console.error(`No cylinders found for ${manufacturer} in ${country}, ${market}`);
        return;
    }
    const cylinderKeys = Object.keys(cylinders).sort((a, b) => parseInt(a) - parseInt(b));
    const angleSpread = cylinderKeys.length > 1 ? Math.PI / 18 : 0; // 10° spread for multiple nodes
    cylinderKeys.forEach((cylinder, index) => {
        const keyParts = [market, country, manufacturer, cylinder];
        const isSelected = isInActivePath('cylinder', keyParts);
        const radius = 280; // Fixed 280px for position
        const angle = manufacturerAngle + (index - (cylinderKeys.length - 1) / 2) * angleSpread;
        const r = isSelected ? 18 : 10;
        const textX = 0;
        const textY = 0;
        let rotation = angle * 180 / Math.PI;
        let textAnchor = 'middle';
        let dy = '0.3em';
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        const cylinderKey = `${market}/${country}/${manufacturer}/${cylinder}`;
        if (cylinderAngles[cylinderKey] === undefined) {
            cylinderAngles[cylinderKey] = angle; // Store initial cylinder angle
        }
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const g = document.createElementNS(ns, 'g');
        g.classList.add('cylinder');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        g.setAttribute('data-angle', angle.toString());
        g.innerHTML = `
            <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('cylinder', cylinder)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
            <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black">${isSelected ? `${cylinder} cyl` : cylinder}</text>
        `;
        const hitCircle = document.createElementNS(ns, 'circle');
        hitCircle.setAttribute('cx', '0');
        hitCircle.setAttribute('cy', '0');
        hitCircle.setAttribute('r', (r + HIT_PADDING).toString());
        hitCircle.setAttribute('fill', 'transparent');
        hitCircle.setAttribute('stroke', 'none');
        g.appendChild(hitCircle);
        cylindersGroup.appendChild(g);
        addHitListeners(hitCircle, g, 'cylinder', cylinderKey, angle, isSelected);
    });
}

// Render model nodes (180px ring)
function renderModels(market, country, manufacturer, cylinder, cylinderAngle, selectedModel = null) {
    console.log('Rendering models for', market, country, manufacturer, cylinder, 'selected:', selectedModel);
    modelsGroup.innerHTML = '';
    const models = data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder];
    if (!models) {
        console.error(`No models found for ${cylinder} in ${manufacturer}, ${country}, ${market}`);
        return;
    }
    const angleSpread = models.length > 1 ? Math.PI / 18 : 0; // 10° spread for multiple nodes
    models.forEach((model, index) => {
        const modelName = model.engine_model;
        const keyParts = [market, country, manufacturer, cylinder, modelName];
        const isSelected = isInActivePath('model', keyParts);
        const radius = 180; // Fixed 180px for position
        const modelKey = `${market}/${country}/${manufacturer}/${cylinder}/${modelName}`;
        // Use stored angle if available, otherwise calculate and store
        let angle;
        if (modelAngles[modelKey] !== undefined) {
            angle = modelAngles[modelKey];
        } else {
            angle = cylinderAngle + (index - (models.length - 1) / 2) * angleSpread;
            modelAngles[modelKey] = angle; // Store initial angle
        }
        const r = isSelected ? 18 : 10;
        const offset = r + 5;
        const textX = offset * Math.cos(angle);
        const textY = offset * Math.sin(angle);
        let rotation = angle * 180 / Math.PI;
        let textAnchor = Math.cos(angle) >= 0 ? 'end' : 'start';
        let dy = '0.3em';
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const g = document.createElementNS(ns, 'g');
        g.classList.add('model');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        g.setAttribute('data-model', modelName);
        g.setAttribute('data-angle', angle.toString());
        g.innerHTML = `
            <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('model', modelName)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
            <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black">${modelName}</text>
        `;
        const hitCircle = document.createElementNS(ns, 'circle');
        hitCircle.setAttribute('cx', '0');
        hitCircle.setAttribute('cy', '0');
        hitCircle.setAttribute('r', (r + HIT_PADDING).toString());
        hitCircle.setAttribute('fill', 'transparent');
        hitCircle.setAttribute('stroke', 'none');
        g.appendChild(hitCircle);
        modelsGroup.appendChild(g);
        addHitListeners(hitCircle, g, 'model', modelKey, angle, isSelected);
    });
}

// Function to render path lines
function renderPathLines() {
    pathLinesGroup.innerHTML = '';
    if (activePath.length < 3) return;

    let prevX, prevY;

    // Manufacturer position (always to center)
    if (activePath.length >= 3) {
        const manufacturerKey = `${activePath[0]}/${activePath[1]}/${activePath[2]}`;
        const manAngle = getManufacturerAngle(activePath[0], activePath[1], activePath[2]);
        const manRadius = 375;
        prevX = manRadius * Math.cos(manAngle);
        prevY = manRadius * Math.sin(manAngle);
    }

    // Line from manufacturer to cylinder (to center if selected)
    if (activePath.length >= 4) {
        const cylinderAngle = cylinderAngles[`${activePath[0]}/${activePath[1]}/${activePath[2]}/${activePath[3]}`] || getCylinderAngle(activePath[0], activePath[1], activePath[2], activePath[3], getManufacturerAngle(activePath[0], activePath[1], activePath[2]));
        const cylRadius = 280;
        const cylX = cylRadius * Math.cos(cylinderAngle);
        const cylY = cylRadius * Math.sin(cylinderAngle);
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', prevX.toString());
        line.setAttribute('y1', prevY.toString());
        line.setAttribute('x2', cylX.toString());
        line.setAttribute('y2', cylY.toString());
        line.setAttribute('stroke', 'black');
        line.setAttribute('stroke-width', '1');
        pathLinesGroup.appendChild(line);
        prevX = cylX;
        prevY = cylY;
    }

    // Line from cylinder to model (to center if selected)
    if (activePath.length >= 5) {
        const modelKey = `${activePath[0]}/${activePath[1]}/${activePath[2]}/${activePath[3]}/${activePath[4]}`;
        const modelAngle = modelAngles[modelKey] || getModelAngle(activePath[0], activePath[1], activePath[2], activePath[3], activePath[4], cylinderAngles[`${activePath[0]}/${activePath[1]}/${activePath[2]}/${activePath[3]}`] || getCylinderAngle(activePath[0], activePath[1], activePath[2], activePath[3], getManufacturerAngle(activePath[0], activePath[1], activePath[2])));
        const modelRadius = 180;
        const modelX = modelRadius * Math.cos(modelAngle);
        const modelY = modelRadius * Math.sin(modelAngle);
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', prevX.toString());
        line.setAttribute('y1', prevY.toString());
        line.setAttribute('x2', modelX.toString());
        line.setAttribute('y2', modelY.toString());
        line.setAttribute('stroke', 'black');
        line.setAttribute('stroke-width', '1');
        pathLinesGroup.appendChild(line);
    }

    // Fan lines to children at the deepest level (to before edge of unselected nodes)
    if (activePath.length === 3) {
        // Fan from manufacturer to all cylinders
        const market = activePath[0];
        const country = activePath[1];
        const manufacturer = activePath[2];
        const manAngle = getManufacturerAngle(market, country, manufacturer);
        const cylinders = Object.keys(data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders || {}).sort((a, b) => parseInt(a) - parseInt(b));
        const cylRingRadius = 280;
        cylinders.forEach((cylinder) => {
            const cylinderAngle = getCylinderAngle(market, country, manufacturer, cylinder, manAngle);
            const cylX = cylRingRadius * Math.cos(cylinderAngle);
            const cylY = cylRingRadius * Math.sin(cylinderAngle);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', prevX.toString());
            line.setAttribute('y1', prevY.toString());
            line.setAttribute('x2', cylX.toString());
            line.setAttribute('y2', cylY.toString());
            line.setAttribute('stroke', 'black');
            line.setAttribute('stroke-width', '1');
            pathLinesGroup.appendChild(line);
        });
    } 
    if (activePath.length === 4) {
        // Fan from cylinder to all models
        const market = activePath[0];
        const country = activePath[1];
        const manufacturer = activePath[2];
        const cylinder = activePath[3];
        const cylAngle = cylinderAngles[`${market}/${country}/${manufacturer}/${cylinder}`] || getCylinderAngle(market, country, manufacturer, cylinder, getManufacturerAngle(market, country, manufacturer));
        const modelsData = data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder];
        if (modelsData && modelsData.length > 0) {
            const angleSpread = modelsData.length > 1 ? Math.PI / 18 : 0;
            const modelRingRadius = 180;
            modelsData.forEach((modelObj, index) => {
                const modelAngle = cylAngle + (index - (modelsData.length - 1) / 2) * angleSpread;
                const modelX = modelRingRadius * Math.cos(modelAngle);
                const modelY = modelRingRadius * Math.sin(modelAngle);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', prevX.toString());
                line.setAttribute('y1', prevY.toString());
                line.setAttribute('x2', modelX.toString());
                line.setAttribute('y2', modelY.toString());
                line.setAttribute('stroke', 'black');
                line.setAttribute('stroke-width', '1');
                pathLinesGroup.appendChild(line);
            });
        }
    }
}

// Add event listeners to hit circle only
function addHitListeners(hitCircle, nodeGroup, type, name, angle, isSelected) {
    hitCircle.addEventListener('mouseover', () => {
        const keyParts = name.split('/');
        if (activeType === type && isInActivePath(type, keyParts)) {
            console.log(`Node ${type}: ${name} already active, skipping`);
            return;
        }
        console.log(`Activating ${type}: ${name} at angle ${angle}`);
        if (activeType === 'model') {
            revertCentral();
        }
        activeType = type;
        activePath = keyParts; // Update active path
        resetView(false);
        renderNextLevel(type, name, angle);
        renderPathLines();
        if (type === 'model') {
            showModelInfo(name);
        }
    });
}

// Render next level based on current node
function renderNextLevel(type, name, angle) {
    console.log(`Rendering next level for ${type}: ${name}`);
    const parts = name.split('/');
    
    // First, hide all rings except markets
    cylindersGroup.classList.add('hidden');
    modelsGroup.classList.add('hidden');
    
    if (type === 'market') {
        const market = parts[0];
        manufacturersGroup.classList.remove('hidden');
        console.log('Showing manufacturers group');
        renderManufacturers(market);
        // Clear other rings
        cylindersGroup.innerHTML = '';
        modelsGroup.innerHTML = '';
    } else if (type === 'manufacturer') {
        const market = parts[0];
        const country = parts[1];
        const manufacturer = parts[2];
        const manufacturerAngle = angle;
        cylindersGroup.classList.remove('hidden');
        console.log('Showing cylinders group');
        renderManufacturers(market, name);
        renderCylinders(market, country, manufacturer, manufacturerAngle);
    } else if (type === 'cylinder') {
        const market = parts[0];
        const country = parts[1];
        const manufacturer = parts[2];
        const cylinder = parts[3];
        cylindersGroup.classList.remove('hidden');
        modelsGroup.classList.remove('hidden');
        console.log('Showing models group');
        const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
        renderManufacturers(market, `${market}/${country}/${manufacturer}`);
        renderCylinders(market, country, manufacturer, manufacturerAngle, cylinder);
        // Use stored cylinder angle for consistency
        const cylinderKey = name;
        const storedCylinderAngle = cylinderAngles[cylinderKey] || angle;
        renderModels(market, country, manufacturer, cylinder, storedCylinderAngle);
    } else if (type === 'model') {
        const market = parts[0];
        const country = parts[1];
        const manufacturer = parts[2];
        const cylinder = parts[3];
        const model = parts[4];
        cylindersGroup.classList.remove('hidden');
        modelsGroup.classList.remove('hidden');
        console.log('Showing model selected');
        const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
        renderManufacturers(market, `${market}/${country}/${manufacturer}`);
        renderCylinders(market, country, manufacturer, manufacturerAngle, cylinder);
        const cylinderKey = `${market}/${country}/${manufacturer}/${cylinder}`;
        const storedCylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(market, country, manufacturer, cylinder, manufacturerAngle);
        // Use stored model angle
        const modelKey = name;
        const modelAngle = modelAngles[modelKey] || angle;
        renderModels(market, country, manufacturer, cylinder, storedCylinderAngle, model);
    }
}

// Helper functions to calculate angles
function getCylinderAngle(market, country, manufacturer, cylinder, manufacturerAngle) {
    const cylinders = Object.keys(data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders).sort((a, b) => parseInt(a) - parseInt(b));
    const index = cylinders.indexOf(cylinder);
    const angleSpread = cylinders.length > 1 ? Math.PI / 18 : 0;
    return manufacturerAngle + (index - (cylinders.length - 1) / 2) * angleSpread;
}

// Reset view to MMdM
function resetView(clearActive = true) {
    console.log('Resetting view, clearActive:', clearActive);
    mainGroup.setAttribute('transform', 'translate(500, 325)');
    pathLinesGroup.innerHTML = '';
    manufacturersGroup.innerHTML = '';
    cylindersGroup.innerHTML = '';
    modelsGroup.innerHTML = '';
    cylindersGroup.classList.add('hidden');
    modelsGroup.classList.add('hidden');
    if (clearActive) {
        activeType = null;
        activePath = [];
        marketsGroup.classList.remove('hidden');
        manufacturersGroup.classList.add('hidden');
        renderMarkets();
    } else {
        // For non-clear, assume next level is handled in renderNextLevel
    }
}

// Helper to approximate model angle if needed
function getModelAngle(market, country, manufacturer, cylinder, selectedModel, cylinderAngle) {
    const models = data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder];
    const index = models.findIndex(m => m.engine_model === selectedModel);
    const angleSpread = models.length > 1 ? Math.PI / 18 : 0;
    return cylinderAngle + (index - (models.length - 1) / 2) * angleSpread;
}

// Color function for hierarchy levels
function getColor(type, name) {
    switch (type) {
        case 'oem-manifold':
            return 'steelblue';
        case 'mmdm-manifold':
            return 'limegreen';
        default:
            return '#f1b800';
    }
}

// Add reset on MMdM click (initial setup)
revertCentral(); // Ensures listener is added

// Handle mouseout with delay
let timeout;
svg.addEventListener('mouseout', (e) => {
    if (!svg.contains(e.relatedTarget)) {
        console.log('Mouseout triggered');
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            console.log('Mouseout reset executed');
            if (activeType === 'model') {
                revertCentral();
            }
            resetView(true);
        }, 300);
    }
});
svg.addEventListener('mouseover', () => {
    console.log('Mouseover SVG, clearing timeout');
    clearTimeout(timeout);
});

// Initialize
console.log('Initializing visualization');
loadData();