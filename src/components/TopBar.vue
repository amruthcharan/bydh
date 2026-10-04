<script setup>
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';

const plan = usePlanStore();
const ui = useUiStore();
function rename(e) { plan.plan.name = e.target.value; plan.touch(); }
</script>

<template>
  <header class="bar">
    <div class="brand">
      <span class="mark" aria-hidden="true">BYDH</span>
      <input class="name" type="text" aria-label="Project name" :value="plan.plan.name" @input="rename" @change="plan.commit()" />
    </div>
    <div class="actions">
      <button class="btn" :disabled="!plan.canUndo" title="Undo (Ctrl+Z)" @click="plan.undo()">Undo</button>
      <button class="btn" :disabled="!plan.canRedo" title="Redo (Ctrl+Shift+Z)" @click="plan.redo()">Redo</button>
      <span class="sep opt"></span>
      <button class="btn opt" @click="ui.confirmNew = true">New plan</button>
      <button class="btn opt" @click="plan.loadSample(); ui.toast('Sample loaded. Undo to go back.')">Load sample</button>
      <button class="btn" @click="ui.fileOpen = true">Save / open</button>
    </div>
    <div class="tabs" role="tablist" aria-label="View">
      <button role="tab" :aria-selected="ui.mobileView === 'plan'" @click="ui.mobileView = 'plan'">Plan</button>
      <button role="tab" :aria-selected="ui.mobileView === '3d'" @click="ui.mobileView = '3d'">3D</button>
    </div>
  </header>
</template>

<style scoped>
.bar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--panel); flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 220px; }
.mark { font-family: var(--f-display); font-weight: 700; font-size: 22px; letter-spacing: .06em; line-height: 1; padding: 3px 7px 2px; border: 2px solid var(--ink); border-radius: 3px; }
.name { border: 1px solid transparent; background: transparent; padding: 4px 6px; border-radius: 4px; font-weight: 500; min-width: 0; width: 100%; max-width: 340px; }
.name:hover, .name:focus { border-color: var(--line); background: var(--paper); }
.actions { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
.tabs { display: none; gap: 2px; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r); padding: 2px; }
.tabs button { border: 0; background: transparent; padding: 4px 12px; border-radius: 4px; font-size: 13px; }
.tabs button[aria-selected="true"] { background: var(--panel); box-shadow: 0 0 0 1px var(--line); }
@media (max-width: 760px) {
  .bar { padding: 6px 12px; gap: 8px; }
  .brand { flex: 1 1 140px; }
  .opt { display: none; }
  .tabs { display: flex; }
}
</style>
