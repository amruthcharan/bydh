<script setup>
import { ref, computed } from 'vue';
import { CATALOG, CATEGORIES } from '../catalog/items.js';
import { useUiStore } from '../stores/ui.js';
import ProductCard from './ProductCard.vue';

const ui = useUiStore();
const q = ref('');
const cat = ref('all');
const sort = ref('featured');

const items = computed(() => {
  const s = q.value.trim().toLowerCase();
  let list = CATALOG.filter((i) => (cat.value === 'all' || i.category === cat.value) &&
    (!s || i.name.toLowerCase().includes(s) || i.tags.some((t) => t.includes(s)) || i.sku.toLowerCase().includes(s)));
  if (sort.value === 'low') list = list.slice().sort((a, b) => a.price - b.price);
  if (sort.value === 'high') list = list.slice().sort((a, b) => b.price - a.price);
  return list;
});
const counts = computed(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === 'all' ? CATALOG.length : CATALOG.filter((i) => i.category === c.id).length])));
</script>

<template>
  <aside class="store" aria-label="Furniture store">
    <header>
      <div>
        <div class="eyebrow">Store</div>
        <h2>Furnish your home</h2>
      </div>
      <button class="close" aria-label="Close store" @click="ui.storeOpen = false">×</button>
    </header>
    <div class="controls">
      <input id="storeSearch" v-model="q" type="search" placeholder="Search beds, sofas, wardrobes…" aria-label="Search the store" />
      <select id="storeSort" v-model="sort" aria-label="Sort">
        <option value="featured">Featured</option>
        <option value="low">Price: low to high</option>
        <option value="high">Price: high to low</option>
      </select>
    </div>
    <div class="cats" role="tablist">
      <button v-for="c in CATEGORIES" :key="c.id" role="tab" :aria-selected="cat === c.id" @click="cat = c.id">
        {{ c.label }} <span>{{ counts[c.id] }}</span>
      </button>
    </div>
    <p class="tip">Drag a product onto the plan, or press Add and click where it goes. Cabinets, beds and wardrobes back onto the nearest wall.</p>
    <div class="grid">
      <ProductCard v-for="i in items" :key="i.sku" :item="i" />
      <p v-if="!items.length" class="empty">Nothing matches “{{ q }}”. Try another word, such as bed or cabinet.</p>
    </div>
  </aside>
</template>

<style scoped>
.store {
  position: absolute; top: 0; left: 0; bottom: 31px; width: min(380px, 100%); z-index: 7;
  background: var(--panel); border-right: 1px solid var(--line); box-shadow: var(--shadow);
  display: flex; flex-direction: column; min-height: 0;
}
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 16px 8px; gap: 8px; }
h2 { margin: 2px 0 0; font: 600 24px/1.05 var(--f-display); text-wrap: balance; }
.close { border: 0; background: transparent; font-size: 24px; line-height: 1; color: var(--muted); padding: 0 4px; }
.controls { display: flex; gap: 6px; padding: 0 16px; }
.controls input, .controls select { border: 1px solid var(--line); background: var(--paper); border-radius: var(--r); padding: 6px 8px; font-size: 13px; min-width: 0; }
.controls input { flex: 1; }
.cats { display: flex; gap: 4px; padding: 10px 16px 4px; overflow-x: auto; flex: none; }
.cats button { border: 1px solid var(--line); background: var(--paper); border-radius: 14px; padding: 3px 10px; font-size: 12px; white-space: nowrap; }
.cats button span { color: var(--muted); font-family: var(--f-mono); font-size: 10.5px; }
.cats button[aria-selected="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.cats button[aria-selected="true"] span { color: inherit; opacity: .7; }
.tip { margin: 6px 16px 8px; font-size: 12px; color: var(--muted); line-height: 1.45; }
.grid { flex: 1; min-height: 0; overflow: auto; padding: 0 16px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: start; grid-auto-rows: max-content; }
.empty { grid-column: 1 / -1; color: var(--muted); font-size: 13px; }
@media (max-width: 760px) { .store { width: 100%; bottom: 0; } }
</style>
