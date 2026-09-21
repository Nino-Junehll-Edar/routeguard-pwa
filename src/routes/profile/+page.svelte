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

{#if isLoading}
  <div class="loading">Loading profile...</div>
{:else if !profile}
  <div class="error">Unable to load profile. Please try again later.</div>
{:else}
  <div class="profile-container">
    <h2>My Profile</h2>

    {#if errorMessage}
      <div class="error-message">{errorMessage}</div>
    {/if}

    {#if successMessage}
      <div class="success-message">{successMessage}</div>
    {/if}

    <div class="profile-info">
      <div class="info-row">
        <span class="info-label">Full Name:</span>
        {#if editMode}
          <input type="text" bind:value={editedFullName} class="edit-input" />
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
        <button on:click={toggleEditMode}>
          Edit Profile
        </button>
      {:else}
        <button on:click={handleUpdate}>
          Save Changes
        </button>
        <button on:click={toggleEditMode} class="cancel">
          Cancel
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .profile-container {
    max-width: 500px;
    margin: 2rem auto;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .profile-info {
    margin-bottom: 2rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #eee;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-weight: bold;
    color: #555;
  }

  .info-value {
    text-align: right;
    color: #333;
  }

  .reputation-points {
    font-size: 1.5rem;
    font-weight: bold;
    color: #d35400;
  }

  .edit-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
  }

  button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }

  .cancel {
    background-color: #6c757d;
  }

  .cancel:hover {
    background-color: #5a6268;
  }

  .error-message {
    background-color: #ffe6e6;
    color: #d33;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }

  .success-message {
    background-color: #e6ffe6;
    color: #2d5a2d;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error {
    text-align: center;
    padding: 2rem;
    color: #d33;
  }
</style>