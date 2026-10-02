<script lang="ts">
  import { onMount } from 'svelte';
  import { loadUserProfile, updateUserProfile } from '$lib/profileUtils';
  import { signOut, user } from '$lib/authStore';
  import type { UserProfile } from '$lib/types/profile';
  import { initializeTheme, setAppTheme } from '$lib/theme';

  let profile: UserProfile | null = null;
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // For editing
  let editMode = false;
  let editedFullName: string = '';
  let isDarkMode = false;
  let isSigningOut = false;

  onMount(async () => {
    isDarkMode = initializeTheme() === 'dark';
    await loadProfile();
  });

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    setAppTheme(isDarkMode ? 'dark' : 'light');
  }

  async function handleSignOut() {
    isSigningOut = true;
    errorMessage = null;
    try {
      await signOut();
      window.location.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      errorMessage = 'Unable to sign out. Please try again.';
      isSigningOut = false;
    }
  }

  async function loadProfile() {
    isLoading = true;
    errorMessage = null;
    successMessage = null;

    try {
      profile = await loadUserProfile();
      if (profile) {
        editedFullName = profile.full_name ?? '';
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      errorMessage = 'Unable to load profile. Please try again.';
    } finally {
      isLoading = false;
    }
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
    <div class="error">{errorMessage ?? 'Unable to load profile. Please try again later.'}</div>
    <button on:click={loadProfile} class="btn-primary">Try again</button>
    <a href="/map" class="btn-secondary">Back to map</a>
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

      <section class="profile-preferences" aria-labelledby="preferences-heading">
        <h3 id="preferences-heading">Preferences</h3>
        <div class="preference-row">
          <div>
            <h4>Appearance</h4>
            <p>Choose the RouteGuard color theme.</p>
          </div>
          <button type="button" class="btn-secondary" aria-pressed={isDarkMode} on:click={toggleTheme}>
            Use {isDarkMode ? 'light' : 'dark'} mode
          </button>
        </div>
      </section>

      <div class="profile-account-actions">
        <button type="button" class="btn-secondary" disabled={isSigningOut} on:click={handleSignOut}>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-container {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px;
    color: var(--ink);
  }

  .profile-info {
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    background: var(--surface);
  }

  .profile-preferences {
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }

  .profile-preferences h3,
  .preference-row h4 {
    margin: 0;
    color: var(--ink);
  }

  .preference-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 12px;
  }

  .preference-row p {
    margin: 3px 0 0;
    color: var(--ink2);
  }

  .profile-actions,
  .profile-account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .profile-account-actions {
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .btn-primary,
  .btn-secondary {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--primary);
    border-radius: var(--r-s);
    background: var(--primary);
    color: #fff;
    font-weight: 600;
  }

  .btn-secondary {
    background: var(--surface);
    color: var(--primary);
  }

  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  @media (max-width: 540px) {
    .profile-container { padding: 14px; }
    .preference-row { align-items: flex-start; flex-direction: column; }
  }
</style>