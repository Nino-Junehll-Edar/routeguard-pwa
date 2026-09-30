<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { getNotifications, markNotificationAsRead } from '$lib/notificationUtils';
  import notificationsStore from '$lib/stores/notifications.js';
  import { user } from '$lib/authStore';

  type NotificationItem = {
    id: string;
    title: string;
    body: string;
    type?: string;
    hazard_id?: string | null;
    is_read?: boolean;
    created_at?: string;
  };

  let notifications: NotificationItem[] = [];
  let loading = false;
  let showOnlyUnread = false;

  async function loadNotifications() {
    const currentUser = get(user);
    if (!currentUser) return;

    loading = true;
    try {
      notifications = await getNotifications({ limit: 50, unreadOnly: showOnlyUnread });
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      loading = false;
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await markNotificationAsRead(id);
      notifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      notificationsStore.update((n) => ({
        ...n,
        unreadCount: Math.max(0, (n.unreadCount ?? 0) - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      for (const n of notifications) {
        await markNotificationAsRead(n.id);
      }
      notifications = notifications.map((n) => ({ ...n, is_read: true }));
      notificationsStore.update((n) => ({ ...n, unreadCount: 0 }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async function handleRefresh() {
    await loadNotifications();
  }

  onMount(() => {
    loadNotifications();
  });
</script>

<div class="notification-page">
  <header class="notification-header">
    <h1>Notifications</h1>
    <div class="notification-actions">
      {#if notifications.length > 0}
        <button class="btn btn-sm btn-secondary" on:click={handleMarkAllAsRead}>Mark all as read</button>
      {/if}
      <button class="btn btn-sm btn-secondary" on:click={handleRefresh}>Refresh</button>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showOnlyUnread} on:change={loadNotifications} />
        <span>Show only unread</span>
      </label>
    </div>
  </header>

  {#if loading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Loading notifications...</p>
    </div>
  {:else if notifications.length === 0}
    <div class="empty-state">
      <p>{showOnlyUnread ? 'No unread notifications' : 'No notifications yet'}</p>
      <p class="hint">You'll see notifications here when hazards are reported nearby or when verification is needed.</p>
    </div>
  {:else}
    <div class="notification-list">
      {#each notifications as notification (notification.id)}
        <button
          type="button"
          class="notification-item {notification.is_read ? 'read' : 'unread'}"
          on:click={() => handleMarkAsRead(notification.id)}
         
        >
          <div class="notification-content">
            <div class="notification-title">{notification.title}</div>
            <div class="notification-body">{notification.body}</div>
            {#if notification.hazard_id}
              <div class="notification-meta">
                <span class="notification-type">{notification.type ?? 'alert'}</span>
                <time datetime={notification.created_at ?? ''}>
                  {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                </time>
              </div>
            {/if}
          </div>
          {#if !notification.is_read}
            <div class="notification-indicator"></div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
