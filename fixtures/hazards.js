// Test data fixtures for hazard reports
export const testHazards = [
  {
    id: 'hazard-1',
    reporter_id: 'user-1',
    location: 'POINT(125.0041 11.2442)', // Tacloban City coordinates
    hazard_type: 'flooding',
    status: 'unconfirmed',
    description: 'Water level rising rapidly on Quezon Blvd',
    created_at: '2026-09-27T10:30:00Z',
    updated_at: '2026-09-27T10:30:00Z'
  },
  {
    id: 'hazard-2',
    reporter_id: 'user-2',
    location: 'POINT(125.0035 11.2438)',
    hazard_type: 'pothole',
    status: 'needs_verification',
    description: 'Large pothole in right lane of Real St',
    created_at: '2026-09-27T09:15:00Z',
    updated_at: '2026-09-27T09:15:00Z'
  },
  {
    id: 'hazard-3',
    reporter_id: 'user-3',
    location: 'POINT(125.0052 11.2450)',
    hazard_type: 'flooding',
    status: 'hazard_active',
    description: 'Flood blocking both lanes on Justice Romualdez St',
    created_at: '2026-09-27T08:00:00Z',
    updated_at: '2026-09-27T08:00:00Z'
  },
  {
    id: 'hazard-4',
    reporter_id: 'user-1',
    location: 'POINT(125.0028 11.2420)',
    hazard_type: 'landslide',
    status: 'hazard_cleared',
    description: 'Small landslide cleared by DPWH crew',
    created_at: '2026-09-26T14:20:00Z',
    updated_at: '2026-09-26T16:45:00Z'
  }
];

export const testHazardTypes = ['flooding', 'pothole', 'debris', 'landslide', 'fallen_tree', 'road_collapse', 'accident', 'obstruction', 'other'];

export const testHazardStatuses = ['unconfirmed', 'needs_verification', 'hazard_active', 'hazard_cleared', 'expired'];