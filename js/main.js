// main.js: Entry point for catalog visualization
import { loadData, getData } from './data.js';
import { renderAllManufacturers } from './render.js';
import { growCentral, stageInContent, fadeOutContent } from './animations.js';
import { initInteractions, isInActivePath, manufacturerAngles, cylinderAngles, modelAngles, activePath, activeType } from './interactions.js';
import { CONFIG } from './config.js';

const svg = document.getElementById('catalogSvg');
const mainGroup = document.getElementById('mainGroup');
const centralGroup = document.getElementById('centralGroup');
const pathLinesGroup = document.getElementById('pathLines');
const manufacturersGroup = document.getElementById('manufacturers');
const cylindersGroup = document.getElementById('cylinders');
const modelsGroup = document.getElementById('models');
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Globals
window.addToCart = function(mmdmModel) {
  console.log('Added to cart:', mmdmModel);
  alert(`Added ${mmdmModel.model} to cart! Price: $${mmdmModel.price}`);
};

// showModelInfo (with stroke add)
function showModelInfo(modelFullKey) {
  const data = getData();
  if (!data) return;
  const parts = modelFullKey.split('/');
  const country = parts[0], manuf = parts[1], cyl = parts[2], model = parts[3];
  const engineObj = data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].find(m => m.manufacturer_engine_model === model);
  if (!engineObj || !engineObj.manifold_alternatives || engineObj.manifold_alternatives.length === 0 || 
      !engineObj.manifold_alternatives[0].mmdm_models || engineObj.manifold_alternatives[0].mmdm_models.length === 0) return;
  const alternative = engineObj.manifold_alternatives[0];
  const mmdmModel = alternative.mmdm_models[0];

  const existingFo = centralGroup.querySelector('foreignObject');
  if (existingFo) existingFo.remove();

  const circle = centralGroup.querySelector('circle');
  circle.setAttribute('stroke', 'black');

  const fo = document.createElementNS(CONFIG.NS, 'foreignObject');
  fo.setAttribute('x', CONFIG.FO_X.toString());
  fo.setAttribute('y', CONFIG.FO_Y.toString());
  fo.setAttribute('width', CONFIG.FO_WIDTH.toString());
  fo.setAttribute('height', CONFIG.FO_HEIGHT.toString());

  const containerDiv = document.createElement('div');
  containerDiv.style.cssText = `${CONFIG.TEXT_FONT}; padding: 60px 10px 10px 10px; overflow: auto; text-align: center; line-height: 1.2; cursor: pointer; color: #f2f2e6; position: relative; height: 100%; font-family: ${CONFIG.TEXT_FAMILY};`;

  const descDiv = document.createElement('div');
  descDiv.id = 'desc';
  descDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out;';
  descDiv.innerHTML = `MMdM: ${mmdmModel.model}<br>${mmdmModel.description}`;
  containerDiv.appendChild(descDiv);

  const oemPriceDiv = document.createElement('div');
  oemPriceDiv.id = 'oemPrice';
  oemPriceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
  oemPriceDiv.innerHTML = `OEM Price: $${alternative.oem_price}`;
  containerDiv.appendChild(oemPriceDiv);

  const priceDiv = document.createElement('div');
  priceDiv.id = 'price';
  priceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
  priceDiv.innerHTML = `MMdM Price: $${mmdmModel.price}`;
  containerDiv.appendChild(priceDiv);

  const photoDiv = document.createElement('div');
  photoDiv.id = 'photo';
  photoDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px; max-height: 100px; overflow: hidden;';
  if (mmdmModel.photos && mmdmModel.photos.length > 0) {
    photoDiv.innerHTML = `<img src="${mmdmModel.photos[0]}" style="max-width:100%; height:auto; border-radius: 5px;">`;
  } else {
    photoDiv.innerHTML = 'Photo not available.';
  }
  containerDiv.appendChild(photoDiv);

  const specsDiv = document.createElement('div');
  specsDiv.id = 'specs';
  specsDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px; text-align: left; font-size: 10px;';
  let specsHtml = '<ul style="margin: 0; padding-left: 20px;">';
  const specs = mmdmModel.specifications;
  specsHtml += `<li>Material: ${specs.material}</li>`;
  specsHtml += `<li>Weight: ${specs.weight}</li>`;
  specsHtml += `<li>Warranty: ${specs.warranty}</li>`;
  specsHtml += '<li>Dimensions:<ul style="margin: 0; padding-left: 20px;">';
  specsHtml += `<li>Height: ${specs.dimensions.height}</li>`;
  specsHtml += `<li>Width: ${specs.dimensions.width}</li>`;
  specsHtml += `<li>Length: ${specs.dimensions.length}</li>`;
  specsHtml += '</ul></li>';
  specsHtml += '</ul>';
  specsDiv.innerHTML = specsHtml;
  containerDiv.appendChild(specsDiv);

  const linkDiv = document.createElement('div');
  linkDiv.id = 'link';
  linkDiv.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s ease-in-out;';
  linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart(${JSON.stringify(mmdmModel)}); return false;">Add to Cart</a>`;
  containerDiv.appendChild(linkDiv);

  fo.appendChild(containerDiv);
  centralGroup.appendChild(fo);

  growCentral(centralGroup, () => stageInContent(containerDiv));
}

