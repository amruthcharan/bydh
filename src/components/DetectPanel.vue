<script setup>
// Find walls, doors, windows and rooms in the tracing image.
import { computed, onMounted, ref } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { WALL_TYPES } from '../catalog/items.js';
import { MODEL, deleteModel, modelReady } from '../detect/model.js';

const emit = defineEmits(['calibrate']);
const plan = usePlanStore();
const ui = useUiStore();
const u = computed(() => plan.plan.underlay);
const method = ref('model');
const hollow = ref(false);
const replace = ref(false);
const busy = ref(false);
const status = ref('');
const ready = ref(false);
const hasWalls = computed(() => plan.plan.walls.length > 0);

onMounted(async () => { ready.value = await modelReady().catch(() => false); });

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

async function run() {
  if (busy.value || !u.value) return;
  busy.value = true; status.value = '';
  try {
    const { detect } = await import('../detect/run.js');
    const found = await detect(u.value, { method: method.value, hollow: hollow.value, onProgress: (t) => { status.value = t; } });
    ready.value = await modelReady().catch(() => false);
    if (!found.walls.length) {
      ui.toast(method.value === 'quick'
        ? 'No walls found. If the walls are drawn as two thin lines, tick "Walls drawn as outlines", or try the wall model.'
        : 'No walls found. Check the scale is set, then try again or use the Quick method.', 7000);
      return;
    }
    // Use the nearest standard wall type.
    const wallT = WALL_TYPES.reduce((a, b) => (Math.abs(b.v - found.wallT) < Math.abs(a.v - found.wallT) ? b : a)).v;
    plan.addDetected({ ...found, wallT }, { replace: replace.value });
    const doors = found.openings.filter((o) => o.type === 'door').length, windows = found.openings.length - doors;
    let msg = `Added ${plural(found.walls.length, 'wall')}, ${plural(doors, 'door')}, ${plural(windows, 'window')} and ${plural(found.rooms.length, 'room')}. Check them over; Ctrl Z removes them all.`;
    if (found.skippedRooms) msg += ` ${plural(found.skippedRooms, 'space')} weren’t rectangular, so draw those rooms yourself.`;
    ui.toast(msg, 9000);
  } catch (err) {
    ui.toast(err.message || 'Detection failed. Try again.', 7000);
  } finally {
    busy.value = false; status.value = '';
  }
}

async function removeModel() {
  await deleteModel();
  ready.value = false;
  ui.toast('Removed the wall model from this device.');
}
</script>

<template>
  <div class="group">
    <div class="eyebrow">Find walls and rooms</div>
    <p class="muted">Traces walls, doors, windows and rectangular rooms from the image. Runs on this device; the image isn’t uploaded.</p>
    <p v-if="!u.calibrated" class="warn">Set the scale first so walls come out the right size. <button class="link" type="button" @click="emit('calibrate')">Set scale</button></p>
    <div class="choices" role="radiogroup" aria-label="Detection method">
      <label><input v-model="method" type="radio" value="model" /> <span><b>Wall model</b> · best for scans and photos. {{ ready ? 'Downloaded to this device.' : `Downloads once, about ${MODEL.approxMB} MB.` }}</span></label>
      <label><input v-model="method" type="radio" value="quick" /> <span><b>Quick</b> · no download. For clean drawings with solid walls.</span></label>
    </div>
    <label v-if="method === 'quick'" class="check"><input v-model="hollow" type="checkbox" /> Walls drawn as outlines (two thin lines)</label>
    <label v-if="hasWalls" class="check"><input v-model="replace" type="checkbox" /> Replace the walls, doors and rooms already drawn</label>
    <div class="row">
      <button class="btn primary" type="button" :disabled="busy" @click="run">{{ busy ? 'Working…' : 'Find walls' }}</button>
      <button v-if="ready && method === 'model' && !busy" class="btn" type="button" @click="removeModel">Remove model</button>
    </div>
    <p v-if="status" class="muted" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.group { display: flex; flex-direction: column; gap: 8px; }
.muted { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
.warn { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--danger); }
.link { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; font-size: inherit; }
.choices { display: flex; flex-direction: column; gap: 6px; }
.choices label, .check { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.4; }
.choices input, .check input { margin-top: 2px; accent-color: var(--accent); }
</style>
