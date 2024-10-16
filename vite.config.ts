import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  server: {
    port: 6010,
    watch: {}
  },
  plugins: [glsl()],
  build: {
    sourcemap: true,
  },
});