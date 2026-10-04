<script setup>
import { onMounted, ref } from 'vue';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';
import { engines } from '../lib/engines.js';

const plan = usePlanStore();
const ui = useUiStore();
const yes = ref(null);
onMounted(() => yes.value?.focus());
function confirm() {
  ui.confirmNew = false; plan.newBlank(); ui.setTool('room');
  requestAnimationFrame(() => { engines.editor?.fit(); engines.viewport?.fitCamera(); });
  ui.toast('Blank plan. Drag on the plan to draw your first room, or import a drawing to trace.', 6000);
}
</script>

<template>
  <div class="modal" @click.self="ui.confirmNew = false">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="newTitle">
      <h2 id="newTitle">Start a new plan?</h2>
      <p>This clears the current plan. You can undo it afterwards.</p>
      <div class="row"><span style="flex: 1"></span><button class="btn" @click="ui.confirmNew = false">Cancel</button><button ref="yes" class="btn primary" @click="confirm">Clear plan</button></div>
    </div>
  </div>
</template>
