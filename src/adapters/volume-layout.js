import { createVolumePyramidConfig } from '../pyramid/volume-pyramid.js';

// Builds a layoutSpec with pyramid config derived from per-volume hooks/state.
export function createVolumeLayoutSpec({
  volume,
  manifest,
  namesMap,
  placesState,
  buildPlacesLevel,
  placesChildrenHandler,
  getCatalogChildren,
  getCalendarMonths,
  getBibleChapters,
  getApp,
  calendarModeRef,
  setCalendarMode,
  setCalendarMonthContext,
  bibleModeRef,
  setBibleMode,
  setBibleChapterContext,
  catalogModeRef,
  setCatalogMode,
  savePreInState,
  pyramidBuilder
} = {}) {
  const pyramid = createVolumePyramidConfig({
    volume,
    manifest,
    namesMap,
    placesState,
    buildPlacesLevel,
    placesChildrenHandler,
    getCatalogChildren,
    getCalendarMonths,
    getBibleChapters,
    getApp,
    calendarModeRef,
    setCalendarMode,
    setCalendarMonthContext,
    bibleModeRef,
    setBibleMode,
    setBibleChapterContext,
    catalogModeRef,
    setCatalogMode,
    savePreInState,
    pyramidBuilder
  });
  return pyramid ? { pyramid } : {};
}
