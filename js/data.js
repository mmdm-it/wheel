// data.js — Handles loading, querying, and saving catalog data

let catalogData = null;

/**
 * Load catalog data from JSON file.
 * Returns Promise that resolves with the parsed data.
 */
export async function loadData() {
  try {
    const response = await fetch("./catalog.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    catalogData = await response.json();
    console.log("✅ Loaded catalog data", catalogData);
    return catalogData;
  } catch (err) {
    console.error("❌ Failed to load catalog.json:", err);
    alert("Failed to load catalog data. Please ensure catalog.json exists and is accessible.");
    throw err;
  }
}

/**
 * Get currently loaded catalog data.
 */
export function getData() {
  return catalogData;
}

/**
 * Return all manufacturers from all countries (sorted Z→A)
 */
export function getAllManufacturers(data = catalogData) {
  if (!data || !data.MMdM) return [];

  const manufacturers = [];

  for (const [country, cObj] of Object.entries(data.MMdM.countries || {})) {
    for (const mName of Object.keys(cObj.manufacturers || {})) {
      manufacturers.push({ name: mName, country });
    }
  }

  return manufacturers.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Compute cylinder angle for layout
 */
export function getCylinderAngle(country, manufacturer, cylinder, manufacturerAngle, data = catalogData) {
  try {
    const cylinders = Object.keys(data.MMdM.countries[country].manufacturers[manufacturer].cylinders || {})
      .sort((a, b) => parseInt(a) - parseInt(b));
    const idx = cylinders.indexOf(cylinder);
    if (idx === -1) return manufacturerAngle;

    const spread = cylinders.length > 1 ? Math.PI / 18 : 0;
    return manufacturerAngle + (idx - (cylinders.length - 1) / 2) * spread;
  } catch {
    return manufacturerAngle;
  }
}

/**
 * Compute model angle for layout
 */
export function getModelAngle(country, manufacturer, cylinder, model, cylinderAngle, data = catalogData) {
  try {
    const models = data.MMdM.countries[country].manufacturers[manufacturer].cylinders[cylinder] || [];
    const idx = models.findIndex(m => m.manufacturer_engine_model === model);
    if (idx === -1) return cylinderAngle;

    const spread = models.length > 1 ? Math.PI / 18 : 0;
    return cylinderAngle + (idx - (models.length - 1) / 2) * spread;
  } catch {
    return cylinderAngle;
  }
}

/**
 * Save changes locally by prompting user to download updated JSON.
 * (Browsers cannot overwrite local files directly.)
 */
export function saveDataLocal() {
  if (!catalogData) {
    alert("No data loaded — cannot save.");
    return;
  }

  const blob = new Blob([JSON.stringify(catalogData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `catalog_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("💾 Catalog exported locally.");
  alert("Catalog data exported as JSON file.");
}

/**
 * Set (replace) the current catalog data manually.
 */
export function setData(newData) {
  catalogData = structuredClone(newData);
}
