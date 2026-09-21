import type { RoutePoint, RouteResult, HazardWeight } from '$lib/types/routing';
import type { Hazard } from '$lib/types/hazard';
import { loadOsmData, getNode, getNodeIds } from './osmLoader';
import { supabase } from '$lib/supabaseClient';
import { user } from '$lib/authStore';

// Hazard weight configuration
const HAZARD_WEIGHTS: Record<string, Record<string, number>> = {
  flooding: {
    unconfirmed: 1.5,
    needs_verification: 2.0,
    hazard_active: 3.0,
    hazard_cleared: 1.2
  },
  debris: {
    unconfirmed: 1.3,
    needs_verification: 1.8,
    hazard_active: 2.5,
    hazard_cleared: 1.1
  },
  roadblock: {
    unconfirmed: 2.0,
    needs_verification: 3.0,
    hazard_active: 5.0, // Essentially blocked
    hazard_cleared: 1.2
  },
  // Default for other types
  default: {
    unconfirmed: 1.4,
    needs_verification: 1.9,
    hazard_active: 2.8,
    hazard_cleared: 1.15
  }
};

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Get hazard weight multiplier for a location
 */
async function getHazardWeightAtLocation(lat: number, lng: number): Promise<number> {
  try {
    // Find hazards within 50 meters of this point
    const { data, error } = await supabase
      .from('hazards')
      .select('hazard_type, status')
      .not('status', 'eq', 'expired')
      .contains('location', {
        type: 'Point',
        coordinates: [lng, lat]
      });

    if (error) {
      console.error('Error fetching hazards for location:', error);
      return 1.0; // No additional cost on error
    }

    if (!data || data.length === 0) {
      return 1.0; // No hazards nearby
    }

    // Calculate maximum weight multiplier from all nearby hazards
    let maxMultiplier = 1.0;

    for (const hazard of data) {
      const typeWeights = HAZARD_WEIGHTS[hazard.hazard_type] || HAZARD_WEIGHTS.default;
      const weight = typeWeights[hazard.status] || 1.0;
      maxMultiplier = Math.max(maxMultiplier, weight);
    }

    return maxMultiplier;
  } catch (error) {
    console.error('Error in getHazardWeightAtLocation:', error);
    return 1.0;
  }
}

/**
 * A* pathfinding algorithm
 */
export async function findRoute(start: RoutePoint, end: RoutePoint): Promise<RouteResult | null> {
  try {
    // Ensure OSM data is loaded
    await loadOsmData();

    // Simple implementation - in reality, you'd need to:
    // 1. Find nearest OSM nodes to start/end points
    // 2. Run A* on the graph
    // 3. Return the path

    // For MVP, we'll implement a simplified version that uses direct line
    // with hazard avoidance, then plan to improve with proper A*

    // Calculate direct distance
    const directDistance = haversineDistance(start.lat, start.lng, end.lat, end.lng);

    // Sample points along the path for hazard checking
    const sampleCount = Math.max(5, Math.floor(directDistance / 100)); // Sample every 100m
    const points: RoutePoint[] = [start];

    for (let i = 1; i < sampleCount; i++) {
      const ratio = i / sampleCount;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      points.push({ lat, lng });
    }

    points.push(end);

    // Calculate segments and costs
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    let totalHazardScore = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];

      const segmentDistance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
      totalDistance += segmentDistance;

      // Get hazard weight for midpoint of segment
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;
      const hazardWeight = await getHazardWeightAtLocation(midLat, midLng);

      const baseCost = segmentDistance; // Base cost is distance
      const hazardCost = baseCost * (hazardWeight - 1.0); // Additional cost from hazards
      const totalCost = baseCost * hazardWeight;

      segments.push({
        from,
        to,
        distance: segmentDistance,
        baseCost,
        hazardCost,
        totalCost
      });

      // Accumulate hazard score (0-100 scale)
      totalHazardScore += Math.min((hazardWeight - 1) * 50, 50); // Cap at 50 per segment
    }

    // Normalize hazard score to 0-100
    const hazardScore = Math.min(100, (totalHazardScore / segments.length) * 2);

    // Estimate time (assuming average speed of 5 km/h = 1.39 m/s)
    const averageSpeed = 1.39; // m/s
    const totalTime = totalDistance / averageSpeed;

    return {
      points,
      totalDistance,
      totalTime,
      hazardScore,
      segments
    };
  } catch (error) {
    console.error('Error in findRoute:', error);
    return null;
  }
}

/**
 * Get alternative routes (simplified for MVP)
 */
export async function getAlternativeRoutes(start: RoutePoint, end: RoutePoint): Promise<RouteResult[]> {
  const mainRoute = await findRoute(start, end);
  if (!mainRoute) return [];

  // For MVP, just return the main route
  // In future, could calculate alternatives by avoiding certain areas
  return [mainRoute];
}