<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth, user, authLoading, authError, profileLoading, profileError } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  onMount(() => {
    initAuth();
  });

  // Determine redirect path based on user role
  function getRedirectPath(userRole: string | null): string {
    switch (userRole) {
      case 'admin':
        return '/admin/agency-requests';
      case 'agency_personnel':
        return '/agency';
      default:
        return '/map';
    }
  }
</script>

<div class="shell">
  {#if $authLoading}
    <div class="auth-loading">
      <div class="loading-spinner"></div>
      <p>Initializing...</p>
    </div>
  {:else if $authError}
    <div class="auth-error">
      <p>Authentication error: {$authError}</p>
      <button on:click={() => { authError.set(null); initAuth(); }}>
        Retry
      </button>
    </div>
  {:else}
    <header class="app-header">
      <a class="brand" href="/map" aria-label="RouteGuard home">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
        <span>RouteGuard</span>
      </a>
      {#if $user || $profile}
        <nav class="desktop-nav" aria-label="Primary navigation">
          <a href="/map" class:active={$page.url.pathname === '/map'}>Map</a>
          <a href="/route" class:active={$page.url.pathname === '/route'}>Navigate</a>
          <a href="/notifications" class:active={$page.url.pathname === '/notifications'}>Alerts</a>
          {#if $profile?.role === 'admin' || $profile?.role === 'agency_personnel'}
            <a href="/profile" class:active={$page.url.pathname === '/profile'}>Profile</a>
          {/if}
        </nav>
        <div class="header-actions">
          {#if $profile?.role === 'admin'}
            <a class="agency-link" href="/admin/agency-requests">Admin</a>
          {:else if $profile?.role === 'agency_personnel'}
            <a class="agency-link" href="/agency">Agency</a>
          {/if}
          <a class="agency-link" href="/agency-request">Agency access</a>
          {#if $user}
            <a class="report-link" href="/report-hazard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Report hazard
            </a>
          {/if}
          {#if $user}
            <button on:click={() => {
              signOut().catch(err => console.error('Sign out failed:', err));
            }} class="user-action">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5 .67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h10v-1l-2-2z"/></svg>
              Sign out
            </button>
          {/if}
        </div>
      {:else}
        <nav class="desktop-nav" aria-label="Primary navigation">
          <a href="/map" class:active={$page.url.pathname === '/map'}>Map</a>
          <a href="/route" class:active={$page.url.pathname === '/route'}>Navigate</a>
          <a href="/notifications" class:active={$page.url.pathname === '/notifications'}>Alerts</a>
          <a href="/profile" class:active={$page.url.pathname === '/profile'}>Profile</a>
        </nav>
        <div class="header-actions">
          <a class="agency-link" href="/agency-request">Agency access</a>
          <a class="agency-link" href="/admin/agency-requests">Admin</a>
          {#if !$user}
            <a class="report-link" href="/login">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Report hazard
            </a>
          {/if}
        </div>
      {/if}
    </header>

    <main class="app-content"><slot /></main>

    <nav class="mobile-nav" aria-label="Primary navigation">
      {#if $user || $profile}
        <a href="/map" class:active={$page.url.pathname === '/map'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></svg><span>Map</span>
        </a>
        <a href="/route" class:active={$page.url.pathname === '/route'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></svg><span>Navigate</span>
        </a>
        {#if $profile?.role === 'admin' || $profile?.role === 'agency_personnel'}
          <a href="/profile" class:active={$page.url.pathname === '/profile'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3-6 8-6s8 2 8 6"/></svg><span>Profile</span>
          </a>
        {/if}
        <a class="mobile-report" href="/report-hazard" aria-label="Report hazard">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Report</span>
        </a>
        <a href="/notifications" class:active={$page.url.pathname === '/notifications'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4"/></svg><span>Alerts</span>
        </a>
        {#if $profile?.role === 'admin'}
          <a href="/admin/agency-requests" class="agency-link">
            Admin
          </a>
        {:else if $profile?.role === 'agency_personnel'}
          <a href="/agency" class="agency-link">
            Agency
          </a>
        {/if}
        {#if $user}
          <button on:click={() => {
            signOut().catch(err => console.error('Sign out failed:', err));
          }} class="user-action-mobile">
            Sign out
          </button>
        {/if}
      {:else}
        <a href="/map" class:active={$page.url.pathname === '/map'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></svg><span>Map</span>
        </a>
        <a href="/route" class:active={$page.url.pathname === '/route'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></svg><span>Navigate</span>
        </a>
        <a class="mobile-report" href="/report-hazard" aria-label="Report hazard">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Report</span>
        </a>
        <a href="/notifications" class:active={$page.url.pathname === '/notifications'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4"/></svg><span>Alerts</span>
        </a>
        <a href="/profile" class:active={$page.url.pathname === '/profile'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3-6 8-6s8 2 8 6"/></svg><span>Profile</span>
        </a>
        <a href="/agency-request" class="agency-link">Agency access</a>
        <a href="/admin/agency-requests" class="agency-link">Admin</a>
      {/if}
    </nav>
  {/if}
</div>