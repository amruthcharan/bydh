<script setup>
import { ref, watch, onMounted } from 'vue';
import { thumbnail } from '../three/thumbnails.js';
import { fmtINR, fmtSize } from '../lib/units.js';
import { usePlanStore } from '../stores/plan.js';
import { useUiStore } from '../stores/ui.js';

const props = defineProps({ item: { type: Object, required: true } });
const ui = useUiStore();
const plan = usePlanStore();
const color = ref(props.item.colors[0]);
const src = ref('');
const card = ref(null);

async function load() { src.value = await thumbnail(props.item.sku, color.value); }
onMounted(() => {
  // Render thumbnails only when the card scrolls into view.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: '120px' });
  io.observe(card.value);
});
watch(color, load);

function onDragStart(e) {
  e.dataTransfer.setData('text/x-bydh-sku', JSON.stringify({ sku: props.item.sku, color: color.value }));
  e.dataTransfer.effectAllowed = 'copy';
}
</script>

<template>
  <article ref="card" class="card" draggable="true" @dragstart="onDragStart">
    <div class="thumb">
      <img v-if="src" :src="src" :alt="item.name" draggable="false" />
      <span v-else class="ph" aria-hidden="true"></span>
      <span v-if="item.elev" class="tag">Wall-mounted</span>
    </div>
    <div class="body">
      <h3>{{ item.name }}</h3>
      <div class="dims">{{ fmtSize(item, plan.plan.settings.units) }}</div>
      <div v-if="item.colors.length > 1" class="swatches" role="radiogroup" :aria-label="`${item.name} finish`">
        <button v-for="c in item.colors" :key="c" role="radio" :aria-checked="color === c" :aria-label="`Finish ${c}`" :style="{ background: c }" @click="color = c"></button>
      </div>
      <div class="foot">
        <span class="price">{{ fmtINR(item.price) }}</span>
        <button class="btn primary small" @click="ui.startPlacing(item.sku, color)">Add</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); display: flex; flex-direction: column; cursor: grab; }
.card:hover { border-color: var(--muted); }
.thumb { flex: none; border-radius: 8px 8px 0 0; overflow: hidden; position: relative; aspect-ratio: 4 / 3; max-width: 100%; background: linear-gradient(180deg, var(--paper), var(--panel)); display: flex; align-items: center; justify-content: center; }
.thumb img { width: 100%; height: 100%; object-fit: contain; }
.ph { width: 40%; height: 30%; border-radius: 6px; background: var(--grid); }
.tag { position: absolute; top: 6px; left: 6px; font: 600 9.5px var(--f-display); letter-spacing: .08em; text-transform: uppercase; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; padding: 1px 5px; color: var(--muted); }
.body { padding: 8px 9px 9px; display: flex; flex-direction: column; gap: 4px; flex: 1 0 auto; }
h3 { margin: 0; font-size: 12.5px; font-weight: 500; line-height: 1.25; }
.dims { font: 10.5px var(--f-mono); color: var(--muted); }
.swatches { display: flex; gap: 4px; flex-wrap: wrap; }
.swatches button { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--line); padding: 0; }
.swatches button[aria-checked="true"] { box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--accent); }
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 4px; }
.price { font: 500 13px var(--f-mono); font-variant-numeric: tabular-nums; }
</style>
