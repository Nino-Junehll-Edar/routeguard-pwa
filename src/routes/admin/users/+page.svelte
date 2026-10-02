<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

  let profiles: UserProfile[] = [];
  let filteredProfiles: UserProfile[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let searchTerm = '';
  let isAuthorized = false;
  let authLoading = true;
  let selectedProfile: UserProfile | null = null;
  let isDrawerOpen = false;
  let roleLoading = false;
  let roleError: string | null = null;
  let suspensionLoading = false;
  let suspensionError: string | null = null;
  let reputationEvents: ReputationEvent[] = [];
  let recentReports: Hazard[] = [];

  // Types
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

  interface ReputationEvent {
    id: string;
    user_id: string;
    points: number;
    event_type: string;
    description: string;
    created_at: string;
  }

  interface Hazard {
    id: string;
    hazard_type: string;
    status: 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
    location: [number, number]; // [lng, lat]
    description: string | null;
    reporter_id: string | null;
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

  // Load profiles
  async function loadProfiles() {
    if (!isAuthorized) return;

    isLoading = true;
    errorMessage = null;
    successMessage = null;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      profiles = data as UserProfile[];
      applyFilter();
    } catch (err) {
      console.error('Error loading profiles:', err);
      errorMessage = 'Failed to load user profiles. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Load reputation events for a user
  async function loadReputationEvents(userId: string) {
    try {
      const { data, error } = await supabase
        .from('reputation_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      reputationEvents = data as ReputationEvent[];
    } catch (err) {
      console.error('Error loading reputation events:', err);
      reputationEvents = [];
    }
  }

  // Load recent reports (hazards) for a user
  async function loadRecentReports(userId: string) {
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('*')
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      recentReports = data as Hazard[];
    } catch (err) {
      console.error('Error loading recent reports:', err);
      recentReports = [];
    }
  }

  // Apply search filter
  function applyFilter() {
    if (!searchTerm.trim()) {
      filteredProfiles = profiles;
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    filteredProfiles = profiles.filter(profile =>
      (profile.full_name?.toLowerCase().includes(searchLower) ||
       profile.email.toLowerCase().includes(searchLower))
    );
  }

  // Handle search change
  function handleSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;
    applyFilter();
  }

  // Open profile drawer
  function openProfileDrawer(profile: UserProfile) {
    selectedProfile = profile;
    isDrawerOpen = true;
    loadReputationEvents(profile.id);
    loadRecentReports(profile.id);
  }

  // Close profile drawer
  function closeProfileDrawer() {
    selectedProfile = null;
    isDrawerOpen = false;
    reputationEvents = [];
    recentReports = [];
  }

  // Change user role
  async function changeRole(profile: UserProfile, newRole: 'common_user' | 'agency_personnel' | 'admin') {
    if (!isAuthorized) return;

    // Prevent self role changes
    const currentUser = get(user);
    if (currentUser && profile.id === currentUser.id) {
      errorMessage = 'You cannot change your own role';
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Changing user role to ${newRole} is audit-logged and the user will be notified. Continue?`)) {
      return;
    }

    roleLoading = true;
    roleError = null;

    try {
      const { error } = await supabase.rpc('admin_set_role', {
        p_user: profile.id,
        p_role: newRole
      });

      if (error) throw error;

      // Update local data
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index !== -1) {
        profiles[index].role = newRole;
        applyFilter();
      }

      if (selectedProfile && selectedProfile.id === profile.id) {
        selectedProfile.role = newRole;
      }

      successMessage = `User role changed to ${newRole}`;
    } catch (err) {
      console.error('Error changing role:', err);
      roleError = err.message || 'Failed to change role';
      errorMessage = roleError;
    } finally {
      roleLoading = false;
    }
  }

  // Toggle user suspension
  async function toggleSuspension(profile: UserProfile) {
    if (!isAuthorized) return;

    // Prevent self suspension
    const currentUser = get(user);
    if (currentUser && profile.id === currentUser.id) {
      errorMessage = 'You cannot suspend yourself';
      return;
    }

    suspensionLoading = true;
    suspensionError = null;

    try {
      let reason = '';
      if (!profile.is_suspended) {
        // Suspending requires a reason
        reason = window.prompt('Please provide a reason for suspending this user:');
        if (reason === null) {
          // User canceled
          suspensionLoading = false;
          return;
        }
        if (reason.trim() === '') {
          errorMessage = 'Please provide a reason for suspension';
          suspensionLoading = false;
          return;
        }
      }

      const { error } = await supabase.rpc('admin_set_suspension', {
        p_user: profile.id,
        p_suspend: !profile.is_suspended,
        p_reason: profile.is_suspended ? null : reason
      });

      if (error) throw error;

      // Update local data
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index !== -1) {
        profiles[index].is_suspended = !profile.is_suspended;
        profiles[index].suspension_reason = profile.is_suspended ? null : reason;
        applyFilter();
      }

      if (selectedProfile && selectedProfile.id === profile.id) {
        selectedProfile.is_suspended = !profile.is_suspended;
        selectedProfile.suspension_reason = profile.is_suspended ? null : reason;
      }

      successMessage = profile.is_suspended ? 'User reactivated' : 'User suspended';
    } catch (err) {
      console.error('Error toggling suspension:', err);
      suspensionError = err.message || 'Failed to update suspension status';
      errorMessage = suspensionError;
    } finally {
      suspensionLoading = false;
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

  // Get role chip class and label
  function getRoleInfo(role: UserProfile['role']) {
    switch (role) {
      case 'common_user':
        return { class: 'role-common', label: 'Community' };
      case 'agency_personnel':
        return { class: 'role-agency', label: 'Agency' };
      case 'admin':
        return { class: 'role-admin', label: 'Admin' };
      default:
        return { class: 'role-unknown', label: 'Unknown' };
    }
  }

  // Get status chip class and label
  function getStatusInfo(isSuspended: boolean) {
    if (isSuspended) {
      return { class: 'status-suspended', label: 'Suspended' };
    } else {
      return { class: 'status-active', label: 'Active' };
    }
  }

  // Get reputation event class based on points
  function getReputationClass(points: number) {
    return points >= 0 ? 'positive' : 'negative';
  }

  // Get reputation event sign
  function getReputationSign(points: number) {
    return points >= 0 ? '+' : '';
  }

  // Get hazard status chip class
  function getHazardStatusClass(status: Hazard['status']) {
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

  // Page load
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) {
      isLoading = false;
      return;
    }

    isAuthorized = true;
    await loadProfiles();
  });
</script>

{#if isLoading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <p>Loading dashboard...</p>
  </div>
{:else if errorMessage}
  <div class="error-banner">{errorMessage}</div>
{:else}
  <div class="admin-users-container">
    <header class="users-header">
      <h1>User Management</h1>
      <p class="users-subtitle">Manage user profiles, roles, and suspensions</p>
    </header>

    <section class="users-search">
      <div class="search-wrapper">
        <input
          type="text"
          placeholder="Search by name or email..."
          bind:value={searchTerm}
          on:input={handleSearchChange}
          class="search-input"
        />
        <button on:click={() => { searchTerm = ''; applyFilter(); }} class="search-clear">
          ×
        </button>
      </div>
      <p class="search-info">Showing {filteredProfiles.length} of {profiles.length} users</p>
    </section>

    <div class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Points</th>
            <th>Status</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#if filteredProfiles.length === 0}
            <tr>
              <td colspan="7" class="empty-state">
                {#if searchTerm}
                  No users match "{searchTerm}".
                {:else}
                  No users found.
                {/if}
              </td>
            </tr>
          {:else}
            {#each filteredProfiles as profile}
              <tr class="user-row" on:click={() => openProfileDrawer(profile)}>
                <td class="user-name">
                  <div class="user-info">
                    <div class="user-initials">
                      {#if profile.full_name}
                        {(profile.full_name.match(/\b\w/g) || []).slice(0,2).join('').toUpperCase()}
                      {:else}
                        {(profile.email.match(/^[^@]/) || ['?'])[0].toUpperCase()}
                      {/if}
                    </div>
                    <div class="user-details">
                      <div class="user-name-bold">{profile.full_name || profile.email.split('@')[0]}</div>
                      <div class="user-email">{profile.email}</div>
                    </div>
                  </div>
                </td>
                <td>{profile.email}</td>
                <td>
                  <span class="role-chip role-{getRoleInfo(profile.role).class.split('-')[1]}">{getRoleInfo(profile.role).label}</span>
                </td>
                <td class="points-column">{profile.reputation_points}</td>
                <td>
                  <span class="status-chip status-{getStatusInfo(profile.is_suspended).class.split('-')[1]}">{getStatusInfo(profile.is_suspended).label}</span>
                </td>
                <td class="joined-column">{formatTimeAgo(profile.created_at)}</td>
                <td class="actions-column">
                  <button class="btn-detail">View Details</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Profile Drawer -->
    {#if isDrawerOpen && selectedProfile}
      <div class="drawer-overlay" on:click={closeProfileDrawer}>
        <div class="drawer" on:click={event => event.stopPropagation()}>
          <div class="drawer-header">
            <h2>User Details</h2>
            <button on:click={closeProfileDrawer} class="btn-close">×</button>
          </div>
          <div class="drawer-content">
            <div class="identity-block">
              <div class="identity-avatar">
                <div class="identity-initials">
                  {#if selectedProfile.full_name}
                    {(selectedProfile.full_name.match(/\b\w/g) || []).slice(0,2).join('').toUpperCase()}
                    {:else}
                    {(selectedProfile.email.match(/^[^@]/) || ['?'])[0].toUpperCase()}
                  {/if}
                </div>
              </div>
              <div class="identity-info">
                <div class="identity-name">{selectedProfile.full_name || 'No name provided'}</div>
                <div class="identity-email">{selectedProfile.email}</div>
              </div>
            </div>

            <div class="info-section">
              <h3>Account Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Role:</span>
                  <span class="info-value">
                    {#if roleLoading}
                      Loading...
                    {:else if roleError}
                      <span class="error">{roleError}</span>
                    {:else}
                      <select
                        bind:value={selectedProfile.role}
                        disabled={roleLoading}
                        on:change={async (event) => {
                          const target = event.target as HTMLSelectElement;
                          await changeRole(selectedProfile, target.value as 'common_user' | 'agency_personnel' | 'admin');
                        }}
                      >
                        <option value="common_user">Community</option>
                        <option value="agency_personnel">Agency</option>
                        <option value="admin">Admin</option>
                      </select>
                    {/if}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Reputation Points:</span>
                  <span class="info-value">{selectedProfile.reputation_points}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Member Since:</span>
                  <span class="info-value">{formatTimeAgo(selectedProfile.created_at)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status:</span>
                  <span class="info-value status-{selectedProfile.is_suspended ? 'suspended' : 'active'}">
                    {selectedProfile.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
                {#if selectedProfile.is_suspended && selectedProfile.suspension_reason}
                  <div class="info-item">
                    <span class="info-label">Suspension Reason:</span>
                    <span class="info-value">{selectedProfile.suspension_reason}</span>
                  </div>
                {/if}
              </div>
            </div>

            {#if reputationEvents.length > 0}
              <div class="info-section">
                <h3>Reputation History (20 latest)</h3>
                <div class="reputation-history">
                  {#each reputationEvents as event}
                    <div class="reputation-event {getReputationClass(event.points)}">
                      <span class="event-points">{getReputationSign(event.points)}${Math.abs(event.points)}</span>
                      <span class="event-description">{event.description}</span>
                      <span class="event-date">{formatTimeAgo(event.created_at)}</span>
                  </div>
                {/each}
                </div>
              </div>
            {/if}

            {#if recentReports.length > 0}
              <div class="info-section">
                <h3>Recent Reports</h3>
                <div class="reports-list">
                  {#each recentReports as report}
                    <div class="report-item">
                      <div class="report-tag">
                        {(
                          {
                            flood: 'Flooding',
                            pothole: 'Pothole',
                            accident: 'Accident',
                            obstruction: 'Obstruction',
                            landslide: 'Landslide',
                            tree: 'Fallen Tree',
                            collapse: 'Road Collapse',
                            other: 'Other'
                          }
                        )[report.hazard_type] || report.hazard_type}
                      </div>
                      <div class="report-street">
                        <!-- In a real app, we'd reverse geocode to get street name -->
                        Lat: {report.location[1].toFixed(4)}, Lng: {report.location[0].toFixed(4)}
                      </div>
                      <div class="report-status">
                        <span class="status-chip status-{getHazardStatusClass(report.status)}">
                          {#if report.status === 'unconfirmed'}
                            Unconfirmed
                          {:else if report.status === 'needs_verification'}
                            Needs Verification
                          {:else if report.status === 'hazard_active'}
                            Active
                          {:else if report.status === 'hazard_cleared'}
                            Cleared
                          {:else}
                            Expired
                          {/if}
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .admin-users-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: var(--background);
    min-height: 100vh;
  }

  .users-header {
    margin-bottom: 24px;
  }

  .users-header h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: var(--primary-ink);
  }

  .users-subtitle {
    margin: 0 0 16px 0;
    color: var(--ink2);
    font-size: 1rem;
  }

  .users-search {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    padding: 20px;
    margin-bottom: 24px;
  }

  .search-wrapper {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .search-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }

  .search-clear {
    padding: 0;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--ink2);
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: var(--r-s);
  }

  .search-clear:hover {
    background: var(--primary-surface);
  }

  .search-info {
    color: var(--ink2);
    font-size: 0.875rem;
    text-align: right;
  }

  .users-table-container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th,
  .users-table td {
    padding: 16px 20px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .users-table th {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--surface);
  }

  .user-name {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .user-initials {
    width: 36px;
    height: 36px;
    background: var(--primary-surface);
    color: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .user-details {
    display: flex;
    flex-direction: column;
  }

  .user-name-bold {
    font-weight: 600;
    color: var(--primary-ink);
    font-size: 0.875rem;
  }

  .user-email {
    color: var(--ink2);
    font-size: 0.75rem;
  }

  .points-column {
    text-align: center;
    font-weight: 600;
    color: var(--primary-ink);
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

  .status-chip.suspended {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .joined-column {
    text-align: center;
    color: var(--ink2);
    font-size: 0.875rem;
  }

  .actions-column {
    text-align: center;
  }

  .btn-detail {
    background: var(--primary-surface);
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: var(--r-s);
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-detail:hover {
    background: var(--primary);
    color: white;
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

  /* Profile Drawer */
  .drawer-overlay {
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

  .drawer {
    position: relative;
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    background: var(--surface);
    border-radius: var(--r-l);
    overflow-y: auto;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }

  .drawer-header h2 {
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

  .drawer-content {
    padding: 24px;
  }

  .identity-block {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
  }

  .identity-avatar {
    width: 60px;
    height: 60px;
    background: var(--primary-surface);
    color: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.5rem;
  }

  .identity-info {
    display: flex;
    flex-direction: column;
  }

  .identity-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .identity-email {
    color: var(--ink2);
    font-size: 0.9rem;
  }

  .info-section {
    margin-bottom: 24px;
  }

  .info-section h3 {
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

  .info-value.error {
    color: var(--danger);
  }

  .reputation-history {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reputation-event {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    font-size: 0.875rem;
  }

  .reputation-event.positive {
    border-left: 3px solid var(--success);
  }

  .reputation-event.negative {
    border-left: 3px solid var(--danger);
  }

  .event-points {
    font-weight: 600;
    min-width: 24px;
    text-align: center;
  }

  .event-description {
    flex: 1;
    margin: 0 12px;
    color: var(--ink2);
    font-size: 0.875rem;
  }

  .event-date {
    color: var(--ink2);
    font-size: 0.75rem;
  }

  .reports-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .report-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-s);
  }

  .report-tag {
    background: var(--primary-surface);
    color: var(--primary);
    padding: 2px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .report-street {
    color: var(--ink2);
    font-size: 0.875rem;
  }

  .report-status {
    display: flex;
    align-items: center;
  }

  /* Dark mode adjustments */
  [data-theme=dark] .users-table-container,
  [data-theme=dark] .users-search {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .users-table th {
    background: var(--surface);
  }

  [data-theme=dark] .user-initials,
  [data-theme=dark] .identity-avatar,
  [data-theme=dark] .btn-detail {
    background: var(--primary-surface);
    color: var(--primary);
  }

  [data-theme=dark] .status-chip.active {
    background: var(--success-surface);
    color: var(--success);
  }

  [data-theme=dark] .status-chip.suspended {
    background: var(--danger-surface);
    color: var(--danger);
  }

  [data-theme=dark] .reputation-event,
  [data-theme=dark] .report-item {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .reputation-event.positive {
    border-left: 3px solid var(--success);
  }

  [data-theme=dark] .reputation-event.negative {
    border-left: 3px solid var(--danger);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .admin-users-container {
      padding: 16px;
    }

    .users-table th,
    .users-table td {
      padding: 12px 16px;
    }

    .user-name {
      flex-wrap: wrap;
    }

    .user-initials {
      width: 30px;
      height: 30px;
      font-size: 0.875rem;
    }

    .user-details {
      min-width: 100px;
    }

    .user-name-bold {
      font-size: 0.75rem;
    }

    .user-email {
      font-size: 0.7rem;
    }

    .points-column {
      font-size: 0.875rem;
    }

    .joined-column {
      font-size: 0.75rem;
    }

    .info-section h3 {
      font-size: 1rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .drawer {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }
  }

  @media (max-width: 480px) {
    .users-table th,
    .users-table td {
      padding: 8px 12px;
      font-size: 0.75rem;
    }

    .user-initials {
      width: 24px;
      height: 24px;
      font-size: 0.75rem;
    }

    .identity-avatar {
      width: 48px;
      height: 48px;
      font-size: 1.25rem;
    }

    .users-table th {
      text-align: left;
    }

    .users-table td {
      display: block;
    }

    .users-table td:nth-of-type(1) {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .users-table td:nth-of-type(2),
    .users-table td:nth-of-type(3),
    .users-table td:nth-of-type(4),
    .users-table td:nth-of-type(5),
    .users-table td:nth-of-type(6),
    .users-table td:nth-of-type(7) {
      display: block;
    }
  }
</style>