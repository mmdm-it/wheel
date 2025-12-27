// Volume-specific chain/build helpers extracted from the host page.
// These remain pure functions over manifests and options.

export function getCatalogChildren(manifest, selected) {
  const id = selected?.id;
  if (!id) return [];
  const [marketId, countryId, manufacturerId] = id.split('__');
  const manufacturer = manifest?.MMdM?.markets?.[marketId]?.countries?.[countryId]?.manufacturers?.[manufacturerId];
  if (!manufacturer) return [];
  const cylinders = manufacturer.cylinders || {};
  const children = [];
  Object.entries(cylinders).forEach(([cylKey, cylVal]) => {
    const models = Array.isArray(cylVal.models) ? cylVal.models : [];
    models.forEach((model, idx) => {
      const modelId = `model:${manufacturerId}:${cylKey}:${model.engine_model || idx}`;
      children.push({
        id: modelId,
        name: model.engine_model || modelId,
        order: idx,
        parentId: id,
        cylinder: cylKey,
        level: 'model'
      });
    });
  });
  return children.map((child, idx) => ({ ...child, order: Number.isFinite(child.order) ? child.order : idx }));
}

export function getCalendarMonths(manifest, selected, calendarMode) {
  if (calendarMode !== 'year') return [];
  const yearId = selected?.id;
  if (!yearId) return [];
  const years = manifest?.Calendar?.years || {};
  const yearEntry = years[yearId] || Object.values(years).find(y => String(y.id || '') === String(yearId));
  if (!yearEntry?.months) return [];
  return Object.entries(yearEntry.months).map(([monthKey, monthVal], idx) => ({
    id: monthVal?.id || `${yearId}:${monthKey}`,
    name: monthVal?.name || monthKey,
    order: Number.isFinite(monthVal?.sort_number) ? monthVal.sort_number : idx,
    parentId: yearId,
    level: 'month'
  })).sort((a, b) => {
    if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
    return a.order - b.order;
  }).map((item, idx) => ({ ...item, order: idx }));
}

export function getBibleChapters(manifest, selected, namesMap, bibleMode) {
  if (bibleMode !== 'book') return [];
  const bookId = selected?.id;
  if (!bookId) return [];
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  let bookEntry = null;
  Object.values(testaments).some(testament => {
    const sections = testament?.sections || {};
    return Object.values(sections).some(section => {
      const books = section?.books || {};
      if (books[bookId]) {
        bookEntry = books[bookId];
        return true;
      }
      return false;
    });
  });
  if (!bookEntry?.chapters) return [];
  return Object.entries(bookEntry.chapters).map(([chapterKey, chapterVal], idx) => {
    const chapterNum = Number.parseInt(chapterKey, 10);
    const label = Number.isFinite(chapterNum) ? `Chapter ${chapterNum}` : (namesMap?.sections?.[chapterKey] || chapterKey);
    return {
      id: chapterVal?.id || `${bookId}:${chapterKey}`,
      name: chapterVal?.name || label,
      order: Number.isFinite(chapterVal?.sort_number) ? chapterVal.sort_number : idx,
      parentId: bookId,
      level: 'chapter'
    };
  }).sort((a, b) => {
    if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
    return a.order - b.order;
  }).map((item, idx) => ({ ...item, order: idx }));
}

export function getPlacesLevels(manifest) {
  const levels = manifest?.Places?.display_config?.hierarchy_levels;
  if (!levels) return [];
  return Object.keys(levels);
}

function pluralizeLevel(level) {
  if (!level) return '';
  if (level.endsWith('y')) return `${level.slice(0, -1)}ies`;
  if (level.endsWith('s')) return `${level}es`;
  return `${level}s`;
}