function updateModelInfo(modelFullKey) {
  const data = getData();
  if (!data) return;
  const parts = modelFullKey.split('/');
  const country = parts[0], manuf = parts[1], cyl = parts[2], model = parts[3];
  const engineObj = data.MMdM.countries[country].manufacturers[manuf].cylinders[cyl].find(m => m.manufacturer_engine_model === model);
  if (!engineObj || !engineObj.manifold_alternatives || engineObj.manifold_alternatives.length === 0 || 
      !engineObj.manifold_alternatives[0].mmdm_models || engineObj.manifold_alternatives[0].mmdm_models.length === 0) return;
  const alternative = engineObj.manifold_alternatives[0];
  const mmdmModel = alternative.mmdm_models[0];

  const containerDiv = centralGroup.querySelector('div');
  if (!containerDiv) return;

  const descDiv = containerDiv.querySelector('#desc');
  const oemPriceDiv = containerDiv.querySelector('#oemPrice');
  const priceDiv = containerDiv.querySelector('#price');
  const photoDiv = containerDiv.querySelector('#photo');
  const specsDiv = containerDiv.querySelector('#specs');
  const linkDiv = containerDiv.querySelector('#link');

  if (!descDiv || !priceDiv || !linkDiv) return;

  fadeOutContent(containerDiv, () => {
    descDiv.innerHTML = `MMdM: ${mmdmModel.model}<br>${mmdmModel.description}`;
    if (oemPriceDiv) oemPriceDiv.innerHTML = `OEM Price: $${alternative.oem_price}`;
    priceDiv.innerHTML = `MMdM Price: $${mmdmModel.price}`;
    if (photoDiv) {
      if (mmdmModel.photos && mmdmModel.photos.length > 0) {
        photoDiv.innerHTML = `<img src="${mmdmModel.photos[0]}" style="max-width:100%; height:auto; border-radius: 5px;">`;
      } else {
        photoDiv.innerHTML = 'Photo not available.';
      }
    }
    if (specsDiv) {
      let specsHtml = '<ul style="margin: 0; padding-left: 20px;">';
      const specs = mmdmModel.specifications;
      specsHtml += `<li>Material: ${specs.material}</li>`;
      specsHtml += `<li>Weight: ${specs.weight}</li>`;
      specsHtml += `<li>Warranty: ${specs.warranty}</li>`;
      specsHtml += '<li>Dimensions:<ul style="margin: 0; padding-left: 20px;">';
      specsHtml += `<li>Height: ${specs.dimensions.height}</li>`;
      specsHtml += `<li>Width: ${specs.dimensions.width}</li>`;
      specsHtml += `<li>Length: ${specs.dimensions.length}</li>`;
      specsHtml += '</ul></li>';
      specsHtml += '</ul>';
      specsDiv.innerHTML = specsHtml;
    }
    linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart(${JSON.stringify(mmdmModel)}); return false;">Add to Cart</a>`;

    stageInContent(containerDiv);
  });
}

// Initial render
function initialRender(interactions) {
  console.log('Initial render firing');
  const addHitListeners = interactions.addHitListeners;
  renderAllManufacturers(manufacturersGroup, manufacturerAngles, activePath, isInActivePath, addHitListeners);
}

// Init
console.log('Initializing visualization');
loadData().then(() => {
  const interactions = initInteractions(svg, mainGroup, centralGroup, pathLinesGroup, cylindersGroup, modelsGroup, manufacturersGroup, isMobile, showModelInfo, updateModelInfo);
  initialRender(interactions);
}).catch(err => {
  console.error('Init failed:', err);
});