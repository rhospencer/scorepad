import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { lobbyPlugin } from './server/plugin';

export default defineConfig({
  plugins: [
    svelte(),
    // Lets phones on the same Wi-Fi join a game (see server/plugin.ts).
    lobbyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      // The lobby API is live data; never answer it from the offline cache.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: 'Scorepad',
        short_name: 'Scorepad',
        description: 'Score keeper for tabletop and board games',
        theme_color: '#0F1420',
        background_color: '#0F1420',
        display: 'standalone',
        start_url: '/',
        icons: [
          // TODO: add 192x192 and 512x512 PNG icons to /public and list them here
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  // host: true listens on the local network too, so phones can open the join link.
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
