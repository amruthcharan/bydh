<script setup>
import { useUiStore } from '../stores/ui.js';
const ui = useUiStore();
</script>

<template>
  <div v-if="ui.toastMsg" class="toast" role="status" aria-live="polite">{{ ui.toastMsg }}</div>
</template>

<style scoped>
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink); color: var(--paper); padding: 9px 16px; border-radius: 8px; font-size: 13px; line-height: 1.45; z-index: 50; max-width: min(520px, calc(100% - 32px)); box-shadow: var(--shadow); }
</style>
