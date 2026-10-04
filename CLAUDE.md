# CLAUDE.md — BYDH Planner

Browser home visualizer. You draw a floor plan in 2D, furnish it from a built-in store, and see it live in 3D, with walk-through, Cardboard, WebXR VR/AR and GLB/USDZ export. Indian context: ₹ prices, m²/sq ft, 4½″/9″ brick walls, pooja units, Kota stone.

## Commands
- `npm install`
- `npm run dev` → http://localhost:5173
- `npm run dev:https` → self-signed HTTPS on the LAN. WebXR needs HTTPS, so use this to test on a Quest or an Android phone.
- `npm run build` → `dist/` (relative `base: './'`, so it works from any subfolder or GitHub Pages)
- `npm run preview`

- `npm test` → Vitest unit tests (`*.test.js` next to the code they cover). `npm run test:watch` re-runs on save.
- `npm run lint` → ESLint. `npm run format` → Prettier (existing files are not yet reformatted; format new files you add).

Unit tests cover `lib/geometry.js`, `lib/snapping.js` and the plan store edits. Verify everything else with `npm run build`, then exercise the app in a browser. For headless Chromium, pass `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` so WebGL works.

## Stack
Vue 3 (`<script setup>`, plain JS, no TypeScript), Pinia, three.js r186 (OrbitControls, GLTFExporter, USDZExporter), pdf.js (lazy-loaded), idb-keyval, Vite 8. No CSS framework: styles are design tokens in `src/styles/tokens.css` plus scoped component CSS.

## Architecture: read this before changing anything
- **One source of truth: `usePlanStore().plan`** (`src/stores/plan.js`). It is plain JSON with walls, openings, rooms, furniture, underlay and settings. All coordinates are metres, plan **y points down the page**, and that y maps to three.js **z**.
- **Edit contract:** mutate `plan` → call `store.touch()` (increments `rev`, which triggers the 3D rebuild) → call `store.commit()` when the edit is finished (undo snapshot + debounced IndexedDB autosave). During drags, call `touch()` every move and `commit()` once on pointerup. Forgetting `commit()` breaks undo and saving. Forgetting `touch()` leaves the 3D view stale.
- **The canvas engines are plain classes, not Vue components.** They are reached through `src/lib/engines.js`:
  - `PlanEditor` (`src/plan/PlanEditor.js`) owns the 2D view transform, tool state and pointer handling, and redraws via `drawPlan.js` only when its `dirty` flag is set (`invalidate()`).
  - `Viewport` (`src/three/Viewport.js`) owns the renderer, camera modes, picking, XR and export. It rebuilds the whole house from the plan on each `rev` change (one rebuild per animation frame).
- **`src/lib/walker.js`** is deliberately non-reactive shared state for the walk camera. The 3D view writes it every frame and the plan draws the marker from it. Don't put it in Pinia.
- **UI state** (current tool, dialogs, view mode, toasts) lives in `src/stores/ui.js`.

## Conventions
- **Furniture item front faces +z** in model space. The origin is the footprint centre at floor level. Plan rotation `rot` is in degrees, and the 3D group gets `rotation.y = -rad(rot)`. Wall snapping (`src/lib/snapping.js`) relies on this convention.
- **Catalogue** (`src/catalog/items.js`): `sku`, `name`, `category`, `model` (builder function name), `w/d/h` in metres, `price` in INR, `colors[]`, `elev` (wall-mounted height), `wallSnap`, `params`, `tags`. To add an item, add an entry, point `model` at a builder in `src/three/furniture/*.js` (signature `(group, item, material)`, with `item._color` set), and optionally add a plan symbol in `glyph()` in `drawPlan.js`.
- **Materials:** use `mat(color)` from `src/three/parts.js` (cached per colour) and the shared `M.*` materials. Never create a material per rebuild unless you also mark the mesh with `userData.ownsMaterial = true` so `disposeHouse` frees it.
- **Picking:** meshes carry `userData.pick = { kind, id }`. `userData.noExport` keeps a mesh out of GLB/USDZ.
- **Colours** come from CSS tokens. Canvas code reads them via `readTokens()`, so the plan follows light and dark themes. Don't hard-code UI colours.
- **Copy:** plain, active voice. Errors say what went wrong and how to fix it.
- Keep files small and grouped by concern, matching the existing folders.

## Gotchas
- `PlanEditor.hitTest` sorts furniture so wall-mounted items (`elev > 0`) are hit before floor items under them.
- Room creation adds four walls but skips any edge that an existing collinear wall already covers (`wallCovers`).
- The tracing image (`plan.underlay`) is stored as a JPEG data URL inside the plan, which is why autosave uses IndexedDB rather than localStorage. Large images make plan files big.
- `three/examples/jsm/...` imports are the supported path for addons in r186.
- The pdf.js worker is imported with `?url`. Don't force pdfjs into a manual chunk: that makes it preload on start-up.
