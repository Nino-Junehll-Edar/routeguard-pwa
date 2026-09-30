// vite.config.js
import { sveltekit } from "file:///D:/routeguard-pwa/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig } from "file:///D:/routeguard-pwa/node_modules/vite/dist/node/index.js";
var config = defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"]
  },
  build: {
    // Production optimizations
    target: "es2020",
    polyfillDynamicImport: false,
    minify: "esbuild",
    cssMinify: true,
    // Asset optimization
    assetsInlineLimit: 4096,
    sourcemap: false
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["@supabase/supabase-js", "firebase/app", "firebase/messaging", "leaflet"],
    exclude: ["svelte"]
  },
  // Server optimizations
  server: {
    fs: {
      // Allow serving files from parent directories
      allow: [".."]
    }
  }
});
var vite_config_default = config;
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxyb3V0ZWd1YXJkLXB3YVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxccm91dGVndWFyZC1wd2FcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3JvdXRlZ3VhcmQtcHdhL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgc3ZlbHRla2l0IH0gZnJvbSAnQHN2ZWx0ZWpzL2tpdC92aXRlJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuXG4vKiogQHR5cGUge2ltcG9ydCgndml0ZScpLlVzZXJDb25maWd9ICovXG5jb25zdCBjb25maWcgPSBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbc3ZlbHRla2l0KCldLFxuICB0ZXN0OiB7XG4gICAgaW5jbHVkZTogWydzcmMvKiovKi57dGVzdCxzcGVjfS57anMsdHN9J11cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBQcm9kdWN0aW9uIG9wdGltaXphdGlvbnNcbiAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgIHBvbHlmaWxsRHluYW1pY0ltcG9ydDogZmFsc2UsXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgY3NzTWluaWZ5OiB0cnVlLFxuICAgIC8vIEFzc2V0IG9wdGltaXphdGlvblxuICAgIGFzc2V0c0lubGluZUxpbWl0OiA0MDk2LFxuICAgIHNvdXJjZW1hcDogZmFsc2VcbiAgfSxcbiAgLy8gT3B0aW1pemUgZGVwZW5kZW5jaWVzXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJywgJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9tZXNzYWdpbmcnLCAnbGVhZmxldCddLFxuICAgIGV4Y2x1ZGU6IFsnc3ZlbHRlJ11cbiAgfSxcbiAgLy8gU2VydmVyIG9wdGltaXphdGlvbnNcbiAgc2VydmVyOiB7XG4gICAgZnM6IHtcbiAgICAgIC8vIEFsbG93IHNlcnZpbmcgZmlsZXMgZnJvbSBwYXJlbnQgZGlyZWN0b3JpZXNcbiAgICAgIGFsbG93OiBbJy4uJ11cbiAgICB9XG4gIH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWc7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TyxTQUFTLGlCQUFpQjtBQUNuUSxTQUFTLG9CQUFvQjtBQUc3QixJQUFNLFNBQVMsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxVQUFVLENBQUM7QUFBQSxFQUNyQixNQUFNO0FBQUEsSUFDSixTQUFTLENBQUMsOEJBQThCO0FBQUEsRUFDMUM7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsUUFBUTtBQUFBLElBQ1IsdUJBQXVCO0FBQUEsSUFDdkIsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBO0FBQUEsSUFFWCxtQkFBbUI7QUFBQSxJQUNuQixXQUFXO0FBQUEsRUFDYjtBQUFBO0FBQUEsRUFFQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMseUJBQXlCLGdCQUFnQixzQkFBc0IsU0FBUztBQUFBLElBQ2xGLFNBQVMsQ0FBQyxRQUFRO0FBQUEsRUFDcEI7QUFBQTtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBO0FBQUEsTUFFRixPQUFPLENBQUMsSUFBSTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQ0YsQ0FBQztBQUVELElBQU8sc0JBQVE7IiwKICAibmFtZXMiOiBbXQp9Cg==
