import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Disable crossorigin attribute on script/link tags
    // It causes CORS issues with file:// protocol in packaged Electron apps
    modulePreload: {
      polyfill: false,
    },
  },
  // Experimental: disable crossorigin attribute entirely
  experimental: {
    renderBuiltUrl(filename) {
      // Return plain relative paths without crossorigin
      return './' + filename;
    },
  },
})
