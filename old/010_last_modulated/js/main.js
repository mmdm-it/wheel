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

// Market buttons
const europeBtn = document.getElementById('europeAsia');
const americaBtn = document.getElementById('northSouthAmerica');
let activeMarket = null;

// Globals
window.addToCart = function(mmdmManifoldData) {
  console.log('Added to cart:', mmdmManifoldData);
  alert(`Added ${mmdmManifoldData.model} to cart! Price: $${mmdmManifoldData.price}`);
};

// showModelInfo (updated for new structure)
function showModelInfo(modelFullKey) {
  const data = getData();
  if (!data) return;
  const parts = modelFullKey.split('/');
  if (parts.length < 5) return; // Expect market/country/manuf/cyl/engine_model
  const market = parts[0], country = parts[1], manuf = parts[2], cyl = parts[3], engine_model = parts[4];
  const engineObj = data.MMdM.markets[market]?.countries[country]?.manufacturers[manuf]?.cylinders[cyl]?.find(e => e.engine_model === engine_model);
  if (!engineObj || !engineObj.manifold_alternatives) return;

  // Find MMdM alternative
  const mmdmAlt = engineObj.manifold_alternatives.find(a => a.type === 'mmdm');
  if (!mmdmAlt || !mmdmAlt.mmdm_manifold) return;
  const mmdmManifold = mmdmAlt.mmdm_manifold;

  // Find OEM alternative for price (first one)
  const oemAlt = engineObj.manifold_alternatives.find(a => a.type === 'oem');
  const oemPrice = oemAlt ? oemAlt.price : null;

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
  descDiv.innerHTML = `MMdM: ${mmdmAlt.part_number}<br>${mmdmManifold.description}`;
  containerDiv.appendChild(descDiv);

  const oemPriceDiv = document.createElement('div');
  oemPriceDiv.id = 'oemPrice';
  oemPriceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
  if (oemPrice) {
    oemPriceDiv.innerHTML = `OEM Price: $${oemPrice}`;
  } else {
    oemPriceDiv.innerHTML = 'OEM Price: N/A';
  }
  containerDiv.appendChild(oemPriceDiv);

  const priceDiv = document.createElement('div');
  priceDiv.id = 'price';
  priceDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px;';
  priceDiv.innerHTML = `MMdM Price: $${mmdmAlt.price}`;
  containerDiv.appendChild(priceDiv);

  const photoDiv = document.createElement('div');
  photoDiv.id = 'photo';
  photoDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px; max-height: 100px; overflow: hidden;';
  if (mmdmManifold.photos && mmdmManifold.photos.length > 0) {
    photoDiv.innerHTML = `<img src="${mmdmManifold.photos[0]}" style="max-width:100%; height:auto; border-radius: 5px;">`;
  } else {
    photoDiv.innerHTML = 'Photo not available.';
  }
  containerDiv.appendChild(photoDiv);

  const specsDiv = document.createElement('div');
  specsDiv.id = 'specs';
  specsDiv.style.cssText = 'opacity: 0; transition: opacity 0.3s ease-in-out; margin-top: 10px; text-align: left; font-size: 10px;';
  let specsHtml = '<ul style="margin: 0; padding-left: 20px;">';
  const specs = mmdmManifold.specifications;
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
  const cartData = {
    model: mmdmAlt.part_number,
    price: mmdmAlt.price,
    description: mmdmManifold.description,
    specifications: mmdmManifold.specifications,
    photos: mmdmManifold.photos
  };
  linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart(${JSON.stringify(cartData)}); return false;">Add to Cart</a>`;
  containerDiv.appendChild(linkDiv);

  fo.appendChild(containerDiv);
  centralGroup.appendChild(fo);

  growCentral(centralGroup, () => stageInContent(containerDiv));
}

