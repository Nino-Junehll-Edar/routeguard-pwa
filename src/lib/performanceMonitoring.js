// Performance monitoring utilities for RouteGuard PWA
// Provides helpers for measuring and reporting performance metrics

/**
 * Initialize performance monitoring
 * Sets up observers for key performance metrics
 */
export function initPerformanceMonitoring() {
  // Measure FCP (First Contentful Paint) and LCP (Largest Contentful Paint)
  if ('performance' in window) {
    // Observe Core Web Vitals
    if (window.PerformanceObserver) {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Log performance entries
          console.log('Performance entry:', entry.name, entry.startTime, entry.duration);

          // Send to analytics endpoint if configured
          if (window.routeGuardAnalytics) {
            window.routeGuardAnalytics.trackPerformance(entry);
          }
        }
      });

      po.observe({entryTypes: ['paint', 'largest-contentful-paint', 'first-input']});
    }

    // Measure FID (First Input Delay) using polyfill approach
    let fidMetric = null;
    const fidCallback = (entry) => {
      fidMetric = entry;
      console.log('FID:', entry.processingStart - entry.startTime);
    };

    if (window.PerformanceObserver) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(fidCallback);
        });
        fidObserver.observe({entryTypes: ['first-input']});
      } catch (e) {
        console.warn('First Input Delay not supported:', e);
      }
    }
  }
}

/**
 * Measure component render time
 * @param {string} componentName - Name of the component being measured
 * @param {Function} callback - Function that returns the component rendering logic
 * @returns {Promise<*>} - Result of the callback
 */
export async function measureRenderTime(componentName, callback) {
  if (!('performance' in window)) {
    return callback();
  }

  const start = performance.now();
  try {
    const result = await callback();
    const end = performance.now();
    const duration = end - start;

    console.log(`Component "${componentName}" rendered in ${duration.toFixed(2)}ms`);

    // Send to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackComponentRender(componentName, duration);
    }

    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;

    console.error(`Component "${componentName}" failed after ${duration.toFixed(2)}ms:`, error);

    // Send error to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackComponentError(componentName, error, duration);
    }

    throw error;
  }
}

/**
 * Track route navigation performance
 * @param {string} routeName - Name of the route being navigated to
 * @param {Function} callback - Function that handles the route navigation
 * @returns {Promise<*>} - Result of the callback
 */
export async function trackRouteNavigation(routeName, callback) {
  if (!('performance' in window)) {
    return callback();
  }

  const start = performance.now();
  try {
    const result = await callback();
    const end = performance.now();
    const duration = end - start;

    console.log(`Route "${routeName}" navigated in ${duration.toFixed(2)}ms`);

    // Send to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackRouteNavigation(routeName, duration);
    }

    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;

    console.error(`Route "${routeName}" navigation failed after ${duration.toFixed(2)}ms:`, error);

    // Send error to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackRouteError(routeName, error, duration);
    }

    throw error;
  }
}

/**
 * Measure HTTP request performance
 * @param {string} endpoint - API endpoint being called
 * @param {Function} callback - Function that performs the HTTP request
 * @returns {Promise<*>} - Result of the callback
 */
export async function measureHttpRequest(endpoint, callback) {
  if (!('performance' in window)) {
    return callback();
  }

  const start = performance.now();
  try {
    const result = await callback();
    const end = performance.now();
    const duration = end - start;

    console.log(`HTTP request to "${endpoint}" completed in ${duration.toFixed(2)}ms`);

    // Send to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackHttpRequest(endpoint, duration, true);
    }

    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;

    console.error(`HTTP request to "${endpoint}" failed after ${duration.toFixed(2)}ms:`, error);

    // Send error to analytics if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackHttpRequest(endpoint, duration, false, error);
    }

    throw error;
  }
}

/**
 * Bundle analysis utility
 * Analyzes bundle contents for optimization opportunities
 */
export function analyzeBundle() {
  // This would typically be done at build time with tools like rollup-plugin-visualizer
  // For runtime analysis, we can check chunk loading times

  if (!('performance' in window)) {
    return null;
  }

  const entries = performance.getEntriesByType('resource');
  const jsResources = entries.filter(entry =>
    entry.initiatorType === 'script' &&
    entry.name.endsWith('.js')
  );

  const bundleInfo = {
    totalJsResources: jsResources.length,
    totalJsLoadTime: jsResources.reduce((sum, res) => sum + res.duration, 0),
    averageJsLoadTime: jsResources.length > 0 ?
      jsResources.reduce((sum, res) => sum + res.duration, 0) / jsResources.length : 0,
    resources: jsResources.map(res => ({
      name: res.name.split('/').pop(), // Just the filename
      size: res.transferSize || 0,
      loadTime: res.duration
    }))
  };

  console.log('Bundle analysis:', bundleInfo);
  return bundleInfo;
}

/**
 * Memory leak detection helper
 * Checks for increasing memory usage over time
 */
