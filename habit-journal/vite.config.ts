import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html that works offline,
// can be opened directly from Finder, or hosted anywhere (GitHub Pages etc.).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
