import { supabase } from './supabaseClient';
import { user } from './authStore';
import { get } from 'svelte/store';
import type { Hazard } from './types/hazard';

export interface Comment {
  id: string;
  hazard_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get comments for a specific hazard
 */
export async function getHazardComments(hazardId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('hazard_comments')
      .select('*')
      .eq('hazard_id', hazardId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching hazard comments:', error);
    return [];
  }
}

/**
 * Add a comment to a hazard
 */
export async function addHazardComment(hazardId: string, commentText: string): Promise<Comment | null> {
  const currentUser = get(user);
  if (!currentUser) {
    console.warn('User not authenticated');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('hazard_comments')
      .insert({
        hazard_id: hazardId,
        user_id: currentUser.id,
        comment: commentText
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error adding hazard comment:', error);
    return null;
  }
}

/**
 * Update a comment
 */
export async function updateComment(commentId: string, commentText: string): Promise<boolean> {
  const currentUser = user.get();
  if (!currentUser) {
    console.warn('User not authenticated');
    return false;
  }

  try {
    const { error } = await supabase
      .from('hazard_comments')
      .update({ comment: commentText, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', currentUser.id);

    return !error;
  } catch (error) {
    console.error('Error updating comment:', error);
    return false;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  const currentUser = user.get();
  if (!currentUser) {
    console.warn('User not authenticated');
    return false;
  }

  try {
    const { error } = await supabase
      .from('hazard_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', currentUser.id);

    return !error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
}