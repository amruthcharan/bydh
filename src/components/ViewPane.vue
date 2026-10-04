<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { Viewport } from '../three/Viewport.js';
import { engines } from '../lib/engines.js';
import { downloadBlob, slug } from '../lib/files.js';

const plan = usePlanStore();
const ui = useUiStore();
const host = ref(null);
const overlay = ref(null);
const exportOpen = ref(false);
const busy = ref(false);
const note = ref('');
let vp, raf = 0, noteTimer;

const NOTES = {
  orbit: 'Drag to orbit · right-drag to pan · scroll to zoom · click to select',
  walk: 'Drag to look · WASD or arrow keys to walk · drag the green marker on the plan to teleport',
  stereo: 'Put the phone in a VR viewer · tilt to look where supported, or drag',
};
function showNote(t) { note.value = t; clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.value = ''; }, 7000); }

onMounted(() => {
  vp = new Viewport(host.value, {
    getPlan: () => plan.plan,
    overlayEl: overlay.value,
    onPick: (p) => plan.select(p),
  });
  engines.viewport = vp;
  vp.rebuild(); vp.fitCamera();
});
onBeforeUnmount(() => { vp?.destroy(); engines.viewport = null; });

watch(() => plan.rev, () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => vp?.rebuild());
});
watch(() => plan.sel, (s) => vp?.setSelection(s));
watch(() => [plan.plan.settings.sun, plan.plan.settings.north], () => vp?.updateSun());
watch(() => ui.viewMode, (m) => { vp?.setMode(m); engines.editor?.invalidate(); showNote(NOTES[m]); });
watch(() => ui.mobileView, () => requestAnimationFrame(() => vp?.resize()));

async function startXR(kind) {
  const err = await vp.xr.start(kind);
  if (err) ui.toast(err, 6500);
}
async function doExport(kind) {
  exportOpen.value = false; busy.value = true;
  try {
    const blob = kind === 'glb' ? await vp.exportGLB() : await vp.exportUSDZ();
    downloadBlob(blob, `${slug(plan.plan.name)}.${kind}`);
    ui.toast(kind === 'glb' ? 'GLB model downloaded. Open it in Blender, SketchUp or any glTF viewer.' : 'USDZ model downloaded. On an iPhone or iPad, tap it to view in AR Quick Look.');
  } catch (e) {
    ui.toast(`Export failed: ${e?.message || 'unknown error'}`);
  } finally { busy.value = false; }
}
function fullscreen() {
  const el = host.value.parentElement;
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => ui.toast('Fullscreen is not available here.'));
  } catch { ui.toast('Fullscreen is not available here.'); }
}
const pad = (k, v) => { if (vp) { vp.walk.pad[k] = v; vp.active = true; } };
</script>

