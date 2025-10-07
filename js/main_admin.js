// main_admin.js — Corrected & updated for use with the improved data.js

import { loadData, saveDataLocal, setData, getData } from './data.js';
import { initInteractions } from './interactions.js';

const svg = document.getElementById('catalogSvg');
const mainGroup = document.getElementById('mainGroup');
const centralGroup = document.getElementById('centralGroup');
const pathLinesGroup = document.getElementById('pathLines');
const manufacturersGroup = document.getElementById('manufacturers');
const cylindersGroup = document.getElementById('cylinders');
const modelsGroup = document.getElementById('models');

let data = null;
let dirty = false;
let selectedPath = [];

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI event handlers
  initButtons();

  // Load data and initialize visualization
  loadData()
    .then(loaded => {
      data = loaded;
      setData(data);
      interactions.renderAllManufacturersWrapper();
      updateSaveButton();
      updateEditButton();
    })
    .catch(err => console.error("Load failed:", err));
});

function initButtons() {
  document.getElementById('addManufacturer').addEventListener('click', () => {
    document.getElementById('addManufacturerDialog').showModal();
  });

  document.getElementById('addManufacturerConfirm').addEventListener('click', () => {
    const country = document.getElementById('addCountry').value.trim();
    const name = document.getElementById('addName').value.trim();
    if (!country || !name) return alert('Please fill all fields.');

    if (!data.MMdM.countries[country])
      data.MMdM.countries[country] = { manufacturers: {} };

    if (data.MMdM.countries[country].manufacturers[name]) {
      alert('Manufacturer already exists.');
      return;
    }

    data.MMdM.countries[country].manufacturers[name] = { cylinders: {} };
    markDirty();
    reRender();
    closeDialog('addManufacturerDialog');
  });

  document.getElementById('editSelected').addEventListener('click', () => {
    if (selectedPath.length === 0) return alert('Select a node first.');
    showEditDialog();
  });

  document.getElementById('save').addEventListener('click', () => {
    if (!dirty) return alert('No changes to save.');
    saveDataLocal();
    dirty = false;
    updateSaveButton();
  });
}

// --- UI Updates ---
function markDirty() {
  dirty = true;
  updateSaveButton();
}

function updateSaveButton() {
  const btn = document.getElementById('save');
  btn.classList.toggle('dirty', dirty);
}

function updateEditButton() {
  const btn = document.getElementById('editSelected');
  btn.classList.toggle('active', selectedPath.length > 0);
}

// --- Dialog Handling ---
function closeDialog(id) {
  const dlg = document.getElementById(id);
  if (dlg && dlg.open) dlg.close();
}

function showEditDialog() {
  const dialog = document.getElementById('editDialog');
  const title = document.getElementById('editTitle');
  const actions = document.getElementById('editActions');
  const deleteBtn = document.getElementById('deleteBtn');

  actions.innerHTML = '';
  const path = selectedPath;

  if (path.length === 1) {
    title.textContent = `Editing ${path[0]} (Country)`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddManufacturerDialog('${path[0]}')">Add Manufacturer</button>`;
  } else if (path.length === 2) {
    title.textContent = `Editing ${path[1]} (Manufacturer)`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddCylinderDialog('${path[0]}','${path[1]}')">Add Cylinder Count</button>`;
  } else if (path.length === 3) {
    title.textContent = `Editing ${path[2]} (Cylinder)`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddModelDialog('${path[0]}','${path[1]}','${path[2]}')">Add Engine Model</button>`;
  } else if (path.length === 4) {
    title.textContent = `Editing ${path[3]} (Model)`;
    actions.innerHTML = `<button type="button" class="add-btn" onclick="showAddManifoldDialog('${path[0]}','${path[1]}','${path[2]}','${path[3]}')">Add Manifold</button>`;
  }

  deleteBtn.onclick = () => showConfirmDelete(path);
  dialog.showModal();
}

function showConfirmDelete(path) {
  const dialog = document.getElementById('confirmDeleteDialog');
  document.getElementById('confirmTitle').textContent = `Delete ${path[path.length - 1]}?`;

  document.getElementById('confirmDeleteBtn').onclick = () => {
    deleteNode(path);
    closeDialog('confirmDeleteDialog');
    closeDialog('editDialog');
  };
  dialog.showModal();
}

