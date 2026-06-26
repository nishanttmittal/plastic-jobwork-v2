import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Build stamp (IST) — shown in-app (More) so it's obvious whether a phone is on
// the latest version. Generated fresh on every build.
const BUILD_ID = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' IST'

export default defineConfig({
  base: '/plastic-jobwork-v2/',
  define: { __APP_VERSION__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // we register manually in main.jsx to add periodic update checks
      scope: '/plastic-jobwork-v2/',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/plastic-jobwork-v2/index.html',
        navigateFallbackAllowlist: [/^\/plastic-jobwork-v2/],
      },
      manifest: {
        name: 'Plastic Job Work',
        short_name: 'Plastic',
        description: 'Plastic moulding job work — production, cost per piece, material reconciliation & molder hisab',
        theme_color: '#0E1217',
        background_color: '#0E1217',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/plastic-jobwork-v2/',
        scope: '/plastic-jobwork-v2/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
