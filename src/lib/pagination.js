// Pagination utilities for RouteGuard PWA
// Provides helpers for paginated data retrieval and UI components

import {
  getHazardCount,
  getHazardCountNearPoint,
  getHazardsNearPoint,
  getOptimizedHazards
} from './queryOptimization.js';

/**
 * Calculate pagination metadata
 * @param {number} totalItems - Total number of items
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Object} - Pagination metadata
 */
export function calculatePagination(totalItems, currentPage = 1, pageSize = 10) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems);

  return {
    totalItems,
    totalPages,
    currentPage,
    pageSize,
    hasNextPage,
    hasPrevPage,
    startIndex,
    endIndex,
    hasPages: totalPages > 1
  };
}

/**
 * Create a paginated query options object
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Object} - Query options with limit and offset
 */
export function createPageOptions(page = 1, pageSize = 10) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  return { limit, offset };
}

/**
 * Create cursor-based pagination options (more efficient for large datasets)
 * @param {string|null} cursor - Cursor string (encoded ID or timestamp)
 * @param {number} pageSize - Number of items per page
 * @param {string} cursorType - Type of cursor ('id' or 'timestamp')
 * @returns {Object} - Query options for cursor-based pagination
 */
export function createCursorOptions(cursor = null, pageSize = 10, cursorType = 'id') {
  const options = { limit: pageSize };

  if (cursor) {
    try {
      const decodedCursor = atob(cursor);
      const [type, value] = decodedCursor.split(':');

      if (type === cursorType) {
        if (cursorType === 'id') {
          options.cursorId = value;
        } else if (cursorType === 'timestamp') {
          options.cursorTimestamp = new Date(value);
        }
      }
    } catch (e) {
      console.warn('Invalid cursor format:', e);
    }
  }

  return options;
}

/**
 * Encode a cursor value for client-side use
 * @param {string} type - Cursor type ('id' or 'timestamp')
 * @param {string|Date} value - Cursor value
 * @returns {string} - Base64 encoded cursor
 */
export function encodeCursor(type, value) {
  let stringValue;
  if (value instanceof Date) {
    stringValue = value.toISOString();
  } else {
    stringValue = value;
  }
  return btoa(`${type}:${stringValue}`);
}

/**
 * Get paginated hazards with metadata
 * @param {Object} options - Query options (same as getOptimizedHazards)
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} - Object containing data and pagination metadata
 */
export async function getPaginatedHazards(options = {}, page = 1, pageSize = 10) {
  try {
    // Get total count for pagination metadata
    const totalItems = await getHazardCount(options);

    // Get paginated data
    const pageOptions = createPageOptions(page, pageSize);
    const queryOptions = {
      ...options,
      limit: pageOptions.limit,
      offset: pageOptions.offset
    };

    const data = await getOptimizedHazards(queryOptions);

    // Calculate pagination metadata
    const pagination = calculatePagination(totalItems, page, pageSize);

    return {
      data,
      pagination
    };
  } catch (error) {
    console.error('Error getting paginated hazards:', error);
    return {
      data: [],
      pagination: calculatePagination(0, 1, pageSize)
    };
  }
}

/**
 * Get paginated hazards near a point with metadata
 * @param {Object} point - { latitude, longitude }
 * @param {number} radiusMeters - Search radius in meters
 * @param {Object} options - Additional options
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} - Object containing data and pagination metadata
 */
export async function getPaginatedHazardsNearPoint(point, radiusMeters = 500, options = {}, page = 1, pageSize = 10) {
  try {
    const totalItems = await getHazardCountNearPoint(point, radiusMeters, options);

    // Get paginated data
    const pageOptions = createPageOptions(page, pageSize);
    const queryOptions = {
      ...options,
      limit: pageOptions.limit,
      offset: pageOptions.offset
    };

    const data = await getHazardsNearPoint(point, radiusMeters, queryOptions);

    // Calculate pagination metadata
    const pagination = calculatePagination(totalItems, page, pageSize);

    return {
      data,
      pagination
    };
  } catch (error) {
    console.error('Error getting paginated hazards near point:', error);
    return {
      data: [],
      pagination: calculatePagination(0, 1, pageSize)
    };
  }
}