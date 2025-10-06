// main_admin.js: Admin entry point for catalog
import { loadData, getData, getAllManufacturers } from './data.js';
import { renderAllManufacturers, renderCylinders, renderModels, renderPathLines } from './render.js';
import { CONFIG } from './config.js';
import { initInteractions, activeType, activePath, manufacturerAngles, cylinderAngles, modelAngles, isInActivePath } from './interactions.js';

const svg = document.getElementById('catalogSvg');
const mainGroup = document.getElementById('mainGroup');
const centralGroup = document.getElementById('centralGroup');
const pathLinesGroup = document.getElementById('pathLines');
const manufacturersGroup = document.getElementById('manufacturers');
const cylindersGroup = document.getElementById('cylinders');
const modelsGroup = document.getElementById('models');
const isMobile = false; // Desktop only

let data = null;
let dirty = false;
let selectedPath = [];

// Stub for admin (no expansion)
function showModelInfo() { console.log('Admin: Model info stub'); }
function updateModelInfo() { console.log('Admin: Update model stub'); }

// Button handlers
document.getElementById('addManufacturer').addEventListener('click', () => {
  document.getElementById('addManufacturerDialog').showModal();
});

document.getElementById('addManufacturerDialog').addEventListener('submit', (e) => {
  e.preventDefault();
  const country = document.getElementById('addCountry').value.trim();
  const name = document.getElementById('addName').value.trim();
  if (!country || !name) return alert('Fill all fields');
  if (!data.MMdM.countries[country]) data.MMdM.countries[country] = { manufacturers: {} };
  data.MMdM.countries[country].manufacturers[name] = { cylinders: {} };
  dirty = true;
  updateSaveButton();
  reRender();
  closeDialog('addManufacturerDialog');
});

document.getElementById('editSelected').addEventListener('click', () => {
  if (selectedPath.length === 0) return alert('Select a node first');
  showEditDialog();
});

document.getElementById('save').addEventListener('click', () => {
  if (!dirty) return;
  console.log('Saving data:', data);
  alert('Saved to JSON!');
  dirty = false;
  updateSaveButton();
});

function updateSaveButton() {
  const btn = document.getElementById('save');
  btn.classList.toggle('dirty', dirty);
}

function updateEditButton() {
  const btn = document.getElementById('editSelected');
  btn.classList.toggle('active', selectedPath.length > 0);
}

// Dialog helpers
function closeDialog(id) {
  document.getElementById(id).close();
}

function showEditDialog() {
  const path = selectedPath;
  const dialog = document.getElementById('editDialog');
  const title = document.getElementById('editTitle');
  const actions = document.getElementById('editActions');
  const deleteBtn = document.getElementById('deleteBtn');

  if (path.length === 1) {
    title.textContent = `Editing ${path[0]}...`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddCylinderDialog('${path[0]}')">Add Cylinder Count</button>`;
  } else if (path.length === 2) {
    title.textContent = `Editing ${path[0]} ${path[1]} cyl...`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddModelDialog('${path[0]}', '${path[1]}')">Add Engine Model</button>`;
  } else if (path.length === 3) {
    title.textContent = `Editing ${path[2]}...`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddManifoldDialog('${path[0]}', '${path[1]}', '${path[2]}')">Add Manifold Alternative</button>`;
  }

  deleteBtn.onclick = () => showConfirmDelete(path);
  dialog.showModal();
}

function showConfirmDelete(path) {
  const dialog = document.getElementById('confirmDeleteDialog');
  document.getElementById('confirmTitle').textContent = `Delete ${getNodeName(path)}?`;
  document.getElementById('confirmDeleteBtn').onclick = () => {
    deleteNode(path);
    closeDialog('confirmDeleteDialog');
    closeDialog('editDialog');
  };
  dialog.showModal();
}

function getNodeName(path) {
  if (path.length === 1) return path[0];
  if (path.length === 2) return `${path[0]} ${path[1]} cyl`;
  if (path.length === 3) return path[2];
  return 'Node';
}

