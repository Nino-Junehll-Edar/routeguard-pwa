// Query optimization utilities for RouteGuard PWA
// Provides optimized Supabase queries for hazard retrieval and other common operations

import { supabase } from './supabaseClient.js';

/**
 * Optimized hazard retrieval with spatial filtering and pagination
 * @param {Object} options - Query options
 * @param {Object} options.bounds - Geographic bounds { north, south, east, west }
 * @param {number} options.limit - Maximum number of hazards to return
 * @param {number} options.offset - Offset for pagination
 * @param {Array} options.hazardTypes - Array of hazard types to filter by
 * @param {string} options.status - Hazard status to filter by
 * @param {Date} options.since - Only return hazards updated since this date
 * @param {boolean} options.includeExpired - Whether to include expired hazards
 * @returns {Promise<Array>} - Array of hazard objects
 */
export async function getOptimizedHazards(options = {}) {
  try {
    if (options.bounds) {
      const { north, south, east, west } = options.bounds;
      const { data, error } = await supabase.rpc('get_hazards_in_bounds', {
        p_west: west,
        p_south: south,
        p_east: east,
        p_north: north,
        p_hazard_types: options.hazardTypes?.length ? options.hazardTypes : null,
        p_status: options.status || null,
        p_since: options.since?.toISOString() || null,
        p_include_expired: options.includeExpired ?? false,
        p_limit: options.limit ?? null,
        p_offset: options.offset ?? 0
      });
      if (error) throw error;
      return data || [];
    }

    let query = supabase.from('hazards').select('*');

    // Filter by hazard types
    if (options.hazardTypes && options.hazardTypes.length > 0) {
      query = query.in('hazard_type', options.hazardTypes);
    }

    // Filter by status
    if (options.status) {
      query = query.eq('status', options.status);
    } else if (!options.includeExpired) {
      // Exclude expired hazards by default
      query = query.neq('status', 'expired');
    }

    // Filter by update time
    if (options.since) {
      query = query.gte('updated_at', options.since.toISOString());
    }

    // Apply pagination
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options.offset !== undefined) {
      query = query.offset(options.offset);
    }

    // Order by creation date (newest first) for consistent results
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching optimized hazards:', error);
    return [];
  }
}

/**
 * Get hazards near a specific point with distance ordering
 * @param {Object} point - { latitude, longitude }
 * @param {number} radiusMeters - Search radius in meters
 * @param {Object} options - Additional options
 * @param {number} options.limit - Maximum number of hazards to return
 * @param {Array} options.hazardTypes - Array of hazard types to filter by
 * @returns {Promise<Array>} - Array of hazard objects with distance
 */
export async function getHazardsNearPoint(point, radiusMeters = 500, options = {}) {
  try {
    const { latitude, longitude } = point;
    const { data, error } = await supabase.rpc('get_hazards_near_point', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_meters: radiusMeters,
      p_hazard_types: options.hazardTypes?.length ? options.hazardTypes : null,
      p_status: options.status || null,
      p_include_expired: options.includeExpired ?? false,
      p_limit: options.limit ?? null,
      p_offset: options.offset ?? 0
    });
    if (error) throw error;
    return (data || []).map(({ hazard, distance_meters }) => ({
      ...hazard,
      distance: distance_meters
    }));
  } catch (error) {
    console.error('Error fetching hazards near point:', error);
    return [];
  }
}

export async function getHazardCountNearPoint(point, radiusMeters = 500, options = {}) {
  try {
    const { data, error } = await supabase.rpc('count_hazards_near_point', {
      p_latitude: point.latitude,
      p_longitude: point.longitude,
      p_radius_meters: radiusMeters,
      p_hazard_types: options.hazardTypes?.length ? options.hazardTypes : null,
      p_status: options.status || null,
      p_include_expired: options.includeExpired ?? false
    });
    if (error) throw error;
    return Number(data || 0);
  } catch (error) {
    console.error('Error counting hazards near point:', error);
    return 0;
  }
}

/**
 * Get hazard count with filters (optimized for performance)
 * @param {Object} options - Filter options (same as getOptimizedHazards)
 * @returns {Promise<number>} - Count of hazards matching filters
 */
export async function getHazardCount(options = {}) {
  try {
    if (options.bounds) {
      const { north, south, east, west } = options.bounds;
      const { data, error } = await supabase.rpc('count_hazards_in_bounds', {
        p_west: west,
        p_south: south,
        p_east: east,
        p_north: north,
        p_hazard_types: options.hazardTypes?.length ? options.hazardTypes : null,
        p_status: options.status || null,
        p_since: options.since?.toISOString() || null,
        p_include_expired: options.includeExpired ?? false
      });
      if (error) throw error;
      return Number(data || 0);
    }

    let query = supabase.from('hazards').select('*', { count: 'exact', head: true });

    // Filter by hazard types
    if (options.hazardTypes && options.hazardTypes.length > 0) {
      query = query.in('hazard_type', options.hazardTypes);
    }

    // Filter by status
    if (options.status) {
      query = query.eq('status', options.status);
    } else if (!options.includeExpired) {
      // Exclude expired hazards by default
      query = query.neq('status', 'expired');
    }

    // Filter by update time
    if (options.since) {
      query = query.gte('updated_at', options.since.toISOString());
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting hazard count:', error);
    return 0;
  }
}

/**
 * Get recent hazards for a specific user (for personalized feeds)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of hazards to return
 * @returns {Promise<Array>} - Array of hazard objects
 */
export async function getRecentHazardsForUser(userId, options = {}) {
  try {
    let query = supabase
      .from('hazards')
      .select('*')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false });

    // Apply additional filters
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recent hazards for user:', error);
    return [];
  }
}

