<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import type { AgencyAdvisory } from '$lib/types/hazard';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

  // Stores for advisory data and UI state
  export const advisories = writable<AgencyAdvisory[]>([]);
  export const loading = writable<boolean>(true);
  export const error = writable<string | null>(null);
  export const creating = writable<boolean>(false);
  export const createError = writable<string | null>(null);
  export const createSuccess = writable<string | null>(null);

  // Form state for creating advisories
  let title = '';
  let description = '';
  let advisoryType = '';
  let startTime: string | null = null;
  let endTime: string | null = null;
  let isActive = true;

  // Check authorization on mount
  onMount(async () => {
    await checkAuthorization();
    if ($profile?.role === 'agency_personnel' || $profile?.role === 'admin') {
      await loadAdvisories();
    }
  });

  async function checkAuthorization() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      goto('/login');
      return;
    }

    // Wait for profile to load if needed
    if (!profileData) {
      // Profile will be loaded via authStore listener
      // For now, we'll assume not authorized until profile loads
      return;
    }

    // Check if user is agency personnel or admin
    if (profileData && (profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
      // Authorized
      return;
    }

    // Not authorized, redirect to map
    goto('/map');
  }

  async function loadAdvisories() {
    loading.set(true);
    error.set(null);

    try {
      const { data, error: err } = await supabase
        .from('agency_advisories')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      advisories.set(data || []);
    } catch (err) {
      console.error('Error loading advisories:', err);
      error.set(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      loading.set(false);
    }
  }

  async function createAdvisory() {
    // Validate form
    if (!title || !advisoryType) {
      createError.set('Please fill in all required fields');
      return;
    }

    // Validate time range
    if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
      createError.set('End time must be after start time');
      return;
    }

    creating.set(true);
    createError.set(null);
    createSuccess.set(null);

    try {
      const currentUser = get(user);
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const profileData = get(profile);
      if (!profileData || !(profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
        throw new Error('Unauthorized');
      }

      // Create a default Point geometry for the advisory
      // Using Tacloban City coordinates as default (same as map initialization)
      // In a full implementation, this would be replaced with user-selected coordinates
      const defaultLatitude = 11.2447;
      const defaultLongitude = 125.0033;
      const geometry = {
        type: 'Point',
        coordinates: [defaultLongitude, defaultLatitude]
      };

      // Create advisory
      const { data, error: err } = await supabase
        .from('agency_advisories')
        .insert({
          created_by: currentUser.id,
          title,
          description: description || null,
          advisory_type: advisoryType,
          geometry: geometry,
          start_time: startTime || null,
          end_time: endTime || null,
          is_active: isActive
        });

      if (err) throw err;

      createSuccess.set('Advisory created successfully!');

      // Reset form
      title = '';
      description = '';
      advisoryType = '';
      startTime = null;
      endTime = null;
      isActive = true;

      // Reload advisories
      await loadAdvisories();
    } catch (err) {
      console.error('Error creating advisory:', err);
      createError.set(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      creating.set(false);
    }
  }

  async function toggleAdvisoryStatus(id: string, currentStatus: boolean) {
    try {
      const { error: err } = await supabase
        .from('agency_advisories')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (err) throw err;

      // Update local store
      advisories.update(items =>
        items.map(item =>
          item.id === id ? { ...item, is_active: !currentStatus } : item
        )
      );
    } catch (err) {
      console.error('Error updating advisory status:', err);
      error.set(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function deleteAdvisory(id: string) {
    if (!confirm('Are you sure you want to delete this advisory?')) return;

    try {
      const { error: err } = await supabase
        .from('agency_advisories')
        .delete()
        .eq('id', id);

      if (err) throw err;

      // Remove from local store
      advisories.update(items => items.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error deleting advisory:', err);
      error.set(err instanceof Error ? err.message : 'Unknown error');
    }
  }
</script>

<div class="agency-dashboard">
  <header class="dashboard-header">
    <h1>Agency Dashboard</h1>
    <p class="dashboard-subtitle">Manage agency advisories and alerts</p>
    <div class="user-info">
      <span>Logged in as: {$profile?.full_name || 'User'} ({$profile?.role || 'unknown'})</span>
      <button on:click={() => {
        import('$lib/authStore').then(({ signOut }) => signOut().catch(console.error));
      }} class="btn-outline">Sign Out</button>
    </div>
  </header>

  {#if $loading}
    <div class="loading">Loading advisories...</div>
  {:else if $error}
    <div class="error">Error: {$error}</div>
  {/if}

  <section class="advisory-management">
    <h2>My Advisories</h2>

    {#if $advisories.length === 0}
      <p class="empty-state">No advisories created yet. Create your first advisory below.</p>
      {:else}
      <div class="advisories-list">
        {#each $advisories as advisory}
          <div class="advisory-card">
            <div class="advisory-header">
              <h3>{advisory.title}</h3>
              <div class="advisory-meta">
                <span class="advisory-type">{advisory.advisory_type}</span>
                <span class="advisory-status" class:inactive={!advisory.is_active}>{advisory.is_active ? 'Active' : 'Inactive'}</span>
                <span class="advisory-date">{new Date(advisory.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            {#if advisory.description}
              <p class="advisory-description">{advisory.description}</p>
            {/if}
            {#if advisory.start_time || advisory.end_time}
              <div class="advisory-timing">
                {#if advisory.start_time}
                  <span>Starts: {new Date(advisory.start_time).toLocaleString()}</span>
                {/if}
                {#if advisory.end_time}
                  <span>Ends: {new Date(advisory.end_time).toLocaleString()}</span>
                {/if}
              </div>
            {/if}
            <div class="advisory-actions">
              <button
                on:click={() => toggleAdvisoryStatus(advisory.id, advisory.is_active)}
                class="btn-sm btn-{advisory.is_active ? 'danger' : 'success'}"
              >
                {advisory.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                on:click={() => deleteAdvisory(advisory.id)}
                class="btn-sm btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="advisory-form-section">
      <h2>Create New Advisory</h2>

      {#if $createError}
        <div class="error">{$createError}</div>
      {/if}
      {#if $createSuccess}
        <div class="success">{$createSuccess}</div>
      {/if}

      <form on:submit|preventDefault={createAdvisory} class="advisory-form">
        <div class="form-group">
          <label for="advisory-title">Title:</label>
          <input
            type="text"
            id="advisory-title"
            bind:value={title}
            required
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="advisory-description">Description:</label>
          <textarea
            id="advisory-description"
            bind:value={description}
            rows="3"
            class="input"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="advisory-type">Advisory Type:</label>
          <select
            id="advisory-type"
            bind:value={advisoryType}
            required
            class="select"
          >
            <option value="">Select advisory type</option>
            <option value="weather">Weather Advisory</option>
            <option value="traffic">Traffic Advisory</option>
            <option value="construction">Construction Advisory</option>
            <option value="emergency">Emergency Advisory</option>
            <option value="public_safety">Public Safety Advisory</option>
            <option value="health">Health Advisory</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="advisory-start-time">Start Time:</label>
          <input
            type="datetime-local"
            id="advisory-start-time"
            bind:value={startTime}
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="advisory-end-time">End Time:</label>
          <input
            type="datetime-local"
            id="advisory-end-time"
            bind:value={endTime}
            class="input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={isActive}
            />
            Is Active
          </label>
        </div>

        <button
          type="submit"
          disabled={$creating}
          class="btn-primary"
        >
          {#if $creating}
            Creating...
          {:else}
            Create Advisory
          {/if}
        </button>
      </form>
    </div>
  </section>
</div>

<style>
  .agency-dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 20px;
  }

  .dashboard-header h1 {
    margin: 0 0 10px 0;
    font-size: 2rem;
  }

  .dashboard-subtitle {
    color: #666;
    margin: 0;
    font-size: 1.1rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  .advisory-management {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .advisory-management h2 {
    margin-top: 0;
    color: #333;
  }

  .empty-state {
    text-align: center;
    color: #666;
    padding: 40px 20px;
  }

  .advisories-list {
    display: grid;
    gap: 16px;
    margin-bottom: 30px;
  }

  .advisory-card {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 16px;
    background: #fafafa;
  }

  .advisory-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .advisory-header h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    color: #333;
  }

  .advisory-meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .advisory-type, .advisory-status, .advisory-date {
    font-size: 0.875rem;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .advisory-type {
    background: #e3f2fd;
    color: #1976d2;
  }

  .advisory-status {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .advisory-status.inactive {
    background: #ffebee;
    color: #c62828;
  }

  .advisory-date {
    background: #f5f5f5;
    color: #666;
  }

  .advisory-description {
    margin: 12px 0;
    color: #555;
    line-height: 1.5;
  }

  .advisory-timing {
    display: flex;
    gap: 16px;
    font-size: 0.875rem;
    color: #666;
    margin: 12px 0;
  }

  .advisory-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .advisory-form {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #eee;
  }

  

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .input, .select, textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .input:focus, .select:focus, textarea:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input {
    margin-right: 8px;
    width: auto;
  }

  button {
    cursor: pointer;
    border: none;
    padding: 10px 16px;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #1976d2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1565c0;
  }

  .btn-success {
    background: #4caf50;
    color: white;
  }

  .btn-success:hover {
    background: #43a047;
  }

  .btn-danger {
    background: #f44336;
    color: white;
  }

  .btn-danger:hover {
    background: #d32f2f;
  }

  .btn-outline {
    background: transparent;
    border: 1px solid #ccc;
    color: #666;
  }

  .btn-outline:hover {
    border-color: #999;
    color: #333;
  }

  .error {
    background: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  .success {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .dashboard-header {
      flex-direction: column;
      align-items: stretch;
    }

    .user-info {
      align-items: stretch;
    }

    .advisory-header {
      flex-direction: column;
      align-items: stretch;
    }

    .advisory-actions {
      justify-content: center;
    }
  }
</style>



