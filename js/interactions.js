// interactions.js: Handles state, events, and orchestration for user interactions
import { getData, getCylinderAngle, getModelAngle } from './data.js';
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
let showModelInfoRef = null;
let updateModelInfoRef = null;

const HIT_PADDING = CONFIG.HIT_PADDING;
const UNSELECTED_RADIUS = CONFIG.UNSELECTED_RADIUS;
const GAP = CONFIG.GAP;

// Local helpers
function getManufacturerAngle(country, manufacturer) {
  const manufacturerKey = `${country}/${manufacturer}`;
  return manufacturerAngles[manufacturerKey] || CONFIG.CENTER_ANGLE;
}

export function isInActivePath(type, keyParts) {
  if (activePath.length === 0) return false;
  switch (type) {
    case 'manufacturer':
      if (activePath.length < 2) return false;
      return activePath[0] === keyParts[0] && activePath[1] === keyParts[1];
    case 'cylinder':
      if (activePath.length < 3) return false;
      return activePath[0] === keyParts[0] && activePath[1] === keyParts[1] && activePath[2] === keyParts[2];
    case 'model':
      if (activePath.length < 4) return false;
      return activePath[0] === keyParts[0] && activePath[1] === keyParts[1] && activePath[2] === keyParts[2] && activePath[3] === keyParts[3];
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
    const isSameCylinder = (type === 'model' && activeType === 'model' && activePath.slice(0,3).join('/') === keyParts.slice(0,3).join('/'));
    if (activeType === 'model' && !isSameCylinder) {
      revertCentral(centralGroupRef, () => {});
    }
    activeType = type;
    activePath = keyParts;
    resetView(false, type, name);
    renderNextLevel(type, name, angle);
    renderPathLinesWrapper();
    if (type === 'model') {
      if (isSameCylinder) {
        updateModelInfoRef(name);
      } else {
        showModelInfoRef(name);
      }
    }
  });
}

// Render next level
function renderNextLevel(type, name, angle) {
  const country = name.split('/')[0];
  const manufacturer = name.split('/')[1];
  const data = getData();
  if (!data) return;
  const manufacturerAngle = getManufacturerAngle(country, manufacturer);
  if (type === 'manufacturer') {
    cylindersGroupRef.classList.remove('hidden');
    renderAllManufacturersWrapper();
    renderCylinders(cylindersGroupRef, country, manufacturer, angle, activePath, cylinderAngles, isInActivePath, addHitListeners);
  } else if (type === 'cylinder') {
    modelsGroupRef.classList.remove('hidden');
    renderAllManufacturersWrapper();
    renderCylinders(cylindersGroupRef, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
    const cylinderKey = name;
    const storedCylinderAngle = cylinderAngles[cylinderKey] || angle;
    renderModels(modelsGroupRef, country, manufacturer, activePath[2], storedCylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
  } else if (type === 'model') {
    renderAllManufacturersWrapper();
    renderCylinders(cylindersGroupRef, country, manufacturer, getManufacturerAngle(country, manufacturer), activePath, cylinderAngles, isInActivePath, addHitListeners);
    const cylinderKey = `${country}/${manufacturer}/${activePath[2]}`;
    const storedCylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(country, manufacturer, activePath[2], getManufacturerAngle(country, manufacturer), data);
    const modelKey = name;
    const modelAngle = modelAngles[modelKey] || angle;
    renderModels(modelsGroupRef, country, manufacturer, activePath[2], storedCylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
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
  if (nextType === 'manufacturer') {
    const country = nextName.split('/')[0];
    const manufacturer = nextName.split('/')[1];
    const manufacturerAngle = getManufacturerAngle(country, manufacturer);
    renderAllManufacturersWrapper();
    cylindersGroupRef.classList.remove('hidden');
    renderCylinders(cylindersGroupRef, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
  } else if (nextType === 'cylinder') {
    const country = nextName.split('/')[0];
    const manufacturer = nextName.split('/')[1];
    const selectedCylinder = nextName.split('/')[2];
    const manufacturerAngle = getManufacturerAngle(country, manufacturer);
    renderAllManufacturersWrapper();
    cylindersGroupRef.classList.remove('hidden');
    renderCylinders(cylindersGroupRef, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
  } else if (nextType === 'model') {
    const country = nextName.split('/')[0];
    const manufacturer = nextName.split('/')[1];
    const cylinder = nextName.split('/')[2];
    const selectedModel = nextName.split('/')[3];
    const manufacturerAngle = getManufacturerAngle(country, manufacturer);
    const cylinderKey = `${country}/${manufacturer}/${cylinder}`;
    const cylinderAngle = cylinderAngles[cylinderKey] || getCylinderAngle(country, manufacturer, cylinder, manufacturerAngle, data);
    const modelKey = `${country}/${manufacturer}/${cylinder}/${selectedModel}`;
    const modelAngle = modelAngles[modelKey] || getModelAngle(country, manufacturer, cylinder, selectedModel, cylinderAngle, data);
    renderAllManufacturersWrapper();
    cylindersGroupRef.classList.remove('hidden');
    renderCylinders(cylindersGroupRef, country, manufacturer, manufacturerAngle, activePath, cylinderAngles, isInActivePath, addHitListeners);
    modelsGroupRef.classList.remove('hidden');
    renderModels(modelsGroupRef, country, manufacturer, cylinder, cylinderAngle, activePath, modelAngles, isInActivePath, addHitListeners);
  } else {
    renderAllManufacturersWrapper();
  }
}

// Wrapper for renderAllManufacturers
function renderAllManufacturersWrapper() {
  renderAllManufacturers(manufacturersGroupRef, manufacturerAngles, activePath, isInActivePath, addHitListeners);
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
  showModelInfoRef = showModelInfo;
  updateModelInfoRef = updateModelInfo;

  console.log('Interactions initialized');

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