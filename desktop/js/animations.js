// animations.js: Handles all growth, shrink, and fade animations
import { CONFIG } from './config.js';

// Grow central node (circle + logo) with easing, then calls callback
export function growCentral(centralGroup, callback) {
  const circle = centralGroup.querySelector('circle');
  const logo = centralGroup.querySelector('image');
  if (!circle || !logo) {
    if (callback) callback();
    return;
  }

  // Add stroke
  circle.setAttribute('stroke', 'black');

  // Start values (current or defaults)
  let startRadius = parseFloat(circle.getAttribute('r')) || CONFIG.CENTRAL.start.radius;
  let startX = parseFloat(logo.getAttribute('x')) || CONFIG.CENTRAL.start.logo.x;
  let startY = parseFloat(logo.getAttribute('y')) || CONFIG.CENTRAL.start.logo.y;
  let startW = parseFloat(logo.getAttribute('width')) || CONFIG.CENTRAL.start.logo.width;
  let startH = parseFloat(logo.getAttribute('height')) || CONFIG.CENTRAL.start.logo.height;

  // End values
  const endRadius = CONFIG.CENTRAL.end.radius;
  const endX = CONFIG.CENTRAL.end.logo.x;
  const endY = CONFIG.CENTRAL.end.logo.y;
  const endW = CONFIG.CENTRAL.end.logo.width;
  const endH = CONFIG.CENTRAL.end.logo.height;

  const duration = CONFIG.ANIMATION_DURATION;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    let progress = Math.min(elapsed / duration, 1);
    progress = CONFIG.EASING.grow(progress);
    const currentRadius = startRadius + (endRadius - startRadius) * progress;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    const currentW = startW + (endW - startW) * progress;
    const currentH = startH + (endH - startH) * progress;
    circle.setAttribute('r', currentRadius);
    logo.setAttribute('x', currentX);
    logo.setAttribute('y', currentY);
    logo.setAttribute('width', currentW);
    logo.setAttribute('height', currentH);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (callback) callback();
    }
  }

  requestAnimationFrame(animate);
}

// Shrink central node back to original, with staged fade-out, then callback
export function shrinkCentral(centralGroup, callback) {
  const descDiv = centralGroup.querySelector('#desc');
  const priceDiv = centralGroup.querySelector('#price');
  const linkDiv = centralGroup.querySelector('#link');
  const oemPriceDiv = centralGroup.querySelector('#oemPrice');
  const photoDiv = centralGroup.querySelector('#photo');
  const specsDiv = centralGroup.querySelector('#specs');

  if (!linkDiv) {
    if (callback) callback();
    return;
  }

  // Staged fade out
  linkDiv.style.opacity = '0';
  setTimeout(() => {
    if (priceDiv) priceDiv.style.opacity = '0';
    setTimeout(() => {
      if (descDiv) descDiv.style.opacity = '0';
      setTimeout(() => {
        // Now shrink
        const circle = centralGroup.querySelector('circle');
        const logo = centralGroup.querySelector('image');
        if (!circle || !logo) {
          cleanup(callback);
          return;
        }

        // Start values (current or defaults)
        let startRadius = parseFloat(circle.getAttribute('r')) || CONFIG.CENTRAL.end.radius;
        let startX = parseFloat(logo.getAttribute('x')) || CONFIG.CENTRAL.end.logo.x;
        let startY = parseFloat(logo.getAttribute('y')) || CONFIG.CENTRAL.end.logo.y;
        let startW = parseFloat(logo.getAttribute('width')) || CONFIG.CENTRAL.end.logo.width;
        let startH = parseFloat(logo.getAttribute('height')) || CONFIG.CENTRAL.end.logo.height;

        // End values
        const endRadius = CONFIG.CENTRAL.start.radius;
        const endX = CONFIG.CENTRAL.start.logo.x;
        const endY = CONFIG.CENTRAL.start.logo.y;
        const endW = CONFIG.CENTRAL.start.logo.width;
        const endH = CONFIG.CENTRAL.start.logo.height;

        const duration = CONFIG.ANIMATION_DURATION;
        const startTime = performance.now();

        function animate(currentTime) {
          const elapsed = currentTime - startTime;
          let progress = Math.min(elapsed / duration, 1);
          progress = CONFIG.EASING.shrink(progress);
          const currentRadius = startRadius - (startRadius - endRadius) * progress;
          const currentX = startX - (startX - endX) * progress;
          const currentY = startY - (startY - endY) * progress;
          const currentW = startW - (startW - endW) * progress;
          const currentH = startH - (startH - endH) * progress;
          circle.setAttribute('r', currentRadius);
          logo.setAttribute('x', currentX);
          logo.setAttribute('y', currentY);
          logo.setAttribute('width', currentW);
          logo.setAttribute('height', currentH);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            cleanup(callback);
          }
        }

        requestAnimationFrame(animate);

        function cleanup(cb) {
          const fo = centralGroup.querySelector('foreignObject');
          if (fo) fo.remove();
          if (circle) circle.removeAttribute('stroke');
          if (cb) cb();
        }
      }, CONFIG.FADE_STAGES.pricesSpecs);
    }, CONFIG.FADE_STAGES.pricesSpecs);
  }, CONFIG.FADE_STAGES.link);
}

// Stage in content elements with delays (for showModelInfo)
export function stageInContent(containerDiv) {
  const descDiv = containerDiv.querySelector('#desc');
  const oemPriceDiv = containerDiv.querySelector('#oemPrice');
  const priceDiv = containerDiv.querySelector('#price');
  const specsDiv = containerDiv.querySelector('#specs');
  const photoDiv = containerDiv.querySelector('#photo');
  const linkDiv = containerDiv.querySelector('#link');

  setTimeout(() => {
    if (descDiv) descDiv.style.opacity = '1';
  }, CONFIG.FADE_STAGES.desc);

  setTimeout(() => {
    if (oemPriceDiv) oemPriceDiv.style.opacity = '1';
    if (priceDiv) priceDiv.style.opacity = '1';
    if (specsDiv) specsDiv.style.opacity = '1';
  }, CONFIG.FADE_STAGES.pricesSpecs);

  setTimeout(() => {
    if (photoDiv) photoDiv.style.opacity = '1';
  }, CONFIG.FADE_STAGES.photo);

  setTimeout(() => {
    if (linkDiv) linkDiv.style.opacity = '1';
  }, CONFIG.FADE_STAGES.link);
}

// Fade out content elements (for updateModelInfo)
export function fadeOutContent(containerDiv, callback) {
  const descDiv = containerDiv.querySelector('#desc');
  const oemPriceDiv = containerDiv.querySelector('#oemPrice');
  const priceDiv = containerDiv.querySelector('#price');
  const photoDiv = containerDiv.querySelector('#photo');
  const specsDiv = containerDiv.querySelector('#specs');
  const linkDiv = containerDiv.querySelector('#link');

  if (descDiv) descDiv.style.opacity = '0';
  if (oemPriceDiv) oemPriceDiv.style.opacity = '0';
  if (priceDiv) priceDiv.style.opacity = '0';
  if (photoDiv) photoDiv.style.opacity = '0';
  if (specsDiv) specsDiv.style.opacity = '0';
  if (linkDiv) linkDiv.style.opacity = '0';

  setTimeout(() => {
    if (callback) callback();
  }, CONFIG.FADE_STAGES.fadeOutDelay);
}

// Revert central (wrapper for shrink)
export function revertCentral(centralGroup, callback) {
  shrinkCentral(centralGroup, callback);
}