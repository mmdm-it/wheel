# wheel docs

These docs are copied forward from v3 (which itself started from v2). They preserve the geometry and interaction contracts (lodestar magnifier, sprocket windowing, 4.3° spacing, zero inline styles/`!important`).

For the adapter reset (versioned as v3.x) we will:
- Keep constitutional constants, but rebuild the architecture around adapters, schemas, and a single interaction store/state machine.
- Enforce data-agnosticism: no dataset-specific assumptions in core navigation or rendering seams; push them into adapters.
- Track adapter-reset deltas in the dedicated specs below.

 Key docs:
 - `ARCHITECTURE_V4.md` — adapter/store/schema/rendering plan (retained filename; now versioned as v3.x)
 - `ROADMAP.md` — v3 milestones and success criteria
 - `ARCHITECTURE_V3.md` — legacy baseline reference

If you change a spec for this adapter reset, add a short version note near the top of the relevant document.