function deleteNode(path) {
  const [country, manufacturer, cyl, model] = path;

  try {
    if (path.length === 1) {
      delete data.MMdM.countries[country];
    } else if (path.length === 2) {
      delete data.MMdM.countries[country].manufacturers[manufacturer];
    } else if (path.length === 3) {
      delete data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cyl];
    } else if (path.length === 4) {
      const arr = data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cyl];
      const idx = arr.findIndex(m => m.manufacturer_engine_model === model);
      if (idx !== -1) arr.splice(idx, 1);
    }
    markDirty();
    reRender();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete node. Check console.");
  }
}

// --- Add dialogs ---
function showAddManufacturerDialog(country) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Manufacturer in ${country}`;
  document.getElementById('detailLabel1').innerHTML = 'Manufacturer Name: <input type="text" id="detailInput1" required>';
  document.getElementById('detailLabel2').style.display = 'none';

  dialog.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('detailInput1').value.trim();
    if (!name) return;
    data.MMdM.countries[country].manufacturers[name] = { cylinders: {} };
    markDirty();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

function showAddCylinderDialog(country, manufacturer) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Cylinder Count for ${manufacturer}`;
  document.getElementById('detailLabel1').innerHTML = 'Cylinder Count: <input type="number" id="detailInput1" min="1" required>';
  document.getElementById('detailLabel2').style.display = 'none';

  dialog.onsubmit = (e) => {
    e.preventDefault();
    const cyl = document.getElementById('detailInput1').value;
    if (!cyl) return;
    data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cyl] = [];
    markDirty();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

function showAddModelDialog(country, manufacturer, cyl) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Model for ${manufacturer} ${cyl} cyl`;
  document.getElementById('detailLabel1').innerHTML = 'Engine Model: <input type="text" id="detailInput1" required>';
  document.getElementById('detailLabel2').style.display = 'none';

  dialog.onsubmit = (e) => {
    e.preventDefault();
    const model = document.getElementById('detailInput1').value.trim();
    if (!model) return;
    const cylArr = data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cyl];
    cylArr.push({ manufacturer_engine_model: model, manifold_alternatives: [] });
    markDirty();
    reRender();
    closeDialog('detailDialog');
  };
  dialog.showModal();
}

function showAddManifoldDialog(country, manufacturer, cyl, model) {
  closeDialog('editDialog');
  const dialog = document.getElementById('detailDialog');
  document.getElementById('detailTitle').textContent = `Add Manifold for ${model}`;
  document.getElementById('detailLabel1').innerHTML = 'Manifold Number: <input type="text" id="detailInput1" required>';
  document.getElementById('detailLabel2').innerHTML = 'OEM Price: <input type="number" id="detailInput2" min="0" required>';
  document.getElementById('detailLabel2').style.display = 'block';

  dialog.onsubmit = (e) => {
    e.preventDefault();
    const num = document.getElementById('detailInput1').value.trim();
    const price = parseInt(document.getElementById('detailInput2').value);
    if (!num || isNaN(price)) return;

    const modelObj = data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cyl]
      .find(m => m.manufacturer_engine_model === model);

    if (modelObj) {
      modelObj.manifold_alternatives.push({
        manufacturer_manifold_number: num,
        oem_price: price,
        mmdm_models: []
      });
      markDirty();
      reRender();
      closeDialog('detailDialog');
    }
  };
  dialog.showModal();
}

// --- Visualization + Selection Handling ---
const interactions = initInteractions(
  svg, mainGroup, centralGroup, pathLinesGroup,
  cylindersGroup, modelsGroup, manufacturersGroup, false
);

const originalAddHitListeners = interactions.addHitListeners;

interactions.addHitListeners = (hitCircle, nodeGroup, type, name, angle, isSelected) => {
  originalAddHitListeners(hitCircle, nodeGroup, type, name, angle, isSelected);
  hitCircle.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPath = name.split('/');
    updateEditButton();

    document.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
    nodeGroup.querySelector('.node').classList.add('selected');
  });
};

function reRender() {
  interactions.resetView(true);
  interactions.renderAllManufacturersWrapper();
}

// Expose helper functions for inline HTML onclick usage
window.closeDialog = closeDialog;
window.showAddManufacturerDialog = showAddManufacturerDialog;
window.showAddCylinderDialog = showAddCylinderDialog;
window.showAddModelDialog = showAddModelDialog;
window.showAddManifoldDialog = showAddManifoldDialog;
window.showConfirmDelete = showConfirmDelete;