// Builds ordered items for a Places hierarchy level using optional parent context.
export function buildPlacesLevel(manifest, levels, levelIndex, { selectedId, parentItem, contextParentId } = {}) {
  const places = manifest?.Places;
  if (!places || !levels?.length || levelIndex < 0 || levelIndex >= levels.length) {
    return { items: [], selectedIndex: 0, preserveOrder: true };
  }
  const levelName = levels[levelIndex];
  const levelKey = pluralizeLevel(levelName);
  const parentLevelName = levelIndex > 0 ? levels[levelIndex - 1] : null;
  const parentLevelKey = parentLevelName ? pluralizeLevel(parentLevelName) : null;
  const collection = places[levelKey] || {};
  const parentCollection = parentLevelKey ? places[parentLevelKey] || {} : {};
  const parent = parentItem || (parentLevelName && contextParentId ? parentCollection[contextParentId] : null);
  const filterParentId = parent?.id || contextParentId || null;
  const rootChildren = places.root?.children || [];
  const ids = (() => {
    if (parent && Array.isArray(parent[levelKey])) {
      return parent[levelKey];
    }
    if (filterParentId && parentLevelName) {
      const parentProp = `${parentLevelName}_id`;
      return Object.values(collection)
        .filter(entry => (entry?.[parentProp] ?? entry?.parent_id) === filterParentId)
        .sort((a, b) => {
          const as = Number.isFinite(a?.sort_number) ? a.sort_number : 0;
          const bs = Number.isFinite(b?.sort_number) ? b.sort_number : 0;
          if (as === bs) return (a?.name || '').localeCompare(b?.name || '');
          return as - bs;
        })
        .map(entry => entry.id);
    }
    if (levelIndex === 0 && rootChildren.length) {
      return rootChildren;
    }
    return Object.keys(collection);
  })();
  const items = ids
    .map((id, idx) => {
      const raw = collection[id] || { id, name: id };
      const sort = Number.isFinite(raw.sort_number) ? raw.sort_number : idx;
      return {
        id: raw.id || id,
        name: raw.name || raw.id || id,
        sort,
        order: sort,
        parentId: parent?.id ?? filterParentId ?? raw[`${parentLevelName}_id`] ?? raw.parent_id ?? null,
        parentName: parent?.name || null,
        level: levelName
      };
    })
    .sort((a, b) => {
      if (a.sort === b.sort) return (a.name || '').localeCompare(b.name || '');
      return a.sort - b.sort;
    })
    .map((item, idx) => ({ ...item, order: idx }));
  const selectedIndex = (() => {
    if (selectedId) {
      const idx = items.findIndex(item => item?.id === selectedId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex, preserveOrder: true };
}

export function buildCatalogManufacturers(manifest, { initialItemId } = {}) {
  const markets = manifest?.MMdM?.markets;
  if (!markets) return { items: [], selectedIndex: 0, preserveOrder: false };
  const items = [];
  const target = initialItemId ? String(initialItemId).toLowerCase() : null;
  Object.entries(markets).forEach(([marketId, market]) => {
    const countries = market?.countries || {};
    Object.entries(countries).forEach(([countryId, country]) => {
      const manufacturers = country?.manufacturers || {};
      Object.entries(manufacturers).forEach(([manufacturerId, manufacturer]) => {
        items.push({
          id: `${marketId}__${countryId}__${manufacturerId}`,
          name: manufacturerId,
          sort: Number.isFinite(manufacturer?.sort_number) ? manufacturer.sort_number : items.length + 1
        });
      });
    });
  });

  items.sort((a, b) => {
    const as = a.sort || 0;
    const bs = b.sort || 0;
    if (as === bs) return (a.name || '').localeCompare(b.name || '');
    return as - bs;
  });
  items.forEach((item, idx) => { item.order = idx; });

  const selectedIndex = (() => {
    if (target) {
      const idx = items.findIndex(item => {
        const simple = String(item.name || '').toLowerCase();
        if (simple === target) return true;
        return String(item.id || '').toLowerCase() === target;
      });
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  return { items, selectedIndex, preserveOrder: true };
}

export function buildCalendarMillennia(manifest, { initialItemId } = {}) {
  const millennia = manifest?.Calendar?.millennia || {};
  const items = Object.entries(millennia).map(([id, milli], idx) => ({
    id,
    name: milli.name || id,
    sort: milli?.sort_number || idx,
    order: milli?.sort_number || idx,
    parentId: null
  })).sort((a, b) => {
    if (a.sort === b.sort) return (a.name || '').localeCompare(b.name || '');
    return a.sort - b.sort;
  }).map((item, idx) => ({ ...item, order: idx }));
  const selectedIndex = (() => {
    if (initialItemId) {
      const idx = items.findIndex(item => item.id === initialItemId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex, preserveOrder: true };
}

export function buildCalendarYears(manifest, { arrangement, initialItemId, filterMillenniumId } = {}) {
  const years = manifest?.Calendar?.years;
  if (!years) return { items: [], selectedIndex: 0, preserveOrder: false };
  const items = [];
  Object.entries(years).forEach(([yearId, year]) => {
    if (filterMillenniumId && (year?.millennium_id || year?.millenniumId) !== filterMillenniumId) return;
    items.push({
      id: yearId,
      name: year.name || year.year_display || String(year.year_number || yearId),
      sort: year?.sort_number || year?.year_number || items.length + 1,
      yearNumber: year.year_number,
      parentId: year.millennium_id || year.millenniumId || null,
      level: 'year'
    });
  });

  items.sort((a, b) => {
    if ((arrangement || '').startsWith('ascending')) {
      return (a.sort || 0) - (b.sort || 0);
    }
    if ((arrangement || '').startsWith('descending')) {
      return (b.sort || 0) - (a.sort || 0);
    }
    const as = a.sort || 0;
    const bs = b.sort || 0;
    if (as === bs) return (a.name || '').localeCompare(b.name || '');
    return as - bs;
  });
  items.forEach((item, idx) => { item.order = idx; });

  const selectedIndex = (() => {
    if (initialItemId) {
      const idx = items.findIndex(item => item.id === initialItemId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  return { items, selectedIndex, preserveOrder: true };
}

export function buildBibleSections(manifest, { testamentId, sectionId, namesMap } = {}) {
  const testaments = manifest?.Gutenberg_Bible?.testaments;
  if (!testaments) return { items: [], selectedIndex: 0, preserveOrder: false };
  const items = [];
  let activeTestament = testaments[testamentId];
  if (!activeTestament) {
    const fallbackTestaments = Object.values(testaments);
    activeTestament = fallbackTestaments[0];
    testamentId = Object.keys(testaments)[0];
  }
  const sections = activeTestament?.sections || {};
  const activeTestamentId = testamentId || Object.keys(testaments)[0];
  Object.entries(sections).forEach(([sectionKey, sectionVal], idx) => {
    items.push({
      id: sectionKey,
      name: namesMap?.sections?.[sectionKey] || sectionVal?.name || sectionKey,
      sort: sectionVal?.sort_number || idx,
      order: sectionVal?.sort_number || idx,
      testamentId: activeTestamentId
    });
  });
  items.sort((a, b) => {
    if (a.sort === b.sort) return (a.name || '').localeCompare(b.name || '');
    return a.sort - b.sort;
  });
  items.forEach((item, idx) => { item.order = idx; });

  const selectedIndex = (() => {
    if (sectionId) {
      const idx = items.findIndex(item => item.id === sectionId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  const activeTestamentIdValue = activeTestamentId;

  return {
    items,
    selectedIndex,
    preserveOrder: true,
    meta: {
      testament: activeTestament,
      testamentId: activeTestamentIdValue
    }
  };
}

export function buildBibleBooks(manifest, namesMap = {}) {
  const testaments = manifest?.Gutenberg_Bible?.testaments;
  if (!testaments) return [];
  const bookNames = namesMap.books || namesMap;
  const sectionNames = namesMap.sections || {};
  const items = [];
  Object.entries(testaments).forEach(([testamentId, testament]) => {
    const sections = testament?.sections || {};
    Object.entries(sections).forEach(([sectionId, section]) => {
      const books = section?.books || {};
      Object.entries(books).forEach(([bookId, book]) => {
        items.push({
          id: bookId,
          name: bookNames?.[bookId] || book?.book_name || book?.name || bookId,
          sort: book?.sort_number || items.length + 1,
          sectionId,
          parentName: sectionNames?.[sectionId] || section?.name || sectionId
        });
      });
    });
  });
  return items;
}
