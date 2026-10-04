import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over HTTPS on your LAN so a Quest headset or an
// Android phone can open the dev server and use WebXR (VR/AR need HTTPS).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [vue(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
}));
