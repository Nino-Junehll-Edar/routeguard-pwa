// Routing Web Worker for heavy calculations
// This worker handles A* algorithm computations to prevent blocking the UI thread

import type { RoutePoint, RouteResult } from '$lib/types/routing';
import { loadOsmData, getNode, getNodeIds, getProcessedNode } from './osmLoader';
import { supabase } from '../supabaseClient';

// Hazard weight configuration (duplicated from astar.ts for worker use)
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

// Min-heap implementation for A* open set
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

// Haversine distance calculation
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

// Find the nearest OSM node to a given point
async function findNearestNode(lat: number, lng: number): Promise<string | null> {
  try {
    await loadOsmData();

    let nearestNodeId: string | null = null;
    let minDistance = Infinity;

    // For efficiency, we could use spatial indexing, but for MVP we'll do a linear scan
    const nodeIds = getNodeIds();

    for (const nodeId of nodeIds) {
      const node = getNode(nodeId);
      if (!node) continue;

      const distance = haversineDistance(node.lat, node.lng, lat, lng);
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

// Get hazard weight for a location
async function getHazardWeightAtLocation(lat: number, lng: number): Promise<number> {
  try {
    // Find hazards within 50 meters of this point
    const { data, error } = await supabase.rpc('get_hazards_near_point', {
      p_latitude: lat,
      p_longitude: lng,
      p_radius_meters: 50,
      p_hazard_types: null,
      p_status: null,
      p_include_expired: false,
      p_limit: null,
      p_offset: 0
    });

    if (error) {
      console.error('Error fetching hazards for location:', error);
      throw error; 
    }

    if (!data || data.length === 0) {
      return 1.0; // No hazards nearby
    }

    // Calculate maximum weight multiplier from all nearby hazards
    let maxMultiplier = 1.0;

    for (const { hazard } of data) {
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

// Get hazard weight for an edge between two nodes
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

// Heuristic cost estimate (haversine distance)
function heuristicCostEstimate(nodeId1: string, nodeId2: string): number {
  const node1 = getNode(nodeId1);
  const node2 = getNode(nodeId2);

  if (!node1 || !node2) return 0;

  return haversineDistance(node1.lat, node1.lng, node2.lat, node2.lng);
}

// Reconstruct path from cameFrom map
function reconstructPath(
  cameFrom: Map<string, string>,
  current: string,
  startNodeId: string,
  endNodeId: string
): { lat: number; lng: number }[] | null {
  try {
    // Reconstruct the path of node IDs
    const pathNodeIds: string[] = [current];
    let currentId = current;

    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId)!;
      pathNodeIds.unshift(currentId);
    }

    // Convert node IDs to RoutePoints
    const points: { lat: number; lng: number }[] = [];
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

    return points;
  } catch (error) {
    console.error('Error reconstructing path:', error);
    return null;
  }
}

// Main A* pathfinding algorithm
async function findRoute(start: RoutePoint, end: RoutePoint): Promise<RouteResult | null> {
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
        const pathPoints = reconstructPath(cameFrom, current, startNodeId, endNodeId);
        if (!pathPoints) return null;

        // Calculate segments and costs
        const segments: any[] = [];
        let totalDistance = 0;
        let totalHazardScore = 0;

        for (let i = 0; i < pathPoints.length - 1; i++) {
          const from = pathPoints[i];
          const to = pathPoints[i + 1];

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
        const hazardScore = Math.min(100, (totalHazardScore / Math.max(1, segments.length)) * 2);

        // Estimate time (assuming average speed of 5 km/h = 1.39 m/s)
        const averageSpeed = 1.39; // m/s
        const totalTime = totalDistance / averageSpeed;

        return {
          points: pathPoints,
          totalDistance,
          totalTime,
          hazardScore,
          segments
        };
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

// Listen for messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  try {
    const { type, data, id } = event.data;

    if (type === 'FIND_ROUTE') {
      const { start, end } = data;
      const result = await findRoute(start, end);

      // Send result back to main thread
      self.postMessage({
        type: 'ROUTE_RESULT',
        id,
        data: result,
        error: result ? null : 'Failed to calculate route'
      });
    } else if (type === 'LOAD_OSM_DATA') {
      await loadOsmData();
      self.postMessage({
        type: 'OSM_DATA_LOADED',
        id,
        data: true
      });
    }
  } catch (error) {
    console.error('Error in worker:', error);
    self.postMessage({
      type: 'ERROR',
      id: event.data?.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};