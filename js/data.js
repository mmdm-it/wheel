// data.js: Handles loading and querying catalog data
let catalogData = null; // Module-level storage for loaded data

// Load JSON data (async, returns promise resolving to data)
export async function loadData() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    catalogData = await response.json();
    console.log('Loaded data:', JSON.stringify(catalogData, null, 2));
    return catalogData;
  } catch (error) {
    console.error('Error loading catalog.json:', error);
    alert('Failed to load catalog data. Please check the file path.');
    throw error; // Re-throw for caller handling
  }
}

// Getter for the loaded data (null if not loaded)
export function getData() {
  return catalogData;
}

// Collect all manufacturers from all countries (Z-A sort)
export function getAllManufacturers(data) {
  if (!data) {
    console.warn('getAllManufacturers called before data load');
    return [];
  }
  const allManufacturers = [];
  Object.keys(data.MMdM.countries).forEach(country => {
    Object.keys(data.MMdM.countries[country].manufacturers).forEach(manufacturer => {
      allManufacturers.push({ name: manufacturer, country: country });
    });
  });
  // Sort alphabetically by manufacturer name A to Z, then reverse to Z to A
  allManufacturers.sort((a, b) => a.name.localeCompare(b.name));
  allManufacturers.reverse();
  return allManufacturers;
}

// Helper to calculate cylinder angle
export function getCylinderAngle(country, manufacturer, cylinder, manufacturerAngle, data) {
  if (!data) return manufacturerAngle; // Fallback
  const cylinders = Object.keys(data.MMdM.countries[country].manufacturers[manufacturer].cylinders || {})
    .sort((a, b) => parseInt(a) - parseInt(b));
  const index = cylinders.indexOf(cylinder);
  if (index === -1) return manufacturerAngle;
  const angleSpread = cylinders.length > 1 ? Math.PI / 18 : 0;
  return manufacturerAngle + (index - (cylinders.length - 1) / 2) * angleSpread;
}

// Helper to approximate model angle if needed
export function getModelAngle(country, manufacturer, cylinder, selectedModel, cylinderAngle, data) {
  if (!data) return cylinderAngle; // Fallback
  const models = data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cylinder] || [];
  const index = models.findIndex(m => m.manufacturer_engine_model === selectedModel);
  if (index === -1) return cylinderAngle;
  const angleSpread = models.length > 1 ? Math.PI / 18 : 0;
  return cylinderAngle + (index - (models.length - 1) / 2) * angleSpread;
}
// Add to data.js for save
export async function saveData() {
  try {
    const response = await fetch('./catalog.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catalogData, null, 2)
    });
    if (response.ok) {
      console.log('Catalog saved');
      alert('Changes saved!');
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('Save failed - check console.');
  }
}