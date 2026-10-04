<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { PlanEditor } from '../plan/PlanEditor.js';
import { engines } from '../lib/engines.js';
import { fmtArea, fmtINR, fmtLen, parseLen } from '../lib/units.js';
import { SKU } from '../catalog/items.js';
import FurnitureStore from './FurnitureStore.vue';

const plan = usePlanStore();
const ui = useUiStore();
const canvas = ref(null);
const drafting = ref(false);
const cursor = ref('');
const calibLen = ref('');
const calibUnit = ref('ft');
const units = computed(() => plan.plan.settings.units);
const FT_EXAMPLE = `e.g. 12'6"`;
const calibInput = ref(null);
const dropActive = ref(false);
let editor;

onMounted(() => {
  editor = new PlanEditor(canvas.value, plan, ui, {
    onDraft: (v) => { drafting.value = v; },
    onCursor: (x, y) => { cursor.value = `x ${fmtLen(x, units.value)}  y ${fmtLen(y, units.value)}`; },
  });
  engines.editor = editor;
});
onBeforeUnmount(() => { editor?.destroy(); engines.editor = null; });

watch(() => [plan.rev, plan.sel, ui.tool, ui.placeSku], () => editor?.invalidate());
watch(() => ui.tool, (t) => {
  if (!editor) return;
  editor.wallDraft = null; editor.roomDraft = null; editor.hover = null; drafting.value = false;
  if (t !== 'calibrate') editor.resetCalibration();
  canvas.value.style.cursor = t === 'select' ? 'default' : t === 'erase' ? 'not-allowed' : 'crosshair';
});
watch(() => ui.calib, async (c) => { if (c) { calibLen.value = ''; calibUnit.value = units.value; await nextTick(); calibInput.value?.focus(); } });

const hint = computed(() => {
  switch (ui.tool) {
    case 'select': return 'Drag to move · drag a wall end to reshape · drag empty space to pan';
    case 'wall': return drafting.value ? 'Click the next corner · double-click or Esc to finish' : `Click to start a wall · corners snap to the ${units.value === 'ft' ? '9¾″ (25 cm)' : '25 cm'} grid`;
    case 'room': return 'Drag a rectangle to add a room with its four walls';
    case 'door': return 'Click a wall to add a door';
    case 'window': return 'Click a wall to add a window';
    case 'erase': return 'Click anything to delete it';
    case 'place': return `Click to place the ${SKU[ui.placeSku]?.name.toLowerCase() || 'item'} · it backs onto the nearest wall · Shift-click to place several`;
    case 'calibrate': return ui.calib ? 'Enter the real length of the line you drew' : 'Click both ends of a dimension you know, such as a wall marked 12′0″';
    default: return '';
  }
});

function applyCalibration() {
  const metres = parseLen(calibLen.value, calibUnit.value);
  if (!(metres > 0)) { ui.toast(`Enter the length, for example 12'6" or 12.5 in feet, or 3.81 in metres.`); return; }
  if (plan.calibrate(ui.calib.p1, ui.calib.p2, metres)) {
    ui.setTool('select'); plan.select({ kind: 'underlay', id: 'underlay' });
    ui.toast('Scale set. Lock the image, then trace walls over it.');
    editor.fit();
  }
}
function cancelCalibration() { ui.setTool('select'); }

function onDragOver(e) {
  if (e.dataTransfer?.types?.includes('text/x-bydh-sku')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropActive.value = true; }
}
function onDrop(e) {
  dropActive.value = false;
  const raw = e.dataTransfer?.getData('text/x-bydh-sku'); if (!raw) return;
  e.preventDefault();
  const { sku, color } = JSON.parse(raw);
  const [x, y] = editor.clientToWorld(e.clientX, e.clientY);
  const f = plan.addFurniture(sku, x, y, color);
  if (f) { plan.select({ kind: 'furniture', id: f.id }); ui.setTool('select'); }
}
</script>

