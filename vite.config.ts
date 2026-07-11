import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/android-chrome-192x192.png',
        'icons/android-chrome-512x512.png',
        'og-image.png',
      ],
      manifest: {
        name: 'Fintrackly – Personal Finance Tracker',
        short_name: 'Fintrackly',
        description:
          'Free personal finance tracker for Indian investors and farmers.',
        theme_color: '#10b981',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/favicon-16x16.png',
            sizes: '16x16',
            type: 'image/png',
          },
          {
            src: '/icons/favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
          {
            src: '/icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 4000000,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/assets\//,
          /^\/__\/auth\//,
          /\.(js|css|woff2?|png|jpg|svg|json|ico)$/,
          /firestore\.googleapis\.com/,
          /identitytoolkit\.googleapis\.com/,
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    headers: {
      // Required for Google sign-in popup to communicate with parent window
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          'chart-vendor': ['recharts'],
          'motion-vendor': ['framer-motion'],
          'icons-vendor': ['react-icons'],
          'utils-vendor': ['date-fns', 'zustand'],
          'excel-vendor': ['exceljs'],
          'pdf-vendor': ['pdfjs-dist'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