<template>
  <section class="pane">
    <div ref="host" class="host"></div>
    <div v-if="ui.viewMode === 'stereo'" class="divider"></div>
    <div class="label">Live 3D</div>

    <div class="bar">
      <div class="seg" role="group" aria-label="Camera">
        <button :aria-pressed="ui.viewMode === 'orbit'" @click="ui.viewMode = 'orbit'">Orbit</button>
        <button :aria-pressed="ui.viewMode === 'walk'" @click="ui.viewMode = 'walk'">Walk</button>
        <button :aria-pressed="ui.viewMode === 'stereo'" title="Split screen for phone VR viewers" @click="ui.viewMode = 'stereo'">Cardboard</button>
      </div>
      <div class="seg" role="group" aria-label="Immersive and export">
        <button class="xr" title="Enter VR on a WebXR headset" @click="startXR('immersive-vr')">VR</button>
        <button class="xr" title="Place the model in your room on an AR phone" @click="startXR('immersive-ar')">AR</button>
        <button :disabled="busy" :aria-expanded="exportOpen" @click="exportOpen = !exportOpen">{{ busy ? 'Exporting…' : 'Export' }}</button>
        <button title="Fullscreen" aria-label="Fullscreen" @click="fullscreen">⛶</button>
      </div>
      <div v-if="exportOpen" class="menu" role="menu">
        <button role="menuitem" @click="doExport('glb')"><b>GLB</b><span>For Blender, SketchUp, web viewers</span></button>
        <button role="menuitem" @click="doExport('usdz')"><b>USDZ</b><span>For iPhone and iPad AR Quick Look</span></button>
      </div>
    </div>

    <div v-if="ui.viewMode !== 'orbit'" class="walkpad">
      <button class="up" aria-label="Walk forward" @pointerdown.prevent="pad('f', 1)" @pointerup="pad('f', 0)" @pointerleave="pad('f', 0)">▲</button>
      <button class="left" aria-label="Turn left" @pointerdown.prevent="pad('l', 1)" @pointerup="pad('l', 0)" @pointerleave="pad('l', 0)">◀</button>
      <button class="down" aria-label="Walk back" @pointerdown.prevent="pad('b', 1)" @pointerup="pad('b', 0)" @pointerleave="pad('b', 0)">▼</button>
      <button class="right" aria-label="Turn right" @pointerdown.prevent="pad('r', 1)" @pointerup="pad('r', 0)" @pointerleave="pad('r', 0)">▶</button>
    </div>
    <div v-if="note" class="note"><span>{{ note }}</span></div>

    <div ref="overlay" class="xr-overlay" hidden>
      <div class="xr-tip">Point at the floor or a table, then tap to place</div>
      <div class="xr-bar">
        <button @click.stop="vp.xr.setScale(1 / 25)">Tabletop 1:25</button>
        <button @click.stop="vp.xr.setScale(1)">Full size</button>
        <button @click.stop="vp.xr.end()">Exit</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pane { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #C9D9E2; }
.host { position: absolute; inset: 0; }
.host :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: none; }
.divider { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: #000; pointer-events: none; }
.label { position: absolute; top: 10px; left: 12px; font: 600 12px var(--f-display); letter-spacing: .12em; text-transform: uppercase; color: #2a3a40; background: rgba(255, 255, 255, .7); padding: 2px 6px; border-radius: 3px; pointer-events: none; }
.bar { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: calc(100% - 110px); }
.seg { display: flex; background: rgba(255, 255, 255, .9); border: 1px solid rgba(20, 30, 35, .15); border-radius: var(--r); padding: 2px; gap: 2px; backdrop-filter: blur(6px); }
.seg button { border: 0; background: transparent; padding: 5px 10px; border-radius: 4px; font-size: 12.5px; color: #22313a; font-weight: 500; }
.seg button:hover { background: rgba(20, 30, 35, .07); }
.seg button[aria-pressed="true"] { background: #22313a; color: #fff; }
.seg .xr { color: #1f5f53; font-weight: 600; }
.menu { position: absolute; top: 40px; right: 0; background: #fff; color: #22313a; border: 1px solid rgba(20, 30, 35, .15); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, .18); padding: 4px; display: flex; flex-direction: column; min-width: 240px; z-index: 4; }
.menu button { border: 0; background: transparent; text-align: left; padding: 8px 10px; border-radius: 5px; display: flex; flex-direction: column; gap: 1px; }
.menu button:hover { background: #eef2f1; }
.menu b { font-size: 13px; } .menu span { font-size: 11.5px; color: #5b676d; }
.walkpad { position: absolute; left: 12px; bottom: 12px; display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(2, 44px); gap: 4px; }
.walkpad button { border: 1px solid rgba(20, 30, 35, .2); background: rgba(255, 255, 255, .85); border-radius: 8px; font-size: 16px; color: #22313a; touch-action: none; user-select: none; -webkit-user-select: none; }
.walkpad .up { grid-column: 2; } .walkpad .left { grid-column: 1; grid-row: 2; } .walkpad .down { grid-column: 2; grid-row: 2; } .walkpad .right { grid-column: 3; grid-row: 2; }
.note { position: absolute; right: 12px; bottom: 12px; left: 170px; display: flex; justify-content: flex-end; pointer-events: none; }
.note span { background: rgba(255, 255, 255, .88); color: #22313a; font-size: 12px; padding: 5px 10px; border-radius: 14px; max-width: 360px; }
.xr-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 40; }
.xr-tip { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, .6); color: #fff; padding: 8px 14px; border-radius: 16px; font-size: 13px; white-space: nowrap; }
.xr-bar { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; gap: 6px; pointer-events: auto; }
.xr-bar button { border: 0; border-radius: 20px; padding: 10px 16px; background: rgba(255, 255, 255, .92); color: #1c272e; font-size: 14px; font-weight: 600; }
@media (max-width: 760px) { .bar { top: 40px; max-width: calc(100% - 16px); } .note { left: 12px; bottom: 116px; } }
</style>
