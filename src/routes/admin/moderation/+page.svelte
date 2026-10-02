<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

const placeholderImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#666">No photo</text></svg>';

  let hazardFlags: HazardFlag[] = [];
  let publishedAdvisories: Advisory[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let isAuthorized = false;
  let authLoading = true;
  let selectedFlag: HazardFlag | null = null;
  let isFlagDetailOpen = false;
  let removeReason = '';
  let showRemoveForm = false;

  // Types
  interface HazardFlag {
    id: string;
    hazard_id: string;
    flagger_id: string;
    reason: string | null;
    created_at: string;
    resolved_action: string | null; // null/expired/removed/dismissed
    hazard: Hazard; // Joined hazard data
    flagger: UserProfile; // Joined flagger data
  }

  interface Hazard {
    id: string;
    reporter_id: string | null;
    location: [number, number]; // [lng, lat] - GeoJSON format (center point)
    hazard_type: string; // Tag: flood, pothole, accident, obstruction, landslide, tree, collapse, other
    description: string | null;
    photo_url: string | null;
    severity: 'passable' | 'one_lane' | 'impassable';
    status: 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
    lifetime_minutes: number;
    created_at: string;
    updated_at: string;
    expires_at: string;
  }

  interface Advisory {
    id: string;
    created_by: string;
    title: string;
    description: string | null;
    advisory_type: string;
    geometry: { type: string; coordinates: unknown } | null;
    start_time: string | null;
    end_time: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'common_user' | 'agency_personnel' | 'admin';
    is_suspended: boolean;
    suspension_reason: string | null;
    reputation_points: number;
    created_at: string;
    updated_at: string;
  }

  // Check authorization
  async function checkAuthorization() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      // Not signed in, redirect to login
      goto('/login');
      return false;
    }

    // Wait for profile to load if not already loaded
    if (!profileData) {
      // Profile will be loaded via authStore listener, we'll check again in a moment
      // For now, we'll assume not authorized until profile loads
      isAuthorized = false;
      authLoading = false;
      return false;
    }

    // Check if user is admin
    if (profileData.role === 'admin') {
      return true;
    }

    // Not authorized, redirect to appropriate page
    goto(profileData.role === 'agency_personnel' ? '/agency' : '/map');
    return false;
  }

  // Load hazard flags (open flags only)
  async function loadHazardFlags() {
    if (!isAuthorized) return;

    isLoading = true;
    errorMessage = null;
    successMessage = null;

    try {
      // Join with hazards and user profiles to get flagger and hazard details
      const { data, error } = await supabase
        .from('hazard_flags')
        .select(`
          *,
          hazard:hazards (
            id,
            hazard_type,
            description,
            photo_url,
            severity,
            status,
            location,
            created_at
          ),
          flagger:user_profiles!hazard_flags_flagger_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .is('resolved_action', null) // Only open flags
        .order('created_at', { ascending: false });

      if (error) throw error;
      hazardFlags = data as HazardFlag[];
    } catch (err) {
      console.error('Error loading hazard flags:', err);
      const message = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String(err.message)
          : String(err);
      errorMessage = `Failed to load moderation queue: ${message}`;
    } finally {
      isLoading = false;
    }
  }

  // Load published advisories (for admin oversight)
  async function loadPublishedAdvisories() {
    if (!isAuthorized) return;

    try {
      const { data, error } = await supabase
        .from('agency_advisories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      publishedAdvisories = data as Advisory[];
    } catch (err) {
      console.error('Error loading published advisories:', err);
      // Don't set error state for advisories as it's secondary content
    }
  }

  // Format time ago
  function formatTimeAgo(dateString: string): string {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    let interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
      return interval + ' years ago';
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
      return interval + ' months ago';
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
      return interval + ' days ago';
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
      return interval + ' hours ago';
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
      return interval + ' minutes ago';
    }
    return Math.floor(seconds) + ' seconds ago';
  }

  // Get hazard type display name
  function getHazardTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      flood: 'Flooding',
      pothole: 'Pothole',
      accident: 'Accident',
      obstruction: 'Obstruction',
      landslide: 'Landslide',
      tree: 'Fallen Tree',
      collapse: 'Road Collapse',
      other: 'Other'
    };

    return typeMap[type] || type;
  }

  // Get hazard severity chip class
  function getHazardSeverityClass(severity: Hazard['severity']): string {
    switch (severity) {
      case 'passable':
        return 'severity-passable';
      case 'one_lane':
        return 'severity-one-lane';
      case 'impassable':
        return 'severity-impassable';
      default:
        return 'severity-unknown';
    }
  }

  // Get hazard status chip class
  function getHazardStatusClass(status: Hazard['status']): string {
    switch (status) {
      case 'unconfirmed':
        return 'status-unconfirmed';
      case 'needs_verification':
        return 'status-needs-verification';
      case 'hazard_active':
        return 'status-active';
      case 'hazard_cleared':
        return 'status-cleared';
      case 'expired':
        return 'status-expired';
      default:
        return 'status-unknown';
    }
  }

  // Open flag detail view
  function openFlagDetail(flag: HazardFlag) {
    selectedFlag = flag;
    isFlagDetailOpen = true;
    removeReason = '';
    showRemoveForm = false;
  }

  // Close flag detail view
  function closeFlagDetail() {
    selectedFlag = null;
    isFlagDetailOpen = false;
    removeReason = '';
    showRemoveForm = false;
  }

  // Expire hazard (confirm as expired)
  async function expireHazard(flag: HazardFlag) {
    if (!isAuthorized) return;

    if (!window.confirm('Expire this hazard? This will mark it as expired and resolve all associated flags.')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('moderate_hazard', {
        p_flag_id: flag.id,
        p_action: 'expire',
        p_reason: null
      });

      if (error) throw error;

      successMessage = 'Hazard expired successfully';
      await loadHazardFlags(); // Refresh the queue
    } catch (err) {
      console.error('Error expiring hazard:', err);
      errorMessage = 'Failed to expire hazard: ' + (err.message || 'Unknown error');
    }
  }

  // Remove hazard (with reason and reporter notification)
  async function removeHazard(flag: HazardFlag) {
    if (!isAuthorized) return;

    if (!removeReason.trim()) {
      errorMessage = 'Please provide a reason for removing this hazard';
      return;
    }

    if (!window.confirm(`Remove this hazard? This will:\n- Mark the hazard as expired\n- Notify the reporter\n- Deduct 10 reputation points from the reporter\n- Resolve all flags as 'removed'\n\nReason: ${removeReason}`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('moderate_hazard', {
        p_flag_id: flag.id,
        p_action: 'remove',
        p_reason: removeReason
      });

      if (error) throw error;

      successMessage = 'Hazard removed successfully';
      await loadHazardFlags(); // Refresh the queue
      closeFlagDetail();
    } catch (err) {
      console.error('Error removing hazard:', err);
      errorMessage = 'Failed to remove hazard: ' + (err.message || 'Unknown error');
    }
  }

  // Dismiss flag (no action on hazard)
  async function dismissFlag(flagId: string) {
    if (!isAuthorized) return;

    if (!window.confirm('Dismiss this flag? This will resolve the flag as "dismissed" with no action on the hazard.')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('moderate_hazard', {
        p_flag_id: flagId,
        p_action: 'dismiss',
        p_reason: null
      });

      if (error) throw error;

      successMessage = 'Flag dismissed successfully';
      await loadHazardFlags(); // Refresh the queue
    } catch (err) {
      console.error('Error dismissing flag:', err);
      errorMessage = 'Failed to dismiss flag: ' + (err.message || 'Unknown error');
    }
  }

  // Page load
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) {
      isLoading = false;
      return;
    }

    isAuthorized = true;
    await loadHazardFlags();
    await loadPublishedAdvisories();
  });
</script>

{#if isLoading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <p>Loading moderation queue...</p>
  </div>
{:else if errorMessage}
  <div class="error-banner">{errorMessage}</div>
{:else}
  <div class="admin-moderation-container">
    <header class="moderation-header">
      <h1>Moderation Queue</h1>
      <p class="moderation-subtitle">Review and act on hazard flags and published advisories</p>
    </header>

    <section class="flags-section">
      <h2>Open Flags Queue</h2>
      {#if hazardFlags.length === 0}
        <div class="empty-state">
          <p>No flags in the moderation queue.</p>
        </div>
      {:else}
        <div class="flags-list">
          {#each hazardFlags as flag}
            <div class="flag-item" on:click={() => openFlagDetail(flag)}>
              <div class="flag-content">
                <div class="flag-thumbnail">
                  {#if flag.hazard.photo_url}
                    <img src={flag.hazard.photo_url} alt="Hazard photo" on:error={() => { this.src = placeholderImage }} />
                  {:else}
                    <div class="no-photo">—</div>
                  {/if}
                </div>
                <div class="flag-details">
                  <div class="flag-title">
                    <span class="hazard-tag">{getHazardTypeName(flag.hazard.hazard_type)}</span>
                    <span class="separator">·</span>
                    <span class="hazard-street">
                      <!-- In a real app, we'd reverse geocode to get street name -->
                      Lat: {flag.hazard.location[1].toFixed(4)}, Lng: {flag.hazard.location[0].toFixed(4)}
                    </span>
                  </div>
                  <div class="flag-meta">
                    <p class="flag-reason">"{flag.reason || 'No reason provided'}"</p>
                    <div class="flag-info">
                      <span class="flagger-name">
                        {#if flag.flagger.full_name}
                          {flag.flagger.full_name}
                        {:else}
                          {flag.flagger.email.split('@')[0]}
                        {/if}
                        </span>
                        <span class="flag-time">{formatTimeAgo(flag.created_at)}</span>
                    </div>
                  </div>
                  <div class="flag-excerpt">
                    {#if flag.hazard.description}
                      {flag.hazard.description.length > 100
                        ? flag.hazard.description.substring(0, 100) + '...'
                        : flag.hazard.description}
                    {:else}
                      No description provided
                    {/if}
                  </div>
                </div>
                <div class="flag-actions-preview">
                  <span class="action-count">3 actions</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Flag Detail Drawer -->
    {#if isFlagDetailOpen && selectedFlag}
      <div class="detail-overlay" on:click={closeFlagDetail}>
        <div class="detail-drawer" on:click={event => event.stopPropagation()}>
          <div class="detail-header">
            <h2>Flag Details</h2>
            <button on:click={closeFlagDetail} class="btn-close">×</button>
          </div>
          <div class="detail-content">
            <div class="flag-info-section">
              <h3>Hazard Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Tag:</span>
                  <span class="info-value">{getHazardTypeName(selectedFlag.hazard.hazard_type)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Severity:</span>
                  <span class="info-value severity-{getHazardSeverityClass(selectedFlag.hazard.severity)}">
                    {#if selectedFlag.hazard.severity === 'passable'}
                      Passable
                    {:else if selectedFlag.hazard.severity === 'one_lane'}
                      One lane
                    {:else}
                      Impassable
                    {/if}
                    </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status:</span>
                  <span class="info-value status-{getHazardStatusClass(selectedFlag.hazard.status)}">
                    {#if selectedFlag.hazard.status === 'unconfirmed'}
                      Unconfirmed
                    {:else if selectedFlag.hazard.status === 'needs_verification'}
                      Needs Verification
                    {:else if selectedFlag.hazard.status === 'hazard_active'}
                      Active
                    {:else if selectedFlag.hazard.status === 'hazard_cleared'}
                      Cleared
                    {:else}
                      Expired
                    {/if}
                    </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Reported:</span>
                  <span class="info-value">{formatTimeAgo(selectedFlag.hazard.created_at)}</span>
                </div>
                {#if selectedFlag.hazard.photo_url}
                  <div class="info-item">
                    <span class="info-label">Photo:</span>
                    <div class="info-value">
                      <img src={selectedFlag.hazard.photo_url} alt="Hazard photo" style="max-width: 100px; max-height: 100px; border-radius: 4px;">
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="flag-info-section">
              <h3>Flag Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Flager:</span>
                  <span class="info-value">
                    {#if selectedFlag.flagger.full_name}
                      {selectedFlag.flagger.full_name}
                    {:else}
                      {selectedFlag.flagger.email.split('@')[0]}
                    {/if}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Flag Time:</span>
                  <span class="info-value">{formatTimeAgo(selectedFlag.created_at)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Reason:</span>
                  <span class="info-value">"{selectedFlag.reason || 'No reason provided'}"</span>
                </div>
              </div>
            </div>

            <div class="flag-info-section">
              <h3>Hazard Description</h3>
              <p class="description-text">
                {selectedFlag.hazard.description || 'No description provided'}
              </p>
            </div>

            <div class="flag-actions-section">
              <h3>Actions</h3>
              <div class="action-buttons">
                <button
                  on:click={() => expireHazard(selectedFlag)}
                  class="btn-action btn-expire"
                  disabled={false}
                >
                  Expire Hazard
                </button>
                <div class="action-divider">or</div>
                <button
                  on:click={() => { showRemoveForm = true; removeReason = ''; }}
                  class="btn-action btn-remove"
                >
                  Remove Hazard
                </button>
                <button
                  on:click={() => dismissFlag(selectedFlag.id)}
                  class="btn-action btn-dismiss"
                >
                  Dismiss Flag
                </button>
              </div>

              <!-- Remove reason input (shown when Remove button is clicked) -->
              {#if showRemoveForm}
                <div class="remove-reason-section">
                  <label for="remove-reason">Reason for removal:</label>
                  <textarea
                    id="remove-reason"
                    bind:value={removeReason}
                    rows="3"
                    placeholder="Please provide a detailed reason for removing this hazard..."
                    class="remove-reason-input"
                  ></textarea>
                  <div class="remove-reason-actions">
                    <button on:click={() => removeHazard(selectedFlag)} class="btn-action btn-confirm">
                      Confirm Removal
                    </button>
                    <button on:click={() => { removeReason = ''; showRemoveForm = false; }} class="btn-action btn-cancel">
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <section class="advisories-section">
      <h2>Published Advisories (Admin Oversight)</h2>
      {#if publishedAdvisories.length === 0}
        <div class="empty-state">
          <p>No published advisories.</p>
        </div>
      {:else}
        <div class="advisories-list">
          {#each publishedAdvisories as advisory}
            <div class="advisory-item">
              <div class="advisory-content">
                <div class="advisory-header">
                  <h3>{advisory.title}</h3>
                  <div class="advisory-meta">
                    <span class="advisory-type">{advisory.advisory_type}</span>
                    <span class="advisory-status">
                      {#if advisory.is_active}
                        <span class="status-chip status-active">Active</span>
                      {:else}
                        <span class="status-chip status-inactive">Inactive</span>
                      {/if}
                    </span>
                  </div>
                </div>
                {#if advisory.description}
                  <p class="advisory-description">{advisory.description}</p>
                {/if}
                <div class="advisory-actions">
                  <button
                    on:click={() => {
                      // Toggle advisory status
                      const newStatus = !advisory.is_active;
                      // Would call update advisory function here
                    }}
                    class="btn-action btn-{advisory.is_active ? 'danger' : 'success'}"
                  >
                    {#if advisory.is_active}
                      Deactivate
                    {:else}
                      Activate
                    {/if}
                    </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  .admin-moderation-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: var(--background);
    min-height: 100vh;
  }

  .moderation-header {
    margin-bottom: 24px;
  }

  .moderation-header h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: var(--primary-ink);
  }

  .moderation-subtitle {
    margin: 0 0 16px 0;
    color: var(--ink2);
    font-size: 1rem;
  }

  .flags-section,
  .advisories-section {
    margin-bottom: 24px;
  }

  .flags-section h2,
  .advisories-section h2 {
    margin: 0 0 16px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--ink2);
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    background: var(--danger-surface);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin-bottom: 20px;
    font-size: 0.875rem;
  }

  .flags-list,
  .advisories-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .flag-item,
  .advisory-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .flag-item:hover,
  .advisory-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-color: var(--primary);
  }

  .flag-content {
    display: flex;
    align-items: center;
    padding: 16px;
    gap: 16px;
  }

  .flag-thumbnail {
    width: 60px;
    height: 60px;
    border-radius: var(--r-s);
    overflow: hidden;
    background: var(--primary-surface);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flag-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-photo {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink2);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .flag-details {
    flex: 1;
    min-width: 0;
  }

  .flag-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .hazard-tag {
    background: var(--primary-surface);
    color: var(--primary);
    padding: 2px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .separator {
    color: var(--ink2);
    font-size: 0.75rem;
  }

  .hazard-street {
    font-size: 0.875rem;
    color: var(--ink2);
    font-family: var(--f);
  }

  .flag-meta {
    margin-bottom: 8px;
  }

  .flag-reason {
    font-style: italic;
    color: var(--ink);
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .flag-info {
    display: flex;
    gap: 12px;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .flagger-name {
    font-weight: 600;
  }

  .flag-time {
    font-family: var(--f);
  }

  .flag-excerpt {
    color: var(--ink2);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .flag-actions-preview {
    margin-top: 8px;
    font-size: 0.875rem;
    color: var(--primary);
  }

  .action-count {
    font-weight: 600;
  }

  /* Detail Drawer */
  .detail-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .detail-drawer {
    position: relative;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: var(--surface);
    border-radius: var(--r-l);
    overflow-y: auto;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }

  .detail-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--primary-ink);
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--ink2);
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close:hover {
    color: var(--ink);
  }

  .detail-content {
    padding: 24px;
  }

  .flag-info-section {
    margin-bottom: 24px;
  }

  .flag-info-section h3 {
    margin: 0 0 12px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-label {
    font-size: 0.875rem;
    color: var(--ink2);
    margin-bottom: 4px;
  }

  .info-value {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--primary-ink);
  }

  .description-text {
    margin: 16px 0;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--ink);
  }

  .flag-actions-section {
    margin-top: 24px;
  }

  .flag-actions-section h3 {
    margin: 0 0 12px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn-action {
    padding: 8px 16px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-expire {
    background: var(--warning);
    color: white;
  }

  .btn-expire:hover:not(:disabled) {
    background: var(--warning-dark);
  }

  .btn-remove {
    background: var(--danger);
    color: white;
  }

  .btn-remove:hover:not(:disabled) {
    background: var(--danger-dark);
  }

  .btn-dismiss {
    background: var(--surface);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  .btn-dismiss:hover:not(:disabled) {
    background: var(--primary-surface);
    color: white;
  }

  .action-divider {
    color: var(--ink2);
    font-size: 0.875rem;
    margin: 0 8px;
  }

  /* Remove reason section (when implemented) */
  .remove-reason-section {
    margin-top: 16px;
  }

  .remove-reason-section label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .remove-reason-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    font-size: 0.875rem;
    resize: vertical;
  }

  .remove-reason-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }

  .remove-reason-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    justify-content: flex-end;
  }

  .btn-confirm {
    background: var(--success);
    color: white;
  }

  .btn-confirm:hover:not(:disabled) {
    background: var(--success-dark);
  }

  .btn-cancel {
    background: var(--surface);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  .btn-cancel:hover:not(:disabled) {
    background: var(--primary-surface);
  }

  /* Advisories section */
  .advisories-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .advisory-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  .advisory-content {
    padding: 16px;
  }

  .advisory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .advisory-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .advisory-meta {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .advisory-type {
    text-transform: capitalize;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .status-chip {
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-chip.active {
    background: var(--success-surface);
    color: var(--success);
  }

  .status-chip.inactive {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .advisory-description {
    margin: 0 0 12px 0;
    color: var(--ink2);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .advisory-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Dark mode adjustments */
  [data-theme=dark] .flag-item,
  [data-theme=dark] .advisory-item {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .flag-item:hover,
  [data-theme=dark] .advisory-item:hover {
    border-color: var(--primary);
  }

  [data-theme=dark] .flag-thumbnail {
    background: var(--primary-surface);
  }

  [data-theme=dark] .no-photo {
    color: var(--ink2);
  }

  [data-theme=dark] .detail-drawer {
    background: var(--surface);
  }

  [data-theme=dark] .info-value {
    color: var(--primary-ink);
  }

  [data-theme=dark] .description-text {
    background: var(--surface);
    border-color: var(--border);
    color: var(--ink);
  }

  [data-theme=dark] .status-chip.active {
    background: var(--success-surface);
    color: var(--success);
  }

  [data-theme=dark] .status-chip.inactive {
    background: var(--danger-surface);
    color: var(--danger);
  }

  [data-theme=dark] .btn-expire {
    background: var(--warning);
    color: white;
  }

  [data-theme=dark] .btn-remove {
    background: var(--danger);
    color: white;
  }

  [data-theme=dark] .btn-dismiss {
    background: var(--surface);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  [data-theme=dark] .btn-dismiss:hover:not(:disabled) {
    background: var(--primary-surface);
    color: white;
  }

  [data-theme=dark] .advisory-item {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .advisory-item:hover {
    border-color: var(--primary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .admin-moderation-container {
      padding: 16px;
    }

    .moderation-header {
      flex-direction: column;
      align-items: stretch;
    }

    .moderation-header h1 {
      text-align: center;
    }

    .flags-section,
    .advisories-section {
      margin-bottom: 16px;
    }

    .flag-content {
      flex-wrap: wrap;
    }

    .flag-thumbnail {
      width: 50px;
      height: 50px;
      margin-bottom: 12px;
    }

    .flag-details {
      width: 100%;
    }

    .detail-drawer {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }
  }

  @media (max-width: 480px) {
    .flag-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .flag-thumbnail {
      width: 100%;
      height: 200px;
    }

    .flag-details {
      width: 100%;
      margin-top: 16px;
    }

    .flag-title {
      justify-content: center;
    }

    .hazard-street {
      text-align: center;
      margin-bottom: 8px;
    }

    .flag-meta {
      flex-wrap: wrap;
      justify-content: center;
    }

    .flag-info {
      justify-content: center;
    }

    .flag-excerpt {
      text-align: center;
    }

    .flag-actions-preview {
      margin-top: 16px;
      text-align: center;
    }

    .action-buttons {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-action {
      width: 100%;
      margin-bottom: 8px;
    }

    .advisory-content {
      text-align: center;
    }

    .advisory-actions {
      justify-content: center;
    }
  }
</style>