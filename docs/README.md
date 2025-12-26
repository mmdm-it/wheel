# wheel-v4 docs

These docs are copied forward from v3 (which itself started from v2). They preserve the architecture, geometry, and interaction contracts (lodestar magnifier, sprocket windowing, 4.3° spacing, zero inline styles/`!important`).

For v4 we will:
- Keep the same layer boundaries (interaction → navigation → view → geometry → data) and constitutional constants.
- Keep modules small and pure, but enforce data-agnosticism: no dataset-specific assumptions in core navigation or rendering seams.
- Track any v4-specific deltas here before editing the source specs.

If you change a spec for v4, add a short “v4 delta” callout near the top of the relevant document.
