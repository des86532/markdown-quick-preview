import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        popup: 'popup.html',
        viewer: 'viewer.html',
        options: 'options.html',
      },
    },
  },
  test: {
    environment: 'node',
  },
});