function deleteNode(path) {
  const country = path[0];
  if (path.length === 1) {
    delete data.MMdM.countries[country];
  } else if (path.length === 2) {
    const manuf = path[1];
    delete data.MMdM.countries[country].manufacturers[manuf].cylinders[path[1]];
  } else if (path.length === 3) {
    const manuf = path[1], cyl = path[2];
    const index = data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].findIndex(m => m.manufacturer_engine_model === path[2]);
    if (index > -1) data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].splice(index, 1);
  }
  dirty = true;
  updateSaveButton();
  reRender();
}

function showAddCylinderDialog(manuf) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Cylinder Count for ${manuf}`;
  document.getElementById('detailLabel1').innerHTML = 'Cylinder Count: <input type="number" id="detailInput1" required min="1">';
  document.getElementById('detailLabel2').style.display = 'none';
  dialog.onsubmit = (e) => {
    e.preventDefault();
    const cyl = document.getElementById('detailInput1').value;
    if (!cyl) return;
    const country = selectedPath[0];
    data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl] = [];
    dirty = true;
    updateSaveButton();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

function showAddModelDialog(manuf, cyl) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Engine Model for ${manuf} ${cyl} cyl`;
  document.getElementById('detailLabel1').innerHTML = 'Engine Model: <input type="text" id="detailInput1" required>';
  document.getElementById('detailLabel2').style.display = 'none';
  dialog.onsubmit = (e) => {
    e.preventDefault();
    const modelName = document.getElementById('detailInput1').value;
    if (!modelName) return;
    const country = selectedPath[0];
    data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].push({
      manufacturer_engine_model: modelName,
      manifold_alternatives: []
    });
    dirty = true;
    updateSaveButton();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

function showAddManifoldDialog(manuf, cyl, model) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Manifold for ${model}`;
  document.getElementById('detailLabel1').innerHTML = 'Manifold Number: <input type="text" id="detailInput1" required>';
  document.getElementById('detailLabel2').innerHTML = 'OEM Price: <input type="number" id="detailInput2" required min="0">';
  document.getElementById('detailLabel2').style.display = 'block';
  dialog.onsubmit = (e) => {
    e.preventDefault();
    const num = document.getElementById('detailInput1').value;
    const price = parseInt(document.getElementById('detailInput2').value);
    if (!num || !price) return;
    const country = selectedPath[0];
    const engineObj = data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].find(m => m.manufacturer_engine_model === model);
    if (engineObj) {
      engineObj.manifold_alternatives.push({
        manufacturer_manifold_number: num,
        oem_price: price,
        mmdm_models: []
      });
    }
    dirty = true;
    updateSaveButton();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

// Extend interactions for selection
const interactions = initInteractions(svg, mainGroup, centralGroup, pathLinesGroup, cylindersGroup, modelsGroup, manufacturersGroup, isMobile, showModelInfo, updateModelInfo);

// Override for selection (click to select)
const originalAddHitListeners = interactions.addHitListeners;
interactions.addHitListeners = (hitCircle, nodeGroup, type, name, angle, isSelected) => {
  originalAddHitListeners(hitCircle, nodeGroup, type, name, angle, isSelected);
  hitCircle.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPath = name.split('/');
    updateEditButton();
    // Highlight selected (target only this group)
    nodeGroup.classList.add('selected');
    // Clear previous (find previous selected g)
    document.querySelectorAll('.manufacturer, .cylinder, .model').forEach(g => {
      if (g !== nodeGroup) g.classList.remove('selected');
    });
  });
};

// Re-render
function reRender() {
  activeType = null;
  activePath = [];
  manufacturerAngles = {};
  cylinderAngles = {};
  modelAngles = {};
  selectedPath = []; // Clear selection on re-render
  updateEditButton();
  interactions.resetView(true);
  renderAllManufacturers(manufacturersGroup, manufacturerAngles, activePath, isInActivePath, interactions.addHitListeners);
}

// Init
console.log('Initializing admin');
loadData().then((loadedData) => {
  data = loadedData;
  reRender();
  updateSaveButton();
}).catch(err => console.error('Load failed:', err));