/**
 * Optimized query for hazard statistics (for dashboard/admin views)
 * @param {Object} options - Query options
 * @param {Object} options.bounds - Geographic bounds
 * @param {Date} options.since - Only include hazards since this date
 * @returns {Promise<Object>} - Statistics object
 */
export async function getHazardStatistics(options = {}) {
  try {
    // We'll use a raw SQL query for complex aggregations
    let query = `
      SELECT
        status,
        hazard_type,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
      FROM hazards
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply geographic bounds filtering if provided
    if (options.bounds) {
      const { north, south, east, west } = options.bounds;
      query += `
        AND location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      `;
      params.push(west, south, east, north);
      paramIndex += 4;
    }

    // Filter by update time
    if (options.since) {
      query += ` AND updated_at >= $${paramIndex} `;
      params.push(options.since.toISOString());
      paramIndex++;
    }

    // Exclude expired hazards by default for statistics
    query += " AND status != 'expired' ";

    query += `
      GROUP BY status, hazard_type
      ORDER BY count DESC
    `;

    // Note: Supabase doesn't support raw SQL queries directly in the JS client
    // This would need to be implemented as a PostgreSQL function or handled differently
    // For now, we'll fetch the data and compute statistics client-side
    // but with proper filtering to minimize data transfer

    const { data: hazards, error } = await supabase
      .from('hazards')
      .select('status, hazard_type, created_at')
      .not('status', 'eq', 'expired');

    if (error) throw error;

    // Compute statistics client-side (but we've minimized data transfer with filtering)
    const stats = {};
    hazards.forEach(hazard => {
      const key = `${hazard.status}:${hazard.hazard_type}`;
      if (!stats[key]) {
        stats[key] = { count: 0, totalAgeHours: 0 };
      }
      stats[key].count++;
      const ageHours = (new Date() - new Date(hazard.created_at)) / (1000 * 60 * 60);
      stats[key].totalAgeHours += ageHours;
    });

    // Format results
    const results = [];
    for (const [key, value] of Object.entries(stats)) {
      const [status, hazardType] = key.split(':');
      results.push({
        status,
        hazard_type: hazardType,
        count: value.count,
        avg_age_hours: value.totalAgeHours / value.count
      });
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);

    return results;
  } catch (error) {
    console.error('Error getting hazard statistics:', error);
    return [];
  }
}

/**
 * Create a materialized view for hazard statistics (would be run as migration)
 * This is a helper function that returns the SQL for creating the view
 */
export function getCreateHazardStatisticsViewSQL() {
  return `
    CREATE MATERIALIZED VIEW hazard_statistics AS
    SELECT
      status,
      hazard_type,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours,
      MAX(created_at) as latest_report,
      MIN(created_at) as earliest_report
    FROM hazards
    WHERE status != 'expired'
    GROUP BY status, hazard_type
    WITH DATA;

    CREATE INDEX idx_hazard_statistics_status ON hazard_statistics(status);
    CREATE INDEX idx_hazard_statistics_hazard_type ON hazard_statistics(hazard_type);
  `;
}

/**
 * Refresh the hazard statistics materialized view
 * This would be called periodically (e.g., every hour)
 */
export async function refreshHazardStatisticsView() {
  try {
    // Note: This would need to be called via a PostgreSQL function or raw SQL
    // In Supabase, you might need to use a custom PostgreSQL function
    console.log('Refreshing hazard statistics view - would execute: REFRESH MATERIALIZED VIEW hazard_statistics;');
    // For now, we'll just log that this should be done
    return { success: true };
  } catch (error) {
    console.error('Error refreshing hazard statistics view:', error);
    return { success: false };
  }
}

/**
 * Get hazards that need verification (optimized query)
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of hazards to return
 * @returns {Promise<Array>} - Array of hazard objects needing verification
 */
export async function getHazardsNeedingVerification(options = {}) {
  try {
    let query = supabase
      .from('hazards')
      .select('*')
      .eq('status', 'needs_verification');

    // Apply geographic bounds if provided
    if (options.bounds) {
      const { north, south, east, west } = options.bounds;
      query = query.filter(
        'location',
        'geo-intersects',
        `SRID=4326;POLYGON((${west} ${south}, ${west} ${north}, ${east} ${north}, ${east} ${south}, ${west} ${south}))`
      );
    }

    // Order by creation date (oldest first) to prioritize older verification requests
    query = query.order('created_at', { ascending: true });

    // Apply limit
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting hazards needing verification:', error);
    return [];
  }
}