import type { RoutePoint, RouteResult, RouteSegment, HazardWeight } from '$lib/types/routing';
import type { Hazard } from '$lib/types/hazard';
import { loadOsmData, getNode, getNodeIds, getProcessedNode } from './osmLoader';
import { supabase } from '../supabaseClient';

// Check if we should use web workers (can be controlled by environment variable)
const USE_WORKER = import.meta.env.VITE_USE_ROUTING_WORKER === 'true';

// Worker instance
let routingWorker: Worker | null = null;
let workerIdCounter = 0;
const workerPromises = new Map<number, { resolve: (value: RouteResult | null) => void; reject: (reason?: any) => void }>();

// Initialize worker if needed
function initializeWorker(): Worker {
  if (!routingWorker) {
    // Create a new worker from our TypeScript file
    // Note: In production, you'd want to bundle this properly
    routingWorker = new Worker(new URL('./routingWorker.ts', import.meta.url), { type: 'module' });

    // Set up message handler
    routingWorker.onmessage = (event: MessageEvent) => {
      const { type, id, data, error } = event.data;
      const promise = workerPromises.get(id);
      if (promise) {
        workerPromises.delete(id);
        if (type === 'ROUTE_RESULT') {
          promise.resolve(data);
        } else if (type === 'OSM_DATA_LOADED') {
          promise.resolve(data as unknown as RouteResult | null);
        } else if (type === 'ERROR') {
          promise.reject(new Error(error));
        } else {
          promise.resolve(null);
        }
      }
    };

    // Handle worker errors
    routingWorker.onerror = (error: ErrorEvent) => {
      console.error('Routing worker error:', error);
      // Reject all pending promises
      workerPromises.forEach((promise, id) => {
        workerPromises.delete(id);
        promise.reject(new Error(`Worker error: ${error.message}`));
      });
    };
  }
  return routingWorker;
}

// Send a message to the worker and return a promise
function postMessageToWorker(message: any): Promise<any> {
  const worker = initializeWorker();
  const id = ++workerIdCounter;

  return new Promise((resolve, reject) => {
    workerPromises.set(id, { resolve, reject });
    worker.postMessage({ ...message, id });
  });
}

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
 * Find the nearest OSM node to a given point
 */
export async function findNearestNode(lat: number, lng: number): Promise<string | null> {
  try {
    await loadOsmData();

    let nearestNodeId: string | null = null;
    let minDistance = Infinity;

    // For efficiency, we could use spatial indexing, but for MVP we'll do a linear scan
    // In production, you'd want to use an R-tree or similar spatial index
    const nodeIds = getNodeIds();

    for (const nodeId of nodeIds) {
      const node = getNode(nodeId);
      if (!node) continue;

      const distance = Math.hypot(node.lat - lat, node.lng - lng); // Simple Euclidean for now
      // For more accuracy over small areas, we can use this approximation
      // In reality, we'd use haversine, but for finding nearest node in a small area,
      // Euclidean is fine

      if (distance < minDistance) {
        minDistance = distance;
        nearestNodeId = nodeId;
      }
    }

    return nearestNodeId;
  } catch (error) {
    console.error('Error finding nearest node:', error);
    return null;
  }
}

/**
 * A* pathfinding algorithm with hazard-aware weights
 * Uses web worker if USE_WORKER is true, otherwise runs in main thread
 */
