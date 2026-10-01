<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeMap, loadAdvisories, loadHazards } from '$lib/mapUtils';

  let mapContainer: HTMLDivElement;
  let refreshing = false;
  let errorMessage = '';
  let lastUpdated = '';

  async function refreshMap() {
    if (!mapContainer || refreshing) return;

    refreshing = true;
    errorMessage = '';
    try {
      await initializeMap(mapContainer.id);
      await Promise.all([loadHazards(null), loadAdvisories()]);
      lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Command map refresh failed:', error);
      errorMessage = 'Map data could not be refreshed.';
    } finally {
      refreshing = false;
    }
  }

  onMount(() => {
    let active = true;
    const update = async () => {
      if (active) await refreshMap();
    };

    void update();
    const refreshTimer = setInterval(update, 60_000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  });
</script>

<section class="command-panel" aria-label="Live operations map">
  <header class="command-header">
    <div class="command-heading">
      <span class="live-indicator"><i></i> LIVE MAP</span>
      <h2>Operations command center</h2>
      <p>Community hazards and official advisories</p>
    </div>
    <div class="command-actions">
      {#if lastUpdated}<span class="updated-time">Updated {lastUpdated}</span>{/if}
      <button class="refresh-button" type="button" disabled={refreshing} onclick={refreshMap}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>
        {refreshing ? 'Refreshing' : 'Refresh'}
      </button>
      <a class="map-link" href="/map" data-sveltekit-reload>Open public map</a>
    </div>
  </header>

  {#if errorMessage}<p class="map-error" role="status">{errorMessage}</p>{/if}
  <div class="map-frame">
    <div bind:this={mapContainer} id="operations-command-map" class="command-map"></div>
    {#if refreshing && !lastUpdated}
      <div class="map-loading">Loading live map...</div>
    {/if}
  </div>
  <footer class="map-legend">
    <span><i class="dot danger"></i>Impassable</span>
    <span><i class="dot warning"></i>One lane</span>
    <span><i class="dot caution"></i>Passable</span>
    <span><i class="dot advisory"></i>Official advisory</span>
    <span class="map-hint">Select a marker to inspect its details</span>
  </footer>
</section>

<style>
  .command-panel { overflow: hidden; border: 1px solid var(--border); border-radius: var(--r-m); background: var(--surface); box-shadow: var(--e1); }
  .command-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
  .command-heading { min-width: 0; }
  .command-heading h2 { margin: 5px 0 2px; font-size: 17px; }
  .command-heading p { margin: 0; color: var(--ink2); font-size: 12px; }
  .live-indicator { display: inline-flex; align-items: center; gap: 6px; color: var(--success); font-size: 10px; font-weight: 800; }
  .live-indicator i { width: 7px; height: 7px; border-radius: 50%; background: var(--success); }
  .command-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .updated-time { color: var(--ink2); font-size: 11px; }
  .refresh-button, .map-link { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--r-s); background: var(--surface); color: var(--ink); font-size: 12px; font-weight: 700; text-decoration: none; }
  .refresh-button:disabled { opacity: .6; }
  .refresh-button svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
  .map-link { border-color: var(--primary); background: var(--primary); color: #fff; }
  .map-frame { position: relative; height: clamp(300px, 48vh, 540px); background: var(--map-land); }
  .command-map { position: absolute; inset: 0; }
  .map-loading { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(247 248 250 / 72%); color: var(--ink2); font-size: 13px; font-weight: 700; pointer-events: none; }
  .map-error { margin: 10px 16px 0; color: var(--danger); font-size: 12px; }
  .map-legend { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid var(--border); color: var(--ink2); font-size: 11px; }
  .map-legend > span:not(.map-hint) { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.danger { background: var(--danger); }
  .dot.warning { background: var(--warning); }
  .dot.caution { background: var(--caution); }
  .dot.advisory { background: var(--advisory); }
  .map-hint { margin-left: auto; }
  @media (max-width: 700px) {
    .command-header { align-items: flex-start; flex-direction: column; }
    .command-actions { width: 100%; justify-content: flex-start; }
    .map-frame { height: 46vh; min-height: 280px; }
    .map-hint { width: 100%; margin-left: 0; }
  }
</style>