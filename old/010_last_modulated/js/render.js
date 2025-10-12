// render.js: Handles SVG rendering for rings and paths
import { CONFIG, getColor } from './config.js';
import { getData, getAllManufacturers } from './data.js';

// Render all manufacturer nodes
export function renderAllManufacturers(manufacturersGroup, manufacturerAngles, activePath, isInActivePath, addHitListeners, manufacturersList = null, adminMode = false) {
  console.log('Rendering all manufacturers', manufacturersList ? 'from list' : 'from data');
  const data = getData();
  if (!data) return;
  manufacturersGroup.innerHTML = '';
  let allManufacturers = manufacturersList || getAllManufacturers(data);
  const angleSpread = CONFIG.MANUFACTURER_ANGLE_SPREAD;
  const centerAngle = CONFIG.CENTER_ANGLE;
  allManufacturers.forEach((item, index) => {
    let manufacturer, country, manufacturerKey;
    if (manufacturersList) {
      manufacturer = item.label;
      country = item.country;
      manufacturerKey = item.key; // Full key including market
    } else {
      manufacturer = item.name;
      country = item.country;
      manufacturerKey = `${country}/${manufacturer}`;
    }
    const keyParts = manufacturerKey.split('/'); // [market, country, manufacturer] or [country, manufacturer]
    const isSelected = isInActivePath('manufacturer', keyParts);
    const baseRadius = CONFIG.RADII.manufacturers;
    const angle = centerAngle + (index - (allManufacturers.length - 1) / 2) * angleSpread;
    manufacturerAngles[manufacturerKey] = angle;
    let r = isSelected ? CONFIG.SELECTED_RADIUS : CONFIG.UNSELECTED_RADIUS;
    if (adminMode && isSelected) r *= 1.5; // 50% larger
    const offset = - (r + 5);
    const textX = offset * Math.cos(angle);
    const textY = offset * Math.sin(angle);
    let rotation = angle * 180 / Math.PI;
    let textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
    let dy = CONFIG.TEXT_DY;
    if (Math.cos(angle) < 0) {
      rotation += 180;
    }
    const g = document.createElementNS(CONFIG.NS, 'g');
    g.classList.add('manufacturer');
    g.setAttribute('transform', `translate(${baseRadius * Math.cos(angle)}, ${baseRadius * Math.sin(angle)})`);
    g.innerHTML = `
      <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('manufacturer', manufacturer)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
      <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black" font-family="${CONFIG.TEXT_FAMILY}" font-size="${CONFIG.TEXT_FONT}">${manufacturer}</text>
    `;
    const hitCircle = document.createElementNS(CONFIG.NS, 'circle');
    hitCircle.setAttribute('cx', '0');
    hitCircle.setAttribute('cy', '0');
    hitCircle.setAttribute('r', (r + CONFIG.HIT_PADDING).toString());
    hitCircle.setAttribute('fill', 'transparent');
    hitCircle.setAttribute('stroke', 'none');
    g.appendChild(hitCircle);
    manufacturersGroup.appendChild(g);
    addHitListeners(hitCircle, g, 'manufacturer', manufacturerKey, angle, isSelected);

    // Admin buttons for selected node
    if (adminMode && isSelected) {
      const buttonOffset = baseRadius * 1.5;
      const buttonX = buttonOffset * Math.cos(angle);
      const buttonY = buttonOffset * Math.sin(angle);
      const buttonG = document.createElementNS(CONFIG.NS, 'g');
      buttonG.setAttribute('transform', `translate(${buttonX}, ${buttonY}) rotate(${rotation})`);
      buttonG.innerHTML = `
        <circle cx="0" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="-8" y="4" class="admin-button" data-action="add">+</text>
        <circle cx="12" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="4" y="4" class="admin-button" data-action="delete">-</text>
        <circle cx="24" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="16" y="4" class="admin-button" data-action="edit">E</text>
      `;
      g.appendChild(buttonG);
      buttonG.querySelectorAll('.admin-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          handleAdminAction(action, manufacturerKey);
        });
      });
    }
  });
}

