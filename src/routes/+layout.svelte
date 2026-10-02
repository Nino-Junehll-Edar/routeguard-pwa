<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth, signOut, user, authLoading, authError, profile } from '$lib/authStore';
  import { initializeTheme } from '$lib/theme';

  let menuOpen = false;
  let menuToggle: HTMLButtonElement;
  let staffSidebarExpanded = true;
  $: isAuthRoute = ['/auth', '/login', '/register'].includes($page.url.pathname);
  $: isStaffUser = $profile?.role === 'admin' || $profile?.role === 'agency_personnel';
  $: isCommunityUser = !!$user && (!$profile || $profile.role === 'common_user');

  onMount(() => {
    staffSidebarExpanded = window.matchMedia('(min-width: 761px)').matches;
    initializeTheme();
    initAuth();
  });

  function closeMenu() {
    menuToggle?.focus();
    menuOpen = false;
  }

  function toggleStaffSidebar() {
    staffSidebarExpanded = !staffSidebarExpanded;
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

<div class="shell" class:staff-shell={isStaffUser} class:sidebar-collapsed={isStaffUser && !staffSidebarExpanded}>
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
    {#if !isAuthRoute && !$user}
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

    {#if !isAuthRoute && (!$user || isStaffUser)}
      {#if !$user && menuOpen}
        <button class="drawer-backdrop" type="button" aria-label="Close navigation menu" on:click={closeMenu}></button>
      {/if}
      <aside
        id="app-sidebar"
        class="app-sidebar"
        class:open={!$user && menuOpen}
        class:staff-sidebar={isStaffUser}
        class:collapsed={isStaffUser && !staffSidebarExpanded}
        aria-label={isStaffUser ? 'Console navigation' : 'Main navigation'}
        aria-hidden={!isStaffUser && !menuOpen}
        inert={!isStaffUser && !menuOpen}
      >
        {#if isStaffUser}
          <button
            class="sidebar-collapse-toggle"
            type="button"
            aria-label={staffSidebarExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
            aria-expanded={staffSidebarExpanded}
            on:click={toggleStaffSidebar}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={staffSidebarExpanded ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
          </button>
        {/if}
        <a class="drawer-brand" href={isStaffUser ? ($profile?.role === 'admin' ? '/admin#overview' : '/agency') : '/map'} on:click={!$user ? closeMenu : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
          <span>RouteGuard</span>
        </a>

        <nav class="drawer-nav">
          {#if isStaffUser && $profile?.role === 'admin'}
            <a href="/admin#overview" aria-label="Overview" title="Overview" class:active={$page.url.pathname === '/admin'}>
              <span class="nav-abbreviation" aria-hidden="true">OV</span><span class="nav-label">Overview</span>
            </a>
            <a href="/admin/agency-requests" aria-label="Agency requests" title="Agency requests" class:active={$page.url.pathname.startsWith('/admin/agency-requests')}>
              <span class="nav-abbreviation" aria-hidden="true">RQ</span><span class="nav-label">Agency requests</span>
            </a>
            <a href="/admin/users" aria-label="User management" title="User management" class:active={$page.url.pathname.startsWith('/admin/users')}>
              <span class="nav-abbreviation" aria-hidden="true">US</span><span class="nav-label">User management</span>
            </a>
            <a href="/admin/moderation" aria-label="Moderation queue" title="Moderation queue" class:active={$page.url.pathname.startsWith('/admin/moderation')}>
              <span class="nav-abbreviation" aria-hidden="true">MQ</span><span class="nav-label">Moderation queue</span>
            </a>
            <a href="/admin/audit" aria-label="Audit logs" title="Audit logs" class:active={$page.url.pathname.startsWith('/admin/audit')}>
              <span class="nav-abbreviation" aria-hidden="true">AL</span><span class="nav-label">Audit logs</span>
            </a>
            <a href="/admin/statistics" aria-label="Statistics" title="Statistics" class:active={$page.url.pathname.startsWith('/admin/statistics')}>
              <span class="nav-abbreviation" aria-hidden="true">ST</span><span class="nav-label">Statistics</span>
            </a>
            <a href="/profile" aria-label="Profile" title="Profile" class:active={$page.url.pathname === '/profile'}>
              <span class="nav-abbreviation" aria-hidden="true">PF</span><span class="nav-label">Profile</span>
            </a>
          {:else if isStaffUser}
            <a href="/agency" aria-label="Overview" title="Overview" class:active={$page.url.pathname === '/agency' && !$page.url.hash}>
              <span class="nav-abbreviation" aria-hidden="true">OV</span><span class="nav-label">Overview</span>
            </a>
            <a href="/agency/hazards" aria-label="Hazard review" title="Hazard review" class:active={$page.url.pathname.startsWith('/agency/hazards')}>
              <span class="nav-abbreviation" aria-hidden="true">HQ</span><span class="nav-label">Hazard review</span>
            </a>
            <a href="/agency/map" aria-label="Operations map" title="Operations map" class:active={$page.url.pathname.startsWith('/agency/map')}>
              <span class="nav-abbreviation" aria-hidden="true">MP</span><span class="nav-label">Map</span>
            </a>
            <a href="/agency/advisories" aria-label="Advisories" title="Advisories" class:active={$page.url.pathname.startsWith('/agency/advisories')}>
              <span class="nav-abbreviation" aria-hidden="true">AD</span><span class="nav-label">Advisories</span>
            </a>
            <a href="/agency/statistics" aria-label="Statistics" title="Statistics" class:active={$page.url.pathname.startsWith('/agency/statistics')}>
              <span class="nav-abbreviation" aria-hidden="true">ST</span><span class="nav-label">Statistics</span>
            </a>
            <a href="/profile" aria-label="Profile" title="Profile" class:active={$page.url.pathname === '/profile'}>
              <span class="nav-abbreviation" aria-hidden="true">PF</span><span class="nav-label">Profile</span>
            </a>
          {:else}
            <a href="/map" class:active={$page.url.pathname === '/map'} on:click={closeMenu}>Map</a>
            <a href="/route" class:active={$page.url.pathname === '/route'} on:click={closeMenu}>Navigate</a>
            <a href="/notifications" class:active={$page.url.pathname === '/notifications'} on:click={closeMenu}>Alerts</a>
            <a href="/auth" on:click={closeMenu}>Sign in</a>
            <a href="/auth?side=agency&tab=request" on:click={closeMenu}>Agency access</a>
          {/if}
        </nav>

        {#if $user}
          <div class="drawer-footer">
            <span class="drawer-email" title={$user.email}>{$user.email}</span>
            <button class="drawer-signout" type="button" on:click={handleSignOut}>Sign out</button>
          </div>
        {/if}
      </aside>
    {/if}

    {#if !isAuthRoute && (!$user || isCommunityUser)}
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