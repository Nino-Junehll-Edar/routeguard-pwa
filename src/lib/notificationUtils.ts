import { supabase } from './supabaseClient';
import { user } from './authStore';
import { get } from 'svelte/store';
import type { Notification } from './types/notification';
import { normalizeHazardLocation } from './geoUtils';
import { requestFCMPermission, setupFCMListener, isFCMSupported } from './firebase';

// FCM configuration
let notificationPermission: NotificationPermission = 'default';
let isInitialized = false;
let fcmToken: string | null = null;

/**
 * Initialize notification service
 * Should be called after user authentication
 */
export async function initNotifications(): Promise<void> {
  if (isInitialized) return;

  try {
    // Request permission for notifications
    if ('Notification' in window) {
      notificationPermission = await Notification.requestPermission();
    }

    // Initialize FCM if available
    if (isFCMSupported() && notificationPermission === 'granted') {
      fcmToken = await requestFCMPermission();
      if (fcmToken) {
        console.log('FCM token obtained:', fcmToken);
        // In a real app, you would send this token to your backend
        // For now, we'll store it locally for demonstration
        localStorage.setItem('fcm_token', fcmToken);
      }
    }

    isInitialized = true;
    console.log('Notification service initialized');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}


/**
 * Show a browser notification
 */
export function showNotification(title: string, options: { body?: string; icon?: string } = {}): void {
  if (!('Notification' in window) || notificationPermission !== 'granted') {
    console.warn('Notifications not supported or permission denied');
    return;
  }

  new Notification(title, {
    body: options.body || '',
    icon: options.icon || '/favicon.svg',
    ...options
  });
}

/**
 * Send a notification via FCM (would typically call your backend)
 * This is a simplified version - in production you'd send the FCM token to your backend
 * and have your backend send the actual FCM message
 */
export async function sendFCMNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
  if (!fcmToken) {
    console.warn('No FCM token available');
    return;
  }

  // In a real implementation, you would send this to your backend:
  // await fetch('/api/send-fcm-notification', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     token: fcmToken,
  //     title,
  //     body,
  //     data
  //   })
  // });

  // For now, we'll just log what we would send
  console.log('Would send FCM notification:', { token: fcmToken, title, body, data });
}

/**
 * Store a notification in the database for the in-app notification center
 */
export async function storeNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<string | null> {
  const currentUser = get(user);
  if (!currentUser) return null;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: currentUser.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        hazard_id: notification.hazard_id,
        data: notification.data,
        is_read: notification.is_read ?? false
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error storing notification:', error);
    return null;
  }
}

/**
 * Retrieve notifications for the current user
 */
export async function getNotifications(options: { limit?: number; unreadOnly?: boolean } = {}): Promise<Notification[]> {
  const currentUser = get(user);
  if (!currentUser) return [];

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error retrieving notifications:', error);
    return [];
  }
}

/**
 * Check for nearby hazards and send proximity alerts
 * Should be called periodically or when location changes significantly
 */
export async function checkProximityAlerts(currentLat: number, currentLng: number): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) return;

  try {
    // Get active hazards within 1km of user location
    const { data, error } = await supabase
      .from('hazards')
      .select('*')
      .not('status', 'in', '(expired,hazard_cleared)')
      .gt('lifetime_minutes', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching hazards for proximity check:', error);
      return;
    }

    // Check each hazard for proximity
    for (const hazard of data || []) {
      const coordinates = normalizeHazardLocation(hazard.location);
      if (!coordinates) continue;
      const [hazardLng, hazardLat] = coordinates;
      const distance = haversineDistance(currentLat, currentLng, hazardLat, hazardLng);

      // If within 500m and we haven't recently notified about this hazard
      if (distance <= 500) {
        const alertKey = `proximity_alert_${hazard.id}`;
        const lastNotified = localStorage.getItem(alertKey);
        const now = Date.now();

        // Only notify if we haven't notified in the last 30 minutes
        if (!lastNotified || (now - parseInt(lastNotified, 10)) > 30 * 60 * 1000) {
          // Show browser notification
          showNotification('Hazard Alert', {
            body: `${hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)} reported nearby!`
          });

          // Store notification in database for in-app notification center
          await storeNotification({
            type: 'proximity_alert',
            title: 'Hazard Alert',
            body: `${hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)} reported nearby!`,
            hazard_id: hazard.id,
            is_read: false
          });

          // Send FCM notification (for when app is in background/closed)
          await sendFCMNotification(
            'Hazard Alert',
            `${hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)} reported nearby!`,
            { hazardId: hazard.id, type: 'proximity_alert' }
          );

          // Record that we notified about this hazard
          localStorage.setItem(alertKey, now.toString());
        }
      }
    }
  } catch (error) {
    console.error('Error in checkProximityAlerts:', error);
  }
}

/**
 * Send a verification prompt notification for hazards needing confirmation
 */
export async function sendVerificationPrompt(hazardId: string, hazardType: string): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) return;

  try {
    // Get hazard details
    const { data, error } = await supabase
      .from('hazards')
      .select('*')
      .eq('id', hazardId)
      .single();

    if (error || !data) {
      console.error('Error fetching hazard for verification prompt:', error);
      return;
    }

    const hazard = data;

    // Check if we've recently sent a verification prompt for this hazard to this user
    const promptKey = `verification_prompt_${hazardId}_${currentUser.id}`;
    const lastPrompted = localStorage.getItem(promptKey);
    const now = Date.now();

    // Only prompt if we haven't prompted in the last 15 minutes
    if (!lastPrompted || (now - parseInt(lastPrompted, 10)) > 15 * 60 * 1000) {
      // Show browser notification
      showNotification('Hazard Verification Needed', {
        body: `Is the ${hazard.hazard_type} still active at this location?`
      });

      // Store notification in database for in-app notification center
      await storeNotification({
        type: 'verification_prompt',
        title: 'Hazard Verification Needed',
        body: `Is the ${hazard.hazard_type} still active at this location?`,
        hazard_id: hazard.id,
        is_read: false
      });

      // Send FCM notification (for when app is in background/closed)
      await sendFCMNotification(
        'Hazard Verification Needed',
        `Is the ${hazard.hazard_type} still active at this location?`,
        { hazardId: hazard.id, type: 'verification_prompt' }
      );

      // Record that we prompted about this hazard
      localStorage.setItem(promptKey, now.toString());
    }
  } catch (error) {
    console.error('Error in sendVerificationPrompt:', error);
  }
}

/**
 * Mark a notification as read (for in-app notification center)
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    return !error;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Helper: Haversine distance calculation
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}