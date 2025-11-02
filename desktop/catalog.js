// Updated: October 26, 2025
const svg = document.getElementById('catalogSvg');
const mainGroup = document.getElementById('mainGroup');
const centralGroup = document.getElementById('centralGroup');
const marketsGroup = document.getElementById('markets');
const pathLinesGroup = document.getElementById('pathLines');
const focusRingGroup = document.getElementById('focusRing');
const childRingGroup = document.getElementById('childRing');
const modelsGroup = document.getElementById('models');
let activeType = null;
let activePath = []; // Track the active path (e.g., ['eurasia', 'Italy', 'VM Motori', '4', '3054'])
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

let selectedMarket = null; // lock selected market until reset

// Load JSON data
async function loadData() {
    try {
        const res = await fetch('./catalog.json');
        data = await res.json();
        console.log('Data loaded', data);
        renderMarkets();
    } catch (error) {
        console.error('Failed to load data', error);
    }
}

// Render markets as images above central
function renderMarkets() {
    marketsGroup.innerHTML = '';
    if (!data || !data.MMdM || !data.MMdM.markets) return;
    const markets = Object.keys(data.MMdM.markets);
    const spacing = 570;
    const yPos = -80;
    const startX = -((markets.length - 1) * spacing) / 2;

    markets.forEach((market, index) => {
        const x = startX + index * spacing;
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${x}, ${yPos})`);
        g.setAttribute('class', 'marketGroup');

        const img = document.createElementNS(ns, 'image');
        const url = `./assets/markets/${market}.png`;

        // Set both href forms for broad browser support
        img.setAttribute('href', url);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);

        img.setAttribute('x', -178);
        img.setAttribute('y', -20);
        img.setAttribute('width', 315);
        img.setAttribute('height', 103);
        img.style.cursor = 'pointer';
        g.appendChild(img);

        // Add hit area - full size initially, will be reduced when inactive
        const hitArea = document.createElementNS(ns, 'rect');
        hitArea.setAttribute('class', 'marketHitArea');
        hitArea.setAttribute('x', -178);
        hitArea.setAttribute('y', -20);
        hitArea.setAttribute('width', 315);
        hitArea.setAttribute('height', 103);
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'pointer';
        g.appendChild(hitArea);

        hitArea.addEventListener('mouseover', () => {
            // Reset visuals
            document.querySelectorAll('.marketGroup').forEach(group => {
                // If a market is locked, don't clear its classes
                if (!selectedMarket) group.classList.remove('active', 'inactive');

                const rect = group.querySelector('.marketHitArea');
                // reset full-size and corners
                rect.setAttribute('x', -178);
                rect.setAttribute('y', -20);
                rect.setAttribute('width', 315);
                rect.setAttribute('height', 103);
                rect.removeAttribute('rx');
                rect.removeAttribute('ry');
            });

            // Apply inactive visuals to others
            document.querySelectorAll('.marketGroup').forEach(group => {
                if (group !== g) {
                    if (!selectedMarket) group.classList.add('inactive');
                    // Center 50px circle over the image center
                    const rect = group.querySelector('.marketHitArea');
                    const cx = -178 + 315 / 2;
                    const cy = -20 + 103 / 2;
                    rect.setAttribute('x', (cx - 25));
                    rect.setAttribute('y', (cy - 25));
                    rect.setAttribute('width', 50);
                    rect.setAttribute('height', 50);
                    rect.setAttribute('rx', 25);
                    rect.setAttribute('ry', 25);
                }
            });

            if (!selectedMarket) g.classList.add('active');
        });

        // Lock selection on click (persists until resetView(true) or reload)
        hitArea.addEventListener('click', () => {
            if (selectedMarket === market) return;
            selectedMarket = market;

            document.querySelectorAll('.marketGroup').forEach(group => {
                group.classList.toggle('active', group === g);
                group.classList.toggle('inactive', group !== g);

                const rect = group.querySelector('.marketHitArea');
                if (group !== g) {
                    const cx = -178 + 315 / 2;
                    const cy = -20 + 103 / 2;
                    rect.setAttribute('x', (cx - 25));
                    rect.setAttribute('y', (cy - 25));
                    rect.setAttribute('width', 50);
                    rect.setAttribute('height', 50);
                    rect.setAttribute('rx', 25);
                    rect.setAttribute('ry', 25);
                } else {
                    rect.setAttribute('x', -178);
                    rect.setAttribute('y', -20);
                    rect.setAttribute('width', 315);
                    rect.setAttribute('height', 103);
                    rect.removeAttribute('rx');
                    rect.removeAttribute('ry');
                }
            });

            activeType = 'market';
            activePath = [market];
            renderNextLevel('market', market, Math.PI / 2);
            renderPathLines();
        });

        // Only clear hover classes if no locked selection
        hitArea.addEventListener('mouseout', () => {
            if (!selectedMarket) {
                g.classList.remove('active', 'inactive');
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
    
    if (!engineObj) {
        console.error('Engine not found:', modelFullKey);
        return;
    }

    // Check if manifold_alternatives exists
    if (!engineObj.manifold_alternatives || engineObj.manifold_alternatives.length === 0) {
        console.error('No manifold alternatives for:', modelFullKey);
        // Show basic info without pricing
        showBasicModelInfo(model, engineObj);
        return;
    }

    const mmdmAlt = engineObj.manifold_alternatives.find(alt => alt.type === "mmdm");
    if (!mmdmAlt) {
        console.error('No MMDM alternative for:', modelFullKey);
        showBasicModelInfo(model, engineObj);
        return;
    }

    const mmdmModel = mmdmAlt.part_number;
    const price = mmdmAlt.price;
    const description = mmdmAlt.description;

    const existingFo = centralGroup.querySelector('foreignObject');
    if (existingFo) existingFo.remove();

    const circle = centralGroup.querySelector('circle');
    const logo = centralGroup.querySelector('image');

    circle.setAttribute('stroke', 'black');
    circle.setAttribute('stroke-width', '2');

    let startRadius = parseFloat(circle.getAttribute('r')) || 40;
    let startX = parseFloat(logo.getAttribute('x')) || -70;
    let startY = parseFloat(logo.getAttribute('y')) || -28;
    let startW = parseFloat(logo.getAttribute('width')) || 140;
    let startH = parseFloat(logo.getAttribute('height')) || 44;

    let endRadius = 150;
    let endX = -120;
    let endY = -180;
    let endW = 240;
    let endH = 75;

    let duration = 500;
    let startTime = performance.now();

    function animateGrowth(currentTime) {
        let elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);
        progress = 1 - Math.pow(1 - progress, 2);
        
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
            const fo = document.createElementNS(ns, 'foreignObject');
            fo.setAttribute('x', '-150');
            fo.setAttribute('y', '-150');
            fo.setAttribute('width', '300');
            fo.setAttribute('height', '300');

            const containerDiv = document.createElement('div');
            containerDiv.style.cssText = 'font-size: 12px; padding: 80px 10px 10px 10px; overflow: auto; text-align: center; line-height: 1.2; cursor: pointer; color: #f2f2e6; position: relative; height: 100%;';

            const descDiv = document.createElement('div');
            descDiv.id = 'desc';
            descDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out;';
            descDiv.innerHTML = `MMdM: ${mmdmModel}<br>${description}`;
            containerDiv.appendChild(descDiv);

            const priceDiv = document.createElement('div');
            priceDiv.id = 'price';
            priceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
            priceDiv.innerHTML = `Price: $${price}`;
            containerDiv.appendChild(priceDiv);

            const linkDiv = document.createElement('div');
            linkDiv.id = 'link';
            linkDiv.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s ease-in-out;';
            linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart('${mmdmModel}'); return false;">Add to Cart</a>`;
            containerDiv.appendChild(linkDiv);

            fo.appendChild(containerDiv);
            centralGroup.appendChild(fo);

            setTimeout(() => { descDiv.style.opacity = '1'; }, 500);
            setTimeout(() => { priceDiv.style.opacity = '1'; }, 1000);
            setTimeout(() => { linkDiv.style.opacity = '1'; }, 1500);
        }
    }

    requestAnimationFrame(animateGrowth);
}

