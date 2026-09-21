<script lang="ts">
  import { onMount } from 'svelte';
  import { initAuth } from '$lib/authStore';

  onMount(() => {
    initAuth();
  });
</script>

<nav>
  <ul>
    <li><a href="/map">Map</a></li>
    <li><a href="/report-hazard">Report Hazard</a></li>
    <li><a href="/profile">Profile</a></li>
    <!-- We'll add more links as we create more pages -->
  </ul>
</nav>

<slot />