export async function findRoute(start: RoutePoint, end: RoutePoint): Promise<RouteResult | null> {
  // Use web worker if enabled
  if (USE_WORKER) {
    try {
      const result = await postMessageToWorker({
        type: 'FIND_ROUTE',
        data: { start, end }
      });
      return result;
    } catch (error) {
      console.error('Error using routing worker, falling back to main thread:', error);
      // Fall back to main thread implementation
    }
  }

  // Main thread implementation (original code)
  try {
    // Ensure OSM data is loaded
    await loadOsmData();

    // Find nearest nodes to start and end points
    const startNodeId = await findNearestNode(start.lat, start.lng);
    const endNodeId = await findNearestNode(end.lat, end.lng);

    if (!startNodeId || !endNodeId) {
      console.error('Could not find nearest OSM nodes for start or end point');
      return null;
    }

    // A* algorithm
    const openSet = new MinHeap<{ id: string; fScore: number }>((left, right) => left.fScore - right.fScore);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>(); // Cost from start to node
    const fScore = new Map<string, number>(); // Estimated total cost from start to goal

    // Initialize
    const allNodes = getNodeIds();
    for (const nodeId of allNodes) {
      gScore.set(nodeId, Infinity);
      fScore.set(nodeId, Infinity);
    }

    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, heuristicCostEstimate(startNodeId, endNodeId));

    openSet.push({ id: startNodeId, fScore: fScore.get(startNodeId)! });

    while (!openSet.isEmpty()) {
      const currentEntry = openSet.pop()!;
      if (currentEntry.fScore > (fScore.get(currentEntry.id) ?? Infinity)) continue;
      const current = currentEntry.id;

      if (current === endNodeId) {
        // Found the path, reconstruct it
        return reconstructPath(cameFrom, current, startNodeId, endNodeId);
      }

      const currentNode = getProcessedNode(current);
      if (!currentNode) continue;

      // Check each neighbor
      for (const neighborId of currentNode.connections) {
        const neighbor = getProcessedNode(neighborId);
        if (!neighbor) continue;

        // Calculate tentative gScore
        const distance = currentNode.distanceToConnections[neighborId] || 0;
        const hazardWeight = await getHazardWeightForEdge(current, neighborId);
        const tentativeGScore = (gScore.get(current) ?? Infinity) + distance * hazardWeight;

        if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
          // This path is better than previous ones
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeGScore);
          fScore.set(neighborId, tentativeGScore + heuristicCostEstimate(neighborId, endNodeId));

          // Add to open set if not already there
          openSet.push({ id: neighborId, fScore: fScore.get(neighborId)! });
        }
      }
    }

    // No path found
    return null;
  } catch (error) {
    console.error('Error in findRoute:', error);
    return null;
  }
}

/**
 * Heuristic cost estimate (haversine distance)
 */
function heuristicCostEstimate(nodeId1: string, nodeId2: string): number {
  const node1 = getNode(nodeId1);
  const node2 = getNode(nodeId2);

  if (!node1 || !node2) return 0;

  return haversineDistance(node1.lat, node1.lng, node2.lat, node2.lng);
}

/**
 * Get hazard weight for an edge between two nodes
 */
async function getHazardWeightForEdge(fromNodeId: string, toNodeId: string): Promise<number> {
  try {
    const fromNode = getNode(fromNodeId);
    const toNode = getNode(toNodeId);

    if (!fromNode || !toNode) return 1.0;

    // Sample points along the edge for hazard checking
    const sampleCount = Math.max(2, Math.floor(haversineDistance(
      fromNode.lat, fromNode.lng,
      toNode.lat, toNode.lng
    ) / 25)); // Sample every 25m

    let maxHazardWeight = 1.0;

    for (let i = 0; i <= sampleCount; i++) {
      const ratio = i / sampleCount;
      const lat = fromNode.lat + (toNode.lat - fromNode.lat) * ratio;
      const lng = fromNode.lng + (toNode.lng - fromNode.lng) * ratio;

      const hazardWeight = await getHazardWeightAtLocation(lat, lng);
      maxHazardWeight = Math.max(maxHazardWeight, hazardWeight);
    }

    return maxHazardWeight;
  } catch (error) {
    console.error('Error getting hazard weight for edge:', error);
    throw error;
  }
}

/**
 * Reconstruct path from cameFrom map
 */
function reconstructPath(
  cameFrom: Map<string, string>,
  current: string,
  startNodeId: string,
  endNodeId: string
): RouteResult | null {
  try {
    // Reconstruct the path of node IDs
    const pathNodeIds: string[] = [current];
    let currentId = current;

    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId)!;
      pathNodeIds.unshift(currentId);
    }

    // Convert node IDs to RoutePoints
    const points: RoutePoint[] = [];
    for (const nodeId of pathNodeIds) {
      const node = getNode(nodeId);
      if (node) {
        points.push({ lat: node.lat, lng: node.lng });
      }
    }

    if (points.length < 2) {
      // Fallback to direct path if we couldn't reconstruct
      const startNode = getNode(startNodeId);
      const endNode = getNode(endNodeId);
      if (startNode && endNode) {
        points.push(
          { lat: startNode.lat, lng: startNode.lng },
          { lat: endNode.lat, lng: endNode.lng }
        );
      } else {
        return null;
      }
    }

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
      const hazardWeight = getHazardWeightAtLocationSync(midLat, midLng); // Sync version for reconstruction

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
    const hazardScore = Math.min(100, (totalHazardScore / Math.max(1, segments.length)) * 2);

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
    console.error('Error reconstructing path:', error);
    return null;
  }
}

