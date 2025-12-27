// Volume-specific pyramid config builders.
// Each builder stays isolated from the host view logic and only uses passed-in
// dependencies (manifest, state accessors, and UI callbacks).

export function createVolumePyramidConfig(options = {}) {
  const { volume } = options;
  const builders = {
    places: buildPlacesPyramid,
    catalog: buildCatalogPyramid,
    calendar: buildCalendarPyramid,
    bible: buildBiblePyramid
  };
  const builder = builders[volume];
  if (!builder) return null;
  return builder(options);
}

function buildPlacesPyramid({
  manifest,
  placesState,
  buildPlacesLevel,
  getApp,
  placesChildrenHandler
} = {}) {
  if (!placesState || !buildPlacesLevel || !manifest) return null;
  const getChildren = ({ selected }) => {
    if (!selected?.id) return [];
    if (!placesState?.levels?.length) return [];
    if (placesState.levelIndex >= placesState.levels.length - 1) return [];
    const nextLevelIndex = placesState.levelIndex + 1;
    const nextLevelName = placesState.levels[nextLevelIndex];
    const { items: childItems } = buildPlacesLevel(
      manifest,
      placesState.levels,
      nextLevelIndex,
      {
        parentItem: selected,
        contextParentId: selected.id,
        selectedId: placesState.selections?.[nextLevelName] || null
      }
    );
    return childItems || [];
  };

  const onClick = instr => {
    if (!instr?.item) return;
    const app = typeof getApp === 'function' ? getApp() : null;
    if (!placesState?.levels?.length) return;
    const nextLevelIndex = placesState.levelIndex + 1;
    if (nextLevelIndex >= (placesState.levels?.length || 0)) return;
    const nextLevelName = placesState.levels[nextLevelIndex];
    if (placesState.selections) {
      placesState.selections[nextLevelName] = instr.item.id || instr.id || null;
    }
    if (typeof placesChildrenHandler === 'function') {
      placesChildrenHandler({ selected: instr.item, setItems: app?.setPrimaryItems });
    }
  };

  return { getChildren, onClick };
}

function buildCatalogPyramid({
  manifest,
  getCatalogChildren,
  getApp,
  catalogModeRef,
  setCatalogMode
} = {}) {
  if (!manifest || typeof getCatalogChildren !== 'function') return null;
  const getChildren = ({ selected }) => getCatalogChildren(manifest, selected);
  const onClick = instr => {
    if (!instr?.item) return;
    if (typeof catalogModeRef === 'function' && catalogModeRef() !== 'manufacturer') return;
    const app = typeof getApp === 'function' ? getApp() : null;
    const parent = app?.nav?.getCurrent?.();
    const models = getCatalogChildren(manifest, parent);
    if (!models.length) return;
    const selectedIdx = models.findIndex(m => m.id === instr.item.id);
    if (typeof setCatalogMode === 'function') setCatalogMode('model');
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true, showInner: true });
    }
    if (app?.setPrimaryItems) {
      app.setPrimaryItems(models, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
  };
  return { getChildren, onClick };
}

function buildCalendarPyramid({
  manifest,
  getCalendarMonths,
  getApp,
  calendarModeRef,
  setCalendarMode,
  setCalendarMonthContext
} = {}) {
  if (!manifest || typeof getCalendarMonths !== 'function') return null;
  const getChildren = ({ selected }) => getCalendarMonths(manifest, selected, calendarModeRef?.());
  const onClick = instr => {
    if (!instr?.item) return;
    if (typeof calendarModeRef === 'function' && calendarModeRef() !== 'year') return;
    const app = typeof getApp === 'function' ? getApp() : null;
    const year = app?.nav?.getCurrent?.();
    if (!year) return;
    const months = getCalendarMonths(manifest, year, calendarModeRef?.());
    if (!months.length) return;
    const selectedIdx = months.findIndex(m => m.id === instr.item.id);
    if (typeof setCalendarMode === 'function') setCalendarMode('month');
    if (typeof setCalendarMonthContext === 'function') {
      setCalendarMonthContext({
        yearId: year?.id || null,
        millenniumId: year?.parentId || year?.parent_id || null
      });
    }
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true, showInner: true });
    }
    if (app?.setPrimaryItems) {
      app.setPrimaryItems(months, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
  };
  return { getChildren, onClick };
}

function buildBiblePyramid({
  manifest,
  namesMap,
  getBibleChapters,
  getApp,
  bibleModeRef,
  setBibleMode,
  setBibleChapterContext
} = {}) {
  if (!manifest || typeof getBibleChapters !== 'function') return null;
  const getChildren = ({ selected }) => getBibleChapters(manifest, selected, namesMap, bibleModeRef?.());
  const onClick = instr => {
    if (!instr?.item) return;
    if (typeof bibleModeRef === 'function' && bibleModeRef() !== 'book') return;
    const app = typeof getApp === 'function' ? getApp() : null;
    const book = app?.nav?.getCurrent?.();
    if (!book) return;
    const chapters = getBibleChapters(manifest, book, namesMap, bibleModeRef?.());
    if (!chapters.length) return;
    const selectedIdx = chapters.findIndex(c => c.id === instr.item.id);
    if (typeof setBibleMode === 'function') setBibleMode('chapter');
    if (typeof setBibleChapterContext === 'function') {
      setBibleChapterContext({
        bookId: book.id,
        sectionId: book.sectionId,
        testamentId: book.testamentId
      });
    }
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true, showInner: true });
    }
    if (app?.setPrimaryItems) {
      app.setPrimaryItems(chapters, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
  };
  return { getChildren, onClick };
}
