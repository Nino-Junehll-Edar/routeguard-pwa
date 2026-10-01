<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import CommandMapPanel from '$lib/components/CommandMapPanel.svelte';
  import { normalizeHazardLocation } from '$lib/geoUtils';

  // Types
  interface HazardStat {
    count: number;
    label: string;
    tone?: 'normal' | 'incoming' | 'verified' | 'cleared';
  }

  interface AdvisoryStat {
    count: number;
    label: string;
  }

  interface Hazard {
    id: string;
    hazard_type: string;
    severity: 'passable' | 'one_lane' | 'impassable';
    status: 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
    location: [number, number]; // [lng, lat]
    description: string | null;
    reporter_id: string | null;
    created_at: string;
    updated_at: string;
  }

  interface Advisory {
    id: string;
    title: string;
    advisory_type: string;
    description: string | null;
    geometry: { type: string; coordinates: unknown } | null;
    start_time: string | null;
    end_time: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  // Stores for data
  const openHazardsCount = writable<number>(0);
  const needsVerificationCount = writable<number>(0);
  const activeAdvisoriesCount = writable<number>(0);
  const reports24hCount = writable<number>(0);
  const latestHazards = writable<Hazard[]>([]);
  const advisoriesList = writable<Advisory[]>([]);
  const loading = writable<boolean>(true);
  const error = writable<string | null>(null);

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
      return false;
    }

    // Check if user is agency personnel or admin
    if (profileData.role === 'agency_personnel' || profileData.role === 'admin') {
      return true;
    }

    // Not authorized, redirect to a safe default page
    goto('/map');
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

      // Needs verification (status = needs_verification)
      const { count: needsVerificationCountValue, error: needsVerificationError } = await supabase
        .from('hazards')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'needs_verification');

      if (needsVerificationError) throw needsVerificationError;
      needsVerificationCount.set(needsVerificationCountValue ?? 0);

      // Active advisories (is_active = true)
      const { count: activeAdvisoriesCountValue, error: activeAdvisoriesError } = await supabase
        .from('agency_advisories')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (activeAdvisoriesError) throw activeAdvisoriesError;
      activeAdvisoriesCount.set(activeAdvisoriesCountValue ?? 0);

      // Reports in last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: reports24hCountValue, error: reports24hError } = await supabase
        .from('hazards')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo);

      if (reports24hError) throw reports24hError;
      reports24hCount.set(reports24hCountValue ?? 0);
    } catch (err) {
      console.error('Error loading stats:', err);
      error.set('Failed to load dashboard data. Please try again.');
    }
  }

  // Load latest hazards (6 newest first)
  async function loadLatestHazards() {
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      latestHazards.set(data as Hazard[]);
    } catch (err) {
      console.error('Error loading latest hazards:', err);
      error.set('Failed to load latest hazards.');
    }
  }

  // Load advisories list
  async function loadAdvisories() {
    try {
      const { data, error } = await supabase
        .from('agency_advisories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      advisoriesList.set(data as Advisory[]);
    } catch (err) {
      console.error('Error loading advisories:', err);
      error.set('Failed to load advisories.');
    }
  }

  // Format time ago
  function formatTimeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    const units = [
      { value: 31536000, label: 'year' },
      { value: 2592000, label: 'month' },
      { value: 86400, label: 'day' },
      { value: 3600, label: 'hour' },
      { value: 60, label: 'minute' }
    ];

    for (const unit of units) {
      const amount = Math.floor(seconds / unit.value);
      if (amount >= 1) {
        return `${amount} ${unit.label}${amount === 1 ? '' : 's'} ago`;
      }
    }

    return `${Math.max(0, Math.floor(seconds))} seconds ago`;
  }

  // Get hazard status chip class and label
  function getHazardStatusInfo(status: Hazard['status']) {
    switch (status) {
      case 'unconfirmed':
        return { class: 'status-unconfirmed', label: 'Unconfirmed' };
      case 'needs_verification':
        return { class: 'status-needs-verification', label: 'Needs Verification' };
      case 'hazard_active':
        return { class: 'status-active', label: 'Active' };
      case 'hazard_cleared':
        return { class: 'status-cleared', label: 'Cleared' };
      case 'expired':
        return { class: 'status-expired', label: 'Expired' };
      default:
        return { class: 'status-unknown', label: 'Unknown' };
    }
  }

  // Get hazard severity chip class and label
  function getHazardSeverityInfo(severity: Hazard['severity']) {
    switch (severity) {
      case 'passable':
        return { class: 'severity-passable', label: 'Passable' };
      case 'one_lane':
        return { class: 'severity-one-lane', label: 'One lane' };
      case 'impassable':
        return { class: 'severity-impassable', label: 'Impassable' };
      default:
        return { class: 'severity-unknown', label: 'Unknown' };
    }
  }

  // Get hazard type display name and icon
  function getHazardTypeInfo(type: string) {
    const typeMap: Record<string, { name: string; icon: string }> = {
      flood: { name: 'Flooding', icon: 'water_drop' },
      pothole: { name: 'Pothole', icon: 'circle' },
      accident: { name: 'Accident', icon: 'car_crash' },
      obstruction: { name: 'Obstruction', icon: 'construction' },
      landslide: { name: 'Landslide', icon: 'terrain' },
      tree: { name: 'Fallen Tree', icon: 'forest' },
      collapse: { name: 'Road Collapse', icon: 'warning' },
      other: { name: 'Other', icon: 'help_outline' }
    };

    return typeMap[type] || { name: type, icon: 'help_outline' };
  }

  function formatHazardLocation(location: unknown): string {
    const coordinates = normalizeHazardLocation(location);
    if (!coordinates) return 'Location unavailable';
    const [longitude, latitude] = coordinates;
    return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
  }

  // Initialize real-time subscriptions
  function setupRealtime() {
    // Hazards changes
    supabase.channel('hazards-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hazards' },
        () => {
          loadStats();
          loadLatestHazards();
        }
      )
      .subscribe();

    // Agency advisories changes
    supabase.channel('advisories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agency_advisories' },
        () => {
          loadStats();
          loadAdvisories();
        }
      )
      .subscribe();
  }

  // Page load
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) return;

    await loadStats();
    await loadLatestHazards();
    await loadAdvisories();
    setupRealtime();
    loading.set(false);
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
  <div class="agency-console">
    <header class="console-header">
      <div class="user-greeting">
        <h1>Good day, {$profile?.full_name || 'User'}</h1>
        <p class="console-subtitle">Community hazards awaiting official action, and your published advisories.</p>
        <span class="verified-badge">LGU verified account</span>
      </div>
    </header>

    <section class="stats-section">
      <div class="stats-grid">
        <!-- Open hazards card -->
        <div class="stat-card">
          <div class="stat-value">{$openHazardsCount}</div>
          <div class="stat-label">Open hazards</div>
        </div>

        <!-- Needs verification card -->
        <div class="stat-card">
          <div class="stat-value status-{$needsVerificationCount > 0 ? 'needs-verification' : 'verified'}">
            {$needsVerificationCount}
          </div>
          <div class="stat-label">Needs verification</div>
        </div>

        <!-- Active advisories card -->
        <div class="stat-card">
          <div class="stat-value">{$activeAdvisoriesCount}</div>
          <div class="stat-label">Active advisories</div>
        </div>

        <!-- Reports 24h card -->
        <div class="stat-card">
          <div class="stat-value tone-{$reports24hCount > 0 ? 'incoming' : 'normal'}">
            {$reports24hCount}
          </div>
          <div class="stat-label">Reports · 24 h</div>
        </div>
      </div>
    </section>

    <CommandMapPanel />

    <section class="lists-section">
      <div class="latest-hazards" id="hazard-review">
        <h2>Latest hazards</h2>
        {#if $latestHazards.length === 0}
          <div class="empty-state">No hazards reported yet.</div>
        {:else}
          <ul class="hazards-list">
            {#each $latestHazards as hazard}
              <li class="hazard-item">
                <div class="hazard-info">
                  <div class="hazard-tag">
                    <span class="tag-chip">{getHazardTypeInfo(hazard.hazard_type).name}</span>
                  </div>
                  <div class="hazard-street">
                    <!-- In a real app, we'd reverse geocode to get street name -->
                    <!-- For now, showing coordinates -->
                    {formatHazardLocation(hazard.location)}
                  </div>
                </div>
                <div class="hazard-meta">
                  <span class="time-ago">{formatTimeAgo(hazard.created_at)}</span>
                  <span class="status-chip status-{getHazardStatusInfo(hazard.status).class.split('-')[1]}">{getHazardStatusInfo(hazard.status).label}</span>
                </div>
              </li>
            {/each}
          </ul>
          <div class="footer-link">
            <a href="/agency#hazard-review" data-sveltekit-reload>Open review queue →</a>
          </div>
        {/if}
      </div>

      <div class="advisories-list" id="advisories">
        <h2>Advisories</h2>
        {#if $advisoriesList.length === 0}
          <div class="empty-state">You haven't published advisories yet.</div>
        {:else}
          <ul class="advisories">
            {#each $advisoriesList as advisory}
              <li class="advisory-item">
                <div class="advisory-info">
                  <div class="advisory-title">{advisory.title}</div>
                  <div class="advisory-meta">
                    <span class="advisory-type">{advisory.advisory_type}</span>
                    <span class="advisory-window">
                      {#if advisory.start_time && advisory.end_time}
                        {new Date(advisory.start_time).toLocaleDateString()} – {new Date(advisory.end_time).toLocaleDateString()}
                      {:else if advisory.start_time}
                        From {new Date(advisory.start_time).toLocaleDateString()}
                      {:else if advisory.end_time}
                        Until {new Date(advisory.end_time).toLocaleDateString()}
                      {:else}
                        Open-ended
                      {/if}
                    </span>
                  </div>
                </div>
                <div class="advisory-status">
                  {#if advisory.is_active}
                    <span class="status-chip status-active">Active</span>
                  {:else}
                    <span class="status-chip status-inactive">Inactive</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
          <div class="footer-link">
            <a href="/agency#advisories" data-sveltekit-reload>Manage advisories →</a>
          </div>
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .agency-console {
    max-width: 1200px;
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

  .stat-value.needs-verification {
    color: var(--danger);
  }

  .stat-value.verified {
    color: var(--success);
  }

  .stat-value.incoming {
    color: var(--warning);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .lists-section {
    display: grid;
    gap: 24px;
  }

  .latest-hazards, .advisories-list {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  .latest-hazards h2, .advisories-list h2 {
    margin: 0;
    padding: 16px 20px;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-ink);
    border-bottom: 1px solid var(--border);
  }

  .hazards-list, .advisories {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .hazard-item, .advisory-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .hazard-item:last-child, .advisory-item:last-child {
    border-bottom: none;
  }

  .hazard-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .hazard-tag .tag-chip {
    background: var(--primary-surface);
    color: var(--primary);
    padding: 2px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .hazard-street {
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .hazard-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .time-ago {
    font-family: var(--f);
  }

  .status-chip {
    padding: 2px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-chip.unconfirmed {
    background: var(--slate-surface);
    color: var(--slate);
  }

  .status-chip.needs-verification {
    background: var(--warning-surface);
    color: var(--warning);
  }

  .status-chip.active {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .status-chip.cleared {
    background: var(--success-surface);
    color: var(--success);
  }

  .status-chip.expired {
    background: var(--surface);
    color: var(--ink2);
  }

  .advisory-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .advisory-item:last-child {
    border-bottom: none;
  }

  .advisory-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .advisory-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-ink);
    line-height: 1.3;
  }

  .advisory-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .advisory-type {
    text-transform: capitalize;
  }

  .advisory-window {
    font-family: var(--f);
  }

  .advisory-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .footer-link {
    display: flex;
    justify-content: flex-end;
    padding: 16px 20px;
    font-size: 0.875rem;
    color: var(--primary);
  }

  .footer-link a:hover {
    text-decoration: underline;
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

  /* Dark mode adjustments */
  [data-theme=dark] .stat-card {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .hazard-item,
  [data-theme=dark] .advisory-item {
    border-color: var(--border);
  }

  [data-theme=dark] .footer-link {
    color: var(--primary);
  }

  [data-theme=dark] .footer-link a:hover {
    text-decoration: underline;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .agency-console {
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

    .lists-section {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-value {
      font-size: 2rem;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .hazard-item, .advisory-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .hazard-meta, .advisory-meta, .advisory-status {
      align-self: flex-start;
    }

    .footer-link {
      justify-content: center;
      margin-top: 16px;
    }
  }
</style>