// Show basic model info when no pricing available
function showBasicModelInfo(model, engineObj) {
    const existingFo = centralGroup.querySelector('foreignObject');
    if (existingFo) existingFo.remove();

    const circle = centralGroup.querySelector('circle');
    const logo = centralGroup.querySelector('image');

    circle.setAttribute('r', '150');
    circle.setAttribute('stroke', 'black');
    circle.setAttribute('stroke-width', '2');
    logo.setAttribute('x', '-120');
    logo.setAttribute('y', '-180');
    logo.setAttribute('width', '240');
    logo.setAttribute('height', '75');

    const fo = document.createElementNS(ns, 'foreignObject');
    fo.setAttribute('x', '-150');
    fo.setAttribute('y', '-150');
    fo.setAttribute('width', '300');
    fo.setAttribute('height', '300');

    const containerDiv = document.createElement('div');
    containerDiv.style.cssText = 'font-size: 12px; padding: 80px 10px 10px 10px; overflow: auto; text-align: center; line-height: 1.2; color: #f2f2e6;';
    containerDiv.innerHTML = `Engine Model: ${model}<br><br>Contact us for availability`;

    fo.appendChild(containerDiv);
    centralGroup.appendChild(fo);
}

// Revert central to original
function revertCentral() {
    const existingFo = centralGroup.querySelector('foreignObject');
    if (existingFo) existingFo.remove();

    centralGroup.innerHTML = `
        <circle class="node" cx="0" cy="0" r="40" fill="#362e6a" id="mmdmNode" />
        <image href="./assets/catalog_logo.png" x="-70" y="-28" width="140" height="44" />
    `;
    const centerImg = centralGroup.querySelector('image');
    centerImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', './assets/catalog_logo.png');
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

// Render focus ring items for a specific market (375px ring)
function renderFocusRing(market, selectedFocusKey = null) {
    console.log('Rendering focus ring for market', market, 'selected:', selectedFocusKey);
    focusRingGroup.innerHTML = '';
    const countries = data.MMdM.markets[market].countries;
    const allManufacturers = [];
    Object.keys(countries).forEach(country => {
        Object.keys(countries[country].manufacturers).forEach(manufacturer => {
            allManufacturers.push({ name: manufacturer, country: country, market: market });
        });
    });
    allManufacturers.sort((a, b) => b.name.localeCompare(a.name));
    
    // Only animate sweep when selecting market (no selected manufacturer)
    const shouldAnimate = selectedManufacturerKey === null;
    const sweepDuration = 1000; // 1 second total
    const delayPerNode = shouldAnimate ? sweepDuration / allManufacturers.length : 0;
    
    const angleSpread = Math.PI / 42;
    const centerAngle = Math.PI / 2;
    
    allManufacturers.forEach((item, index) => {
        const manufacturer = item.name;
        const country = item.country;
        const manufacturerKey = `${market}/${country}/${manufacturer}`;
        const isSelected = selectedManufacturerKey === manufacturerKey;
        const radius = 375;
        const angle = centerAngle + (index - (allManufacturers.length - 1) / 2) * angleSpread;
        manufacturerAngles[manufacturerKey] = angle;
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
        
        if (shouldAnimate) {
            // Determine sweep order: Eurasia sweeps left to right (A-Z), Americhe right to left (Z-A)
            let sweepIndex;
            if (market === 'eurasia') {
                // Left to right (reverse of sorted array which is Z-A)
                sweepIndex = allManufacturers.length - 1 - index;
            } else {
                // Right to left (same as sorted array Z-A)
                sweepIndex = index;
            }
            
            // Initially hidden
            g.style.opacity = '0';
            
            // Animate in with delay - instant pop
            setTimeout(() => {
                g.style.opacity = '1';
            }, sweepIndex * delayPerNode);
        }
        
        focusRingGroup.appendChild(g);
        addHitListeners(hitCircle, g, 'manufacturer', manufacturerKey, angle, isSelected);
    });
}

// Get manufacturer angle for a specific manufacturer
function getManufacturerAngle(market, country, manufacturer) {
    const manufacturerKey = `${market}/${country}/${manufacturer}`;
    return manufacturerAngles[manufacturerKey] || Math.PI / 2;
}

// Render child ring nodes (280px ring)
function renderChildRing(market, country, manufacturer, manufacturerAngle, selectedChild = null) {
    console.log('Rendering child ring for', market, country, manufacturer, 'selected:', selectedChild);
    childRingGroup.innerHTML = '';
    const cylinders = data.MMdM.markets[market].countries[country].manufacturers[manufacturer]?.cylinders;
    if (!cylinders) {
        console.error(`No cylinders found for ${manufacturer} in ${country}, ${market}`);
        return;
    }
    const cylinderKeys = Object.keys(cylinders).sort((a, b) => parseInt(a) - parseInt(b));
    const angleSpread = cylinderKeys.length > 1 ? Math.PI / 18 : 0;
    cylinderKeys.forEach((cylinder, index) => {
        const keyParts = [market, country, manufacturer, cylinder];
        const isSelected = isInActivePath('cylinder', keyParts);
        const radius = 280;
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
            cylinderAngles[cylinderKey] = angle;
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
        childRingGroup.appendChild(g);
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
    const angleSpread = models.length > 1 ? Math.PI / 18 : 0;
    models.forEach((model, index) => {
        const modelName = model.engine_model;
        const keyParts = [market, country, manufacturer, cylinder, modelName];
        const isSelected = isInActivePath('model', keyParts);
        const radius = 180;
        const modelKey = `${market}/${country}/${manufacturer}/${cylinder}/${modelName}`;
        let angle;
        if (modelAngles[modelKey] !== undefined) {
            angle = modelAngles[modelKey];
        } else {
            angle = cylinderAngle + (index - (models.length - 1) / 2) * angleSpread;
            modelAngles[modelKey] = angle;
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

    if (activePath.length >= 3) {
        const manufacturerKey = `${activePath[0]}/${activePath[1]}/${activePath[2]}`;
        const manAngle = getManufacturerAngle(activePath[0], activePath[1], activePath[2]);
        const manRadius = 375;
        prevX = manRadius * Math.cos(manAngle);
        prevY = manRadius * Math.sin(manAngle);
    }

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

    if (activePath.length === 3) {
        const market = activePath[0];
        const country = activePath[1];
        const manufacturer = activePath[2];
        const manAngle = getManufacturerAngle(market, country, manufacturer);
        const cylinders = Object.keys(data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders || {}).sort((a, b) => {
            const na = Number(a), nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
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
    } else if (activePath.length === 4) {
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
        activePath = keyParts;
        resetView(false);
        renderNextLevel(type, name, angle);
        renderPathLines();
        if (type === 'model') {
            showModelInfo(name);
        }
    });
}

// Render next level based on current node - FIXED
function renderNextLevel(type, name, angle) {
    if (type === 'market') {
        focusRingGroup.classList.remove('hidden');
        childRingGroup.classList.add('hidden');
        modelsGroup.classList.add('hidden');
        renderFocusRing(name, null);
        return;
    }

    if (type === 'manufacturer') {
        const parts = name.split('/');
        focusRingGroup.classList.remove('hidden');
        childRingGroup.classList.remove('hidden');
        modelsGroup.classList.add('hidden');
        renderFocusRing(parts[0], name);
        renderChildRing(parts[0], parts[1], parts[2], angle, null);
        return;
    }

    if (type === 'cylinder') {
        const parts = name.split('/');
        focusRingGroup.classList.remove('hidden');
        childRingGroup.classList.remove('hidden');
        modelsGroup.classList.remove('hidden');
        renderFocusRing(parts[0], `${parts[0]}/${parts[1]}/${parts[2]}`);
        renderChildRing(parts[0], parts[1], parts[2], getManufacturerAngle(parts[0], parts[1], parts[2]), name);
        renderModels(parts[0], parts[1], parts[2], parts[3], angle, null);
        return;
    }

    if (type === 'model') {
        const parts = name.split('/');
        focusRingGroup.classList.remove('hidden');
        childRingGroup.classList.remove('hidden');
        modelsGroup.classList.remove('hidden');
        renderManufacturers(parts[0], `${parts[0]}/${parts[1]}/${parts[2]}`);
        const cylKey = `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`;
        renderChildRing(parts[0], parts[1], parts[2], getManufacturerAngle(parts[0], parts[1], parts[2]), cylKey);
        renderModels(parts[0], parts[1], parts[2], parts[3], cylinderAngles[cylKey], name);
        return;
    }
}

// Helper functions to calculate angles
function getCylinderAngle(market, country, manufacturer, cylinder, manufacturerAngle) {
    const cylinders = Object.keys(data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders).sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    const index = cylinders.indexOf(cylinder);
    const angleSpread = cylinders.length > 1 ? Math.PI / 18 : 0;
    return manufacturerAngle + (index - (cylinders.length - 1) / 2) * angleSpread;
}

// Reset view to MMdM
function resetView(clearActive = true) {
    if (clearActive) {
        activePath = [];
        activeType = null;
        selectedMarket = null; // allow markets to be re-selected after reset
        renderMarkets();
    }
    focusRingGroup.classList.add('hidden');
    childRingGroup.classList.add('hidden');
    modelsGroup.classList.add('hidden');
    pathLinesGroup.innerHTML = '';
    if (clearActive) {
        revertCentral();
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