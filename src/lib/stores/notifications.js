import { writable } from 'svelte/store';
import { getNotifications } from '$lib/notificationUtils';
import { user } from '../authStore';

// Create the notifications store
const notificationsStore = writable({
  unreadCount: 0,
  loading: false
});

// Function to update the unread count
export async function updateNotificationCount() {
  const currentUser = user.get();
  if (!currentUser) {
    notificationsStore.update(() => ({ unreadCount: 0, loading: false }));
    return;
  }

  notificationsStore.update(() => ({ loading: true }));

  try {
    const notifications = await getNotifications({ limit: 50 });
    const unreadCount = notifications.filter(n => !n.is_read).length;
    notificationsStore.update(() => ({ unreadCount, loading: false }));
  } catch (error) {
    console.error('Error updating notification count:', error);
    notificationsStore.update(() => ({ loading: false }));
  }
}

// Initialize by updating the count
updateNotificationCount();

// Also update whenever the user changes
const userUnsub = user.subscribe(() => {
  updateNotificationCount();
});

// Also update periodically (every 30 seconds) to catch new notifications
const periodicUnsub = setInterval(() => {
  updateNotificationCount();
}, 30 * 1000); // 30 seconds

// Cleanup on app teardown (if needed)
export function cleanup() {
  userUnsub();
  clearInterval(periodicUnsub);
}

export default notificationsStore;
