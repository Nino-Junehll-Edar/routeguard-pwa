<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user, profile } from '$lib/authStore';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { formatDistanceToNow } from 'date-fns';
  import CommandMapPanel from '$lib/components/CommandMapPanel.svelte';

  // Types
  interface HazardStat {
    count: number;
    label: string;
    tone?: 'normal' | 'incoming' | 'verified' | 'cleared';
  }

  interface UserStats {
    totalProfiles: number;
    suspendedUsers: number;
  }

  interface RequestStats {
    pendingRequests: number;
  }

  interface FlagStats {
    openFlags: number;
  }

  // Stores for data
  const openHazardsCount = writable<number>(0);
  const reports24hCount = writable<number>(0);
  const pendingRequestsCount = writable<number>(0);
  const openFlagsCount = writable<number | null>(null);
  const suspendedUsersCount = writable<number | null>(null);
  const communityMembersCount = writable<number>(0);
  const loading = writable<boolean>(true);
  const error = writable<string | null>(null);
  let hazardsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  let agencyRequestsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  let profilesRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

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
      error.set('Unable to verify your administrator account. Please sign in again.');
      goto('/auth');
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

  // Load stats
  async function loadStats() {
    try {
      // Open hazards (NOT IN (hazard_cleared, expired))
      const { count: openHazardsCountValue, error: openHazardsError } = await supabase
        .from('hazards')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '(hazard_cleared,expired)');

      if (openHazardsError) throw openHazardsError;
      openHazardsCount.set(openHazardsCountValue ?? 0);

      // Reports in last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: reports24hCountValue, error: reports24hError } = await supabase
        .from('hazards')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo);

      if (reports24hError) throw reports24hError;
      reports24hCount.set(reports24hCountValue ?? 0);

      // Pending agency requests
      const { count: pendingRequestsCountValue, error: pendingRequestsError } = await supabase
        .from('agency_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingRequestsError) throw pendingRequestsError;
      pendingRequestsCount.set(pendingRequestsCountValue ?? 0);

      openFlagsCount.set(null);
      suspendedUsersCount.set(null);

      // Community members (total profiles with role common_user)
      const { count: communityMembersCountValue, error: communityMembersError } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'common_user');

      if (communityMembersError) throw communityMembersError;
      communityMembersCount.set(communityMembersCountValue ?? 0);
    } catch (err) {
      console.error('Error loading admin stats:', err);
      error.set('Failed to load dashboard data. Please try again.');
    }
  }

  // Format time ago
  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // Initialize real-time subscriptions
  function setupRealtime() {
    // Hazards changes
    hazardsRealtimeChannel = supabase.channel('admin-overview-hazards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hazards' },
        () => {
          loadStats();
        }
      )
      .subscribe();

    // Agency requests changes
    agencyRequestsRealtimeChannel = supabase.channel('admin-overview-agency-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agency_requests' },
        () => {
          loadStats();
        }
      )
      .subscribe();

    // User profiles changes
    profilesRealtimeChannel = supabase.channel('admin-overview-user-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => {
          loadStats();
        }
      )
      .subscribe();
  }

  // Page load
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) {
      loading.set(false);
      return;
    }

    if (window.location.hash !== '#overview') {
      await goto('/admin/agency-requests', { replaceState: true });
      return;
    }

    await loadStats();
    setupRealtime();
    loading.set(false);
  });

  onDestroy(() => {
    if (hazardsRealtimeChannel) void supabase.removeChannel(hazardsRealtimeChannel);
    if (agencyRequestsRealtimeChannel) void supabase.removeChannel(agencyRequestsRealtimeChannel);
    if (profilesRealtimeChannel) void supabase.removeChannel(profilesRealtimeChannel);
  });
</script>

