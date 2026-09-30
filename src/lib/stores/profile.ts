import { writable, get } from 'svelte/store';
import type { UserProfile } from '$lib/types/profile';
import { loadUserProfile } from '$lib/profileUtils';
import { user } from '$lib/authStore';

export const profile = writable<UserProfile | null>(null);

export async function loadProfile() {
	const currentUser = get(user);
	if (!currentUser) {
		profile.set(null);
		return;
	}

	const profileData = await loadUserProfile();
	profile.set(profileData);
}