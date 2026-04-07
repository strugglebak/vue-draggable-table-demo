import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Relative base makes the built assets work both locally and on GitHub Pages,
  // even when the repository is deployed under /<repo-name>/.
  base: './',
  plugins: [vue()]
});
