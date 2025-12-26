# wheel-v4 docs

These docs are copied forward from v3 (which itself started from v2). They preserve the geometry and interaction contracts (lodestar magnifier, sprocket windowing, 4.3° spacing, zero inline styles/`!important`).

For v4 we will:
- Keep constitutional constants, but rebuild the architecture around adapters, schemas, and a single interaction store/state machine.
- Enforce data-agnosticism: no dataset-specific assumptions in core navigation or rendering seams; push them into adapters.
- Track v4-specific deltas in the dedicated specs below.

Key v4 docs:
- `ARCHITECTURE_V4.md` — greenfield plan (adapters, store, schemas, rendering contracts)
- `ROADMAP.md` — v4 milestones and success criteria
- `ARCHITECTURE_V3.md` — legacy baseline reference

If you change a spec for v4, add a short “v4 delta” callout near the top of the relevant document.
