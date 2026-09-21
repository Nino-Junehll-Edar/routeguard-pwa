<script lang="ts">
  import { onMount } from 'svelte';
  import { initAuth } from '$lib/authStore';

  onMount(() => {
    initAuth();
  });
</script>

<slot />