export function startMemoryLeakDetection(options = {}) {
  if (!('memory' in window.performance)) {
    console.warn('Memory API not available in this browser');
    return null;
  }

  const settings = {
    threshold: options.threshold || 5 * 1024 * 1024, // 5MB increase threshold
    interval: options.interval || 30000, // 30 seconds
    ...options
  };

  let lastMemoryUsage = window.performance.memory.usedJSHeapSize;

  const checkMemory = () => {
    const currentMemoryUsage = window.performance.memory.usedJSHeapSize;
    const memoryIncrease = currentMemoryUsage - lastMemoryUsage;

    if (memoryIncrease > settings.threshold) {
      console.warn(`Potential memory leak detected: ${(memoryIncrease / (1024 * 1024)).toFixed(2)}MB increase`);

      // Send alert to analytics if configured
      if (window.routeGuardAnalytics) {
        window.routeGuardAnalytics.trackMemoryLeakWarning(memoryIncrease);
      }
    }

    lastMemoryUsage = currentMemoryUsage;
  };

  const intervalId = setInterval(checkMemory, settings.interval);

  return {
    stop: () => clearInterval(intervalId),
    getCurrentUsage: () => ({
      usedJSHeapSize: window.performance.memory.usedJSHeapSize,
      totalJSHeapSize: window.performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
    })
  };
}

/**
 * Error tracking and reporting
 * Centralized error handling and reporting
 */
export class ErrorTracker {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.sampleRate = options.sampleRate || 1.0; // 100% by default
    this.maxErrorsPerMinute = options.maxErrorsPerMinute || 10;
    this.errorQueue = [];
    this.lastResetTime = Date.now();
    this.errorCountInWindow = 0;

    // Bind methods
    this.trackError = this.trackError.bind(this);
    this.wrapErrorHandler = this.wrapErrorHandler.bind(this);

    // Set up global error handlers if enabled
    if (this.enabled) {
      this.setupGlobalHandlers();
    }
  }

  setupGlobalHandlers() {
    // Window error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error
      });
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: event.reason.message || String(event.reason),
        url: '',
        line: 0,
        column: 0,
        error: event.reason
      });
    });
  }

  shouldTrackError() {
    // Rate limiting
    const now = Date.now();
    if (now - this.lastResetTime >= 60000) { // Reset every minute
      this.lastResetTime = now;
      this.errorCountInWindow = 0;
    }

    if (this.errorCountInWindow >= this.maxErrorsPerMinute) {
      return false; // Rate limit exceeded
    }

    // Sampling
    return Math.random() <= this.sampleRate;
  }

  trackError(errorInfo) {
    if (!this.enabled || !this.shouldTrackError()) {
      return;
    }

    this.errorCountInWindow++;

    const errorData = {
      timestamp: new Date().toISOString(),
      message: errorInfo.message,
      url: errorInfo.url || window.location.href,
      line: errorInfo.line || 0,
      column: errorInfo.column || 0,
      userAgent: navigator.userAgent,
      ...(errorInfo.error && {
        stack: errorInfo.error.stack,
        name: errorInfo.error.name
      }),
      ...errorInfo
    };

    // Add to queue for batch sending
    this.errorQueue.push(errorData);

    // Send immediately if it's a critical error or we have enough queued
    if (this.errorQueue.length >= 5 || errorInfo.isCritical) {
      this.flushErrorQueue();
    }

    // Also log to console for immediate visibility
    console.error('RouteGuard Error Tracked:', errorData);
  }

  wrapErrorHandler(callback) {
    return (...args) => {
      try {
        return callback(...args);
      } catch (error) {
        this.trackError({
          message: error.message,
          error: error,
          // Try to get more context
          source: 'wrapped callback'
        });
        throw error; // Re-throw to maintain normal error flow
      }
    };
  }

  flushErrorQueue() {
    if (this.errorQueue.length === 0) {
      return;
    }

    const errorsToSend = [...this.errorQueue];
    this.errorQueue = [];

    // Send to analytics endpoint if configured
    if (window.routeGuardAnalytics) {
      window.routeGuardAnalytics.trackErrors(errorsToSend);
    } else {
      // Fallback: just log (in production, you'd send to your error tracking service)
      console.log('Would send errors to analytics:', errorsToSend);
    }
  }

  // Manual flush method for periodic sending
  startPeriodicFlush(interval = 30000) {
    return setInterval(() => this.flushErrorQueue(), interval);
  }
}

// Export a default error tracker instance
export const errorTracker = new ErrorTracker();

// Auto-initialize performance monitoring in development
if (import.meta.env.DEV) {
  // Don't auto-init in dev to avoid interfering with development
} else if (import.meta.env.PROD) {
  // Auto-init in production
  // initPerformanceMonitoring(); // Would be called from main app
}

export default {
  initPerformanceMonitoring,
  measureRenderTime,
  trackRouteNavigation,
  measureHttpRequest,
  analyzeBundle,
  startMemoryLeakDetection,
  ErrorTracker,
  errorTracker
};