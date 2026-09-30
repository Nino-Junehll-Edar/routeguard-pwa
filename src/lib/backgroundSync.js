// Background Sync implementation for RouteGuard PWA
// Handles queued actions and data synchronization when network connectivity is restored

import { syncQueuedActions } from './indexedDB.js';
import { resolveConflicts, resolveHazardConflict, resolveProfileConflict, resolveNotificationConflict } from './conflictResolution.js';
import { supabase } from './supabaseClient.js';

/**
 * Register background sync for the service worker
 * This should be called from the service worker's activate event
 */
export function registerBackgroundSync() {
  // Check if background sync is supported
  if ('sync' in window.registration) {
    console.log('Background sync is supported');

    // Register a periodic sync if supported (for regular sync attempts)
    if ('periodicSync' in window.registration) {
      registerPeriodicSync();
    }
  } else {
    console.log('Background sync is not supported');
  }
}

/**
 * Register periodic background sync for regular sync attempts
 * Note: Requires permission and may have restrictions
 */
async function registerPeriodicSync() {
  try {
    const registration = await navigator.serviceWorker.ready;
    // Try to register periodic sync with a 15 minute interval
    // Minimum interval is typically 12 hours for most browsers
    await registration.periodicSync.register('sync-queued-actions', {
      minInterval: 15 * 60 * 1000 // 15 minutes
    });
    console.log('Periodic background sync registered');
  } catch (error) {
    console.error('Failed to register periodic background sync:', error);
  }
}

/**
 * Listen for background sync events in the service worker
 * This function should be called from the service worker
 */
export function listenForBackgroundSync() {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-queued-actions') {
      event.waitUntil(syncAllData());
    }
  });

  // Also listen for periodic sync if supported
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-queued-actions') {
      event.waitUntil(syncAllData());
    }
  });
}

/**
 * Manually trigger a full sync of all data
 * Can be called from the app when network connectivity is detected
 */
export async function triggerSync() {
  try {
    await syncAllData();
    console.log('Manual full sync completed');
  } catch (error) {
    console.error('Failed to trigger sync:', error);
  }
}

/**
 * Sync all data between IndexedDB and server
 * Handles both queued actions and data synchronization with conflict resolution
 */
export async function syncAllData() {
  try {
    console.log('Starting full data sync...');

    // 1. First, process queued actions (hazard reports, votes, etc.)
    await syncQueuedActions();

    // 2. Then synchronize data with conflict resolution
    await syncHazards();
    await syncUserProfiles();
    await syncNotifications();

    console.log('Full data sync completed');
  } catch (error) {
    console.error('Error during full data sync:', error);
    throw error;
  }
}

/**
 * Synchronize hazards between local IndexedDB and server
 */
export async function syncHazards() {
  try {
    // Get local hazards from IndexedDB
    const localHazards = await getAllData('hazards');

    // Get hazards from server (modified in last 24 hours to limit data)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let { data: serverHazards, error } = await supabase
      .from('hazards')
      .select('*')
      .gte('updated_at', yesterday.toISOString());

    if (error) throw error;

    // Resolve conflicts
    const conflictResults = await resolveConflicts(
      'hazards',
      'id',
      serverHazards || [],
      resolveHazardConflict
    );

    console.log('Hazard sync results:', conflictResults);

    return conflictResults;
  } catch (error) {
    console.error('Error synchronizing hazards:', error);
    throw error;
  }
}

/**
 * Synchronize user profiles between local IndexedDB and server
 */
export async function syncUserProfiles() {
  try {
    // Get local profiles from IndexedDB
    const localProfiles = await getAllData('userProfile');

    // Get profiles from server for users that exist locally
    const localUserIds = localProfiles.map(p => p.id);

    if (localUserIds.length === 0) {
      // No local profiles to sync
      return { added: 0, updated: 0, deleted: 0, conflicts: 0, resolved: 0 };
    }

    let { data: serverProfiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', localUserIds);

    if (error) throw error;

    // Resolve conflicts
    const conflictResults = await resolveConflicts(
      'userProfile',
      'id',
      serverProfiles || [],
      resolveProfileConflict
    );

    console.log('User profile sync results:', conflictResults);

    return conflictResults;
  } catch (error) {
    console.error('Error synchronizing user profiles:', error);
    throw error;
  }
}

/**
 * Synchronize notifications between local IndexedDB and server
 */
export async function syncNotifications() {
  try {
    // Get local notifications from IndexedDB
    const localNotifications = await getAllData('notifications');

    // Get notifications from server for the current user
    // Note: In a real implementation, we'd get the current user ID from auth
    // For now, we'll get recent notifications (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let { data: serverNotifications, error } = await supabase
      .from('notifications')
      .select('*')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Resolve conflicts
    const conflictResults = await resolveConflicts(
      'notifications',
      'id',
      serverNotifications || [],
      resolveNotificationConflict
    );

    console.log('Notification sync results:', conflictResults);

    return conflictResults;
  } catch (error) {
    console.error('Error synchronizing notifications:', error);
    throw error;
  }
}

/**
 * Check if background sync is supported
 * @returns {boolean}
 */
export function isBackgroundSyncSupported() {
  return 'sync' in window.registration;
}

/**
 * Check if periodic background sync is supported
 * @returns {boolean}
 */
export function isPeriodicBackgroundSyncSupported() {
  return 'periodicSync' in window.registration;
}