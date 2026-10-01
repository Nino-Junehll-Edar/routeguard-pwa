<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth, signOut, user, authLoading, authError, profile } from '$lib/authStore';

  let menuOpen = false;
  let menuToggle: HTMLButtonElement;
  $: isAuthRoute = ['/auth', '/login', '/register'].includes($page.url.pathname);

  onMount(() => {
    initAuth();
  });

  function closeMenu() {
    menuToggle?.focus();
    menuOpen = false;
  }

  async function handleSignOut() {
    closeMenu();
    try {
      await signOut();
      window.location.replace('/auth');
    } catch (error) {
      console.error('Sign out failed:', error);
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
      <button on:click={() => { authError.set(null); initAuth(); }}>Retry</button>
    </div>
  {:else}
    {#if !isAuthRoute}
      <button
        class="menu-toggle"
        bind:this={menuToggle}
        class:open={menuOpen}
        type="button"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        on:click={() => { menuOpen = !menuOpen; }}
      >
        {#if menuOpen}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        {/if}
      </button>
    {/if}

    <main class="app-content"><slot /></main>

    {#if !isAuthRoute}
      {#if menuOpen}
        <button class="drawer-backdrop" type="button" aria-label="Close navigation menu" on:click={closeMenu}></button>
      {/if}
      <aside
        id="app-sidebar"
        class="app-sidebar"
        data-sveltekit-reload
        class:open={menuOpen}
        aria-label="Main navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <a class="drawer-brand" href="/map" on:click={closeMenu}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
          <span>RouteGuard</span>
        </a>

        <nav class="drawer-nav">
          <a href="/map" class:active={$page.url.pathname === '/map'} on:click={closeMenu}>Map</a>
          <a href="/route" class:active={$page.url.pathname === '/route'} on:click={closeMenu}>Navigate</a>
          <a href="/notifications" class:active={$page.url.pathname === '/notifications'} on:click={closeMenu}>Alerts</a>
          {#if $user}
            <a href="/profile" class:active={$page.url.pathname === '/profile'} on:click={closeMenu}>Profile</a>
            <a href="/report-hazard" class:active={$page.url.pathname === '/report-hazard'} on:click={closeMenu}>Report hazard</a>
            {#if $profile?.role === 'admin'}
              <a href="/admin/agency-requests" class:active={$page.url.pathname.startsWith('/admin')} on:click={closeMenu}>Admin console</a>
            {:else if $profile?.role === 'agency_personnel'}
              <a href="/agency" class:active={$page.url.pathname === '/agency'} on:click={closeMenu}>Agency console</a>
            {:else}
              <a href="/auth?side=agency&tab=request" on:click={closeMenu}>Agency access</a>
            {/if}
          {:else}
            <a href="/auth" on:click={closeMenu}>Sign in</a>
            <a href="/auth?side=agency&tab=request" on:click={closeMenu}>Agency access</a>
          {/if}
        </nav>

        {#if $user}
          <div class="drawer-footer">
            <span class="drawer-email">{$user.email}</span>
            <button class="drawer-signout" type="button" on:click={handleSignOut}>Sign out</button>
          </div>
        {/if}
      </aside>
    {/if}

    {#if !isAuthRoute && (!$profile || $profile.role === 'common_user')}
      <nav class="community-bottom-nav" aria-label="Community navigation">
        <a href="/map" data-sveltekit-reload class:active={$page.url.pathname === '/map'} aria-current={$page.url.pathname === '/map' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></svg><span>Map</span>
        </a>
        <a href="/notifications" data-sveltekit-reload class:active={$page.url.pathname === '/notifications'} aria-current={$page.url.pathname === '/notifications' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4"/></svg><span>Alerts</span>
        </a>
        <a class="community-report" href={$user ? '/report-hazard' : '/auth'} data-sveltekit-reload aria-label={$user ? 'Report a hazard' : 'Sign in to report a hazard'}>
          <span class="report-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span>Report</span>
        </a>
        <a href="/route" data-sveltekit-reload class:active={$page.url.pathname === '/route'} aria-current={$page.url.pathname === '/route' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></svg><span>Navigate</span>
        </a>
        <a href={$user ? '/profile' : '/auth'} data-sveltekit-reload class:active={$page.url.pathname === '/profile'} aria-current={$page.url.pathname === '/profile' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>Profile</span>
        </a>
      </nav>
    {/if}
  {/if}
</div>