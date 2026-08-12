import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer-only Vite config. Electron main/preload run directly from ./electron.
export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
