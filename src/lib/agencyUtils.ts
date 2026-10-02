import { supabase } from './supabaseClient';
import { user } from './authStore';
import { get } from 'svelte/store';

export interface AgencyRequestForm {
  full_name: string;
  agency: string;
  role: string;
  id_number: string;
  purpose: string;
}

export interface AgencyRequest {
  id: string;
  user_id: string;
  full_name: string;
  agency: string;
  role: string;
  id_number: string | null;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StaffHazardStatus = 'hazard_active' | 'hazard_cleared';

export interface AgencyAdvisoryInput {
  id?: string;
  title: string;
  advisoryType: string;
  description: string | null;
  geometry: { type: 'Point' | 'LineString' | 'Polygon'; coordinates: unknown };
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

/**
 * Submit an agency request
 */
export async function submitAgencyRequest(formData: AgencyRequestForm): Promise<{ success: boolean; error?: string }> {
  const currentUser = get(user);
  if (!currentUser) {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('agency_requests')
      .insert({
        user_id: currentUser.id,
        full_name: formData.full_name,
        agency: formData.agency,
        role: formData.role,
        id_number: formData.id_number,
        purpose: formData.purpose,
        status: 'pending'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Load agency requests (for admin view)
 */
export async function loadAgencyRequests(filters: { status?: string } = {}): Promise<AgencyRequest[]> {
  let query = supabase.from('agency_requests').select('*');

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading agency requests:', error);
    return [];
  }

  return data as AgencyRequest[];
}

/**
 * Approve an agency request
 */
export async function approveAgencyRequest(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('decide_agency_request', {
      p_request_id: requestId,
      p_approve: true,
      p_reason: reason ?? null
    });
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Reject an agency request
 */
export async function rejectAgencyRequest(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('decide_agency_request', {
      p_request_id: requestId,
      p_approve: false,
      p_reason: reason ?? null
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function reviewAgencyHazard(
  hazardId: string,
  status: StaffHazardStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('agency_review_hazard', {
      p_hazard_id: hazardId,
      p_status: status
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function saveAgencyAdvisory(
  advisory: AgencyAdvisoryInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('agency_save_advisory', {
      p_id: advisory.id ?? null,
      p_title: advisory.title,
      p_advisory_type: advisory.advisoryType,
      p_description: advisory.description,
      p_geometry: advisory.geometry,
      p_start_time: advisory.startTime,
      p_end_time: advisory.endTime,
      p_is_active: advisory.isActive
    });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data as string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function setAgencyAdvisoryActive(
  advisoryId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('admin_set_advisory_active', {
      p_advisory_id: advisoryId,
      p_is_active: isActive
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}