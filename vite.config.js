import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
const config = defineConfig({
  plugins: [sveltekit()],
  test: {
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/local/**/*.{test,spec}.{js,ts}'
    ]
  },
  build: {
    // Production optimizations
    target: 'es2020',
    polyfillDynamicImport: false,
    minify: 'esbuild',
    cssMinify: true,
    // Asset optimization
    assetsInlineLimit: 4096,
    sourcemap: false
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'firebase/app', 'firebase/messaging', 'leaflet'],
    exclude: ['svelte']
  },
  resolve: {
    extensions: ['.mjs', '.mts', '.ts', '.js', '.jsx', '.tsx', '.json']
  },
  // Server optimizations
  server: {
    fs: {
      // Allow serving files from parent directories
      allow: ['..']
    }
  }
});

export default config;