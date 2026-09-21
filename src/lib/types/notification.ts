export interface Notification {
  id: string;
  type: 'proximity_alert' | 'verification_prompt' | 'system';
  title: string;
  body: string;
  hazard_id?: string;
  data?: Record<string, unknown>;
  created_at: string;
  is_read: boolean;
}

export interface ProximityAlertOptions {
  hazardId: string;
  hazardType: string;
  distance: number; // meters from user
  userId: string;
}