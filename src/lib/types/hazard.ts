export interface Hazard {
  id: string;
  reporter_id: string | null;
  location: [number, number]; // [lng, lat] - GeoJSON format (center point)
  shape: { type: string; coordinates: unknown } | null; // GeoJSON shape for the hazard area
  hazard_type: string; // Tag: flood, pothole, accident, obstruction, landslide, tree, collapse, other
  description: string | null;
  photo_url: string | null;
  severity: 'passable' | 'one_lane' | 'impassable'; // Passable/yellow, One lane/amber, Impassable/red
  status: 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
  lifetime_minutes: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  building_id: string | null;
}

export interface HazardMarker extends Hazard {
  distance?: number; // distance from user in meters
}

export interface AgencyAdvisory {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  advisory_type: string;
     geometry: { type: string; coordinates: unknown } | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}