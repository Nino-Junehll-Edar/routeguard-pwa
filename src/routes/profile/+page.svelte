<script lang="ts">
  import { onMount } from 'svelte';
  import { loadUserProfile, updateUserProfile } from '$lib/profileUtils';
  import { user } from '$lib/authStore';
  import type { UserProfile } from '$lib/types/profile';

  let profile: UserProfile | null = null;
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // For editing
  let editMode = false;
  let editedFullName: string = '';

  onMount(async () => {
    await loadProfile();
  });

  async function loadProfile() {
    isLoading = true;
    errorMessage = null;
    successMessage = null;

    profile = await loadUserProfile();
    if (profile) {
      editedFullName = profile.full_name ?? '';
    }

    isLoading = false;
  }

  async function handleUpdate() {
    if (!profile) return;

    errorMessage = null;
    successMessage = null;

    const updates: Partial<UserProfile> = {};
    if (editedFullName !== profile.full_name) {
      updates.full_name = editedFullName;
    }

    if (Object.keys(updates).length > 0) {
      const success = await updateUserProfile(updates);
      if (success) {
        successMessage = 'Profile updated successfully!';
        await loadProfile(); // Reload to get fresh data
        editMode = false;
      } else {
        errorMessage = 'Failed to update profile. Please try again.';
      }
    }
  }

  function toggleEditMode() {
    editMode = !editMode;
    if (!editMode && profile) {
      editedFullName = profile.full_name ?? '';
    }
  }
</script>

<div class="profile-container">
  {#if isLoading}
    <div class="loading">Loading profile...</div>
  {:else if !profile}
    <div class="error">Unable to load profile. Please try again later.</div>
  {:else}
    <div class="profile-info">
      <h2>My Profile</h2>

      {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
      {/if}

      {#if successMessage}
        <div class="success-message">{successMessage}</div>
      {/if}

      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Full Name:</span>
          {#if editMode}
            <input type="text" bind:value={editedFullName} class="input" />
          {:else}
            <span class="info-value">{profile.full_name || 'Not set'}</span>
          {/if}
        </div>

        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">{profile.email}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Role:</span>
          <span class="info-value">
            {#if profile.role === 'admin'}
              Administrator
            {:else if profile.role === 'agency_personnel'}
              Agency Personnel
            {:else}
              Community User
            {/if}
          </span>
        </div>

        <div class="info-row">
          <span class="info-label">Reputation Points:</span>
          <span class="info-value reputation-points">{profile.reputation_points}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Member Since:</span>
          <span class="info-value">{new Date(profile.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div class="profile-actions">
        {#if !editMode}
          <button on:click={toggleEditMode} class="btn-primary">
            Edit Profile
          </button>
        {:else}
          <button on:click={handleUpdate} class="btn-primary">
            Save Changes
          </button>
          <button on:click={toggleEditMode} class="btn-secondary">
            Cancel
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>