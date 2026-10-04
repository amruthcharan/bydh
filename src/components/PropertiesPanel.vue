<script setup>
import { computed, ref, watch } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { SKU, FLOORS, WALL_TYPES, CATEGORIES } from '../catalog/items.js';
import { clamp, wallLen } from '../lib/geometry.js';
import { fmtArea, fmtHour, fmtINR, fmtLen, fmtSize, lenInput, parseLen } from '../lib/units.js';
import { engines } from '../lib/engines.js';

const plan = usePlanStore();
const ui = useUiStore();
// On phones the panel starts folded so the plan stays visible; selecting something opens it.
const collapsed = ref(window.innerWidth <= 760);
watch(() => plan.sel, (s) => { if (s) collapsed.value = false; });
const P = computed(() => plan.plan);
const S = computed(() => plan.plan.settings);
const o = computed(() => plan.selected);
const kind = computed(() => (o.value ? plan.sel.kind : null));
const units = computed(() => S.value.units);
const item = computed(() => (kind.value === 'furniture' ? SKU[o.value.sku] : null));
const wall = computed(() => (kind.value === 'opening' ? plan.wallById(o.value.wall) : kind.value === 'wall' ? o.value : null));
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

// Apply a change, rebuild, and record it in history on commit (change events).
function set(fn, commit = true) { fn(); plan.touch(); if (commit) plan.commit(); }
const num = (e) => parseFloat(e.target.value);
/** Read a length field in the plan's units and pass metres to `apply`. Puts `old` back if the text can't be read. */
function onLen(e, old, apply) {
  const v = parseLen(e.target.value, units.value);
  if (Number.isFinite(v)) { apply(v); return; }
  ui.toast(units.value === 'ft' ? `Enter a length such as 12'6" or 12.5 (feet).` : 'Enter a length in metres, such as 3.8.');
  e.target.value = lenInput(old, units.value);
}

/* settings */
const setSetting = (k, v, commit = true) => set(() => { S.value[k] = v; }, commit);

/* wall */
function setWallLen(v) { if (v > 0) { plan.setWallLength(o.value, v); plan.commit(); } }

/* opening */
function setOpening(k, v) {
  const op = o.value, L = wallLen(wall.value);
  set(() => {
    if (k === 'type') { op.type = v; if (v === 'door') op.h = 2.1; else { op.h = 1.2; op.sill = 0.9; } }
    else if (k === 'w') { const c = op.t * L; op.w = clamp(v, 0.4, L - 0.1); op.t = clamp(c / L, op.w / 2 / L, 1 - op.w / 2 / L); }
    else if (k === 'h') op.h = clamp(v, 0.3, S.value.wallH - (op.type === 'window' ? op.sill : 0));
    else if (k === 'sill') op.sill = clamp(v, 0, S.value.wallH - op.h);
    else if (k === 'pos') op.t = clamp((v + op.w / 2) / L, op.w / 2 / L, 1 - op.w / 2 / L);
    else if (k === 'flip') op.flip = !op.flip;
    else if (k === 'hinge') op.hingeEnd = !op.hingeEnd;
  });
}

/* underlay */
const U = computed(() => P.value.underlay);
function startCalibrate() { ui.setTool('calibrate'); engines.editor?.resetCalibration(); ui.mobileView = 'plan'; }
</script>

