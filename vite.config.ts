import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  // Production builds ship no console output (46 call sites used to go to the
  // bundle, several of them logging store contents). Real error reporting lives
  // in src/services/clientErrors.ts, which does not use the console.
  esbuild:
    mode === 'production'
      ? { drop: ['console' as const, 'debugger' as const] }
      : {},
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
          'Personal finance and investment portfolio tracker for Indian investors. Track net worth, stocks, mutual funds, SIPs, bonds, expenses, receivables and financial goals — with an AI financial coach.',
        theme_color: '#7c3aed',
        background_color: '#f6f1fe',
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
        // The workbook/PDF writers are ~1 MB together and only needed when
        // somebody actually exports. Precaching them made every PWA install
        // download them up front; they are `await import()`ed on demand now.
        globIgnores: ['**/excel-vendor-*.js', '**/*jspdf*.js', '**/*exceljs*.js'],
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
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
