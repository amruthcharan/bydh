# Handoff — BYDH Planner v0.2.0

Status as of 4 Oct 2026. `npm run build` passes, and the flows below were checked in headless Chromium.

## Working and verified
- Sample 3-bed bungalow loads on first run. The plan and 3D view stay in sync.
- Wall, room, door, window and erase tools work, including drag-to-reshape with connected corners, undo/redo and keyboard shortcuts.
- Furniture store: 54 items with thumbnails, search, categories and sorting. Items can be added by clicking Add or by dragging onto the plan. Wall snapping works.
- Shopping list total (₹) and area statement.
- Image import, scale calibration (two clicks plus a length in m or ft), opacity, lock, and show-in-3D for the tracing image.
- Orbit, Walk (with collisions; doors are passable) and Cardboard modes.
- GLB and USDZ export both download.
- Phone layout at 400 px has no horizontal overflow; the properties panel starts folded.

## Not verified (needs real hardware or a real host)
- WebXR VR on a Quest and AR on an ARCore phone. The code paths are in `src/three/xr.js`. Test with `npm run dev:https`.
- Opening the exported USDZ in AR Quick Look on an iPhone.
- PDF import in a normal browser. It failed only in the claude.ai preview, which couldn't host the worker file.
- The gyroscope in Cardboard mode on iOS, which needs a permission prompt from a user tap.

## Known issues and rough edges
1. Unit tests cover only geometry, snapping and the plan store. There are no tests for the canvas engines, 3D view or components.
2. Rooms are axis-aligned rectangles only. Walls can be at any angle, but rooms and floors can't follow them.
3. Doors in 3D are frozen half-open at a fixed angle. There is no open/close interaction.
4. Furniture can overlap other furniture and walls. Only wall snapping helps; there are no collision warnings.
5. The 3D view rebuilds the entire house on every edit. This is fine for small plans and may lag on large ones while dragging.
6. One floor only. There are no stairs, ceilings or roof.
7. Plan files can get large when a big tracing image is embedded.
8. Catalogue prices and finishes are placeholders and hard-coded.

## Suggested next steps (in priority order)
1. ~~Add Vitest unit tests, ESLint and Prettier.~~ Done: `npm test`, `npm run lint`.
2. **Incremental 3D updates:** rebuild only the changed wall or item (diff by id) instead of the whole house.
3. **Overlap warnings:** show furniture that intersects other furniture or walls in red on the plan.
4. **Polygon rooms:** detect enclosed regions from the wall graph so floors and areas follow any wall shape.
5. **Clearance and Vastu overlays (optional toggles):** door-swing clearance, walkway widths, and room placement by direction using `settings.north`.
6. **Multiple floors:** levels, stairs, ceiling and a simple roof.
7. **Catalogue from JSON:** load items from `public/catalog.json` so non-developers can edit them. Allow custom GLB models per item.
8. **Measure tool and printable plan export** (PNG/PDF with dimensions and an area table).
9. **PWA/offline support and CI deploy** to GitHub Pages.

## How to verify a change
`npm run build` → `npm run preview` → load the sample. Then:
- Draw a room and add a door.
- Add a bed from the store and check that it snaps to a wall.
- Undo and redo.
- Switch to Walk and walk through a door.
- Export a GLB.
- Reload the page and confirm the plan persisted.
