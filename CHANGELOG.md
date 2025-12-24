# Changelog

## [Unreleased]

## [3.1.20] - 2025-12-23

### Added
- Secondary Stratum now renders 9 language nodes (from `data/gutenberg/translations.json`) with mirrored magnifier and band; selecting a language reloads with that translation

## [3.1.19] - 2025-12-23

### Changed
- Version bump only

## [3.1.18] - 2025-12-23

### Changed
- Secondary Stratum magnifier stroke now renders without fill (hollow) while we await secondary nodes

## [3.1.17] - 2025-12-23

### Fixed
- Secondary Stratum magnifier stroke now mirrors the primary magnifier’s y-position across the viewport height (instead of following the mirrored arc), ensuring it remains visible in Dimension mode

## [3.1.16] - 2025-12-23

### Added
- Debug logging for Secondary Stratum magnifier positioning (prints mirrored hub, angle, radius, and coordinates when Dimension mode is active)

## [3.1.15] - 2025-12-23

### Fixed
- Secondary Stratum magnifier and band now anchor to y = LSd (as designed), ensuring the mirrored magnifier stroke renders in Dimension mode

## [3.1.14] - 2025-12-23

### Fixed
- Secondary Stratum magnifier and band now mirror using viewport height (true vertical reflection), keeping the mirrored magnifier stroke visible in Dimension mode

## [3.1.13] - 2025-12-23

### Added
- Mirrored magnifier stroke circle in the Secondary Stratum, positioned with the same mirrored geometry as the secondary band and kept unblurred

## [3.1.12] - 2025-12-23

### Fixed
- Secondary (mirrored) stratum band now renders above blurred content so underlying labels no longer show through; band remains unblurred

## [3.1.11] - 2025-12-23

### Changed
- Doubled the blur strength applied in Dimension mode for a stronger visual separation

## [3.1.10] - 2025-12-23

### Fixed
- Mirrored Focus Ring band now renders outside the blur layer so it stays sharp while Dimension mode blurs the primary ring

## [3.1.9] - 2025-12-23

### Fixed
- Dimension mode now immediately re-renders when toggled so the mirrored Focus Ring band stays visible while blurred

## [3.1.8] - 2025-12-23

### Added
- Dimension mode now renders a mirrored Focus Ring band across the viewport center line (lower-left to upper-right arc) while keeping the same size and style as the primary band

## [3.1.7] - 2025-12-23

### Fixed
- Blur mode now blocks drag/swipe rotation and momentum; rotation start/end and snapping respect the blur lock so only the Dimension button remains active

## [3.1.6] - 2025-12-23

### Changed
- When blurred (dimension mode), all ring interactions are disabled; only the Dimension button remains clickable

## [3.1.5] - 2025-12-23

### Fixed
- Blur demo now uses an SVG Gaussian blur filter for better mobile browser support (keeps dimension icon sharp)

## [3.1.4] - 2025-12-23

### Fixed
- Blur demo now works on mobile by grouping focus-ring content under a blur group (dimension icon stays sharp)

## [3.1.3] - 2025-12-23

### Added
- Dimension button now toggles a full-viewport blur while keeping the dimension icon sharp to demo the dimension switch visual signature

## [3.1.2] - 2025-12-23

### Changed
- Dimension button repositioned to bottom-right entry angle +9°, radius set to 90% of Focus Ring, and size scaled to 1.8× magnifier radius

## [3.1.1] - 2025-12-23

### Changed
- Dimension button now positioned at bottom-right entry angle +7° with 93% Focus Ring radius and sized to 2× magnifier radius

## [3.1.0] - 2025-12-23

### Added
- Dimension trigger icon placed at 135° from Hub at 90% of Focus Ring radius using `dimension_sphere_black.svg`, sized to node diameter

### Changed
- N/A

## [3.0.56] - 2025-12-23

### Fixed
- Calendar Focus Ring node labels now rotate to match other volumes while remaining centered

## [3.0.55] - 2025-12-23

### Changed
- Calendar volume centers Focus Ring node labels; other volumes unchanged

## [3.0.54] - 2025-12-23

### Added
- Focus Ring label formatter hooks per volume/level with context-aware magnifier vs node labels
- Calendar years show numbers in nodes and A.D./B.C. suffix in magnifier (with periods)
- Bible chapters/verses show numeric nodes and prefixed magnifier labels (Chapter/Verse)

### Changed
- createApp accepts custom label formatter and Focus Ring view uses formatted labels when provided

## [3.0.53] - 2025-12-22

### Fixed
- Honor authored startup item after sorting (Bible and MMdM) so Matthew and Lockwood-Ash load initially

## [3.0.52] - 2025-12-22

### Added
- Authorable startup defaults per volume (level + initial item) pulled from manifests and applied at load
- Per-level arrangement modes (cousins-with-gaps, cousins-flat, siblings-only) with manifest defaults for Bible, Calendar, and MMdM

## [3.0.51] - 2025-12-22

### Changed
- Remove neighbor wrap toggle and log boundaries explicitly for ordered volumes (calendar)

## [3.0.50] - 2025-12-22

### Fixed
- Align initial rotation so the selected item starts under the magnifier and logging reflects the visible neighbors without wraparound on calendar

