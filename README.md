# BYDH Planner

Draw a floor plan, furnish it from the built-in store, and walk through it live in 3D, Cardboard, VR and AR — all in the browser.

## Features

- **Plan editor** — walls that snap to a 25 cm grid and to each other, rectangle rooms, doors and windows, drag-to-reshape with connected corners, undo/redo.
- **Import a plan** — trace over a photo, scan or the builder's PDF (multi-page supported). Set the scale by clicking both ends of a known dimension and typing its length in metres or feet; then adjust opacity, rotation and lock it.
- **Furniture store** — 54 items across living, bedroom, modular kitchen, dining, bath, study and pooja/decor, with finishes, dimensions and indicative INR prices. Drag onto the plan or press Add; cabinets, beds and wardrobes back onto the nearest wall automatically (hold Alt to drag freely).
- **Shopping list** — live furniture estimate and area statement (carpet area, plinth footprint) in m² or sq ft.
- **3D view** — orbit, walk-through with collision (doors are passable), split-screen Cardboard with phone tilt, sun-time and north controls for shadow studies.
- **VR / AR (WebXR)** — full-scale walk-through on Quest-class headsets with thumbstick movement and snap turning; AR tabletop (1:25) or full-size placement with hit-testing on ARCore Android phones.
- **Export** — GLB (Blender, SketchUp, web viewers) and USDZ (iPhone/iPad AR Quick Look).
- **Saving** — autosaves to IndexedDB, including the tracing image; download/open `.bydh.json` plan files.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/
npm run preview      # serve the build locally
```

### Testing VR / AR on a device

WebXR requires HTTPS. Run the dev server with a self-signed certificate on your LAN:

```bash
npm run dev:https    # prints https://<your-ip>:5173
```

Open that address on the headset (Meta Quest Browser) or an Android phone (Chrome), accept the certificate warning, then press **VR** or **AR**. For production, deploy `dist/` to any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages); the build uses relative paths so it works from a sub-folder.

iOS Safari does not support WebXR AR; use **Export → USDZ** and open the file on the iPhone for AR Quick Look.

## Project structure

```
bydh-planner/
├── index.html                  Vite entry
├── vite.config.js              Vue plugin, optional HTTPS mode, three.js chunk
├── public/favicon.svg
└── src/
    ├── main.js                 creates the Vue app + Pinia
    ├── App.vue                 layout and global keyboard shortcuts
    ├── styles/                 design tokens (light/dark) and shared controls
    ├── catalog/items.js        store catalogue, floor finishes, wall types
    ├── stores/
    │   ├── plan.js             plan model, edits, undo/redo, IndexedDB autosave
    │   └── ui.js               tool, dialogs, view mode, toasts
    ├── lib/
    │   ├── geometry.js         distances, bounding boxes, hit tests
    │   ├── snapping.js         back-to-wall furniture snapping
    │   ├── importImage.js      image/PDF → tracing image (pdf.js, lazy-loaded)
    │   ├── samplePlan.js       sample 3-bed bungalow and plan normalisation
    │   ├── units.js            m / ft-in / m² / sq ft / ₹ formatting
    │   ├── files.js            download, copy, read helpers
    │   ├── walker.js           shared walk-through camera state
    │   └── engines.js          handles to the plan editor and 3D viewport
    ├── plan/
    │   ├── PlanEditor.js       canvas editor: view, tools, pointer handling
    │   └── drawPlan.js         plan rendering (walls, doors, furniture symbols)
    ├── three/
    │   ├── Viewport.js         renderer, OrbitControls, modes, picking, export
    │   ├── buildHouse.js       walls with openings, floors, plinth, underlay
    │   ├── walk.js             walk controller, collisions, gyro
    │   ├── xr.js               WebXR VR/AR sessions and hit-test placement
    │   ├── thumbnails.js       offscreen renders for store product images
    │   ├── textures.js         procedural floor textures
    │   ├── parts.js            shared materials and primitives
    │   └── furniture/          parametric models by room (living, bedroom, …)
    └── components/             TopBar, ToolRail, PlanPane, ViewPane,
                                FurnitureStore, ProductCard, PropertiesPanel,
                                ImportDialog, FileDialog, ConfirmDialog, AppToast
```

## Adding a store item

1. Add an entry to `CATALOG` in `src/catalog/items.js` with a unique `sku`, size in metres, price and finishes.
2. Point `model` at an existing builder, or add a function to a file in `src/three/furniture/` — it receives `(group, item, material)` and builds the model with its front facing +z, centred on the footprint at floor level.
3. Optionally add a plan symbol in `glyph()` in `src/plan/drawPlan.js`.

## Plan file format

A plan is plain JSON (`version: 2`) with `walls` (x1, y1, x2, y2 in metres, y pointing down the page), `openings` (wall id, position `t` along the wall 0–1, width, height, sill), `rooms`, `furniture` (sku, x, y, rot in degrees, colour), an optional `underlay` image and `settings`.

## Libraries

Vue 3, Pinia, three.js (OrbitControls, GLTFExporter, USDZExporter), pdf.js, idb-keyval, Vite.

Prices are indicative and for budgeting only.
