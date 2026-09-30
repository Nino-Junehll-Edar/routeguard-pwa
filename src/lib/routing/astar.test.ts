import { describe, expect, it, vi, beforeEach } from 'vitest';

const nodes = new Map([
  ['a', { lat: 0, lng: 0 }],
  ['b', { lat: 0, lng: 0.001 }],
  ['c', { lat: 0, lng: 0.002 }]
]);

const processedNodes = new Map([
  ['a', { lat: 0, lng: 0, connections: ['b'], distanceToConnections: { b: 100 } }],
  ['b', { lat: 0, lng: 0.001, connections: ['a', 'c'], distanceToConnections: { a: 100, c: 100 } }],
  ['c', { lat: 0, lng: 0.002, connections: ['b'], distanceToConnections: { b: 100 } }]
]);

// Mock osmLoader
vi.mock('./osmLoader.ts', () => ({
  loadOsmData: vi.fn().mockResolvedValue(undefined),
  getNode: (id: string) => nodes.get(id),
  getNodeIds: () => [...nodes.keys()],
  getProcessedNode: (id: string) => processedNodes.get(id)
}));

// Mock supabaseClient
const mockSupabase = {
  rpc: vi.fn()
};

vi.mock('../supabaseClient.ts', () => ({
  supabase: mockSupabase
}));

import { findNearestNode, generateTurnByTurnInstructions } from './astar';

describe('A* routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the nearest graph node for route endpoints', async () => {
    await expect(findNearestNode(0, 0.0011)).resolves.toBe('b');
  });

  it('generates a start and destination instruction for a short route', () => {
    expect(generateTurnByTurnInstructions([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 }
    ])).toEqual([
      'Start heading East',
      'In 111 m, you will arrive at your destination'
    ]);
  });
});