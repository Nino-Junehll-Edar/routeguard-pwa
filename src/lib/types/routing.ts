export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  distance: number; // meters
  baseCost: number; // distance/time based
  hazardCost: number; // additional cost from hazards
  totalCost: number; // baseCost + hazardCost
}

export interface RouteResult {
  points: RoutePoint[];
  totalDistance: number; // meters
  totalTime: number; // seconds
  hazardScore: number; // 0-100 score based on hazard exposure
  segments: RouteSegment[];
}

export interface HazardWeight {
  hazardType: string;
  status: 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared';
  weightMultiplier: number; // 1.0 = normal, 2.0 = double cost, etc.
}