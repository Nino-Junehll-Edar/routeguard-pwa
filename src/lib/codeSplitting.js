// Code splitting utilities for RouteGuard PWA
// Provides helpers for dynamic imports and route-based code splitting

/**
 * Dynamically import a module with error handling and loading states
 * @param {function} importFunc - Function that returns a promise for the module (e.g., () => import('./module.js'))
 * @param {Object} options - Options for loading
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} - Promise that resolves with the module or rejects with an error
 */
export async function dynamicImport(importFunc, options = {}) {
  const settings = {
    timeout: 5000,
    ...options
  };

  // Create a promise that rejects after timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Dynamic import timeout')), settings.timeout)
  );

  // Race the import against the timeout
  return Promise.race([
    importFunc(),
    timeoutPromise
  ]);
}

/**
 * Load a component dynamically for route-based code splitting
 * @param {string} componentPath - Path to the component (relative to src/routes)
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} - Promise that resolves with the component module
 */
export async function loadRouteComponent(componentPath, options = {}) {
  // Normalize the path
  const normalizedPath = componentPath.startsWith('./') ? componentPath : `./${componentPath}`;

  // Construct the full import path
  const importPath = `/src/routes${normalizedPath}`;

  // Return dynamic import
  return dynamicImport(() => import(importPath), options);
}

/**
 * Preload components for predicted navigation
 * @param {Array<string>} componentPaths - Array of component paths to preload
 * @param {Object} options - Preloading options
 * @param {number} options.delay - Delay before preloading in milliseconds (default: 0)
 */
export function preloadRouteComponents(componentPaths, options = {}) {
  const settings = {
    delay: 0,
    ...options
  };

  setTimeout(() => {
    componentPaths.forEach(path => {
      // Fire and forget - we don't await these as they're for preloading
      loadRouteComponent(path).catch(err => {
        // Log but don't fail - preloading is optional optimization
        console.warn(`Failed to preload component ${path}:`, err);
      });
    });
  }, settings.delay);
}

/**
 * Create a wrapper component that handles loading states for dynamically loaded components
 * @param {function} importFunc - Function that returns a promise for the component
 * @param {Object} options - Wrapper options
 * @param {boolean} options.showSpinner - Whether to show a spinner while loading (default: true)
 * @param {string} options.spinnerText - Text to show with spinner (default: 'Loading...')
 * @returns {SvelteComponent} - A svelte component that handles loading states
 */
export function createLoadableComponent(importFunc, options = {}) {
  const settings = {
    showSpinner: true,
    spinnerText: 'Loading...',
    ...options
  };

  // This would be implemented as a Svelte component in practice
  // For now, we'll return an object that describes the behavior
  return {
    component: null,
    loading: true,
    error: null,
    async load() {
      try {
        this.loading = true;
        this.error = null;
        this.component = await importFunc();
        this.loading = false;
      } catch (err) {
        this.loading = false;
        this.error = err;
        console.error('Failed to load component:', err);
      }
    }
  };
}

export default {
  dynamicImport,
  loadRouteComponent,
  preloadRouteComponents,
  createLoadableComponent
};