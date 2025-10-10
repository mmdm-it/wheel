// interactions.js: Handles state, events, and orchestration for user interactions
import { getData, getCylinderAngle, getModelAngle, getAllManufacturers } from './data.js';
import { renderAllManufacturers, renderCylinders, renderModels, renderPathLines } from './render.js';
import { revertCentral } from './animations.js';
import { CONFIG } from './config.js';

export let activeType = null;
export let activePath = [];
export const modelAngles = {};
export const cylinderAngles = {};
export const manufacturerAngles = {};

let centralGroupRef = null;
let pathLinesGroupRef = null;
let cylindersGroupRef = null;
let modelsGroupRef = null;
let manufacturersGroupRef = null;
let mainGroupRef = null;
let isMobileRef = null;

const HIT_PADDING = CONFIG.HIT_PADDING;
const UNSELECTED_RADIUS = CONFIG.UNSELECTED_RADIUS;
const GAP = CONFIG.GAP;

// Local helpers
function getManufacturerAngle(market, country, manufacturer) {
  const manufacturerKey = `${market}/${country}/${manufacturer}`;
  return manufacturerAngles[manufacturerKey] || CONFIG.CENTER_ANGLE;
}

export function isInActivePath(type, keyParts) {
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

// Add event listeners (uses refs)
function addHitListeners(hitCircle, nodeGroup, type, name, angle, isSelected) {
  const eventType = isMobileRef ? 'click' : 'mouseover';
  hitCircle.addEventListener(eventType, () => {
    const keyParts = name.split('/');
    if (activeType === type && isInActivePath(type, keyParts)) {
      return;
    }
    if (activeType === 'model') {
      revertCentral(centralGroupRef, () => {});
    }
    activeType = type;
    activePath = keyParts;
    resetView(false, type, name);
    renderNextLevel(type, name, angle);
    renderPathLinesWrapper();
  });
}

// Render next level
function renderNextLevel(type, name, angle) {
  const keyParts = name.split('/');
  const market = keyParts[0];
  const country = keyParts[1];
  const manufacturer = keyParts[2];
  const data = getData();
  if (!data) return;
  const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
  if (type === 'manufacturer') {
    cylindersGroupRef.classList.remove('hidden');
    renderAllManufacturersWrapper(market);
    renderCylinders(cylindersGroupRef, market, country, manufacturer, angle, activePath, cylinderAngles, isInActivePath, addHitListeners);
  } else if (type === 'cylinder') {
    modelsGroupRef.classList.remove('hidden');
    renderAllManufacturersWrapper(market);
    renderCylinders(cylindersGroupRef, market, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
    const cylinderKey = name;
    const storedCylinderAngle = cylinderAngles[cylinderKey] || angle;
    renderModels(modelsGroupRef, market, country, manufacturer, activePath[3], storedCylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
  } else if (type === 'model') {
    renderAllManufacturersWrapper(market);
    renderCylinders(cylindersGroupRef, market, country, manufacturer, getManufacturerAngle(market, country, manufacturer), activePath, cylinderAngles, isInActivePath, addHitListeners);
    const cylinderKey = `${market}/${country}/${manufacturer}/${activePath[3]}`;
    const storedCylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(market, country, manufacturer, activePath[3], getManufacturerAngle(market, country, manufacturer), data);
    const modelKey = name;
    const modelAngle = modelAngles[modelKey] || angle;
    renderModels(modelsGroupRef, market, country, manufacturer, activePath[3], storedCylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
  }
}

// Reset view
function resetView(clearActive = true, nextType = null, nextName = null) {
  mainGroupRef.setAttribute('transform', 'translate(500, 500)');
  pathLinesGroupRef.innerHTML = '';
  cylindersGroupRef.innerHTML = '';
  modelsGroupRef.innerHTML = '';
  cylindersGroupRef.classList.add('hidden');
  modelsGroupRef.classList.add('hidden');
  if (clearActive) {
    activeType = null;
    activePath = [];
  }
  if (nextType && nextName) {
    const keyParts = nextName.split('/');
    const market = keyParts[0];
    if (nextType === 'manufacturer') {
      const country = keyParts[1];
      const manufacturer = keyParts[2];
      const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
      renderAllManufacturersWrapper(market);
      cylindersGroupRef.classList.remove('hidden');
      renderCylinders(cylindersGroupRef, market, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
    } else if (nextType === 'cylinder') {
      const country = keyParts[1];
      const manufacturer = keyParts[2];
      const selectedCylinder = keyParts[3];
      const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
      renderAllManufacturersWrapper(market);
      cylindersGroupRef.classList.remove('hidden');
      renderCylinders(cylindersGroupRef, market, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
    } else if (nextType === 'model') {
      const country = keyParts[1];
      const manufacturer = keyParts[2];
      const cylinder = keyParts[3];
      const selectedModel = keyParts[4];
      const manufacturerAngle = getManufacturerAngle(market, country, manufacturer);
      const cylinderKey = `${market}/${country}/${manufacturer}/${cylinder}`;
      const cylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(market, country, manufacturer, cylinder, manufacturerAngle, getData());
      const modelKey = `${market}/${country}/${manufacturer}/${cylinder}/${selectedModel}`;
      const modelAngle = modelAngles[modelKey] || getModelAngle(market, country, manufacturer, cylinder, selectedModel, cylinderAngle, getData());
      renderAllManufacturersWrapper(market);
      cylindersGroupRef.classList.remove('hidden');
      renderCylinders(cylindersGroupRef, market, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
      modelsGroupRef.classList.remove('hidden');
      renderModels(modelsGroupRef, market, country, manufacturer, cylinder, cylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
    }
  } else {
    // For reset without next, clear manufacturers
    manufacturersGroupRef.innerHTML = '';
  }
}

// Wrapper for renderAllManufacturers (now takes market)
function renderAllManufacturersWrapper(market = null) {
  // If market provided, build list; else, assume global context or empty
  let manufacturersList = null;
  if (market) {
    manufacturersList = getAllManufacturers(getData(), market);
    // Adjust list format for render: {key: fullKey, label: name, country, manufacturer}
    manufacturersList = manufacturersList.map(item => ({
      key: `${item.market}/${item.country}/${item.name}`,
      label: item.name,
      country: item.country,
      manufacturer: item.name,
      market: item.market
    }));
  }
  renderAllManufacturers(manufacturersGroupRef, manufacturerAngles, activePath, isInActivePath, addHitListeners, manufacturersList);
}

// Wrapper for renderPathLines
function renderPathLinesWrapper() {
  renderPathLines(pathLinesGroupRef, activePath, manufacturerAngles, cylinderAngles, modelAngles, getManufacturerAngle, getCylinderAngle, getModelAngle);
}

// Init interactions
export function initInteractions(svg, mainGroup, centralGroup, pathLinesGroup, cylindersGroup, modelsGroup, manufacturersGroup, isMobile, showModelInfo, updateModelInfo) {
  centralGroupRef = centralGroup;
  pathLinesGroupRef = pathLinesGroup;
  cylindersGroupRef = cylindersGroup;
  modelsGroupRef = modelsGroup;
  manufacturersGroupRef = manufacturersGroup;
  mainGroupRef = mainGroup;
  isMobileRef = isMobile;

  document.getElementById('mmdmNode').addEventListener('click', () => {
    if (activeType === 'model') {
      revertCentral(centralGroupRef, () => {
        resetView(true, null, null);
      });
    } else {
      resetView(true, null, null);
    }
  });

  if (!isMobile) {
    let timeout;
    svg.addEventListener('mouseout', (e) => {
      if (!svg.contains(e.relatedTarget)) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (activeType === 'model') {
            revertCentral(centralGroupRef, () => {
              resetView(true, null, null);
            });
          } else {
            resetView(true, null, null);
          }
        }, 300);
      }
    });
    svg.addEventListener('mouseover', () => {
      clearTimeout(timeout);
    });
  }

  return {
    isInActivePath,
    addHitListeners,
    renderNextLevel,
    resetView,
    renderAllManufacturersWrapper,
    renderPathLinesWrapper
  };
}