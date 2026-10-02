<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { supabase } from '$lib/supabaseClient';

  export let role: 'agency_personnel' | 'admin';

  interface Stat {
    label: string;
    value: number;
    detail: string;
    tone: 'primary' | 'warning' | 'success' | 'neutral';
  }

  let stats: Stat[] = [];
  let loading = true;
  let errorMessage = '';

  onMount(async () => {
    const currentUser = get(user);
    const currentProfile = get(profile);
    if (!currentUser) {
      await goto('/login');
      return;
    }
    if (currentProfile?.role !== role) {
      await goto(currentProfile?.role === 'admin' ? '/admin/agency-requests' : currentProfile?.role === 'agency_personnel' ? '/agency' : '/map');
      return;
    }

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const requests = role === 'admin'
        ? supabase.from('agency_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        : supabase.from('hazards').select('id', { count: 'exact', head: true }).eq('status', 'needs_verification');
      const [openHazards, recentReports, activeAdvisories, roleMetric] = await Promise.all([
        supabase.from('hazards').select('id', { count: 'exact', head: true }).not('status', 'in', '(hazard_cleared,expired)'),
        supabase.from('hazards').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('agency_advisories').select('id', { count: 'exact', head: true }).eq('is_active', true),
        requests
      ]);

      const failed = [openHazards, recentReports, activeAdvisories, roleMetric].find(result => result.error);
      if (failed?.error) throw failed.error;

      stats = [
        { label: 'Open hazards', value: openHazards.count ?? 0, detail: 'Reports awaiting resolution', tone: 'warning' },
        { label: 'Reports · 24 h', value: recentReports.count ?? 0, detail: 'New community reports', tone: 'primary' },
        { label: 'Active advisories', value: activeAdvisories.count ?? 0, detail: 'Currently published', tone: 'success' },
        role === 'admin'
          ? { label: 'Pending requests', value: roleMetric.count ?? 0, detail: 'Agency access requests', tone: 'warning' }
          : { label: 'Needs verification', value: roleMetric.count ?? 0, detail: 'Reports for official review', tone: 'warning' }
      ];
    } catch (error) {
      console.error('Failed to load staff statistics:', error);
      errorMessage = error instanceof Error ? error.message : 'Statistics are currently unavailable.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{role === 'admin' ? 'Admin Statistics' : 'Agency Statistics'} | RouteGuard</title>
</svelte:head>

<main class="statistics-page">
  <header class="page-header">
    <div>
      <p class="eyebrow">{role === 'admin' ? 'Administrator workspace' : 'Agency workspace'}</p>
      <h1>Statistics</h1>
      <p>Current operational totals and recent activity.</p>
    </div>
  </header>

  {#if loading}
    <p class="state-message" role="status">Loading statistics...</p>
  {:else if errorMessage}
    <p class="state-message error" role="alert">Statistics could not be loaded: {errorMessage}</p>
  {:else}
    <section class="stats-grid" aria-label="Operational statistics">
      {#each stats as stat (stat.label)}
        <article class="stat-card tone-{stat.tone}">
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
          <span>{stat.detail}</span>
        </article>
      {/each}
    </section>
  {/if}
</main>

<style>
  .statistics-page { width: min(1200px, 100%); min-height: 100%; margin: 0 auto; padding: 28px; color: var(--ink); }
  .page-header { margin-bottom: 24px; }
  .eyebrow { margin: 0 0 6px; color: var(--primary); font-size: 11px; font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0; font-size: 25px; }
  .page-header p:last-child { margin: 5px 0 0; color: var(--ink2); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
  .stat-card { display: grid; min-height: 142px; align-content: space-between; gap: 8px; padding: 18px; border: 1px solid var(--border); border-left: 4px solid var(--neutral); border-radius: var(--r-s); background: var(--surface); }
  .stat-card p, .stat-card span { margin: 0; color: var(--ink2); font-size: 12px; }
  .stat-card strong { color: var(--ink); font-size: 32px; line-height: 1; font-variant-numeric: tabular-nums; }
  .tone-primary { border-left-color: var(--primary); }
  .tone-warning { border-left-color: var(--warning); }
  .tone-success { border-left-color: var(--success); }
  .tone-neutral { border-left-color: var(--neutral); }
  .state-message { color: var(--ink2); }
  .state-message.error { color: var(--danger); }
  @media (max-width: 600px) { .statistics-page { padding: 18px 14px; } }
</style>