// Render cylinder nodes
export function renderCylinders(cylindersGroup, market, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners, adminMode = false) {
  console.log('Rendering cylinders for', market, country, manufacturer);
  const data = getData();
  if (!data) return;
  cylindersGroup.innerHTML = '';
  const cylinders = data.MMdM.markets[market]?.countries[country]?.manufacturers[manufacturer]?.cylinders;
  if (!cylinders) {
    console.error(`No cylinders found for ${manufacturer} in ${country}, ${market}`);
    return;
  }
  const cylinderKeys = Object.keys(cylinders).sort((a, b) => parseInt(a) - parseInt(b));
  const angleSpread = cylinderKeys.length > 1 ? CONFIG.CYLINDER_ANGLE_SPREAD : 0;
  cylinderKeys.forEach((cylinder, index) => {
    const keyParts = [market, country, manufacturer, cylinder];
    const isSelected = isInActivePath('cylinder', keyParts);
    const baseRadius = CONFIG.RADII.cylinders;
    const angle = manufacturerAngle + (index - (cylinderKeys.length - 1) / 2) * angleSpread;
    let r = isSelected ? CONFIG.SELECTED_RADIUS : CONFIG.UNSELECTED_RADIUS;
    if (adminMode && isSelected) r *= 1.5;
    const textX = 0;
    const textY = 0;
    let rotation = angle * 180 / Math.PI;
    let textAnchor = 'middle';
    let dy = CONFIG.TEXT_DY;
    if (Math.cos(angle) < 0) {
      rotation += 180;
    }
    const cylinderKey = `${market}/${country}/${manufacturer}/${cylinder}`;
    if (cylinderAngles[cylinderKey] === undefined) {
      cylinderAngles[cylinderKey] = angle;
    }
    const x = baseRadius * Math.cos(angle);
    const y = baseRadius * Math.sin(angle);
    const g = document.createElementNS(CONFIG.NS, 'g');
    g.classList.add('cylinder');
    g.setAttribute('transform', `translate(${x}, ${y})`);
    g.setAttribute('data-angle', angle.toString());
    g.innerHTML = `
      <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('cylinder', cylinder)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
      <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black" font-family="${CONFIG.TEXT_FAMILY}" font-size="${CONFIG.TEXT_FONT}">${cylinder} cyl</text>
    `;
    const hitCircle = document.createElementNS(CONFIG.NS, 'circle');
    hitCircle.setAttribute('cx', '0');
    hitCircle.setAttribute('cy', '0');
    hitCircle.setAttribute('r', (r + CONFIG.HIT_PADDING).toString());
    hitCircle.setAttribute('fill', 'transparent');
    hitCircle.setAttribute('stroke', 'none');
    g.appendChild(hitCircle);
    cylindersGroup.appendChild(g);
    addHitListeners(hitCircle, g, 'cylinder', cylinderKey, angle, isSelected);

    // Admin buttons
    if (adminMode && isSelected) {
      const buttonOffset = baseRadius * 1.5;
      const buttonX = buttonOffset * Math.cos(angle);
      const buttonY = buttonOffset * Math.sin(angle);
      const buttonG = document.createElementNS(CONFIG.NS, 'g');
      buttonG.setAttribute('transform', `translate(${buttonX}, ${buttonY}) rotate(${rotation})`);
      buttonG.innerHTML = `
        <circle cx="0" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="-8" y="4" class="admin-button" data-action="add">+</text>
        <circle cx="12" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="4" y="4" class="admin-button" data-action="delete">-</text>
        <circle cx="24" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="16" y="4" class="admin-button" data-action="edit">E</text>
      `;
      g.appendChild(buttonG);
      buttonG.querySelectorAll('.admin-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          handleAdminAction(action, cylinderKey);
        });
      });
    }
  });
}

