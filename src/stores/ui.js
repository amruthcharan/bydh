import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const tool = ref('select');        // select | wall | room | door | window | place | erase | calibrate
  const placeSku = ref(null);        // catalogue item waiting to be placed
  const placeColor = ref(null);
  const storeOpen = ref(false);
  const importOpen = ref(false);
  const fileOpen = ref(false);
  const confirmNew = ref(false);
  const viewMode = ref('orbit');     // orbit | walk | stereo
  const mobileView = ref('plan');    // plan | 3d (phones only)
  const calib = ref(null);           // { p1, p2 } once two points are picked
  const toastMsg = ref('');
  let toastTimer;

  function toast(msg, ms = 4200) {
    toastMsg.value = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg.value = ''; }, ms);
  }
  function setTool(t) {
    tool.value = t;
    if (t !== 'place') { placeSku.value = null; placeColor.value = null; }
    if (t !== 'calibrate') calib.value = null;
  }
  function startPlacing(sku, color) {
    placeSku.value = sku; placeColor.value = color || null; tool.value = 'place';
    if (window.innerWidth <= 760) { storeOpen.value = false; mobileView.value = 'plan'; }
  }

  return {
    tool, placeSku, placeColor, storeOpen, importOpen, fileOpen, confirmNew,
    viewMode, mobileView, calib, toastMsg, toast, setTool, startPlacing,
  };
});
