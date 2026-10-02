<script lang="ts">
  import CommandMapPanel from '$lib/components/CommandMapPanel.svelte';
</script>

<svelte:head>
  <title>Agency Map | RouteGuard</title>
</svelte:head>

<main class="map-page">
  <header class="page-header">
    <div>
      <p class="eyebrow">Agency workspace</p>
      <h1>Operations map</h1>
      <p>Community hazards and official advisories.</p>
    </div>
  </header>
  <CommandMapPanel />
</main>

<style>
  .map-page { width: min(1400px, 100%); min-height: 100%; margin: 0 auto; padding: 24px; color: var(--ink); }
  .page-header { margin-bottom: 18px; }
  .eyebrow { margin: 0 0 6px; color: var(--primary); font-size: 11px; font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0; font-size: 24px; }
  .page-header p:last-child { margin: 5px 0 0; color: var(--ink2); }
  @media (max-width: 600px) { .map-page { padding: 16px 12px; } }
</style>
