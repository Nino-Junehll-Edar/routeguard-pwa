import { supabase } from './supabaseClient';
import { user } from './authStore';
import { profile } from '$lib/stores/profile';
import { get } from 'svelte/store';
import type { UserProfile } from '$lib/types/profile';

/**
 * Fetch the current user's profile
 */
export async function loadUserProfile(): Promise<UserProfile | null> {
  const currentUser = get(user);
  if (!currentUser) {
    profile.set(null);
    return null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Error loading user profile:', error);
    profile.set(null);
    return null;
  }

  profile.set(data);
  return data;
}

/**
 * Update the current user's profile
 */
export async function updateUserProfile(updates: Partial<UserProfile>): Promise<boolean> {
  const currentUser = get(user);
  if (!currentUser) return false;

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', currentUser.id);

  if (error) {
    console.error('Error updating user profile:', error);
    return false;
  }

  // Update the profile store
  profile.update(p => p ? { ...p, ...updates } : null);
  return true;
}

/**
 * Add reputation points to a user
 */
export async function addReputationPoints(userId: string, points: number): Promise<boolean> {
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('reputation_points')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    console.error('Error loading reputation points:', fetchError);
    return false;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ reputation_points: profile.reputation_points + points })
    .eq('id', userId);

  if (error) {
    console.error('Error adding reputation points:', error);
    return false;
  }

  return true;
}

/**
 * Get reputation points for a user
 */
export async function getReputationPoints(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('reputation_points')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error getting reputation points:', error);
    return 0;
  }

  return data.reputation_points;
}