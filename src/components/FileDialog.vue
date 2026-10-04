<script setup>
import { ref, computed } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { copyText, downloadBlob, readText, slug } from '../lib/files.js';
import { engines } from '../lib/engines.js';

const plan = usePlanStore();
const ui = useUiStore();
const text = ref('');
const area = ref(null);
const json = computed(() => JSON.stringify(plan.plan));

function download() {
  downloadBlob(new Blob([JSON.stringify(plan.plan, null, 1)], { type: 'application/json' }), `${slug(plan.plan.name)}.bydh.json`);
  ui.toast('Plan file downloaded.');
}
async function copy() {
  if (await copyText(json.value)) ui.toast('Plan copied to the clipboard.');
  else { text.value = json.value; requestAnimationFrame(() => area.value?.select()); ui.toast('Press Ctrl+C (⌘C) to copy the selected plan.'); }
}
function open(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.walls)) throw new Error();
    plan.load(o); ui.fileOpen = false;
    requestAnimationFrame(() => { engines.editor?.fit(); engines.viewport?.fitCamera(); });
    ui.toast('Plan opened. Undo to go back.');
  } catch { ui.toast('That is not a BYDH plan file. Check you copied all of it, from the first { to the last }.'); }
}
async function onFile(e) { const f = e.target.files[0]; e.target.value = ''; if (f) open(await readText(f)); }
</script>

<template>
  <div class="modal" @click.self="ui.fileOpen = false">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="fileTitle">
      <h2 id="fileTitle">Save or open a plan</h2>
      <p>Your plan saves itself in this browser as you work, including any imported image. To keep a copy or move it to another device, download the plan file.</p>
      <div class="row">
        <button class="btn primary" @click="download">Download plan file</button>
        <button class="btn" @click="copy">Copy as text</button>
        <label class="btn" for="openFile">Open plan file…</label>
        <input id="openFile" type="file" accept=".json,application/json" hidden @change="onFile" />
      </div>
      <label class="muted" for="planText">Or paste a plan file's text here</label>
      <textarea id="planText" ref="area" v-model="text" spellcheck="false" placeholder='{"version":2,"name":"…"}'></textarea>
      <div class="row">
        <span style="flex: 1"></span>
        <button class="btn" @click="ui.fileOpen = false">Close</button>
        <button class="btn" :disabled="!text.trim()" @click="open(text)">Open pasted plan</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea { width: 100%; height: 140px; border: 1px solid var(--line); background: var(--paper); border-radius: var(--r); padding: 8px; font: 11.5px var(--f-mono); resize: vertical; }
.muted { color: var(--muted); font-size: 12.5px; }
</style>