## [3.0.49] - 2025-12-22

### Changed
- Neighbor logging now reports whether labels are visible/masked to mirror what the UI shows

## [3.0.48] - 2025-12-22

### Fixed
- Neighbor logging wraps indices so first/last items still report two before/after entries

## [3.0.47] - 2025-12-22

### Changed
- Neighbor logging now reports gaps/unknowns explicitly (magnifier + two before/after)

## [3.0.46] - 2025-12-22

### Added
- Console logging of magnifier label and two neighbor node labels when idle

## [3.0.45] - 2025-12-22

### Fixed
- Hide only the selected node label at the magnifier while keeping adjacent labels visible

## [3.0.44] - 2025-12-22

### Fixed
- Hide the node label closest to the magnifier on load (larger mask) to avoid duplicate magnifier label

## [3.0.43] - 2025-12-22

### Fixed
- Calendar magnifier stroke now stays in themed color during rotation (1px stroke)

## [3.0.42] - 2025-12-22

### Changed
- Calendar theme sets magnifier stroke to match label color

## [3.0.41] - 2025-12-22

### Added
- Single-click a focus node to rotate it into the magnifier without affecting swipe/scrub behavior

## [3.0.40] - 2025-12-22

### Changed
- Restore Montserrat fonts for Bible volume theme

## [3.0.39] - 2025-12-22

### Changed
- Split base styles from volume-specific themes and load per volume
- Default cousin gaps disabled for catalog (catalog items load as siblings)

## [3.0.38] - 2025-12-22

### Changed
- Add millennium gaps to calendar chain (2-node gap between millennia)

## [3.0.37] - 2025-12-22

### Changed
- Add cousin chains for Bible books with section gaps and logging summary

## [3.0.36] - 2025-12-22

### Changed
- Set magnifier angle to 142deg


## [3.0.35] - 2025-12-22

### Changed
- Fix magnifier angle to 140deg


## [3.0.34] - 2025-12-22

### Changed
- Remove multi-flick chaining; fixed 350-node quick swipe


## [3.0.33] - 2025-12-22

### Changed
- Boost chained flicks to half/full dataset


## [3.0.32] - 2025-12-22

### Changed
- Chain quick swipes to traverse large sets


## [3.0.31] - 2025-12-22

### Changed
- Scale quick-swipe spin to dataset size


## [3.0.30] - 2025-12-22

### Changed
- Boost quick-swipe spin gain


## [3.0.29] - 2025-12-22

### Changed
- Add calendar dataset and theme


## [3.0.28] - 2025-12-22

### Changed
- Keep snap non-rotating so magnifier fills


## [3.0.27] - 2025-12-22

### Changed
- Add 100ms snap-to-magnifier animation


## [3.0.26] - 2025-12-22

### Changed
- Add geometry tests and enforce node radius input


## [3.0.25] - 2025-12-22

### Changed
- Set focus label offset to -1.3 radius


## [3.0.24] - 2025-12-22

### Changed
- Pull focus labels further toward hub


## [3.0.23] - 2025-12-22

### Changed
- Pull focus labels closer to hub


## [3.0.22] - 2025-12-22

### Changed
- Shift focus labels toward hub


## [3.0.21] - 2025-12-22

### Changed
- Adjust focus label anchor offset


## [3.0.20] - 2025-12-22

### Changed
- (Add changes here)


## [3.0.19] - 2025-12-22

### Changed
- (Add changes here)


## [3.0.18] - 2025-12-21

### Changed
- (Add changes here)


## [3.0.17] - 2025-12-21

### Changed
- Increase label font sizes ~50% via CSS


## [3.0.16] - 2025-12-21

### Changed
- Return font sizing to CSS; remove inline styles


## [3.0.15] - 2025-12-21

### Changed
- Magnifier draws above nodes


## [3.0.14] - 2025-12-21

### Changed
- Keep magnifier stroke width; hide node label under magnifier when idle


## [3.0.13] - 2025-12-21

### Changed
- Force magnifier fill none during rotation


## [3.0.12] - 2025-12-21

### Changed
- Magnifier empty during rotation (no fill)


## [3.0.11] - 2025-12-21

### Changed
- Magnifier label hides during rotation; nodes flow through


## [3.0.10] - 2025-12-21

### Changed
- Magnifier label matches node font; nodes smaller


## [3.0.9] - 2025-12-21

### Changed
- Scale label font sizes to radius


## [3.0.8] - 2025-12-21

### Changed
- Dynamic spacing for focus ring


## [3.0.7] - 2025-12-21

### Changed
- Dynamic radii for nodes and magnifier


## [3.0.6] - 2025-12-21

### Changed
- Rotate magnifier label


## [3.0.5] - 2025-12-21

### Changed
- Add volume selection logging


## [3.0.4] - 2025-12-21

### Changed
- Fix volume selection by path


## [3.0.3] - 2025-12-21

### Changed
- Display version badge


## [3.0.2] - 2025-12-21

### Changed
- Magnifier integration and selection clamp


## [3.0.1] - 2025-12-21

### Changed
- Set v3 baseline version (major reset for v3 scaffold based on v2 architecture and specs).
