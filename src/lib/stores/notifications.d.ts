import type { Writable } from 'svelte/store';

export interface NotificationStoreState {
  unreadCount: number;
  loading: boolean;
}

declare const notificationsStore: Writable<NotificationStoreState>;
export default notificationsStore;

export declare function updateNotificationCount(): Promise<void>;
export declare function cleanup(): void;
