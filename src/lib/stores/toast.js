import { writable } from 'svelte/store';

export const toast = writable({ message: '', type: '' });

export function show(message, type = 's') {
	toast.set({ message, type });
	setTimeout(() => {
		toast.set({ message: '', type: '' });
	}, 3000);
}