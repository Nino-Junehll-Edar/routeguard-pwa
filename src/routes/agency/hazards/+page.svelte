<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { supabase } from '$lib/supabaseClient';
  import { normalizeHazardLocation } from '$lib/geoUtils';
  import { filterHazards, type HazardAgeFilter } from '$lib/staffWorkflowUtils';

  type HazardStatus = 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
  type HazardSeverity = 'passable' | 'one_lane' | 'impassable';

  interface Hazard {
    id: string;
    hazard_type: string;
    description: string | null;
    location: unknown;
    shape: { type: string; coordinates: unknown } | null;
    photo_url: string | null;
    status: HazardStatus;
    severity: HazardSeverity;
    reporter_id: string | null;
    created_at: string;
    updated_at: string;
    expires_at: string;
  }

  let hazards: Hazard[] = [];
  let searchTerm = '';
  let statusFilter = 'all';
  let severityFilter = 'all';
  let ageFilter: HazardAgeFilter = 'all';
  let selectedHazard: Hazard | null = null;
  let isLoading = true;
  let isAuthorized = false;
  let errorMessage = '';
  let successMessage = '';
  let savingHazardId = '';
  let hazardChannel: ReturnType<typeof supabase.channel> | null = null;

  $: filteredHazards = filterHazards(hazards, searchTerm, statusFilter, severityFilter, ageFilter);

  async function authorize() {
    const currentUser = get(user);
    const currentProfile = get(profile);
    if (!currentUser) {
      await goto('/login');
      return false;
    }
    if (!currentProfile) return false;
    if (currentProfile.role === 'agency_personnel' || currentProfile.role === 'admin') return true;
    await goto('/map');
    return false;
  }

  async function loadHazards() {
    if (!isAuthorized) return;
    errorMessage = '';
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('id,hazard_type,description,location,shape,photo_url,status,severity,reporter_id,created_at,updated_at,expires_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      hazards = (data ?? []) as Hazard[];
    } catch (error) {
      console.error('Error loading agency hazard queue:', error);
      errorMessage = 'Could not load hazards. Try again.';
    } finally {
      isLoading = false;
    }
  }

  function clearFilters() {
    searchTerm = '';
    statusFilter = 'all';
    severityFilter = 'all';
    ageFilter = 'all';
  }

  function formatLocation(location: unknown) {
    const coordinates = normalizeHazardLocation(location);
    if (!coordinates) return 'Location unavailable';
    return `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  async function reviewHazard(hazard: Hazard, nextStatus: 'hazard_active' | 'hazard_cleared') {
    if (nextStatus === 'hazard_cleared' && !window.confirm('Mark this hazard as cleared? It will no longer be treated as an active road hazard.')) return;
    savingHazardId = hazard.id;
    errorMessage = '';
    successMessage = '';
    try {
      const { error } = await supabase.rpc('agency_review_hazard', {
        p_hazard_id: hazard.id,
        p_status: nextStatus
      });
      if (error) throw error;
      successMessage = nextStatus === 'hazard_active' ? 'Hazard marked active.' : 'Hazard marked cleared.';
      selectedHazard = null;
      await loadHazards();
    } catch (error) {
      console.error('Error reviewing hazard:', error);
      errorMessage = error instanceof Error ? error.message : 'Could not update hazard status.';
    } finally {
      savingHazardId = '';
    }
  }

  onMount(async () => {
    isAuthorized = await authorize();
    if (!isAuthorized) {
      isLoading = false;
      return;
    }
    await loadHazards();
    hazardChannel = supabase.channel('agency-hazard-review')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hazards' }, () => loadHazards())
      .subscribe();
  });

  onDestroy(() => {
    if (hazardChannel) void supabase.removeChannel(hazardChannel);
  });
</script>

<svelte:head>
  <title>Hazard Review | RouteGuard</title>
</svelte:head>

<main class="review-page">
  <header class="page-header">
    <div>
      <p class="eyebrow">Agency workspace</p>
      <h1>Hazard review</h1>
      <p>Inspect community reports and record official status decisions.</p>
    </div>
    <a class="back-link" href="/agency">Overview</a>
  </header>

  {#if errorMessage}<p class="feedback error" role="alert">{errorMessage}</p>{/if}
  {#if successMessage}<p class="feedback success" role="status">{successMessage}</p>{/if}

  <section class="filters" aria-label="Filter hazard reports">
    <label>Search reports
      <input bind:value={searchTerm} type="search" placeholder="Type, description, or coordinates" />
    </label>
    <label>Status
      <select bind:value={statusFilter}>
        <option value="all">All statuses</option>
        <option value="unconfirmed">Unconfirmed</option>
        <option value="needs_verification">Needs verification</option>
        <option value="hazard_active">Active</option>
        <option value="hazard_cleared">Cleared</option>
        <option value="expired">Expired</option>
      </select>
    </label>
    <label>Severity
      <select bind:value={severityFilter}>
        <option value="all">All severities</option>
        <option value="impassable">Impassable</option>
        <option value="one_lane">One lane</option>
        <option value="passable">Passable</option>
      </select>
    </label>
    <label>Reported
      <select bind:value={ageFilter}>
        <option value="all">Any time</option>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>
    </label>
    <button type="button" class="quiet-button" on:click={clearFilters}>Clear filters</button>
  </section>

  <div class="queue-heading">
    <h2>Reports</h2>
    <span>{filteredHazards.length} shown · latest 500 loaded</span>
  </div>

  {#if isLoading}
    <p class="empty-state">Loading reports…</p>
  {:else if filteredHazards.length === 0}
    <p class="empty-state">No reports match these filters.</p>
  {:else}
    <div class="review-layout">
      <section class="hazard-list" aria-label="Hazard reports">
        {#each filteredHazards as hazard (hazard.id)}
          <button class="hazard-row" class:selected={selectedHazard?.id === hazard.id} type="button" on:click={() => selectedHazard = hazard}>
            <span class="row-main">
              <strong>{hazard.hazard_type.replaceAll('_', ' ')}</strong>
              <span>{hazard.description || 'No description provided'}</span>
            </span>
            <span class="row-meta">
              <span class="status-chip" data-status={hazard.status}>{hazard.status.replaceAll('_', ' ')}</span>
              <span>{hazard.severity.replaceAll('_', ' ')}</span>
              <time datetime={hazard.created_at}>{formatDate(hazard.created_at)}</time>
            </span>
          </button>
        {/each}
      </section>

      {#if selectedHazard}
        <aside class="hazard-detail" aria-label="Selected hazard details">
          <div class="detail-heading">
            <h2>{selectedHazard.hazard_type.replaceAll('_', ' ')}</h2>
            <button type="button" class="quiet-button" on:click={() => selectedHazard = null}>Close</button>
          </div>
          <p>{selectedHazard.description || 'No description provided.'}</p>
          {#if selectedHazard.photo_url}
            <a href={selectedHazard.photo_url} target="_blank" rel="noreferrer"><img src={selectedHazard.photo_url} alt="Evidence for this hazard report" /></a>
          {/if}
          <dl>
            <div><dt>Status</dt><dd>{selectedHazard.status.replaceAll('_', ' ')}</dd></div>
            <div><dt>Severity</dt><dd>{selectedHazard.severity.replaceAll('_', ' ')}</dd></div>
            <div><dt>Coordinates</dt><dd>{formatLocation(selectedHazard.location)}</dd></div>
            <div><dt>Reported</dt><dd>{formatDate(selectedHazard.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDate(selectedHazard.updated_at)}</dd></div>
            <div><dt>Expires</dt><dd>{formatDate(selectedHazard.expires_at)}</dd></div>
          </dl>
          {#if selectedHazard.status !== 'expired'}
            <div class="decision-actions">
              <button type="button" class="active-button" disabled={savingHazardId === selectedHazard.id || selectedHazard.status === 'hazard_active'} on:click={() => reviewHazard(selectedHazard!, 'hazard_active')}>
                Mark active
              </button>
              <button type="button" class="clear-button" disabled={savingHazardId === selectedHazard.id || selectedHazard.status === 'hazard_cleared'} on:click={() => reviewHazard(selectedHazard!, 'hazard_cleared')}>
                Mark cleared
              </button>
            </div>
          {/if}
        </aside>
      {/if}
    </div>
  {/if}
</main>

<style>
  .review-page { max-width: 1440px; margin: 0 auto; padding: 28px 32px 48px; color: var(--ink); }
  .page-header, .queue-heading, .detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .page-header { margin-bottom: 24px; }
  .page-header h1 { margin: 0 0 8px; font-size: 1.8rem; }
  .page-header p { margin: 0; color: var(--ink2); }
  .eyebrow { margin-bottom: 8px !important; color: var(--primary) !important; font-size: .75rem; font-weight: 800; text-transform: uppercase; }
  .back-link { color: var(--primary); font-weight: 700; text-decoration: none; }
  .filters { display: grid; grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(145px, 1fr)) auto; align-items: end; gap: 12px; padding: 16px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .filters label { display: grid; gap: 6px; color: var(--ink2); font-size: .8rem; font-weight: 700; }
  input, select { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-s); background: var(--surface); color: var(--ink); }
  .quiet-button, .active-button, .clear-button { min-height: 40px; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--r-s); background: var(--surface); color: var(--ink); font-weight: 700; cursor: pointer; }
  .active-button { border-color: var(--primary); background: var(--primary); color: #fff; }
  .clear-button { border-color: var(--danger); color: var(--danger); }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .queue-heading { margin: 24px 0 12px; }
  .queue-heading h2, .detail-heading h2 { margin: 0; font-size: 1.1rem; }
  .queue-heading span { color: var(--ink2); font-size: .85rem; }
  .review-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr); align-items: start; gap: 16px; }
  .hazard-list { display: grid; border-top: 1px solid var(--border); }
  .hazard-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 12px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .hazard-row:hover, .hazard-row.selected { background: var(--brand-surface); }
  .row-main, .row-meta { display: grid; gap: 5px; }
  .row-main { min-width: 0; }
  .row-main strong { text-transform: capitalize; }
  .row-main span, .row-meta { color: var(--ink2); font-size: .82rem; }
  .row-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-meta { justify-items: end; flex: none; }
  .status-chip { padding: 3px 7px; border-radius: var(--r-s); background: var(--surface); color: var(--ink); text-transform: capitalize; }
  .status-chip[data-status='needs_verification'] { color: var(--warning); }
  .status-chip[data-status='hazard_active'] { color: var(--danger); }
  .status-chip[data-status='hazard_cleared'] { color: var(--success); }
  .hazard-detail { position: sticky; top: 16px; padding: 18px; border: 1px solid var(--border); border-radius: var(--r-m); background: var(--surface); }
  .hazard-detail p { margin: 16px 0; white-space: pre-wrap; }
  .hazard-detail img { display: block; width: 100%; max-height: 280px; object-fit: contain; background: var(--bg); }
  dl { display: grid; gap: 10px; margin: 18px 0; }
  dl div { display: grid; grid-template-columns: 105px 1fr; gap: 10px; }
  dt { color: var(--ink2); font-size: .82rem; }
  dd { margin: 0; overflow-wrap: anywhere; font-size: .88rem; }
  .decision-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .empty-state { padding: 36px 16px; color: var(--ink2); text-align: center; }
  .feedback { padding: 12px; border-radius: var(--r-s); }
  .feedback.error { background: var(--danger-surface); color: var(--danger); }
  .feedback.success { background: var(--success-surface); color: var(--success); }
  @media (max-width: 980px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } .review-layout { grid-template-columns: 1fr; } .hazard-detail { position: static; } }
  @media (max-width: 600px) { .review-page { padding: 20px 16px 36px; } .page-header { align-items: flex-start; } .filters { grid-template-columns: 1fr; } .hazard-row { align-items: flex-start; flex-direction: column; } .row-meta { justify-items: start; } }
</style>