{#if $loading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <p>Loading dashboard...</p>
  </div>
{:else if $error}
  <div class="error-banner">{$error}</div>
{:else}
  <div class="admin-console">
    <header class="console-header">
      <div class="user-greeting">
        <h1>Good day, {$profile?.full_name || 'Admin'}</h1>
        <p class="console-subtitle">System administration overview</p>
        <span class="verified-badge">System administrator</span>
      </div>
    </header>

    <section class="stats-section">
      <div class="stats-grid">
        <!-- Open hazards card -->
        <div class="stat-card">
          <div class="stat-value">{$openHazardsCount}</div>
          <div class="stat-label">Open hazards</div>
        </div>

        <!-- Reports 24h card -->
        <div class="stat-card">
          <div class="stat-value {$reports24hCount > 0 ? 'pending' : 'normal'}">
            {$reports24hCount}
          </div>
          <div class="stat-label">Reports · 24 h</div>
        </div>

        <!-- Pending requests card -->
        <div class="stat-card">
          <div class="stat-value {$pendingRequestsCount > 0 ? 'pending' : 'normal'}">
            {$pendingRequestsCount}
          </div>
          <div class="stat-label">Pending requests</div>
        </div>

        <!-- Open flags card -->
        <div class="stat-card">
          <div class="stat-value {$openFlagsCount !== null && $openFlagsCount > 0 ? 'pending' : 'normal'}">
            {$openFlagsCount ?? '—'}
          </div>
          <div class="stat-label">Open flags</div>
        </div>

        <!-- Suspended users card -->
        <div class="stat-card">
          <div class="stat-value">{$suspendedUsersCount ?? '—'}</div>
          <div class="stat-label">Suspended users</div>
        </div>

        <!-- Community members card -->
        <div class="stat-card">
          <div class="stat-value">{$communityMembersCount}</div>
          <div class="stat-label">Community members</div>
        </div>
      </div>
    </section>

    <CommandMapPanel />

    <section class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="actions-grid">
        <a href="/admin/agency-requests" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.54 5.82 22l-5-4.87L2 9.27l6.91-3.06L12 2z"/></svg>
          </div>
          <div class="action-content">
            <h3>Manage Agency Requests</h3>
            <p>Review and approve/reject agency access requests</p>
          </div>
        </a>

        <a href="/admin/users" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          </div>
          <div class="action-content">
            <h3>Manage Users</h3>
            <p>View and manage user profiles, roles, and suspensions</p>
          </div>
        </a>

        <a href="/admin/moderation" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 0h-4v2h4V3zm0 4h-4v2h4V7zm0 4h-4v2h4v-2zm4 6H9v-2h2v-2h2v2h2v-2h-2v-2z"/></svg>
          </div>
          <div class="action-content">
            <h3>Moderation Queue</h3>
            <p>Review and act on hazard flags and published advisories</p>
          </div>
        </a>

        <a href="/admin/audit" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2z"/></svg>
          </div>
          <div class="action-content">
            <h3>Audit Logs</h3>
            <p>View system activity and compliance records</p>
          </div>
        </a>
      </div>
    </section>
  </div>
{/if}

<style>
  .admin-console {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: var(--background);
    min-height: 100vh;
  }

  .console-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .user-greeting h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: var(--primary-ink);
  }

  .console-subtitle {
    margin: 0 0 12px 0;
    color: var(--ink2);
    font-size: 1rem;
  }

  .verified-badge {
    background: var(--primary-surface);
    color: var(--primary);
    padding: 4px 12px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid var(--primary);
  }

  .stats-section {
    margin-bottom: 24px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    padding: 20px;
    text-align: center;
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 8px;
    line-height: 1;
  }

  .stat-value.pending {
    color: var(--warning);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .quick-actions {
    margin-bottom: 24px;
  }

  .quick-actions h2 {
    margin: 0 0 16px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    padding: 20px;
    transition: all 0.2s ease;
    text-decoration: none;
    color: inherit;
  }

  .action-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-color: var(--primary);
  }

  .action-icon {
    width: 48px;
    height: 48px;
    background: var(--primary-surface);
    color: var(--primary);
    border-radius: var(--r-m);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    font-size: 1.5rem;
  }

  .action-content h3 {
    margin: 0 0 8px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .action-content p {
    margin: 0;
    color: var(--ink2);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .error-banner {
    background: var(--danger-surface);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin-bottom: 20px;
    font-size: 0.875rem;
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

  /* Dark mode adjustments */
  [data-theme=dark] .stat-card {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .action-card {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .action-card:hover {
    border-color: var(--primary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .admin-console {
      padding: 16px;
    }

    .console-header {
      flex-direction: column;
      align-items: stretch;
    }

    .user-greeting {
      text-align: center;
    }

    .verified-badge {
      align-self: center;
    }

    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>