// Render model nodes
export function renderModels(modelsGroup, market, country, manufacturer, cylinder, cylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners, adminMode = false) {
  console.log('Rendering models for', market, country, manufacturer, cylinder);
  const data = getData();
  if (!data) return;
  modelsGroup.innerHTML = '';
  const models = data.MMdM.markets[market]?.countries[country]?.manufacturers[manufacturer]?.cylinders[cylinder];
  if (!models) {
    console.error(`No models found for ${cylinder} in ${manufacturer}, ${country}, ${market}`);
    return;
  }
  const angleSpread = models.length > 1 ? CONFIG.MODEL_ANGLE_SPREAD : 0;
  models.forEach((model, index) => {
    const modelName = model.engine_model;
    const keyParts = [market, country, manufacturer, cylinder, modelName];
    const isSelected = isInActivePath('model', keyParts);
    const baseRadius = CONFIG.RADII.models;
    const modelKey = `${market}/${country}/${manufacturer}/${cylinder}/${modelName}`;
    let angle;
    if (modelAngles[modelKey] !== undefined) {
      angle = modelAngles[modelKey];
    } else {
      angle = cylinderAngle + (index - (models.length - 1) / 2) * angleSpread;
      modelAngles[modelKey] = angle;
    }
    let r = isSelected ? CONFIG.SELECTED_RADIUS : CONFIG.UNSELECTED_RADIUS;
    if (adminMode && isSelected) r *= 1.5;
    const offset = r + 5;
    const textX = offset * Math.cos(angle);
    const textY = offset * Math.sin(angle);
    let rotation = angle * 180 / Math.PI;
    let textAnchor = Math.cos(angle) >= 0 ? 'end' : 'start';
    let dy = CONFIG.TEXT_DY;
    if (Math.cos(angle) < 0) {
      rotation += 180;
    }
    const x = baseRadius * Math.cos(angle);
    const y = baseRadius * Math.sin(angle);
    const g = document.createElementNS(CONFIG.NS, 'g');
    g.classList.add('model');
    g.setAttribute('transform', `translate(${x}, ${y})`);
    g.setAttribute('data-model', modelName);
    g.setAttribute('data-angle', angle.toString());
    g.innerHTML = `
      <circle class="node" cx="0" cy="0" r="${r}" fill="${getColor('model', modelName)}" ${isSelected ? 'stroke="black" stroke-width="1"' : ''} />
      <text x="${textX}" y="${textY}" dy="${dy}" text-anchor="${textAnchor}" transform="rotate(${rotation}, ${textX}, ${textY})" fill="black" font-family="${CONFIG.TEXT_FAMILY}" font-size="${CONFIG.TEXT_FONT}">${modelName}</text>
    `;
    const hitCircle = document.createElementNS(CONFIG.NS, 'circle');
    hitCircle.setAttribute('cx', '0');
    hitCircle.setAttribute('cy', '0');
    hitCircle.setAttribute('r', (r + CONFIG.HIT_PADDING).toString());
    hitCircle.setAttribute('fill', 'transparent');
    hitCircle.setAttribute('stroke', 'none');
    g.appendChild(hitCircle);
    modelsGroup.appendChild(g);
    addHitListeners(hitCircle, g, 'model', modelKey, angle, isSelected);

    // Admin buttons
    if (adminMode && isSelected) {
      const buttonOffset = baseRadius * 1.5;
      const buttonX = buttonOffset * Math.cos(angle);
      const buttonY = buttonOffset * Math.sin(angle);
      const buttonG = document.createElementNS(CONFIG.NS, 'g');
      buttonG.setAttribute('transform', `translate(${buttonX}, ${buttonY}) rotate(${rotation})`);
      buttonG.innerHTML = `
        <circle cx="0" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="-8" y="4" class="admin-button" data-action="add">+</text>
        <circle cx="12" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="4" y="4" class="admin-button" data-action="delete">-</text>
        <circle cx="24" cy="0" r="8" fill="#f1b800" class="admin-button-bg" />
        <text x="16" y="4" class="admin-button" data-action="edit">E</text>
      `;
      g.appendChild(buttonG);
      buttonG.querySelectorAll('.admin-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          handleAdminAction(action, modelKey);
        });
      });
    }
  });
}

