// Lazy loading utilities for RouteGuard PWA
// Provides IntersectionObserver-based lazy loading for images and other resources

/**
 * Lazy load images using Intersection Observer
 * @param {NodeList|HTMLCollection} images - Collection of img elements to lazy load
 * @param {Object} options - Lazy load options
 * @param {number} options.rootMargin - Margin around the root (default: '50px')
 * @param {number} options.threshold - Threshold for visibility (default: 0.01)
 * @returns {function} - Cleanup function to disconnect observer
 */
export function lazyLoadImages(images, options = {}) {
  // Default options
  const settings = {
    rootMargin: '50px',
    threshold: 0.01,
    ...options
  };

  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all images immediately
    images.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
    return () => {}; // No cleanup needed
  }

  // Create observer
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        // Load the actual image
        if (img.dataset.src) {
          img.src = img.dataset.src;
          // Optionally remove the data attribute after loading
          img.removeAttribute('data-src');
        }
        // Stop observing this image
        obs.unobserve(img);
      }
    });
  }, settings);

  // Observe each image
  images.forEach(img => {
    observer.observe(img);
  });

  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}

/**
 * Lazy load background images using Intersection Observer
 * @param {NodeList|HTMLCollection} elements - Collection of elements with background images
 * @param {Object} options - Lazy load options
 * @param {string} options.attr - Data attribute containing the background URL (default: 'data-bg')
 * @param {number} options.rootMargin - Margin around the root (default: '50px')
 * @param {number} options.threshold - Threshold for visibility (default: 0.01)
 * @returns {function} - Cleanup function to disconnect observer
 */
export function lazyLoadBackgrounds(elements, options = {}) {
  // Default options
  const settings = {
    attr: 'data-bg',
    rootMargin: '50px',
    threshold: 0.01,
    ...options
  };

  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all background images immediately
    elements.forEach(el => {
      const bgUrl = el.getAttribute(settings.attr);
      if (bgUrl) {
        el.style.backgroundImage = `url(${bgUrl})`;
      }
    });
    return () => {}; // No cleanup needed
  }

  // Create observer
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const bgUrl = el.getAttribute(settings.attr);
        if (bgUrl) {
          el.style.backgroundImage = `url(${bgUrl})`;
          // Optionally remove the data attribute after loading
          el.removeAttribute(settings.attr);
        }
        // Stop observing this element
        obs.unobserve(el);
      }
    });
  }, settings);

  // Observe each element
  elements.forEach(el => {
    observer.observe(el);
  });

  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}

/**
 * Create a lazy load directive for Svelte
 * Usage: <img use:lazyLoad={src} />
 * @param {HTMLImageElement} img - Image element
 * @param {Object} params - Parameters passed from Svelte
 * @param {string} params.src - The actual image src to load when visible
 */
export function lazyLoad(img, { src }) {
  // Set initial state - transparent placeholder or low-res version
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSBoZWlnaHQ9IjIiIHZpZXdCb3g9IjAgMCAxIDIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+';

  // Set up intersection observer
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      img.src = src;
      observer.disconnect();
    }
  }, { rootMargin: '50px', threshold: 0.01 });

  observer.observe(img);

  // Return destroy function
  return {
    destroy() {
      observer.disconnect();
    }
  };
}

export default {
  lazyLoadImages,
  lazyLoadBackgrounds,
  lazyLoad
};