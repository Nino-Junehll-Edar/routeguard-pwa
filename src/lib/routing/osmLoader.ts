import type { RoutePoint } from '$lib/types/routing';

// Data structures for OSM graph
interface OsmNode {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

interface OsmWay {
  id: string;
  nodeIds: string[];
  tags: Record<string, string>;
}

interface ProcessedNode {
  id: string;
  lat: number;
  lng: number;
  connections: string[];
  distanceToConnections: Record<string, number>;
}

let osmNodes: Map<string, OsmNode> = new Map();
let osmWays: Map<string, OsmWay> = new Map();
let processedNodes: Map<string, ProcessedNode> = new Map();
let isLoaded = false;

/**
 * Load OSM road network data for Tacloban area from Overpass API
 */
export async function loadOsmData(): Promise<void> {
  if (isLoaded) return;

  try {
    // [min_lon, min_lat, max_lon, max_lat]
    const bbox = [124.95, 11.20, 125.05, 11.30];
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["highway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        node(w);
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });

    if (!response.ok) {
      throw new Error(`Overpass API request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.elements)) {
      throw new Error('Overpass API returned an invalid response');
    }

    // Process nodes
    data.elements.forEach((element: any) => {
      if (element.type === 'node') {
        osmNodes.set(element.id.toString(), {
          id: element.id.toString(),
          lat: element.lat,
          lng: element.lon,
          tags: element.tags || {}
        });
      } else if (element.type === 'way') {
        osmWays.set(element.id.toString(), {
          id: element.id.toString(),
          nodeIds: element.nodes.map((n: any) => n.toString()),
          tags: element.tags || {}
        });
      }
    });

    // Process ways to build node connections
    await processOsmWays();

    isLoaded = true;
    console.log(`OSM data loaded: ${osmNodes.size} nodes, ${osmWays.size} ways`);
  } catch (error) {
    console.error('Error loading OSM data:', error);
    osmNodes.clear();
    osmWays.clear();
    processedNodes.clear();
    isLoaded = false;
    throw error;
  }
}

/**
 * Process OSM ways to build node connections with distances
 */
async function processOsmWays(): Promise<void> {
  // Clear processed nodes
  processedNodes.clear();

  // Initialize processed nodes with basic info
  osmNodes.forEach((node) => {
    processedNodes.set(node.id, {
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      connections: [],
      distanceToConnections: {}
    });
  });

  // Process each way to create connections between consecutive nodes
  osmWays.forEach((way) => {
    const nodeIds = way.nodeIds;

    // Create connections between consecutive nodes in the way
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromId = nodeIds[i];
      const toId = nodeIds[i + 1];

      // Get nodes
      const fromNode = osmNodes.get(fromId);
      const toNode = osmNodes.get(toId);

      if (!fromNode || !toNode) continue;

      // Calculate distance between nodes
      const distance = haversineDistance(
        fromNode.lat, fromNode.lng,
        toNode.lat, toNode.lng
      );

      // Add connection from -> to
      const fromProcessed = processedNodes.get(fromId);
      if (fromProcessed) {
        // Avoid duplicate connections
        if (!fromProcessed.connections.includes(toId)) {
          fromProcessed.connections.push(toId);
          fromProcessed.distanceToConnections[toId] = distance;
        }
      }

      // Add connection to -> from (for undirected graph)
      const toProcessed = processedNodes.get(toId);
      if (toProcessed) {
        // Avoid duplicate connections
        if (!toProcessed.connections.includes(fromId)) {
          toProcessed.connections.push(fromId);
          toProcessed.distanceToConnections[fromId] = distance;
        }
      }
    }
  });
}

/**
 * Get node by ID
 */
export function getNode(id: string): { lat: number; lng: number } | undefined {
  const node = osmNodes.get(id);
  if (!node) return undefined;
  return { lat: node.lat, lng: node.lng };
}

/**
 * Get processed node with connections
 */
export function getProcessedNode(id: string): {
  lat: number;
  lng: number;
  connections: string[];
  distanceToConnections: Record<string, number>
} | undefined {
  const processedNode = processedNodes.get(id);
  if (!processedNode) return undefined;
  return {
    lat: processedNode.lat,
    lng: processedNode.lng,
    connections: [...processedNode.connections],
    distanceToConnections: { ...processedNode.distanceToConnections }
  };
}

/**
 * Get all node IDs
 */
export function getNodeIds(): string[] {
  return Array.from(osmNodes.keys());
}

/**
 * Haversine distance calculation (moved from astar.ts to avoid duplication)
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