/**
 * Synchronous version of getHazardWeightAtLocation for path reconstruction
 * Note: This is less accurate but avoids async issues during reconstruction
 */
async function getHazardWeightAtLocation(lat: number, lng: number): Promise<number> {
  try {
    // Find point-based hazards within 50 meters of this point
    const { data: pointData, error: pointError } = await supabase.rpc('get_hazards_near_point', {
      p_latitude: lat,
      p_longitude: lng,
      p_radius_meters: 50,
      p_hazard_types: null,
      p_status: null,
      p_include_expired: false,
      p_limit: null,
      p_offset: 0
    });

    // Find shape-based hazards that contain this point
    const { data: shapeData, error: shapeError } = await supabase.rpc('get_hazards_containing_point', {
      p_latitude: lat,
      p_longitude: lng,
      p_hazard_types: null,
      p_status: null,
      p_include_expired: false,
      p_limit: null,
      p_offset: 0
    });

    if (pointError) {
      console.error('Error fetching point hazards for location:', pointError);
      throw pointError;
    }

    if (shapeError) {
      console.error('Error fetching shape hazards for location:', shapeError);
      throw shapeError;
    }

    // Combine point and shape hazards
    const allHazards = [...(pointData || []), ...(shapeData || [])];

    if (!allHazards || allHazards.length === 0) {
      return 1.0; // No hazards nearby
    }

    // Calculate maximum weight multiplier from all nearby hazards
    let maxMultiplier = 1.0;

    for (const { hazard } of allHazards) {
      const typeWeights = HAZARD_WEIGHTS[hazard.hazard_type] || HAZARD_WEIGHTS.default;
      const weight = typeWeights[hazard.status] || 1.0;
      maxMultiplier = Math.max(maxMultiplier, weight);
    }

    return maxMultiplier;
  } catch (error) {
    console.error('Error in getHazardWeightAtLocation:', error);
    throw error;
  }
}

/**
 * Synchronous version of getHazardWeightAtLocation for use during path reconstruction
 * This is a simplified version that assumes low hazard for performance
 * Note: Does not consider shape-based hazards for performance reasons
 */
function getHazardWeightAtLocationSync(lat: number, lng: number): number {
  // For path reconstruction, we use a simplified approach
  // In a production system, we might cache hazard data or use a different strategy
  return 1.0; // Assume no additional hazard cost during reconstruction
}

/**
 * Get alternative routes using edge penalty method
 */
export async function getAlternativeRoutes(start: RoutePoint, end: RoutePoint, count = 3): Promise<RouteResult[]> {
  try {
    const routes: RouteResult[] = [];

    // Find the main route first
    const mainRoute = await findRoute(start, end);
    if (!mainRoute) return [];

    // Add the main route
    routes.push(mainRoute);

    // If we only want one route, return early
    if (count <= 1) return routes;

    // Find alternative routes by penalizing edges used in previous routes
    for (let i = 1; i < count; i++) {
      const alternativeRoute = await findRouteWithPenalty(start, end, routes);
      if (!alternativeRoute) break; // No more alternatives found

      // Simplify the route for performance
      const simplifiedRoute = simplifyRoute(alternativeRoute, 0.0001); // ~10m tolerance
      routes.push(simplifiedRoute);
    }

    return routes;
  } catch (error) {
    console.error('Error getting alternative routes:', error);
    return [];
  }
}

/**
 * Find a route while penalizing edges used in previous routes
 */
