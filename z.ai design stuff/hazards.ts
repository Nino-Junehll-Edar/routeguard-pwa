import { writable, derived } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import type { Hazard, Advisory, Severity } from '$lib/types';

/** ALL hazards incl. expired — for admin/agency consoles. */
export const hazards = writable<Hazard[]>([]);
/** Public-facing view: no expired hazards. Use this on map home, review, route. */
export const liveHazards = derived(hazards, ($h) => $h.filter((h) => h.status !== 'expired'));
export const advisories = writable<Advisory[]>([]);

let channel: RealtimeChannel | null = null;
let inited = false;

async function reloadAdvisories() {
  // agency_advisories_geo = SQL delta 003 view returning ST_AsGeoJSON geometry (RLS-aware)
  const { data } = await supabase.from('agency_advisories_geo').select('*').eq('is_active', true);
  advisories.set((data as unknown as Advisory[]) ?? []);
}

export async function refreshHazards() {
  const { data } = await supabase.from('hazards').select('*').order('created_at', { ascending: false });
  hazards.set((data as Hazard[]) ?? []);
}

export async function initHazards() {
  if (inited) return;
  inited = true;
  await Promise.all([refreshHazards(), reloadAdvisories()]);
  channel = supabase.channel('hazards-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hazards' }, refreshHazards)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_advisories' }, reloadAdvisories)
    .subscribe();
}

export function stopHazards() {
  channel?.unsubscribe();
  channel = null;
  inited = false;
}

export async function createHazard(p: {
  hazard_type: string; severity: Severity; description: string | null;
  location: string; lifetime_minutes?: number;
}, photoUrl?: string | null) {
  const { data, error } = await supabase.from('hazards')
    .insert({ ...p, photo_url: photoUrl ?? null, status: 'unconfirmed' }).select().single();
  if (error) throw error;
  return data as Hazard;
}

export async function uploadHazardPhoto(file: File): Promise<string | null> {
  const name = `hazard-photos/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('hazard-photos').upload(name, file, { contentType: 'image/jpeg' });
  if (error) return null;
  return supabase.storage.from('hazard-photos').getPublicUrl(name).data.publicUrl;
}

/** Community confirmation: logs + adjusts lifetime (+30 active / −15 cleared) via SQL delta 002. */
export async function confirmHazard(hazardId: string, kind: 'hazard_active' | 'hazard_cleared') {
  const { error } = await supabase.from('hazard_confirmations').insert({ hazard_id: hazardId, confirmation_type: kind });
  if (error) throw error;
  await supabase.rpc('adjust_hazard_lifetime', { p_hazard_id: hazardId, p_kind: kind });
}

export interface HazardComment { id: string; comment: string; created_at: string; user_id: string | null }

export async function loadComments(hazardId: string): Promise<HazardComment[]> {
  const { data } = await supabase.from('hazard_comments').select('*').eq('hazard_id', hazardId).order('created_at');
  return (data as HazardComment[]) ?? [];
}

export async function addComment(hazardId: string, comment: string) {
  const { error } = await supabase.from('hazard_comments').insert({ hazard_id: hazardId, comment });
  if (error) throw error;
}

export async function flagHazard(hazardId: string, reason: string) {
  await supabase.from('hazard_flags').insert({ hazard_id: hazardId, reason });
}