function updateModelInfo(modelFullKey) {
  const data = getData();
  if (!data) return;
  const parts = modelFullKey.split('/');
  if (parts.length < 5) return;
  const market = parts[0], country = parts[1], manuf = parts[2], cyl = parts[3], engine_model = parts[4];
  const engineObj = data.MMdM.markets[market]?.countries[country]?.manufacturers[manuf]?.cylinders[cyl]?.find(e => e.engine_model === engine_model);
  if (!engineObj || !engineObj.manifold_alternatives) return;

  const mmdmAlt = engineObj.manifold_alternatives.find(a => a.type === 'mmdm');
  if (!mmdmAlt || !mmdmAlt.mmdm_manifold) return;
  const mmdmManifold = mmdmAlt.mmdm_manifold;

  const oemAlt = engineObj.manifold_alternatives.find(a => a.type === 'oem');
  const oemPrice = oemAlt ? oemAlt.price : null;

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
    descDiv.innerHTML = `MMdM: ${mmdmAlt.part_number}<br>${mmdmManifold.description}`;
    if (oemPriceDiv) {
      oemPriceDiv.innerHTML = oemPrice ? `OEM Price: $${oemPrice}` : 'OEM Price: N/A';
    }
    priceDiv.innerHTML = `MMdM Price: $${mmdmAlt.price}`;
    if (photoDiv) {
      if (mmdmManifold.photos && mmdmManifold.photos.length > 0) {
        photoDiv.innerHTML = `<img src="${mmdmManifold.photos[0]}" style="max-width:100%; height:auto; border-radius: 5px;">`;
      } else {
        photoDiv.innerHTML = 'Photo not available.';
      }
    }
    if (specsDiv) {
      let specsHtml = '<ul style="margin: 0; padding-left: 20px;">';
      const specs = mmdmManifold.specifications;
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
    const cartData = {
      model: mmdmAlt.part_number,
      price: mmdmAlt.price,
      description: mmdmManifold.description,
      specifications: mmdmManifold.specifications,
      photos: mmdmManifold.photos
    };
    linkDiv.innerHTML = `<a href="#" style="color: #f1b800; text-decoration: underline;" onclick="addToCart(${JSON.stringify(cartData)}); return false;">Add to Cart</a>`;

    stageInContent(containerDiv);
  });
}

// Initial render (no initial manufacturers, wait for market selection)
function initialRender(interactions) {
  // Empty initially
  manufacturersGroup.innerHTML = '';
}

// Init
console.log('Initializing visualization');
loadData().then(() => {
  const interactions = initInteractions(svg, mainGroup, centralGroup, pathLinesGroup, cylindersGroup, modelsGroup, manufacturersGroup, isMobile, showModelInfo, updateModelInfo);
  initialRender(interactions);

  // Market button events (click to select market persistently)
  europeBtn.addEventListener('click', () => {
    if (activeMarket === 'Europe & Asia') return; // Already active
    activeMarket = 'Europe & Asia';
    europeBtn.classList.add('active');
    americaBtn.classList.remove('active');
    renderManufacturersForMarket('Europe & Asia', interactions);
  });

  americaBtn.addEventListener('click', () => {
    if (activeMarket === 'North & South America') return; // Already active
    activeMarket = 'North & South America';
    americaBtn.classList.add('active');
    europeBtn.classList.remove('active');
    renderManufacturersForMarket('North & South America', interactions);
  });

}).catch(err => {
  console.error('Init failed:', err);
});

// Function to render manufacturers for a specific market (updated to use interactions)
function renderManufacturersForMarket(market, interactions) {
  // Clear existing
  manufacturersGroup.innerHTML = '';

  const data = getData();
  if (!data || !data.MMdM.markets[market]) {
    console.warn(`No data for market: ${market}`);
    return;
  }

  // Collect manufacturers with full keys
  const marketManufs = [];
  const marketData = data.MMdM.markets[market];
  for (const country in marketData.countries) {
    for (const manuf in marketData.countries[country].manufacturers) {
      const fullKey = `${market}/${country}/${manuf}`;
      marketManufs.push({
        key: fullKey,
        label: manuf,
        country: country,
        manufacturer: manuf
      });
    }
  }

  if (marketManufs.length === 0) {
    console.warn(`No manufacturers in market: ${market}`);
    return;
  }

  const addHitListeners = interactions.addHitListeners;
  renderAllManufacturers(manufacturersGroup, manufacturerAngles, activePath, isInActivePath, addHitListeners, marketManufs);
}