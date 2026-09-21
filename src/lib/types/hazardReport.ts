export interface HazardReportForm {
  hazard_type: string;
  description: string | null;
  photo: File | null; // For file upload
  latitude: number;
  longitude: number;
}

export interface HazardReport extends HazardReportForm {
  id: string;
  reporter_id: string;
  status: 'unconfirmed';
  created_at: string;
  photo_url: string | null;
}