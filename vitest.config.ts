import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Standalone Vitest config. Kept separate from vite.config.ts because Vitest
// bundles its own Vite version; mixing plugin types across versions breaks the
// build typecheck. The unit tests are pure logic and need no Vite plugins.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