<template>
  <aside class="props" :class="{ collapsed }" aria-label="Properties">
    <button class="collapse" :aria-expanded="!collapsed" @click="collapsed = !collapsed">{{ collapsed ? 'Show details' : 'Hide' }}</button>

    <!-- Nothing selected: project overview -->
    <template v-if="!o">
      <div class="group"><div class="eyebrow">Project</div><h2>{{ P.name || 'Untitled home' }}</h2></div>

      <div class="group">
        <div class="eyebrow">Area statement</div>
        <table class="tbl">
          <tr v-for="r in P.rooms" :key="r.id" class="link" @click="plan.select({ kind: 'room', id: r.id })">
            <td><span class="sw" :style="{ background: (FLOORS[r.floor] || FLOORS.vitrified).color }"></span>{{ r.name }}</td>
            <td class="n">{{ fmtArea(r.w * r.h, units) }}</td>
          </tr>
          <tr class="total"><td>Carpet area</td><td class="n">{{ fmtArea(plan.carpetArea, units) }}</td></tr>
          <tr class="total"><td>Plinth footprint</td><td class="n">{{ fmtArea(plan.footprint, units) }}</td></tr>
        </table>
      </div>

      <div class="group">
        <div class="row between"><div class="eyebrow">Shopping list</div><button class="btn small" @click="ui.storeOpen = true; ui.mobileView = 'plan'">Open store</button></div>
        <table v-if="plan.shoppingList.length" class="tbl">
          <tr v-for="r in plan.shoppingList" :key="r.sku"><td>{{ r.name }} <span class="q">× {{ r.qty }}</span></td><td class="n">{{ fmtINR(r.total) }}</td></tr>
          <tr class="total"><td>Furniture estimate</td><td class="n">{{ fmtINR(plan.furnitureTotal) }}</td></tr>
        </table>
        <p v-else class="muted">No furniture yet. Add pieces from the store and their prices add up here.</p>
        <p class="fine">Indicative retail prices for budgeting. Excludes delivery, installation and GST.</p>
      </div>

      <div class="group">
        <div class="eyebrow">Tracing image</div>
        <template v-if="U">
          <div class="row"><button class="btn" @click="plan.select({ kind: 'underlay', id: 'underlay' })">Edit image</button><button class="btn" @click="startCalibrate">Set scale</button></div>
        </template>
        <template v-else>
          <p class="muted">Import a photo, scan or PDF of a floor plan and trace your walls over it.</p>
          <div class="row"><button class="btn" @click="ui.importOpen = true">Import plan image</button></div>
        </template>
      </div>

      <div class="group">
        <div class="eyebrow">Construction</div>
        <div class="field"><label for="p-wallH">Wall height</label><div class="inline"><input id="p-wallH" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(S.wallH, units)" @change="onLen($event, S.wallH, (v) => setSetting('wallH', clamp(v, 2.4, 4.5)))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div class="field"><label for="p-wallT">Wall type</label><select id="p-wallT" :value="S.wallT" @change="setSetting('wallT', +$event.target.value)"><option v-for="w in WALL_TYPES" :key="w.v" :value="w.v">{{ w.l }}</option></select></div>
        <div class="field"><label for="p-units">Units</label><select id="p-units" :value="S.units" @change="setSetting('units', $event.target.value)"><option value="ft">Feet &amp; inches · sq ft</option><option value="m">Metres · m²</option></select></div>
      </div>

      <div class="group">
        <div class="eyebrow">Site &amp; sun</div>
        <div class="field"><label for="p-north">North</label><div class="inline"><input id="p-north" type="range" min="0" max="359" :value="S.north" @input="setSetting('north', +$event.target.value, false)" @change="plan.commit()" /><span class="readout">{{ S.north }}°</span></div></div>
        <div class="field"><label for="p-sun">Sun time</label><div class="inline"><input id="p-sun" type="range" min="6" max="18" step="0.25" :value="S.sun" @input="setSetting('sun', +$event.target.value, false)" @change="plan.commit()" /><span class="readout">{{ fmtHour(S.sun) }}</span></div></div>
      </div>

      <div class="group">
        <div class="eyebrow">Shortcuts</div>
        <div class="keys">
          <kbd>V W M D N E</kbd><span>Drawing tools</span><kbd>F</kbd><span>Open the store</span><kbd>I</kbd><span>Import a plan image</span>
          <kbd>R</kbd><span>Rotate item 90°</span><kbd>Alt</kbd><span>Drag without wall snapping</span><kbd>Del</kbd><span>Delete selection</span>
          <kbd>WASD</kbd><span>Walk in the 3D view</span><kbd>Ctrl Z</kbd><span>Undo</span>
        </div>
      </div>
    </template>

    <!-- Wall -->
    <template v-else-if="kind === 'wall'">
      <div class="group"><div class="eyebrow">Wall</div><h2>{{ fmtLen(wallLen(o), units) }} wall</h2></div>
      <div class="group">
        <div class="field"><label for="p-len">Length</label><div class="inline"><input id="p-len" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(wallLen(o), units)" @change="onLen($event, wallLen(o), setWallLen)" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div class="field"><label>Openings</label><span class="readout">{{ P.openings.filter(x => x.wall === o.id && x.type === 'door').length }} doors · {{ P.openings.filter(x => x.wall === o.id && x.type === 'window').length }} windows</span></div>
      </div>
      <div class="row">
        <button class="btn" @click="(() => { const r = plan.addOpening((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, 'door'); if (typeof r === 'string') ui.toast(r); })()">Add door</button>
        <button class="btn" @click="(() => { const r = plan.addOpening((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, 'window'); if (typeof r === 'string') ui.toast(r); })()">Add window</button>
        <button class="btn" @click="plan.splitWall(o)">Split in half</button>
      </div>
    </template>

    <!-- Door / window -->
    <template v-else-if="kind === 'opening'">
      <div class="group"><div class="eyebrow">{{ o.type === 'door' ? 'Door' : 'Window' }}</div><h2>{{ o.type === 'door' ? 'Door' : 'Window' }} · {{ fmtLen(o.w, units) }}</h2></div>
      <div class="group">
        <div class="field"><label for="p-otype">Type</label><select id="p-otype" :value="o.type" @change="setOpening('type', $event.target.value)"><option value="door">Door</option><option value="window">Window</option></select></div>
        <div class="field"><label for="p-ow">Width</label><div class="inline"><input id="p-ow" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.w, units)" @change="onLen($event, o.w, (v) => setOpening('w', v))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div class="field"><label for="p-oh">Height</label><div class="inline"><input id="p-oh" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.h, units)" @change="onLen($event, o.h, (v) => setOpening('h', v))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div v-if="o.type === 'window'" class="field"><label for="p-osill">Sill height</label><div class="inline"><input id="p-osill" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.sill, units)" @change="onLen($event, o.sill, (v) => setOpening('sill', v))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div class="field"><label for="p-opos">From wall start</label><div class="inline"><input id="p-opos" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.t * wallLen(wall) - o.w / 2, units)" @change="onLen($event, o.t * wallLen(wall) - o.w / 2, (v) => setOpening('pos', v))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
      </div>
      <div v-if="o.type === 'door'" class="row"><button class="btn" @click="setOpening('hinge')">Swap hinge side</button><button class="btn" @click="setOpening('flip')">Open other way</button></div>
    </template>

    <!-- Room -->
    <template v-else-if="kind === 'room'">
      <div class="group"><div class="eyebrow">Room</div><h2>{{ o.name }}</h2><span class="readout">{{ fmtArea(o.w * o.h, units) }} · {{ fmtLen(o.w, units) }} × {{ fmtLen(o.h, units) }}</span></div>
      <div class="group">
        <div class="field"><label for="p-rname">Name</label><input id="p-rname" type="text" :value="o.name" @input="set(() => { o.name = $event.target.value || 'Room'; }, false)" @change="plan.commit()" /></div>
        <div class="field"><label for="p-rfloor">Floor</label><select id="p-rfloor" :value="o.floor" @change="set(() => { o.floor = $event.target.value; })"><option v-for="(f, k) in FLOORS" :key="k" :value="k">{{ f.label }}</option></select></div>
        <div class="field"><label for="p-rw">Width</label><div class="inline"><input id="p-rw" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.w, units)" @change="onLen($event, o.w, (v) => set(() => { o.w = clamp(v, 0.5, 60); }))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
        <div class="field"><label for="p-rh">Depth</label><div class="inline"><input id="p-rh" type="text" class="len" autocomplete="off" spellcheck="false" :value="lenInput(o.h, units)" @change="onLen($event, o.h, (v) => set(() => { o.h = clamp(v, 0.5, 60); }))" /><span v-if="units === 'm'" class="unit">m</span></div></div>
      </div>
    </template>

    <!-- Furniture -->
    <template v-else-if="kind === 'furniture' && item">
      <div class="group"><div class="eyebrow">{{ catLabel(item.category) }} · {{ item.sku }}</div><h2>{{ item.name }}</h2>
        <span class="readout">{{ fmtSize(item, units) }} · {{ fmtINR(item.price) }}</span></div>
      <div class="group">
        <div class="field"><label>Finish</label>
          <div class="swatches"><button v-for="c in item.colors" :key="c" :aria-label="`Finish ${c}`" :aria-pressed="o.color === c" :style="{ background: c }" @click="set(() => { o.color = c; })"></button></div>
        </div>
        <div class="field"><label for="p-fcol">Custom colour</label><input id="p-fcol" type="color" :value="o.color" @input="set(() => { o.color = $event.target.value; }, false)" @change="plan.commit()" /></div>
        <div class="field"><label for="p-frot">Rotation</label><div class="inline"><input id="p-frot" type="number" step="15" :value="o.rot" @change="set(() => { o.rot = ((num($event) % 360) + 360) % 360; })" /><span class="unit">°</span></div></div>
        <div class="field"><label>Position</label><span class="readout">{{ fmtLen(o.x, units) }}, {{ fmtLen(o.y, units) }}</span></div>
      </div>
      <div class="row">
        <button class="btn" @click="plan.rotateFurniture(o, -90)">↺ 90°</button>
        <button class="btn" @click="plan.rotateFurniture(o, 90)">↻ 90°</button>
        <button class="btn" @click="plan.duplicateFurniture(o)">Duplicate</button>
      </div>
    </template>

    <!-- Tracing image -->
    <template v-else-if="kind === 'underlay'">
      <div class="group"><div class="eyebrow">Tracing image</div><h2>Imported plan</h2>
        <span class="readout">{{ fmtLen(o.w * o.mpp, units) }} × {{ fmtLen(o.h * o.mpp, units) }} · {{ units === 'ft' ? `${(0.0254 / o.mpp).toFixed(1)} px/in` : `${(0.01 / o.mpp).toFixed(2)} px/cm` }}</span></div>
      <p class="muted">Set the scale first: click both ends of a dimension printed on the drawing and type its length. Then lock the image and trace walls over it.</p>
      <div class="row"><button class="btn primary" @click="startCalibrate">Set scale</button></div>
      <div class="group">
        <div class="field"><label for="p-uop">Opacity</label><div class="inline"><input id="p-uop" type="range" min="0.1" max="1" step="0.05" :value="o.opacity" @input="set(() => { o.opacity = +$event.target.value; }, false)" @change="plan.commit()" /><span class="readout">{{ Math.round(o.opacity * 100) }}%</span></div></div>
        <div class="field"><label for="p-urot">Rotation</label><div class="inline"><input id="p-urot" type="number" step="0.5" :value="o.rot" @change="set(() => { o.rot = num($event) || 0; })" /><span class="unit">°</span></div></div>
        <div class="field"><label for="p-uvis">Show on plan</label><input id="p-uvis" type="checkbox" :checked="o.visible" @change="set(() => { o.visible = $event.target.checked; })" /></div>
        <div class="field"><label for="p-ulock">Lock in place</label><input id="p-ulock" type="checkbox" :checked="o.locked" @change="set(() => { o.locked = $event.target.checked; })" /></div>
        <div class="field"><label for="p-u3d">Show in 3D</label><input id="p-u3d" type="checkbox" :checked="o.show3D" @change="set(() => { o.show3D = $event.target.checked; })" /></div>
      </div>
      <div class="row"><button class="btn" @click="ui.importOpen = true">Replace image</button></div>
    </template>

    <div v-if="o" class="row"><button class="btn danger" @click="plan.deleteObj(plan.sel)">{{ kind === 'underlay' ? 'Remove image' : 'Delete' }}</button><button class="btn" @click="plan.select(null)">Done</button></div>
  </aside>
