# BYDH Planner

Draw a floor plan, furnish it from the built-in store, and walk through it live in 3D, Cardboard, VR and AR — all in the browser.

## Features

- **Plan editor** — feet-and-inches or metres; walls that snap to a grid that gets finer as you zoom in (down to 3″ or 5 cm) and to each other, rectangle rooms, doors and windows that hinge and open either way, drag-to-reshape with connected corners, undo/redo.
- **Import a plan** — trace over a photo, scan or the builder's PDF (multi-page supported). Set the scale by clicking both ends of a known dimension and typing its length in metres or feet; then adjust opacity, rotation and lock it.
- **Find walls and rooms** — trace walls, doors, windows and rectangular rooms from the tracing image automatically. Runs entirely on your device: a small wall model (about 19 MB, downloaded once and cached for offline use) or a quick no-download method for clean drawings.
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
    │   ├── drawPlan.js         plan rendering (walls, doors, furniture symbols)
    │   └── grid.js             zoom-dependent grid and snap step
    ├── detect/                 wall and room detection from the tracing image
    │   ├── run.js              resample the image, run the worker, map onto the plan
    │   ├── detect.worker.js    model or quick mask → vectorise, off the main thread
    │   ├── model.js            download, cache and delete the model (Cache Storage)
    │   ├── mask.js             quick mask: threshold + morphology, no model
    │   ├── vectorize.js        mask → walls, openings, rooms
    │   └── place.js            image metres → plan metres
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
                                ImportDialog, DetectPanel, FileDialog, ConfirmDialog, AppToast

tools/wallnet/                  trains the wall model (Python, not shipped)
```

## Wall detection model

`public/models/wallnet-v1.onnx` is a small U-Net (1.2 M parameters) that marks wall pixels in a plan drawn at about 2.5 cm per pixel. It was trained only on floor plans generated by `tools/wallnet/synth.py` (random layouts drawn with solid, outlined, hatched and grey walls, door arcs, window lines, labels, dimensions, furniture and scan noise), so there are no third-party data or licence restrictions on the weights. The browser runs it with ONNX Runtime Web (WASM) in a worker.

The shipped weights are the step-4000 checkpoint of a 5000-step run (wall IoU 0.985 on held-out generated plans). On 60 held-out plans the full pipeline finds 98% of rooms, 98% of the rooms it reports are real, and 88% of plans come out fully right; from a perfect wall mask the tracing code itself reaches 98% / 98% / 90%. It has been checked on one real builder's plan (a 3BHK with grey walls): all 9 spaces found, footprint within 2% of the printed area.

To retrain and measure it:

```
cd tools/wallnet
uv venv .venv && uv pip install --python .venv/bin/python -r pyproject.toml
.venv/bin/python train.py --steps 5000 --out ../../public/models/wallnet-v1.onnx
.venv/bin/python eval_dump.py ../../public/models/wallnet-v1.onnx runs/eval 60
cd ../.. && node tools/wallnet/eval.mjs tools/wallnet/runs/eval
```

`eval.mjs` runs the same tracing code as the app on held-out generated plans and reports how many rooms it recovers from the model's mask, the quick mask and the true mask. If you change the model file, bump its name (`wallnet-v2.onnx`) and `CACHE` in `src/detect/model.js` so devices fetch the new one.

## Adding a store item

1. Add an entry to `CATALOG` in `src/catalog/items.js` with a unique `sku`, size in metres, price and finishes.
2. Point `model` at an existing builder, or add a function to a file in `src/three/furniture/` — it receives `(group, item, material)` and builds the model with its front facing +z, centred on the footprint at floor level.
3. Optionally add a plan symbol in `glyph()` in `src/plan/drawPlan.js`.

## Plan file format

A plan is plain JSON (`version: 2`) with `walls` (x1, y1, x2, y2 in metres, y pointing down the page), `openings` (wall id, position `t` along the wall 0–1, width, height, sill), `rooms`, `furniture` (sku, x, y, rot in degrees, colour), an optional `underlay` image and `settings`.

## Libraries

Vue 3, Pinia, three.js (OrbitControls, GLTFExporter, USDZExporter), pdf.js, ONNX Runtime Web, idb-keyval, Vite. Training: PyTorch, OpenCV.

Prices are indicative and for budgeting only.
