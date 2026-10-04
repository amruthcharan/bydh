<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { usePlanStore } from './stores/plan.js';
import { useUiStore } from './stores/ui.js';
import { engines } from './lib/engines.js';
import TopBar from './components/TopBar.vue';
import ToolRail from './components/ToolRail.vue';
import PlanPane from './components/PlanPane.vue';
import ViewPane from './components/ViewPane.vue';
import PropertiesPanel from './components/PropertiesPanel.vue';
import ImportDialog from './components/ImportDialog.vue';
import FileDialog from './components/FileDialog.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import AppToast from './components/AppToast.vue';

const plan = usePlanStore();
const ui = useUiStore();

const TOOL_KEYS = { v: 'select', w: 'wall', m: 'room', d: 'door', n: 'window', e: 'erase' };

function onKey(e) {
  const t = e.target;
  if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? plan.redo() : plan.undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); plan.redo(); return; }
  if (e.code === 'Space' && engines.editor) engines.editor.spaceDown = true;
  if (e.key === 'Escape') {
    if (engines.editor?.wallDraft) engines.editor.endWall();
    else if (ui.tool !== 'select') ui.setTool('select');
    else if (ui.storeOpen) ui.storeOpen = false;
    else plan.select(null);
    return;
  }
  const sel = plan.sel;
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); plan.deleteObj(sel); return; }
  if (mod || e.altKey) return;
  if (k === 'r' && sel?.kind === 'furniture') { plan.rotateFurniture(plan.selected, e.shiftKey ? -90 : 90); return; }
  if (k === 'f') { ui.storeOpen = !ui.storeOpen; return; }
  if (k === 'i') { ui.importOpen = true; return; }
  if (TOOL_KEYS[k]) ui.setTool(TOOL_KEYS[k]);
}
function onKeyUp(e) { if (e.code === 'Space' && engines.editor) engines.editor.spaceDown = false; }

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  const how = await plan.boot();
  requestAnimationFrame(() => { engines.editor?.fit(); engines.viewport?.fitCamera(); });
  if (how === 'sample') ui.toast('This is a sample home. Open the Store to furnish it, or Import plan to trace your own drawing.', 6000);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <div class="app">
    <TopBar />
    <main class="work" :data-view="ui.mobileView">
      <ToolRail />
      <PlanPane class="pane-plan" />
      <ViewPane class="pane-3d" />
      <PropertiesPanel class="pane-props" />
    </main>
    <ImportDialog v-if="ui.importOpen" />
    <FileDialog v-if="ui.fileOpen" />
    <ConfirmDialog v-if="ui.confirmNew" />
    <AppToast />
  </div>
</template>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; }
.work {
  flex: 1; min-height: 0; position: relative;
  display: grid; grid-template-columns: 62px minmax(0, 1fr) minmax(0, 1fr) 300px;
}
.pane-plan { border-right: 1px solid var(--line); }

@media (max-width: 1180px) {
  .work { grid-template-columns: 62px minmax(0, 1fr) minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .work { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .pane-plan, .pane-3d { grid-row: 1; grid-column: 1; border-right: 0; }
  .work[data-view="plan"] .pane-3d { visibility: hidden; }
  .work[data-view="3d"] .pane-plan { visibility: hidden; }
  .work[data-view="3d"] .pane-props { display: none; }
}
</style>
