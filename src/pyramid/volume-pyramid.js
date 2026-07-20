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
    const selectedIdx = children.findIndex(m => m.id === instr.item.id);
    // Mid-rotation the sky live-previews a PASSING parent's children while
    // the committed selection is still travelling (selection commits on
    // arrival). A tapped star that isn't among the committed parent's
    // children would navigate relative to the WRONG parent — pour the old
    // manufacturer's ring seeded at index 0 (Phase C audit H1). Such taps
    // are noise: ignore them; the settled sky is tappable as ever.
    if (selectedIdx < 0) return;
    // Snapshot current nav state before migrating IN
    if (typeof savePreInState === 'function' && app?.nav) {
      const currentItems = app.nav.items;
      const currentIndex = currentItems.indexOf(app.nav.getCurrent());
      savePreInState({ items: currentItems, selectedIndex: currentIndex >= 0 ? currentIndex : 0, preserveOrder: true });
    }
    if (typeof setCatalogMode === 'function') setCatalogMode('child');
    if (app?.setPrimaryItems) {
      // Migrate IN: siblings land on the focus ring with the clicked item selected.
      // If a leaf (model) lands in the magnifier, the render loop's leaf detection
      // will trigger the Detail Sector expand and suppress the Child Pyramid.
      // Use migrateIn for animated transition when available; fall back to instant swap.
      const migrateOrSet = app.migrateIn || app.setPrimaryItems;
      migrateOrSet(children, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
    // AFTER the migration starts, never before: setParentButtons renders
    // immediately, and a render between the nav-stack push and migrateIn
    // repaints the parent button with the POST-descend label in full view —
    // the "label pops before the animation" bug. Once migrateIn has begun,
    // the reals are hidden and the migration barrier owns their reveal.
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true });
    }
  };
  return { getChildren, onClick };
}

export function buildCalendarPyramid({
  manifest,
  getCalendarMonths,
  getCalendarMonthChain,
  getCalendarDayChain,
  getWeekdayLetters,
  getApp,
  calendarModeRef,
  setCalendarMode,
  setCalendarMonthContext
} = {}) {
  if (!manifest || typeof getCalendarMonths !== 'function') return null;
  // The pyramid previews the selected year's own 12 months; clicking one
  // lands on that month INSIDE the continuous months cousin chain.
  // Pyramid-only abbreviations (Howell 2026-07-19): three letters, all caps
  // (IAN, FEB, MAR... — Latin months truncate collision-free). The ring and
  // magnifier keep the full names; the rename never travels past the
  // pyramid (onClick matches by id), same contract as the book abbreviations.
  const getChildren = ({ selected }) => (calendarModeRef?.() === 'day'
    ? [] // the days ring has no pyramid (its detail era comes with C.6's boot state)
    : getCalendarMonths(manifest, selected, calendarModeRef?.()))
    .map(item => (item?.name
      ? { ...item, name: String(item.name).slice(0, 3).toUpperCase() }
      : item));
  const onClick = instr => {
    if (!instr?.item) return;
    const app = typeof getApp === 'function' ? getApp() : null;
    // A DAY tapped in the wedge (Howell 2026-07-19): the month's days pour
    // from the lattice into the focus ring — the ±5-year day chain, entered
    // at the tapped date. Weekday-header cells are inert.
    if (calendarModeRef?.() === 'month') {
      if (instr.item.level !== 'day' || typeof getCalendarDayChain !== 'function') return;
      const chain = getCalendarDayChain(instr.item.id);
      if (!chain?.items?.length) return;
      if (typeof setCalendarMode === 'function') setCalendarMode('day');
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(chain.items, chain.selectedIndex, true);
      }
      // After the migration starts (see buildCatalogPyramid).
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return;
    }
    if (typeof calendarModeRef === 'function' && calendarModeRef() !== 'year') return;
    const year = app?.nav?.getCurrent?.();
    if (!year) return;
    let months;
    let selectedIdx;
    if (typeof getCalendarMonthChain === 'function') {
      const chain = getCalendarMonthChain(instr.item.id);
      months = chain?.items || [];
      selectedIdx = chain?.selectedIndex ?? 0;
    } else {
      months = getCalendarMonths(manifest, year, calendarModeRef?.());
      selectedIdx = months.findIndex(m => m.id === instr.item.id);
    }
    if (!months.length) return;
    if (typeof setCalendarMode === 'function') setCalendarMode('month');
    if (typeof setCalendarMonthContext === 'function') {
      setCalendarMonthContext({ yearId: year?.id || null });
    }
    if (app?.setPrimaryItems) {
      const migrateOrSet = app.migrateIn || app.setPrimaryItems;
      migrateOrSet(months, selectedIdx >= 0 ? selectedIdx : 0, true);
    }
    // After the migration starts (see buildCatalogPyramid) — an earlier call
    // would repaint the parent button pre-animation.
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: true });
    }
  };
  // Months in the ring → the DAY GRID pyramid (Howell 2026-07-19): the one
  // pyramid that is an array, not a star field. The host renders it from
  // this descriptor; tapping a day pours the day chain into the ring
  // (onClick above).
  const gridFor = ({ selected } = {}) => {
    if (calendarModeRef?.() !== 'month') return null;
    if (!selected || !Number.isFinite(selected.monthNumber)) return null;
    const yearNumber = Number.isFinite(selected.yearNumber)
      ? selected.yearNumber
      : Number.parseInt(selected.parentId, 10);
    if (!Number.isFinite(yearNumber)) return null;
    return {
      yearNumber,
      month: selected.monthNumber,
      // The lattice's column headers, named by the volume's own data.
      weekdayLetters: typeof getWeekdayLetters === 'function' ? getWeekdayLetters() : null
    };
  };
  return { getChildren, onClick, gridFor };
}

