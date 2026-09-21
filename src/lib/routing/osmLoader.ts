import type { RoutePoint } from '$lib/types/routing';

// Simple in-memory cache for OSM data
let osmNodes: Map<string, { lat: number; lng: number; connections: string[] }> = new Map();
let isLoaded = false;

/**
 * Load OSM road network data for Tacloban area
 * In production, this would fetch from Overpass API or use a pre-loaded extract
 * For MVP, we'll simulate with a small dataset
 */
export async function loadOsmData(): Promise<void> {
  if (isLoaded) return;

  try {
    // In a real app, this would fetch from Overpass API:
    // https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];
    //   (area["name"="Tacloban City"]->.searchArea);
    //   (way[highway](area.searchArea);
    //   node(w);
    //   out body;
    //   >;
    //   out skel qt;

    // For MVP, we'll simulate loading with a small dataset
    // In reality, you'd want to pre-process OSM data and load a simplified graph

    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add some sample nodes (Tacloban City area)
    // These would normally come from OSM data
    osmNodes.set('node_1', { lat: 14.1512, lng: 124.9734, connections: ['node_2', 'node_3'] }); // City center
    osmNodes.set('node_2', { lat: 14.1550, lng: 124.9780, connections: ['node_1', 'node_4'] }); // North
    osmNodes.set('node_3', { lat: 14.1480, lng: 124.9700, connections: ['node_1', 'node_5'] }); // South
    osmNodes.set('node_4', { lat: 14.1580, lng: 124.9820, connections: ['node_2'] }); // Northeast
    osmNodes.set('node_5', { lat: 14.1450, lng: 124.9650, connections: ['node_3'] }); // Southwest

    isLoaded = true;
    console.log('OSM data loaded');
  } catch (error) {
    console.error('Error loading OSM data:', error);
    throw error;
  }
}

/**
 * Get node by ID
 */
export function getNode(id: string): { lat: number; lng: number; connections: string[] } | undefined {
  return osmNodes.get(id);
}

/**
 * Get all node IDs
 */
export function getNodeIds(): string[] {
  return Array.from(osmNodes.keys());
}