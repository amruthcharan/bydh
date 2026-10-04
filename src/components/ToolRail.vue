<script setup>
import { useUiStore } from '../stores/ui.js';
const ui = useUiStore();

// Icons are inline SVG paths drawn on a 24-unit grid.
const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', d: 'M5 3l6 17 2.5-7L20 10.5z' },
  { id: 'wall', label: 'Wall', key: 'W', d: 'M4 19V6h10v8h6' },
  { id: 'room', label: 'Room', key: 'M', d: 'M4 5h16v14H4zM4 12h6' },
  { id: 'door', label: 'Door', key: 'D', d: 'M3 20h18M7 20V8M7 8a12 12 0 0 1 12 12' },
  { id: 'window', label: 'Window', key: 'N', d: 'M3 12h4M17 12h4M7 9.5h10M7 12h10M7 14.5h10' },
  { id: 'erase', label: 'Erase', key: 'E', d: 'M8 20h12M5.5 14.5l8-8 5 5-6.5 6.5H9z' },
];
function pick(id) { ui.setTool(id); if (window.innerWidth <= 760) ui.mobileView = 'plan'; }
</script>

<template>
  <nav class="tools" aria-label="Drawing tools">
    <button v-for="t in TOOLS" :key="t.id" class="tool" :aria-pressed="ui.tool === t.id" :title="`${t.label} (${t.key})`" @click="pick(t.id)">
      <svg viewBox="0 0 24 24"><path :d="t.d" /></svg>{{ t.label }}<kbd>{{ t.key }}</kbd>
    </button>
    <span class="div" />
    <button class="tool store" :aria-pressed="ui.storeOpen" title="Furniture store (F)" @click="ui.storeOpen = !ui.storeOpen; ui.mobileView = 'plan'">
      <svg viewBox="0 0 24 24"><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM5 17v2M19 17v2" /></svg>Store<kbd>F</kbd>
    </button>
    <button class="tool" title="Import a plan image or PDF (I)" @click="ui.importOpen = true">
      <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 8.5h.01" /></svg>Import<kbd>I</kbd>
    </button>
  </nav>
</template>

<style scoped>
.tools { display: flex; flex-direction: column; gap: 2px; padding: 8px 6px; border-right: 1px solid var(--line); background: var(--panel); overflow: auto; }
.tool {
  display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: transparent;
  border-radius: var(--r); padding: 7px 2px 5px; font: 600 10.5px var(--f-display); letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
}
.tool svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.tool:hover { color: var(--ink); background: var(--paper); }
.tool[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent); }
.tool.store { color: var(--accent); }
.tool kbd { font-family: var(--f-mono); font-size: 9px; opacity: .6; }
.div { height: 1px; background: var(--line); margin: 6px 4px; flex: none; }
@media (max-width: 760px) {
  .tools { grid-row: 2; flex-direction: row; border-right: 0; border-top: 1px solid var(--line); overflow-x: auto; padding: 4px 8px calc(4px + env(safe-area-inset-bottom, 0px)); }
  .tool { min-width: 54px; }
  .tool kbd { display: none; }
  .div { width: 1px; height: auto; margin: 4px 6px; }
}
</style>
