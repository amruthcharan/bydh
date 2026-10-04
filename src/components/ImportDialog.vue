<script setup>
import { ref, onMounted } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { imageFileToUnderlay, isPdf, openPdf } from '../lib/importImage.js';
import { engines } from '../lib/engines.js';

const plan = usePlanStore();
const ui = useUiStore();
const preview = ref(null);     // { src, w, h }
const pdf = ref(null);         // { pageCount, render }
const page = ref(1);
const loading = ref('');
const error = ref('');
const over = ref(false);
const fileInput = ref(null);

async function handle(file) {
  if (!file) return;
  error.value = ''; preview.value = null; pdf.value = null;
  try {
    if (isPdf(file)) {
      loading.value = 'Reading PDF…';
      pdf.value = await openPdf(file); page.value = 1;
      await renderPage();
    } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      loading.value = 'Loading image…';
      preview.value = await imageFileToUnderlay(file);
    } else {
      error.value = 'Choose a PNG, JPG or WebP image, or a PDF.';
    }
  } catch (e) {
    error.value = e?.message || 'That file could not be opened.';
  } finally { loading.value = ''; }
}
async function renderPage() {
  loading.value = `Rendering page ${page.value}…`;
  try { preview.value = await pdf.value.render(page.value); } finally { loading.value = ''; }
}
function onDrop(e) { over.value = false; handle(e.dataTransfer?.files?.[0]); }
function onPaste(e) {
  const f = [...(e.clipboardData?.files || [])][0];
  if (f) handle(f);
}
function useImage() {
  plan.setUnderlay(preview.value);
  ui.importOpen = false;
  requestAnimationFrame(() => engines.editor?.fit());
  ui.setTool('calibrate'); ui.mobileView = 'plan';
  ui.toast('Now set the scale: click both ends of a dimension printed on the plan.', 6000);
}
onMounted(() => { fileInput.value?.focus(); });
</script>

<template>
  <div class="modal" @click.self="ui.importOpen = false" @paste="onPaste">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="importTitle">
      <h2 id="importTitle">Import a floor plan</h2>
      <p>Use a photo, a scan or the builder's PDF. The image sits under the grid so you can trace walls over it at the right scale.</p>

      <label class="drop" :class="{ over }" for="importFile" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
        <img v-if="preview" :src="preview.src" alt="Preview of the imported plan" />
        <span v-else-if="loading">{{ loading }}</span>
        <span v-else><b>Choose a file</b> or drop it here<br /><small>PNG, JPG, WebP or PDF · you can also paste an image</small></span>
      </label>
      <input id="importFile" ref="fileInput" type="file" accept="image/*,application/pdf,.pdf" hidden @change="handle($event.target.files[0]); $event.target.value = ''" />

      <div v-if="pdf && pdf.pageCount > 1" class="row">
        <span class="muted">Page</span>
        <button class="btn small" :disabled="page <= 1 || !!loading" @click="page--; renderPage()">‹</button>
        <span class="readout">{{ page }} / {{ pdf.pageCount }}</span>
        <button class="btn small" :disabled="page >= pdf.pageCount || !!loading" @click="page++; renderPage()">›</button>
      </div>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <p v-if="plan.plan.underlay && preview" class="muted">This replaces the current tracing image.</p>

      <div class="row">
        <span style="flex: 1"></span>
        <button class="btn" @click="ui.importOpen = false">Cancel</button>
        <button class="btn primary" :disabled="!preview || !!loading" @click="useImage">Use this plan</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drop { display: flex; align-items: center; justify-content: center; text-align: center; min-height: 220px; max-height: 46vh; border: 2px dashed var(--line); border-radius: 10px; background: var(--paper); cursor: pointer; overflow: hidden; color: var(--muted); font-size: 13px; line-height: 1.6; padding: 8px; }
.drop b { color: var(--accent); }
.drop.over { border-color: var(--accent); background: var(--accent-soft); }
.drop img { max-width: 100%; max-height: 44vh; object-fit: contain; }
.muted { color: var(--muted); font-size: 12.5px; }
.err { color: var(--danger) !important; }
</style>
