import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Shown at the bottom of "Me" (helps when someone reports a problem): package version and build day.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const built = new Date().toISOString().slice(0, 10)

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`${version} · ${built}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The page itself always comes from the network first (newest version);
      // the saved copy is only used offline.
      workbox: {
        navigateFallback: null,
        importScripts: ['push-sw.js'], // phone notifications (public/push-sw.js)
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg', 'privacy.html'],
      manifest: {
        name: 'כדורגל שכונה',
        short_name: 'כדורגל',
        description: 'חלוקת קבוצות הוגנת, דירוג שחקנים ומעקב משחקים',
        id: '/',
        scope: '/',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['sports', 'social'],
        // The phone's own launch screen in the same green as the start screen (index.html).
        background_color: '#1f8a4c',
        theme_color: '#1f8a4c',
        shortcuts: [
          { name: 'הערב', short_name: 'הערב', url: '/#/tonight', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'סטטיסטיקה', short_name: 'סטטיסטיקה', url: '/#/stats', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'נבחרת השבוע', short_name: 'נבחרת', url: '/#/week', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
