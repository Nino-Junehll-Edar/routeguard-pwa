// IndexedDB wrapper for RouteGuard PWA
// Provides offline storage for hazards, user data, and queued actions

const DB_NAME = 'routeguard-pwa-db';
const DB_VERSION = 1;

// Object stores
const STORES = {
  HAZARDS: 'hazards',
  USER_PROFILE: 'userProfile',
  QUEUED_ACTIONS: 'queuedActions',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings'
};

/**
 * Initialize IndexedDB database and create object stores
 * @returns {Promise<IDBDatabase>}
 */
export function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      // Hazards store - store hazard reports for offline access
      if (!db.objectStoreNames.contains(STORES.HAZARDS)) {
        const hazardStore = db.createObjectStore(STORES.HAZARDS, { keyPath: 'id' });
        hazardStore.createIndex('by-reporter', 'reporter_id', { unique: false });
        hazardStore.createIndex('by-status', 'status', { unique: false });
        hazardStore.createIndex('by-created-at', 'created_at', { unique: false });
      }

      // User profile store - cache user data for offline access
      if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
        db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'id' });
      }

      // Queued actions store - store actions to sync when back online
      if (!db.objectStoreNames.contains(STORES.QUEUED_ACTIONS)) {
        const queueStore = db.createObjectStore(STORES.QUEUED_ACTIONS, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('by-type', 'type', { unique: false });
        queueStore.createIndex('by-created-at', 'created_at', { unique: false });
      }

      // Notifications store - cache notifications for offline access
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        const notificationStore = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
        notificationStore.createIndex('by-user-id', 'user_id', { unique: false });
        notificationStore.createIndex('by-is-read', 'is_read', { unique: false });
        notificationStore.createIndex('by-created-at', 'created_at', { unique: false });
      }

      // Settings store - store user preferences and app settings
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Add or update an object in a store
 * @param {string} storeName - Name of the object store
 * @param {Object} data - Data to store
 * @returns {Promise<any>}
 */
export function putData(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const putRequest = store.put(data);

      putRequest.onsuccess = () => {
        resolve(putRequest.result);
      };

      putRequest.onerror = () => {
        reject(new Error('Failed to put data: ' + putRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Get all objects from a store
 * @param {string} storeName - Name of the object store
 * @param {string} indexName - Optional index name to use
 * @param {*} indexValue - Optional index value to filter by
 * @returns {Promise<Array>}
 */
export function getAllData(storeName, indexName = null, indexValue = null) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      let getAllRequest;

      if (indexName && indexValue !== null) {
        const index = store.index(indexName);
        getAllRequest = index.getAll(IDBKeyRange.only(indexValue));
      } else {
        getAllRequest = store.getAll();
      }

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };

      getAllRequest.onerror = () => {
        reject(new Error('Failed to get data: ' + getAllRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Get a single object by key from a store
 * @param {string} storeName - Name of the object store
 * @param {*} key - Key of the object to retrieve
 * @returns {Promise<Object|null>}
 */
export function getDataByKey(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get data by key: ' + getRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Delete an object by key from a store
 * @param {string} storeName - Name of the object store
 * @param {*} key - Key of the object to delete
 * @returns {Promise<void>}
 */
export function deleteData(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const deleteRequest = store.delete(key);

      deleteRequest.onsuccess = () => {
        resolve();
      };

      deleteRequest.onerror = () => {
        reject(new Error('Failed to delete data: ' + deleteRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Clear all objects from a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise<void>}
 */
export function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        resolve();
      };

      clearRequest.onerror = () => {
        reject(new Error('Failed to clear store: ' + clearRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Get count of objects in a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise<number>}
 */
export function getCount(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB error: ' + request.error));
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };

      countRequest.onerror = () => {
        reject(new Error('Failed to get count: ' + countRequest.error));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };
  });
}

/**
 * Sync queued actions with the server when online
 * This function should be called when network connectivity is restored
 * @returns {Promise<void>}
 */
export async function syncQueuedActions() {
  try {
    const queuedActions = await getAllData(STORES.QUEUED_ACTIONS);

    if (queuedActions.length === 0) {
      return;
    }

    // Process each queued action
    for (const action of queuedActions) {
      try {
        switch (action.type) {
          case 'HAZARD_REPORT':
            // Submit hazard report to Supabase
            await submitHazardReport(action.data);
            break;
          case 'VOTE_ON_HAZARD':
            // Submit vote to Supabase
            await voteOnHazard(action.data.hazardId, action.data.voteType);
            break;
          case 'VERIFY_HAZARD':
            // Submit hazard verification to Supabase
            await verifyHazard(action.data.hazardId, action.data.verificationType);
            break;
          case 'UPDATE_PROFILE':
            // Update user profile in Supabase
            await updateUserProfile(action.data);
            break;
          // Add more action types as needed
          default:
            console.warn('Unknown queued action type:', action.type);
        }

        // If successful, remove from queue
        await deleteData(STORES.QUEUED_ACTIONS, action.id);
      } catch (error) {
        console.error('Failed to process queued action:', action, error);
        // Keep the action in queue for retry
      }
    }
  } catch (error) {
    console.error('Error syncing queued actions:', error);
  }
}

// Helper functions for specific operations (would integrate with existing services)

/**
 * Submit a hazard report (offline-capable version)
 * @param {Object} hazardData - Hazard report data
 * @returns {Promise<Object>}
 */
async function submitHazardReport(hazardData) {
  throw new Error('Background hazard submission is not configured; queued report retained');
}

/**
 * Vote on a hazard (offline-capable version)
 * @param {string} hazardId - ID of the hazard to vote on
 * @param {string} voteType - Type of vote ('upvote' or 'downvote')
 * @returns {Promise<Object>}
 */
async function voteOnHazard(hazardId, voteType) {
  throw new Error('Background voting is not configured; queued vote retained');
}

/**
 * Verify a hazard (offline-capable version)
 * @param {string} hazardId - ID of the hazard to verify
 * @param {string} verificationType - Type of verification ('hazard_active' or 'hazard_cleared')
 * @returns {Promise<void>}
 */
async function verifyHazard(hazardId, verificationType) {
  throw new Error('Background verification is not configured; queued verification retained');
}

/**
 * Update user profile (offline-capable version)
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>}
 */
async function updateUserProfile(profileData) {
  throw new Error('Background profile updates are not configured; queued update retained');
}