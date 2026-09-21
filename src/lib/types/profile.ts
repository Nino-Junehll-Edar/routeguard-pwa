export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: 'admin' | 'agency_personnel' | 'common_user';
  reputation_points: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdates {
  full_name?: string;
  // Other updatable fields
}