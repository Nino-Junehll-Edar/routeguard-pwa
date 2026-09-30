import type { Writable } from 'svelte/store';

export const toast: Writable<{ message: string; type: string }>;

export function show(message: string, type?: string): void;