export function buildBiblePyramid({
  manifest,
  getBibleVerseChain,
  getBibleChapterChain,
  namesMap,
  getBibleChapters,
  getBibleVerseItems,
  getBibleVerseCacheStatus,
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
      // FAVORITES (Howell 2026-07-19): tier-1 prominence stars wear their
      // FULL names in the sky — the editorial "start here" — while everyone
      // else keeps the pyramid abbreviation.
      //
      // SIBLINGS ONLY (Howell 2026-07-20): the books chain is now the whole
      // volume (the sweep — a cousin chain crossing testaments), but the
      // child pyramid is a preview of the MAGNIFIED testament's OWN books.
      // Genesis and Matthew are cousins, not siblings: the sky filters to
      // the selected testament; the ring migration on tap still pours the
      // full chain.
      return getBibleBooksForTestament(selected?.id).items
        .filter(item => Boolean(item) && (!selected?.id || item.testamentId === selected.id))
        .map(item => (
          abbrevs?.[item.id] && item.prominence !== 1 ? { ...item, name: abbrevs[item.id] } : item
        ));
    }
    if (mode === 'book') {
      return getBibleChapters(manifest, selected, namesMap, 'book');
    }
    if (mode === 'chapter') {
      if (typeof getBibleVerseItems !== 'function') return [];
      const items = getBibleVerseItems(selected);
      // Trigger prefetch ONLY when the chapter has never been requested (or
      // is in flight — the queue repaints on arrival). A chapter that loaded
      // EMPTY is an honest data hole (the Esther stubs): re-requesting it
      // fires onLoaded synchronously → refreshPyramid → render → here again
      // — the hot loop that ground the Moto G to a near-crash (Phase C,
      // 2026-07-20). An empty sky renders as an empty sky.
      if (items.length === 0 && typeof prefetchBibleVerses === 'function' && selected?.meta?.externalFile) {
        const status = typeof getBibleVerseCacheStatus === 'function'
          ? getBibleVerseCacheStatus(selected.meta.externalFile)
          : null;
        if (status === null || status === 'loading') {
          const app = typeof getApp === 'function' ? getApp() : null;
          prefetchBibleVerses(selected, {
            onLoaded: () => { app?.refreshPyramid?.(); }
          });
        }
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
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(testamentItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      // After the migration starts (see buildCatalogPyramid).
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
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
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(bookItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      // After the migration starts (see buildCatalogPyramid).
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return;
    }

    if (mode === 'book') {
      const book = app?.nav?.getCurrent?.();
      if (!book) return;
      const chapters = getBibleChapters(manifest, book, namesMap, 'book');
      if (!chapters.length) return;
      // The chapters ring is the WHOLE volume, entered at the tapped
      // chapter (Howell 2026-07-20) — the same complete sweep the verse
      // ring has. This book's own chapters are the fallback.
      let ringItems = chapters;
      let selectedIdx = chapters.findIndex(c => c.id === instr.item.id);
      if (typeof getBibleChapterChain === 'function') {
        const chain = getBibleChapterChain(instr.item.id);
        if (chain?.items?.length) {
          ringItems = chain.items;
          selectedIdx = chain.selectedIndex;
        }
      }
      if (typeof setBibleMode === 'function') setBibleMode('chapter');
      if (typeof setBibleChapterContext === 'function') {
        setBibleChapterContext({
          bookId: book.id,
          sectionId: book.sectionId,
          testamentId: book.testamentId
        });
      }
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(ringItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      // After the migration starts (see buildCatalogPyramid).
      if (app?.setParentButtons) {
        app.setParentButtons({ showOuter: true });
      }
      return;
    }

    if (mode === 'chapter') {
      if (typeof getBibleVerseItems !== 'function') return;
      const chapter = app?.nav?.getCurrent?.();
      if (!chapter) return;
      const verseItems = getBibleVerseItems(chapter);
      if (!verseItems.length) return;
      // The verse ring is the WHOLE volume, entered at the tapped verse
      // (Howell 2026-07-20) — reading runs on past the end of a chapter
      // instead of dead-ending there. The chapter's own verses are the
      // fallback if no chain builder is bound.
      let ringItems = verseItems;
      let selectedIdx = verseItems.findIndex(v => v.id === instr.item.id);
      if (typeof getBibleVerseChain === 'function') {
        const chain = getBibleVerseChain(instr.item.id);
        if (chain?.items?.length) {
          ringItems = chain.items;
          selectedIdx = chain.selectedIndex;
        }
      }
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
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateIn || app.setPrimaryItems;
        migrateOrSet(ringItems, selectedIdx >= 0 ? selectedIdx : 0, true);
      }
      // After the migration starts (see buildCatalogPyramid).
      if (app?.setParentButtons) {
        app.setParentButtons({ showOuter: true });
      }
    }
  };
  return { getChildren, onClick };
}
