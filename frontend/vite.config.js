import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl', 'react-map-gl/maplibre'],
          charts: ['recharts'],
          d3: ['d3-shape', 'd3-scale', 'd3-array'],
        },
      },
    },
  },
});
