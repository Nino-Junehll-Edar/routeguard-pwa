import { supabase } from './supabaseClient';
import { user } from './authStore';

// FCM configuration (would be initialized in main.js or similar)
// For now, we'll use a simplified approach with local storage and periodic checking
// In production, integrate with Firebase Cloud Messaging

let notificationPermission: NotificationPermission = 'default';
let isInitialized = false;

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
    icon: options.icon || '/icon-192x192.png', // Default PWA icon
    ...options
  });
}

/**
 * Check for nearby hazards and send proximity alerts
 * Should be called periodically or when location changes significantly
 */
export async function checkProximityAlerts(currentLat: number, currentLng: number): Promise<void> {
  const currentUser = user.get();
  if (!currentUser) return;

  try {
    // Get active hazards within 1km of user location
    const { data, error } = await supabase
      .from('hazards')
      .select('*')
      .not('status', 'in', ['expired', 'hazard_cleared'])
      .gt('lifetime_minutes', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching hazards for proximity check:', error);
      return;
    }

    // Check each hazard for proximity
    for (const hazard of data || []) {
      const [hazardLng, hazardLat] = hazard.location;
      const distance = haversineDistance(currentLat, currentLng, hazardLat, hazardLng);

      // If within 500m and we haven't recently notified about this hazard
      if (distance <= 500) {
        const alertKey = `proximity_alert_${hazard.id}`;
        const lastNotified = localStorage.getItem(alertKey);
        const now = Date.now();

        // Only notify if we haven't notified in the last 30 minutes
        if (!lastNotified || (now - parseInt(lastNotified, 10)) > 30 * 60 * 1000) {
          showNotification('Hazard Alert', {
            body: `${hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)} reported nearby!`
          });

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
  const currentUser = user.get();
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
      showNotification('Hazard Verification Needed', {
        body: `Is the ${hazard.hazard_type} still active at this location?`
      });

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