import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'assets/aistudio/WhatsApp_Image_2026-11-25_at_03.55.32_835749e8.jpeg',
          'assets/aistudio/wandegeya_3c75f36b.jfif',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Minaratul Huda',
          short_name: 'Minaratul H.',
          description:
            'Authentic Tafseer, Hadith, Speeches, Q&A, and Scholarly Documents with offline listening and reading.',
          theme_color: '#0F4C3A',
          background_color: '#F8F8F6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,jfif,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: !hmrDisabled,
          type: 'module',
        },
      }),
      ...(hmrDisabled
        ? [
            {
              name: 'disable-vite-client-ws',
              enforce: 'post' as const,
              transform(code: string, id: string) {
                if (id.includes('/vite/dist/client/client.mjs') || id.endsWith('/@vite/client')) {
                  return {
                    code: code.replace(
                      'const createWebSocketModuleRunnerTransport = (options) => {',
                      'const createWebSocketModuleRunnerTransport = () => ({ async connect() {}, disconnect() {}, send() {} }); const _unusedCreateWebSocketModuleRunnerTransport = (options) => {'
                    ),
                    map: null,
                  };
                }
              },
            },
          ]
        : []),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." still resolve in production builds.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build' as const,
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: Number(process.env.PORT || 3000),
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: !hmrDisabled,
      watch: hmrDisabled ? null : {},
    },
    preview: {
      port: Number(process.env.PORT || 3000),
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
