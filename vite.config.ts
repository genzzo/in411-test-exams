import { defineConfig } from 'vite'

// Relative base so the built app works when served from any path (static hosting).
export default defineConfig({
  base: './',
  server: {
    port: 3000,
  },
})