<template>
  <section class="pane" @dragover="onDragOver" @dragleave="dropActive = false" @drop="onDrop">
    <canvas ref="canvas" class="plan" :class="{ drop: dropActive }" aria-label="Floor plan editor"></canvas>
    <div class="label">Plan</div>
    <div class="zoom">
      <button aria-label="Zoom in" title="Zoom in" @click="engines.editor.zoomBy(1.25)">+</button>
      <button aria-label="Zoom out" title="Zoom out" @click="engines.editor.zoomBy(0.8)">−</button>
      <button aria-label="Fit plan" title="Fit plan to view" @click="engines.editor.fit()">⤢</button>
    </div>

    <FurnitureStore v-if="ui.storeOpen" />

    <form v-if="ui.tool === 'calibrate' && ui.calib" class="calib" @submit.prevent="applyCalibration">
      <label for="calibLen">Real length of that line</label>
      <div class="row">
        <input id="calibLen" ref="calibInput" v-model="calibLen" type="text" autocomplete="off" spellcheck="false" :placeholder="calibUnit === 'ft' ? FT_EXAMPLE : 'e.g. 3.81'" />
        <select id="calibUnit" v-model="calibUnit" aria-label="Unit"><option value="ft">ft</option><option value="m">m</option></select>
        <button class="btn primary" type="submit">Set scale</button>
        <button class="btn" type="button" @click="cancelCalibration">Cancel</button>
      </div>
    </form>

    <div v-if="hint" class="hint">
      <span>{{ hint }}
        <button v-if="drafting" type="button" @click="engines.editor.endWall()">Finish</button>
        <button v-if="ui.tool === 'place' || ui.tool === 'calibrate'" type="button" @click="ui.setTool('select')">Cancel</button>
      </span>
    </div>
    <div class="status">
      <span>{{ plan.plan.walls.length }} walls · {{ plan.plan.rooms.length }} rooms · {{ plan.plan.furniture.length }} items</span>
      <span class="grow"></span>
      <span class="opt">{{ cursor }}</span>
      <span>{{ fmtArea(plan.carpetArea, plan.plan.settings.units) }}</span>
      <span>{{ fmtINR(plan.furnitureTotal) }}</span>
    </div>
  </section>
</template>

<style scoped>
.pane { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.plan { display: block; width: 100%; height: 100%; touch-action: none; cursor: default; }
.plan.drop { outline: 3px dashed var(--accent); outline-offset: -6px; }
.label { position: absolute; top: 10px; left: 12px; font: 600 12px var(--f-display); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); pointer-events: none; }
.zoom { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 4px; }
.zoom button { width: 30px; height: 30px; border: 1px solid var(--line); background: var(--panel); border-radius: var(--r); font: 14px/1 var(--f-mono); }
.hint { position: absolute; left: 12px; right: 12px; bottom: 38px; display: flex; justify-content: center; pointer-events: none; }
.hint span { background: var(--ink); color: var(--paper); padding: 6px 12px; border-radius: 20px; font-size: 12.5px; max-width: 100%; text-align: center; pointer-events: auto; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
.hint button { border: 0; background: var(--accent); color: var(--accent-ink); border-radius: 12px; padding: 2px 10px; font-size: 12px; }
.status { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 16px; padding: 6px 12px; font: 11px var(--f-mono); color: var(--muted); border-top: 1px solid var(--line); background: var(--panel); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; }
.status .grow { flex: 1; }
.calib { position: absolute; left: 50%; top: 52px; transform: translateX(-50%); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); padding: 12px; display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100% - 24px)); z-index: 6; }
.calib label { font-size: 12.5px; color: var(--muted); }
.calib input { width: 110px; border: 1px solid var(--line); background: var(--paper); border-radius: var(--r); padding: 5px 8px; font-family: var(--f-mono); }
.calib select { border: 1px solid var(--line); background: var(--paper); border-radius: var(--r); padding: 5px; }
@media (max-width: 760px) { .status .opt { display: none; } }
</style>
