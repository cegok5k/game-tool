import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    outDir: 'public/bridge',
    emptyOutDir: true,
    lib: {
      entry: resolve('src/bridge/index.ts'),
      name: 'GameToolBridge',
      formats: ['iife'],
      fileName: () => 'bridge.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
})