</template>

<style scoped>
.props { border-left: 1px solid var(--line); background: var(--panel); overflow: auto; padding: 14px 16px 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.collapse { display: none; }
h2 { margin: 0; font: 600 22px/1.1 var(--f-display); letter-spacing: .02em; text-wrap: balance; }
.group { display: flex; flex-direction: column; gap: 8px; }
.between { justify-content: space-between; }
.muted { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
.fine { margin: 0; color: var(--muted); font-size: 11px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tbl td { padding: 5px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.tbl td.n { text-align: right; font-family: var(--f-mono); font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; padding-left: 8px; }
.tbl .total td { font-weight: 600; color: var(--ink); border-bottom: 0; }
.tbl .total td.n { color: var(--ink); }
.tbl .link { cursor: pointer; } .tbl .link:hover td { color: var(--accent); }
.q { color: var(--muted); font-family: var(--f-mono); font-size: 11px; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.keys { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 12px; color: var(--muted); }
.keys kbd { font: 11px var(--f-mono); background: var(--paper); border: 1px solid var(--line); border-radius: 3px; padding: 0 4px; color: var(--ink); justify-self: start; }
.swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.swatches button { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line); padding: 0; }
.swatches button[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--accent); }
.field input.len { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
input[type=color] { width: 44px; height: 28px; border: 1px solid var(--line); border-radius: var(--r); padding: 2px; background: var(--paper); }
input[type=checkbox] { justify-self: start; width: 16px; height: 16px; accent-color: var(--accent); }

@media (max-width: 1180px) {
  .props { position: absolute; left: 74px; bottom: 40px; width: min(300px, calc(50% - 90px)); max-height: min(62%, 580px); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); z-index: 5; padding: 10px 14px 16px; }
  .collapse { display: block; align-self: flex-end; border: 0; background: transparent; color: var(--accent); font-size: 12px; padding: 0; margin-bottom: -8px; }
  .props.collapsed { max-height: 40px; overflow: hidden; }
}
@media (max-width: 760px) {
  .props { left: 12px; right: 12px; width: auto; bottom: 74px; max-height: 44%; }
}
</style>