async function findRouteWithPenalty(start: RoutePoint, end: RoutePoint, previousRoutes: RouteResult[]): Promise<RouteResult | null> {
  try {
    // Ensure OSM data is loaded
    await loadOsmData();

    // Find nearest nodes to start and end points
    const startNodeId = await findNearestNode(start.lat, start.lng);
    const endNodeId = await findNearestNode(end.lat, end.lng);

    if (!startNodeId || !endNodeId) {
      console.error('Could not find nearest OSM nodes for start or end point');
      return null;
    }

    // Create a set of edges to penalize (used in previous routes)
    const penalizedEdges = new Set<string>();

    for (const route of previousRoutes) {
      for (let i = 0; i < route.points.length - 1; i++) {
        const point1 = route.points[i];
        const point2 = route.points[i + 1];
        const node1Id = await findNearestNode(point1.lat, point1.lng);
        const node2Id = await findNearestNode(point2.lat, point2.lng);

        if (node1Id && node2Id) {
          // Create a canonical edge ID (smaller ID first)
          const edgeId = node1Id < node2Id ? `${node1Id}-${node2Id}` : `${node2Id}-${node1Id}`;
          penalizedEdges.add(edgeId);
        }
      }
    }

    // A* algorithm with edge penalties
    const openSet = new MinHeap<{ id: string; fScore: number }>((a, b) => a.fScore - b.fScore);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>(); // Cost from start to node
    const fScore = new Map<string, number>(); // Estimated total cost from start to goal

    // Initialize
    const allNodes = getNodeIds();
    for (const nodeId of allNodes) {
      gScore.set(nodeId, Infinity);
      fScore.set(nodeId, Infinity);
    }

    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, heuristicCostEstimate(startNodeId, endNodeId));

    openSet.push({ id: startNodeId, fScore: fScore.get(startNodeId)! });

    while (!openSet.isEmpty()) {
      const currentEntry = openSet.pop()!;
      if (currentEntry.fScore > (fScore.get(currentEntry.id) ?? Infinity)) continue;
      const current = currentEntry.id;

      if (current === endNodeId) {
        // Found the path, reconstruct it
        return reconstructPath(cameFrom, current, startNodeId, endNodeId);
      }

      const currentNode = getProcessedNode(current);
      if (!currentNode) continue;

      // Check each neighbor
      for (const neighborId of currentNode.connections) {
        const neighbor = getProcessedNode(neighborId);
        if (!neighbor) continue;

        // Check if this edge is penalized
        const edgeId = current < neighborId ? `${current}-${neighborId}` : `${neighborId}-${current}`;
        const penalty = penalizedEdges.has(edgeId) ? 2.0 : 1.0; // Double cost for penalized edges

        // Calculate tentative gScore
        const distance = currentNode.distanceToConnections[neighborId] || 0;
        const hazardWeight = await getHazardWeightForEdge(current, neighborId);
        const tentativeGScore = (gScore.get(current) ?? Infinity) + distance * hazardWeight * penalty;

        if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
          // This path is better than previous ones
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeGScore);
          fScore.set(neighborId, tentativeGScore + heuristicCostEstimate(neighborId, endNodeId));

          // Add to open set if not already there
          openSet.push({ id: neighborId, fScore: fScore.get(neighborId)! });
        }
      }
    }

    // No path found
    return null;
  } catch (error) {
    console.error('Error finding route with penalty:', error);
    return null;
  }
}

/**
 * Simplify a route using Douglas-Peucker algorithm
 */
