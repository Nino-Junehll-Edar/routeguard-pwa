<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { user } from '$lib/authStore';

  onMount(() => {
    const isLoggedIn = Boolean(get(user));
    goto(isLoggedIn ? '/map' : '/auth', { replaceState: true });
  });
</script>

<div class="landing-shell">
  <p>Loading RouteGuard...</p>
</div>

<style>
  .landing-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #f5f7fb;
    color: #1f2937;
    font-weight: 600;
  }
</style>