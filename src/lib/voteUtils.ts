import { supabase } from './supabaseClient';
import { user } from './authStore';
import { get } from 'svelte/store';
import type { Hazard } from './types/hazard';

export interface Vote {
  id: string;
  hazard_id: string;
  user_id: string;
  vote_type: 'upvote' | 'downvote';
  created_at: string;
  updated_at: string;
}

/**
 * Get votes for a specific hazard
 */
export async function getHazardVotes(hazardId: string): Promise<Vote[]> {
  try {
    const { data, error } = await supabase
      .from('hazard_votes')
      .select('*')
      .eq('hazard_id', hazardId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching hazard votes:', error);
    return [];
  }
}

/**
 * Add or update a vote for a hazard
 */
export async function voteOnHazard(hazardId: string, voteType: 'upvote' | 'downvote'): Promise<Vote | null> {
  const currentUser = get(user);
  if (!currentUser) {
    console.warn('User not authenticated');
    return null;
  }

  try {
    // First check if user has already voted on this hazard
    const { data: existingVote, error: checkError } = await supabase
      .from('hazard_votes')
      .select('*')
      .eq('hazard_id', hazardId)
      .eq('user_id', currentUser.id)
      .single();

    let result;
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
      throw checkError;
    }

    if (existingVote) {
      // Update existing vote
      if (existingVote.vote_type === voteType) {
        // If clicking the same vote type, remove the vote (toggle off)
        const { error } = await supabase
          .from('hazard_votes')
          .delete()
          .eq('id', existingVote.id);

        if (error) throw error;
        return null; // Indicates vote was removed
      } else {
        // Change vote type
        const { data, error } = await supabase
          .from('hazard_votes')
          .update({ vote_type: voteType, updated_at: new Date().toISOString() })
          .eq('id', existingVote.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }
    } else {
      // Insert new vote
      const { data, error } = await supabase
        .from('hazard_votes')
        .insert({
          hazard_id: hazardId,
          user_id: currentUser.id,
          vote_type: voteType
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result;
  } catch (error) {
    console.error('Error voting on hazard:', error);
    return null;
  }
}

/**
 * Get vote summary for a hazard (counts of upvotes and downvotes)
 */
export async function getHazardVoteSummary(hazardId: string): Promise<{ upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> {
  const currentUser = user.get();

  try {
    const { data, error } = await supabase
      .from('hazard_votes')
      .select('vote_type, user_id')
      .eq('hazard_id', hazardId);

    if (error) {
      throw error;
    }

    const votes = data || [];
    const upvotes = votes.filter(v => v.vote_type === 'upvote').length;
    const downvotes = votes.filter(v => v.vote_type === 'downvote').length;

    let userVote = null;
    if (currentUser) {
      const userVoteObj = votes.find(v => v.user_id === currentUser.id);
      userVote = userVoteObj ? userVoteObj.vote_type : null;
    }

    return { upvotes, downvotes, userVote };
  } catch (error) {
    console.error('Error getting hazard vote summary:', error);
    return { upvotes: 0, downvotes: 0, userVote: null };
  }
}