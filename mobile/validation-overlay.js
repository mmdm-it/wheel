/**
 * Validation overlay utilities (sort_number errors, etc.)
 */

function buildParentNames(item) {
    const parentNames = [];
    if (item && Array.isArray(item.__path)) {
        item.__path.slice(0, -1).forEach(segment => {
            if (typeof segment === 'string') {
                parentNames.push(segment);
            } else if (segment && (segment.name || segment.key)) {
                parentNames.push(segment.name || segment.key);
            }
        });
    }
    return parentNames;
}

function renderSortNumberError(items, context) {
    if (!items || items.length === 0) return false;
    const firstItem = items[0];
    const parentNames = buildParentNames(firstItem);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'sort-number-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff3333;
        color: white;
        padding: 30px;
        border-radius: 10px;
        font-size: 20px;
        font-weight: bold;
        z-index: 10000;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        max-width: 80%;
    `;

    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '24px';
    titleEl.style.marginBottom = '15px';
    titleEl.textContent = '⚠️ ERROR - Sort Number Missing';

    const contextEl = document.createElement('div');
    contextEl.style.fontSize = '16px';
    contextEl.style.marginBottom = '10px';
    contextEl.textContent = context;

    const parentInfoEl = document.createElement('div');
    parentInfoEl.style.fontSize = '14px';
    parentInfoEl.style.marginTop = '10px';
    parentInfoEl.style.opacity = '0.9';
    if (parentNames.length > 0) {
        parentInfoEl.textContent = `Parent: ${parentNames.join(' → ')}`;
    }

    const listEl = document.createElement('ul');
    listEl.style.fontSize = '14px';
    listEl.style.textAlign = 'left';
    listEl.style.marginTop = '15px';
    listEl.style.paddingLeft = '20px';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name || item.key} (level: ${item.__level || 'unknown'})`;
        listEl.appendChild(li);
    });

    const footerEl = document.createElement('div');
    footerEl.style.fontSize = '12px';
    footerEl.style.marginTop = '20px';
    footerEl.style.opacity = '0.9';
    footerEl.textContent = 'Items cannot be displayed without sort_number';

    errorDiv.appendChild(titleEl);
    errorDiv.appendChild(contextEl);
    if (parentNames.length > 0) {
        errorDiv.appendChild(parentInfoEl);
    }
    errorDiv.appendChild(listEl);
    errorDiv.appendChild(footerEl);

    document.body.appendChild(errorDiv);
    return true;
}

function showSortNumberErrorOverlay(items, context) {
    // Remove any existing overlay to avoid stacking
    document.querySelectorAll('.sort-number-error').forEach(el => el.remove());
    return renderSortNumberError(items, context);
}

export { showSortNumberErrorOverlay };
