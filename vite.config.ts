import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    target: 'es2020', // Modern browsers — removes legacy polyfills (saves ~10 KiB)
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Split vendor chunks so browser caches them separately
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
        },
      },
    },
  },
});
