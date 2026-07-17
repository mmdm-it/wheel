// Pyramid config builders are provided by volume-specific handlers; the host simply
// invokes the supplied builder without branching on volume ids.
export function createVolumePyramidConfig(options = {}) {
  const { pyramidBuilder } = options;
  if (typeof pyramidBuilder !== 'function') return null;
  return pyramidBuilder(options);
}

export function buildPlacesPyramid({
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

export function buildCatalogPyramid({
  manifest,
  getCatalogChildren,
  getApp,
  catalogModeRef,
  setCatalogMode,
  savePreInState,
  launchGateway
} = {}) {
  if (!manifest || typeof getCatalogChildren !== 'function') return null;
  const getChildren = ({ selected }) => getCatalogChildren(manifest, selected);
  const onClick = instr => {
    if (!instr?.item) return;
    // Gateway node: a data-declared door into another volume. Hand off to
    // the host instead of navigating within this volume.
    if (instr.item.level === 'gateway' && instr.item.gateway && typeof launchGateway === 'function') {
      launchGateway(instr.item.gateway);
      return;
    }
    const app = typeof getApp === 'function' ? getApp() : null;
    const parent = app?.nav?.getCurrent?.();
    const children = getCatalogChildren(manifest, parent);
    if (!children.length) return;
    // Snapshot current nav state before migrating IN
    if (typeof savePreInState === 'function' && app?.nav) {
      const currentItems = app.nav.items;
      const currentIndex = currentItems.indexOf(app.nav.getCurrent());
      savePreInState({ items: currentItems, selectedIndex: currentIndex >= 0 ? currentIndex : 0, preserveOrder: true });
    }
    const selectedIdx = children.findIndex(m => m.id === instr.item.id);
    if (typeof setCatalogMode === 'function') setCatalogMode('child');
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true });
    }
    if (app?.setPrimaryItems) {
      // Migrate IN: siblings land on the focus ring with the clicked item selected.
      // If a leaf (model) lands in the magnifier, the render loop's leaf detection
      // will trigger the Detail Sector expand and suppress the Child Pyramid.
      // Use migrateIn for animated transition when available; fall back to instant swap.
      const migrateOrSet = app.migrateIn || app.setPrimaryItems;
      migrateOrSet(children, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
  };
  return { getChildren, onClick };
}

export function buildCalendarPyramid({
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
      setCalendarMonthContext({ yearId: year?.id || null });
    }
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true });
    }
    if (app?.setPrimaryItems) {
      const migrateOrSet = app.migrateIn || app.setPrimaryItems;
      migrateOrSet(months, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
  };
  return { getChildren, onClick };
}

export function buildBiblePyramid({
  manifest,
  namesMap,
  getBibleChapters,
  getBibleVerseItems,
  getBibleBooksForTestament,
  getBibleTestaments,
  prefetchBibleVerses,
  getApp,
  bibleModeRef,
  setBibleMode,
  setBibleChapterContext,
  setBibleVerseContext
} = {}) {
  if (!manifest || typeof getBibleChapters !== 'function') return null;
  const getChildren = ({ selected }) => {
    const mode = typeof bibleModeRef === 'function' ? bibleModeRef() : 'book';
    if (mode === 'root') {
      // Gateway root: BIBLIA SACRA LATINA in the magnifier, testaments below.
      if (typeof getBibleTestaments !== 'function') return [];
      return (getBibleTestaments().items || []).filter(Boolean);
    }
    if (mode === 'testament') {
      if (typeof getBibleBooksForTestament !== 'function') return [];
      // Pyramid-only abbreviations (PG ebook #825): full book names are too
      // long for pyramid nodes. The ring and magnifier keep the full names —
      // this rename never travels past the pyramid (onClick matches by id).
      const abbrevs = namesMap?.bookAbbreviations || null;
      return getBibleBooksForTestament(selected?.id).items.filter(Boolean).map(item => (
        abbrevs?.[item.id] ? { ...item, name: abbrevs[item.id] } : item
      ));
    }
    if (mode === 'book') {
      return getBibleChapters(manifest, selected, namesMap, 'book');
    }
    if (mode === 'chapter') {
      if (typeof getBibleVerseItems !== 'function') return [];
      const items = getBibleVerseItems(selected);
      // Trigger prefetch for this chapter if not yet cached; refresh pyramid when loaded.
      if (items.length === 0 && typeof prefetchBibleVerses === 'function' && selected?.meta?.externalFile) {
        const app = typeof getApp === 'function' ? getApp() : null;
        prefetchBibleVerses(selected, {
          onLoaded: () => { app?.refreshPyramid?.(); }
        });
      }
      return items;
    }
    return [];
  };
  const onClick = instr => {
    if (!instr?.item) return;
    const mode = typeof bibleModeRef === 'function' ? bibleModeRef() : 'book';
    const app = typeof getApp === 'function' ? getApp() : null;

    if (mode === 'root') {
      // Clicking a testament in the pyramid: ring advances to the testaments.
      if (typeof getBibleTestaments !== 'function') return;
      const { items: testamentItems } = getBibleTestaments();
      if (!testamentItems?.length) return;
      const selectedIdx = testamentItems.findIndex(t => t && t.id === instr.item.id);
      if (typeof setBibleMode === 'function') setBibleMode('testament');
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(testamentItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      return;
    }

    if (mode === 'testament') {
      // Clicking a book node in the pyramid when testaments are in the ring:
      // navigate IN — ring advances to the books of that testament, selected
      // to the clicked book, and bibleMode advances to 'book' (pyramid then
      // shows chapters).
      if (typeof getBibleBooksForTestament !== 'function') return;
      const testament = app?.nav?.getCurrent?.();
      if (!testament) return;
      const { items: bookItems } = getBibleBooksForTestament(testament.id);
      if (!bookItems.length) return;
      const selectedIdx = bookItems.findIndex(b => b && b.id === instr.item.id);
      if (typeof setBibleMode === 'function') setBibleMode('book');
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(bookItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      return;
    }

    if (mode === 'book') {
      const book = app?.nav?.getCurrent?.();
      if (!book) return;
      const chapters = getBibleChapters(manifest, book, namesMap, 'book');
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
        app.setParentButtons({ showOuter: true });
      }
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(chapters, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      return;
    }

    if (mode === 'chapter') {
      if (typeof getBibleVerseItems !== 'function') return;
      const chapter = app?.nav?.getCurrent?.();
      if (!chapter) return;
      const verseItems = getBibleVerseItems(chapter);
      if (!verseItems.length) return;
      const selectedIdx = verseItems.findIndex(v => v.id === instr.item.id);
      if (typeof setBibleMode === 'function') setBibleMode('verse');
      if (typeof setBibleVerseContext === 'function') {
        setBibleVerseContext({
          chapterId: chapter.id,
          bookId: chapter.meta?.bookId || chapter.parentId,
          testamentId: chapter.meta?.testamentId,
          sectionId: chapter.meta?.sectionId,
          externalFile: chapter.meta?.externalFile
        });
      }
      if (app?.setParentButtons) {
        app.setParentButtons({ showOuter: true });
      }
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(verseItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
    }
  };
  return { getChildren, onClick };
}
