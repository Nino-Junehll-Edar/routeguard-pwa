// Conflict resolution system for RouteGuard PWA
// Handles conflicts when syncing offline changes with the server

import { getDataByKey, putData, deleteData } from './indexedDB.js';

const DB_NAME = 'routeguard-pwa-db';
const STORES = {
  HAZARDS: 'hazards',
  USER_PROFILE: 'userProfile',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings'
};

/**
 * Resolve conflicts between local IndexedDB data and server data
 * This function should be called after fetching fresh data from the server
 * @param {string} storeName - Name of the object store
 * @param {string} idField - Field name used as ID (usually 'id')
 * @param {Array} serverData - Array of objects from the server
 * @param {Function} conflictResolver - Function to resolve conflicts (optional)
 * @returns {Promise<Object>} - Results of conflict resolution
 */
export async function resolveConflicts(storeName, idField = 'id', serverData = [], conflictResolver = null) {
  try {
    // Get all local data from IndexedDB
    const localData = await getAllData(storeName);

    // Create maps for easy lookup
    const localMap = new Map();
    localData.forEach(item => {
      localMap.set(item[idField], item);
    });

    const serverMap = new Map();
    serverData.forEach(item => {
      serverMap.set(item[idField], item);
    });

    // Track results
    const results = {
      added: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      resolved: 0
    };

    // Process server data - check for additions and updates
    for (const [id, serverItem] of serverMap.entries()) {
      const localItem = localMap.get(id);

      if (!localItem) {
        // Item exists on server but not locally - add it locally
        await putData(storeName, serverItem);
        results.added++;
      } else {
        // Item exists in both - check for conflicts
        const isEqual = JSON.stringify(localItem) === JSON.stringify(serverItem);

        if (!isEqual) {
          // Conflict detected
          results.conflicts++;

          let resolvedItem;
          if (conflictResolver) {
            // Use custom conflict resolver
            resolvedItem = conflictResolver(localItem, serverItem, id);
          } else {
            // Default resolution: server wins (newer data)
            resolvedItem = serverItem;
          }

          // Update local data with resolved item
          await putData(storeName, resolvedItem);
          results.resolved++;
        }
      }
    }

    // Check for local items that no longer exist on server (deleted)
    for (const [id, localItem] of localMap.entries()) {
      if (!serverMap.has(id)) {
        // Item exists locally but not on server - delete it locally
        await deleteData(storeName, id);
        results.deleted++;
      }
    }

    return results;
  } catch (error) {
    console.error('Error resolving conflicts for store', storeName, error);
    throw error;
  }
}

/**
 * Hazard-specific conflict resolution
 * Hazards have special considerations due to their temporal nature (expiration)
 * @param {Object} localHazard - Hazard from local IndexedDB
 * @param {Object} serverHazard - Hazard from server
 * @param {string} id - Hazard ID
 * @returns {Object} - Resolved hazard
 */
export function resolveHazardConflict(localHazard, serverHazard, id) {
  // For hazards, we need to consider:
  // 1. Status changes (unconfirmed -> needs_verification -> hazard_active/hazard_cleared -> expired)
  // 2. Lifetime changes
  // 3. Reporter consistency

  // Rule 1: If server has hazard_cleared or expired status, it wins (definitive state)
  if (serverHazard.status === 'hazard_cleared' || serverHazard.status === 'expired') {
    return serverHazard;
  }

  // Rule 2: If local has hazard_cleared or expired but server doesn't, server wins
  // (someone reverted the clearance or extended the lifetime)
  if ((localHazard.status === 'hazard_cleared' || localHazard.status === 'expired') &&
      !(serverHazard.status === 'hazard_cleared' || serverHazard.status === 'expired')) {
    return serverHazard;
  }

  // Rule 3: For active hazards, the one with longer lifetime wins
  if (localHazard.status === 'hazard_active' && serverHazard.status === 'hazard_active') {
    return localHazard.lifetime_minutes >= serverHazard.lifetime_minutes ? localHazard : serverHazard;
  }

  // Rule 4: For verification conflicts, prioritize hazard_active over hazard_cleared
  if (localHazard.status === 'hazard_active' && serverHazard.status === 'hazard_cleared') {
    return localHazard; // Active wins over cleared
  }
  if (localHazard.status === 'hazard_cleared' && serverHazard.status === 'hazard_active') {
    return serverHazard; // Active wins over cleared
  }

  // Rule 5: For same status, newer timestamp wins (based on updated_at)
  if (localHazard.updated_at && serverHazard.updated_at) {
    const localTime = new Date(localHazard.updated_at).getTime();
    const serverTime = new Date(serverHazard.updated_at).getTime();
    return localTime >= serverTime ? localHazard : serverHazard;
  }

  // Rule 6: Default to server data (assume it's newer)
  return serverHazard;
}