// Render path lines
export function renderPathLines(pathLinesGroup, activePath, manufacturerAngles, cylinderAngles, modelAngles, getManufacturerAngle, getCylinderAngle, getModelAngle) {
  const data = getData();
  if (!data || activePath.length < 2) {
    pathLinesGroup.innerHTML = '';
    return;
  }

  let prevX, prevY;

  if (activePath.length >= 3) { // Now min 3 for manufacturer: market/country/manuf
    const manufacturerKey = `${activePath[0]}/${activePath[1]}/${activePath[2]}`;
    const manAngle = getManufacturerAngle(activePath[0], activePath[1], activePath[2]);
    const manRadius = CONFIG.RADII.manufacturers;
    prevX = manRadius * Math.cos(manAngle);
    prevY = manRadius * Math.sin(manAngle);
  } else {
    return; // No path yet
  }

  if (activePath.length >= 4) {
    const cylinderKey = `${activePath[0]}/${activePath[1]}/${activePath[2]}/${activePath[3]}`;
    const cylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(activePath[0], activePath[1], activePath[2], activePath[3], getManufacturerAngle(activePath[0], activePath[1], activePath[2]), data);
    const cylRadius = CONFIG.RADII.cylinders;
    const cylX = cylRadius * Math.cos(cylinderAngle);
    const cylY = cylRadius * Math.sin(cylinderAngle);
    const line = document.createElementNS(CONFIG.NS, 'line');
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
    const cylinderAngle = cylinderAngles[`${activePath[0]}/${activePath[1]}/${activePath[2]}/${activePath[3]}`] || getCylinderAngle(activePath[0], activePath[1], activePath[2], activePath[3], getManufacturerAngle(activePath[0], activePath[1], activePath[2]), data);
    const modelAngle = modelAngles[modelKey] || getModelAngle(activePath[0], activePath[1], activePath[2], activePath[3], activePath[4], cylinderAngle, data);
    const modelRadius = CONFIG.RADII.models;
    const modelX = modelRadius * Math.cos(modelAngle);
    const modelY = modelRadius * Math.sin(modelAngle);
    const line = document.createElementNS(CONFIG.NS, 'line');
    line.setAttribute('x1', prevX.toString());
    line.setAttribute('y1', prevY.toString());
    line.setAttribute('x2', modelX.toString());
    line.setAttribute('y2', modelY.toString());
    line.setAttribute('stroke', 'black');
    line.setAttribute('stroke-width', '1');
    pathLinesGroup.appendChild(line);
  }

  // Fan lines
  if (activePath.length === 3) { // Manufacturer selected
    const market = activePath[0];
    const country = activePath[1];
    const manufacturer = activePath[2];
    const manAngle = getManufacturerAngle(market, country, manufacturer);
    const marketData = data.MMdM.markets[market];
    const cylinders = Object.keys(marketData?.countries[country]?.manufacturers[manufacturer]?.cylinders || {}).sort((a, b) => parseInt(a) - parseInt(b));
    const cylRingRadius = CONFIG.RADII.cylinders;
    cylinders.forEach((cylinder) => {
      const cylinderAngle = getCylinderAngle(market, country, manufacturer, cylinder, manAngle, data);
      const cylX = cylRingRadius * Math.cos(cylinderAngle);
      const cylY = cylRingRadius * Math.sin(cylinderAngle);
      const line = document.createElementNS(CONFIG.NS, 'line');
      line.setAttribute('x1', prevX.toString());
      line.setAttribute('y1', prevY.toString());
      line.setAttribute('x2', cylX.toString());
      line.setAttribute('y2', cylY.toString());
      line.setAttribute('stroke', 'black');
      line.setAttribute('stroke-width', '1');
      pathLinesGroup.appendChild(line);
    });
  } else if (activePath.length === 4) { // Cylinder selected
    const market = activePath[0];
    const country = activePath[1];
    const manufacturer = activePath[2];
    const cylinder = activePath[3];
    const cylAngle = cylinderAngles[`${market}/${country}/${manufacturer}/${cylinder}`] || getCylinderAngle(market, country, manufacturer, cylinder, getManufacturerAngle(market, country, manufacturer), data);
    const marketData = data.MMdM.markets[market];
    const modelsData = marketData?.countries[country]?.manufacturers[manufacturer]?.cylinders[cylinder];
    if (modelsData && modelsData.length > 0) {
      const angleSpread = modelsData.length > 1 ? CONFIG.MODEL_ANGLE_SPREAD : 0;
      const modelRingRadius = CONFIG.RADII.models;
      modelsData.forEach((modelObj, index) => {
        const modelName = modelObj.engine_model;
        const modelAngle = cylAngle + (index - (modelsData.length - 1) / 2) * angleSpread;
        const modelX = modelRingRadius * Math.cos(modelAngle);
        const modelY = modelRingRadius * Math.sin(modelAngle);
        const line = document.createElementNS(CONFIG.NS, 'line');
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