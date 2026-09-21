import { supabase } from './supabaseClient';
import { user } from './authStore';

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

/**
 * Submit an agency request
 */
export async function submitAgencyRequest(formData: AgencyRequestForm): Promise<{ success: boolean; error?: string }> {
  const currentUser = user.get();
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
export async function approveAgencyRequest(requestId: string, adminUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Start transaction-like behavior
    const { error: requestError } = await supabase
      .from('agency_requests')
      .update({
        status: 'approved',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (requestError) {
      return { success: false, error: requestError.message };
    }

    // Get the request to update user profile
    const { data: requestData, error: fetchError } = await supabase
      .from('agency_requests')
      .select('user_id, role')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Update user's role to agency_personnel
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ role: requestData.role })
      .eq('id', requestData.user_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Reject an agency request
 */
export async function rejectAgencyRequest(requestId: string, adminUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('agency_requests')
      .update({
        status: 'rejected',
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}