function simplifyRoute(route: RouteResult, tolerance: number): RouteResult {
  if (route.points.length < 3) {
    return route; // Can't simplify with less than 3 points
  }

  try {
    // Convert points to format suitable for Douglas-Peucker
    const points = route.points.map(p => [p.lat, p.lng]);

    // Apply Douglas-Peucker algorithm
    const simplifiedIndices = douglasPeucker(points, tolerance);

    // Build simplified points array
    const simplifiedPoints: RoutePoint[] = simplifiedIndices.map(index => route.points[index]);

    // Recalculate segments for the simplified route
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    let totalHazardScore = 0;

    for (let i = 0; i < simplifiedPoints.length - 1; i++) {
      const from = simplifiedPoints[i];
      const to = simplifiedPoints[i + 1];

      const segmentDistance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
      totalDistance += segmentDistance;

      // Get hazard weight for midpoint of segment
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;
      const hazardWeight = getHazardWeightAtLocationSync(midLat, midLng); // Use sync version for performance

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
    const hazardScore = Math.min(100, (totalHazardScore / Math.max(1, segments.length)) * 2);

    // Estimate time (assuming average speed of 5 km/h = 1.39 m/s)
    const averageSpeed = 1.39; // m/s
    const totalTime = totalDistance / averageSpeed;

    return {
      points: simplifiedPoints,
      totalDistance,
      totalTime,
      hazardScore,
      segments
    };
  } catch (error) {
    console.error('Error simplifying route:', error);
    return route; // Return original route if simplification fails
  }
}

/**
 * Generate turn-by-turn instructions from route points
 */
export function generateTurnByTurnInstructions(points: RoutePoint[]): string[] {
  if (points.length < 2) {
    return [];
  }

  const instructions: string[] = [];

  // Start instruction
  instructions.push("Start heading " + getCardinalDirection(points[0], points[1]) + "");

  // Process each segment (except the last one which is the destination)
  for (let i = 0; i < points.length - 2; i++) {
    const currentPoint = points[i];
    const nextPoint = points[i + 1];
    const nextNextPoint = points[i + 2];

    // Calculate bearings
    const bearing1 = calculateBearing(currentPoint, nextPoint);
    const bearing2 = calculateBearing(nextPoint, nextNextPoint);

    // Calculate the turn angle
    let angle = ((bearing2 - bearing1) + 360) % 360;
    if (angle > 180) {
      angle = angle - 360;
    }

    // Get turn direction
    const turnDirection = getTurnDirection(angle);

    // Only add instruction if there's a meaningful turn
    if (turnDirection !== "" && Math.abs(angle) > 15) { // Only significant turns
      const distance = haversineDistance(currentPoint.lat, currentPoint.lng, nextPoint.lat, nextPoint.lng);
      const distanceText = distance >= 1000 ? (distance / 1000).toFixed(1) + " km" : Math.round(distance) + " m";

      instructions.push(
        `In ${distanceText}, turn ${turnDirection} then continue`
      );
    }
  }

  // Final instruction
  const lastSegmentDistance = haversineDistance(
    points[points.length - 2].lat, points[points.length - 2].lng,
    points[points.length - 1].lat, points[points.length - 1].lng
  );
  const distanceText = lastSegmentDistance >= 1000
    ? (lastSegmentDistance / 1000).toFixed(1) + " km"
    : Math.round(lastSegmentDistance) + " m";

  instructions.push(
    `In ${distanceText}, you will arrive at your destination`
  );

  return instructions;
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(from: RoutePoint, to: RoutePoint): number {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const lng1 = from.lng * Math.PI / 180;
  const lng2 = to.lng * Math.PI / 180;
  const dLng = lng2 - lng1;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  return bearing;
}

/**
 * Get cardinal direction from bearing
 */
function getCardinalDirection(from: RoutePoint, to: RoutePoint): string {
  const bearing = calculateBearing(from, to);

  if (bearing >= 337.5 || bearing < 22.5) return "North";
  if (bearing >= 22.5 && bearing < 67.5) return "North-East";
  if (bearing >= 67.5 && bearing < 112.5) return "East";
  if (bearing >= 112.5 && bearing < 157.5) return "South-East";
  if (bearing >= 157.5 && bearing < 202.5) return "South";
  if (bearing >= 202.5 && bearing < 247.5) return "South-West";
  if (bearing >= 247.5 && bearing < 292.5) return "West";
  if (bearing >= 292.5 && bearing < 337.5) return "North-West";

  return "North"; // fallback
}

/**
 * Get turn direction based on angle
 */
function getTurnDirection(angle: number): string {
  const absAngle = Math.abs(angle);

  if (absAngle < 15) {
    return ""; // No significant turn
  }

  if (angle > 0) {
    // Turning right
    if (absAngle < 30) return "slightly right";
    if (absAngle < 60) return "right";
    if (absAngle < 120) return "turn right";
    if (absAngle < 150) return "turn sharply right";
    return "make a U-turn right";
  } else {
    // Turning left
    if (absAngle < 30) return "slightly left";
    if (absAngle < 60) return "left";
    if (absAngle < 120) return "turn left";
    if (absAngle < 150) return "turn sharply left";
    return "make a U-turn left";
  }
}

/**
 * Douglas-Peucker algorithm for polyline simplification
 * @param points Array of [lat, lng] points
 * @param tolerance Tolerance for simplification (in degrees)
 * @returns Array of indices of points to keep
 */
function douglasPeucker(points: number[][], tolerance: number): number[] {
  if (points.length < 3) {
    return points.map((_, index) => index);
  }

  const firstPoint = 0;
  const lastPoint = points.length - 1;
  const pointIndicesToKeep: boolean[] = new Array(points.length).fill(false);

  // Always keep first and last points
  pointIndicesToKeep[firstPoint] = true;
  pointIndicesToKeep[lastPoint] = true;

  // Recursively simplify
  douglasPeuckerRecursive(points, firstPoint, lastPoint, tolerance, pointIndicesToKeep);

  // Return indices of points to keep
  return pointIndicesToKeep
    .map((keep, index) => keep ? index : -1)
    .filter(index => index !== -1)
    .sort((a, b) => a - b);
}

/**
 * Recursive part of Douglas-Peucker algorithm
 */
function douglasPeuckerRecursive(
  points: number[][],
  firstIndex: number,
  lastIndex: number,
  tolerance: number,
  pointIndicesToKeep: boolean[]
): void {
  if (lastIndex - firstIndex < 2) {
    return; // No points to simplify between
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[firstIndex];
  const lastPoint = points[lastIndex];

  // Find the point with maximum distance from the line segment
  for (let i = firstIndex + 1; i < lastIndex; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    pointIndicesToKeep[maxIndex] = true;

    // Recursively process the two segments
    douglasPeuckerRecursive(points, firstIndex, maxIndex, tolerance, pointIndicesToKeep);
    douglasPeuckerRecursive(points, maxIndex, lastIndex, tolerance, pointIndicesToKeep);
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 * @param point Point to check [lat, lng]
 * @param lineStart Start of line segment [lat, lng]
 * @param lineEnd End of line segment [lat, lng]
 * @returns Perpendicular distance
 */
function perpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
  const [x0, y0] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  // If the line segment is actually a point
  if (x1 === x2 && y1 === y2) {
    return Math.sqrt(Math.pow(x0 - x1, 2) + Math.pow(y0 - y1, 2));
  }

  // Calculate the perpendicular distance
  const numerator = Math.abs(
    (x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y1)
  );
  const denominator = Math.sqrt(
    Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
  );

  return numerator / denominator;
}

/**
 * Min-heap implementation for A* open set
 */
class MinHeap<T> {
  private data: T[] = [];
  constructor(private comparator: (a: T, b: T) => number) {}

  push(item: T): void {
    this.data.push(item);
    this.siftUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop();

    const top = this.data[0];
    const end = this.data.pop()!;
    this.data[0] = end;
    this.siftDown(0);
    return top;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  size(): number {
    return this.data.length;
  }

  contains(id: string): boolean {
    // Assuming T is { id: string, fScore: number }
    return this.data.some(item => (item as any).id === id);
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.data[parentIndex], this.data[index]) <= 0) break;

      [this.data[parentIndex], this.data[index]] = [this.data[index], this.data[parentIndex]];
      index = parentIndex;
    }
  }

  private siftDown(index: number): void {
    const lastIndex = this.data.length - 1;
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let smallestIndex = index;

      if (
        leftChildIndex <= lastIndex &&
        this.comparator(this.data[leftChildIndex], this.data[smallestIndex]) < 0
      ) {
        smallestIndex = leftChildIndex;
      }

      if (
        rightChildIndex <= lastIndex &&
        this.comparator(this.data[rightChildIndex], this.data[smallestIndex]) < 0
      ) {
        smallestIndex = rightChildIndex;
      }

      if (smallestIndex === index) break;

      [this.data[index], this.data[smallestIndex]] = [this.data[smallestIndex], this.data[index]];
      index = smallestIndex;
    }
  }
}

/**
 * Haversine distance calculation
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