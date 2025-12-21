# wheel-v3 docs

These docs are copied from wheel v2 as the starting point for v3. They preserve the architecture, geometry, and interaction contracts (lodestar magnifier, sprocket windowing, 4.3° spacing, zero inline styles/`!important`).

For v3 we will:
- Keep the same layer boundaries (interaction → navigation → view → geometry → data) and constitutional constants.
- Rebuild implementation cleanly with smaller modules and pure geometry.
- Track any v3-specific deltas here before editing the source specs.

If you change a spec for v3, add a short “v3 delta” callout near the top of the relevant document.
