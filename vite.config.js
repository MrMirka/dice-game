// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dice-game/', 
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
});