/**
 * User profile conflict resolution
 * Profiles can be updated from multiple devices
 * @param {Object} localProfile - Profile from local IndexedDB
 * @param {Object} serverProfile - Profile from server
 * @param {string} id - Profile ID
 * @returns {Object} - Resolved profile
 */
export function resolveProfileConflict(localProfile, serverProfile, id) {
  // For user profiles, we generally want to merge changes
  // but prioritize recent updates

  // Rule 1: If either has been deleted (marked as such), respect that
  // This would typically be handled by the deleted check above

  // Rule 2: Merge reputation points (sum both, but don't go negative below initial)
  const mergedProfile = { ...serverProfile }; // Start with server as base

  if (localProfile.reputation_points !== undefined &&
      serverProfile.reputation_points !== undefined) {
    // If both have reputation points, take the higher value
    // This prevents losing reputation gains from either side
    mergedProfile.reputation_points = Math.max(
      localProfile.reputation_points,
      serverProfile.reputation_points
    );
  }

  // Rule 3: For updated_at, keep the newer timestamp
  if (localProfile.updated_at && serverProfile.updated_at) {
    const localTime = new Date(localProfile.updated_at).getTime();
    const serverTime = new Date(serverProfile.updated_at).getTime();
    // We'll update the timestamp after merging
    const newerTime = Math.max(localTime, serverTime);
    mergedProfile.updated_at = new Date(newerTime).toISOString();
  }

  // Rule 4: For other fields, if local has a value and server doesn't, keep local
  // This preserves locally set values that weren't synced yet
  const fieldsToMerge = ['full_name', 'email', 'role'];
  for (const field of fieldsToMerge) {
    if (localProfile[field] !== undefined && localProfile[field] !== '' &&
        (serverProfile[field] === undefined || serverProfile[field] === '')) {
      mergedProfile[field] = localProfile[field];
    }
  }

  return mergedProfile;
}

/**
 * Notification conflict resolution
 * Notifications are generally append-only and time-based
 * @param {Object} localNotification - Notification from local IndexedDB
 * @param {Object} serverNotification - Notification from server
 * @param {string} id - Notification ID
 * @returns {Object} - Resolved notification
 */
export function resolveNotificationConflict(localNotification, serverNotification, id) {
  // For notifications, we generally want to keep both if they're different
  // but mark duplicates appropriately

  // Rule 1: If IDs are the same but content differs, server wins (assume it's newer)
  // unless it's a read status change from the user

  // Rule 2: If local is unread and server is read, respect user's choice
  if (localNotification.is_read === false && serverNotification.is_read === true) {
    // Keep local as unread if user hasn't read it yet
    return { ...serverNotification, is_read: false };
  }

  // Rule 3: If local is read and server is unread, server wins
  // (might be a new notification that looks similar)
  if (localNotification.is_read === true && serverNotification.is_read === false) {
    return serverNotification;
  }

  // Rule 4: For same read status, newer timestamp wins
  if (localNotification.created_at && serverNotification.created_at) {
    const localTime = new Date(localNotification.created_at).getTime();
    const serverTime = new Date(serverNotification.created_at).getTime();
    return localTime >= serverTime ? localNotification : serverNotification;
  }

  // Rule 5: Default to server data
  return serverNotification;
}