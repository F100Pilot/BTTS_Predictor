import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// On GitHub Pages the app is served from /<repo>/. Override with VITE_BASE if needed.
// Example: VITE_BASE=/btts_predictor/ npm run build
const base = process.env.VITE_BASE ?? '/btts_predictor/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user accepts (see
      // PwaUpdatePrompt) instead of reloading mid-session.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'BTTS Analytics Pro',
        short_name: 'BTTS Pro',
        description:
          'Análise estatística e previsões próprias para o mercado BTTS (Both Teams To Score).',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Keep the heavy, rarely-used libs OUT of the install precache (export to
        // Excel/PDF, charts). They are lazily imported and cached on first use via
        // the runtimeCaching rule below — this roughly halves the precache size.
        globIgnores: ['**/xlsx-*.js', '**/jspdf*.js', '**/html2canvas*.js', '**/charts-*.js'],
        navigateFallback: base + 'index.html',
        // Don't skip waiting / claim automatically — the update banner activates
        // the new SW only when the user accepts, so work isn't interrupted.
        clientsClaim: false,
        skipWaiting: false,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Cache the heavy on-demand chunks after first use (offline-friendly).
            urlPattern: /\/assets\/(xlsx-|jspdf|html2canvas|charts-).*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heavy-libs',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // No runtimeCaching for API hosts: requests go through a proxy/worker so
        // the host varies, and API responses are already cached (with TTLs) in
        // IndexedDB. Caching them at the SW layer risked storing opaque errors.
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
