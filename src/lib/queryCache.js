// Query caching utilities for RouteGuard PWA
// Provides caching for frequent queries to improve performance

/**
 * Simple in-memory cache with TTL (time-to-live) support
 */
class QueryCache {
  constructor(defaultTTL = 60000) { // Default TTL: 1 minute
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time-to-live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt
    });
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const now = Date.now();
    let validItems = 0;
    let expiredItems = 0;

    for (const [, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        expiredItems++;
      } else {
        validItems++;
      }
    }

    return {
      totalItems: this.cache.size,
      validItems,
      expiredItems
    };
  }
}

// Create a global cache instance
const queryCache = new QueryCache();

/**
 * Cache wrapper for async functions
 * @param {Function} fn - Async function to cache
 * @param {string} cacheKey - Cache key (should be unique for different parameters)
 * @param {number} ttl - Time-to-live in milliseconds (optional)
 * @returns {Promise<any>} - Result of the function (cached or fresh)
 */
export async function cachedQuery(fn, cacheKey, ttl = 60000) {
  // Try to get from cache first
  const cachedResult = queryCache.get(cacheKey);
  if (cachedResult !== null) {
    return cachedResult;
  }

  // If not in cache, execute the function
  const result = await fn();

  // Cache the result
  queryCache.set(cacheKey, result, ttl);

  return result;
}

/**
 * Get hazard statistics with caching
 * @param {Object} options - Query options (same as getHazardStatistics)
 * @returns {Promise<Array>} - Cached hazard statistics
 */
export async function getCachedHazardStatistics(options = {}) {
  // Create a cache key based on options
  const cacheKey = `hazard_stats_${JSON.stringify(options)}`;

  // Cache for 5 minutes (statistics don't need to be real-time)
  return cachedQuery(() => getHazardStatistics(options), cacheKey, 300000);
}

/**
 * Get nearby hazards with caching
 * @param {Object} point - { latitude, longitude }
 * @param {number} radiusMeters - Search radius in meters
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Cached nearby hazards
 */
export async function getCachedHazardsNearPoint(point, radiusMeters = 500, options = {}) {
  // Create a cache key based on parameters
  const cacheKey = `nearby_hazards_${point.latitude}_${point.longitude}_${radiusMeters}_${JSON.stringify(options)}`;

  // Cache for 30 seconds (location-based data changes more frequently)
  return cachedQuery(() => getHazardsNearPoint(point, radiusMeters, options), cacheKey, 30000);
}

/**
 * Get hazards needing verification with caching
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Cached hazards needing verification
 */
export async function getCachedHazardsNeedingVerification(options = {}) {
  // Create a cache key based on options
  const cacheKey = `hazards_needing_verification_${JSON.stringify(options)}`;

  // Cache for 1 minute
  return cachedQuery(() => getHazardsNeedingVerification(options), cacheKey, 60000);
}

/**
 * Clear all query caches
 * Useful when data is known to have changed significantly
 */
export function clearQueryCache() {
  queryCache.clear();
  console.log('Query cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export function getQueryCacheStats() {
  return queryCache.getStats();
}

export default {
  cachedQuery,
  getCachedHazardStatistics,
  getCachedHazardsNearPoint,
  getCachedHazardsNeedingVerification,
  clearQueryCache,
  getQueryCacheStats
};