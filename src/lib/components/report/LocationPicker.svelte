<script>
  import { onMount } from 'svelte';

  let { latitude = $bindable(null), longitude = $bindable(null), pinned = $bindable(false) } = $props();

  let map = null;
  let currentLocationMarker = null;
  let placementMarker = null;
  let mapReady = false;

  async function initMap() {
    try {
      const L = await import('leaflet');
      const defaultLat = latitude ?? 11.2442;
      const defaultLng = longitude ?? 125.0041;

      const mapContainer = document.getElementById('location-picker-map');
      if (!mapContainer) return;

      map = L.map(mapContainer, {
        zoomControl: false,
        attributionControl: false
      }).setView([defaultLat, defaultLng], 18);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      currentLocationMarker = L.circleMarker([defaultLat, defaultLng], {
        radius: 6,
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map);

      placementMarker = L.circleMarker([defaultLat, defaultLng], {
        radius: 8,
        color: 'red',
        fillColor: '#ff4444',
        fillOpacity: 0.8,
        weight: 2,
        draggable: true
      }).addTo(map);

      placementMarker.on('dragend', (event) => {
        const pos = event.target.getLatLng();
        latitude = pos.lat;
        longitude = pos.lng;
        pinned = true;
      });

      map.on('click', (event) => {
        latitude = event.latlng.lat;
        longitude = event.latlng.lng;
        pinned = true;
        updateMapPosition();
      });

      mapReady = true;
      updateMapPosition();
    } catch (error) {
      console.error('Error initializing location picker map:', error);
    }
  }

  function updateMapPosition() {
    if (!map || !currentLocationMarker || !placementMarker) return;

    const centerLat = latitude ?? 11.2442;
    const centerLng = longitude ?? 125.0041;

    currentLocationMarker.setLatLng([centerLat, centerLng]);

    if (pinned && latitude !== null && longitude !== null) {
      placementMarker.setLatLng([latitude, longitude]);
    } else if (latitude !== null && longitude !== null) {
      placementMarker.setLatLng([latitude, longitude]);
    }

    if (map) {
      map.setView([centerLat, centerLng], 18);
    }
  }

  function useMyLocation() {
    if (latitude !== null && longitude !== null) {
      pinned = false;
      updateMapPosition();
    }
  }

  function centerOnPin() {
    if (latitude !== null && longitude !== null && map) {
      map.setView([latitude, longitude], 18);
    }
  }

  onMount(() => {
    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  });

  $effect(() => {
    if (mapReady) {
      updateMapPosition();
    }
  });
</script>

<div class="location-picker">
  <div class="map-container">
    <div id="location-picker-map" style="width: 100%; height: 200px; border: 1px solid var(--border); border-radius: var(--r-m); margin-bottom: 12px;"></div>
  </div>

  <div class="location-info">
    <div class="coords-row">
      <span class="label">Coordinates:</span>
      <span class="value">
        {#if latitude !== null && longitude !== null}
          Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
        {:else}
          Getting location...
        {/if}
      </span>
    </div>
    <div class="mode-row">
      <span class="label">Mode:</span>
      <span class={pinned ? 'value pinned' : 'value gps'}>
        {pinned ? 'Pinned on map' : 'Using your GPS location'}
      </span>
    </div>
    {#if pinned}
      <div class="rationale-row">
        <span class="label">Note:</span>
        <span class="value">Pin manually when GPS is off or hazard is up the road.</span>
      </div>
    {/if}
  </div>

  <div class="action-buttons">
    <button onclick={useMyLocation} class="btn-link btn-sm">
      Use my location
    </button>
    <button onclick={centerOnPin} class="btn-link btn-sm">
      Center on pin
    </button>
  </div>
</div>

<style>
  .location-picker {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-l);
    padding: 16px;
    margin-bottom: 24px;
  }

  .map-container {
    margin-bottom: 12px;
  }

  .location-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: var(--ink2);
    margin-bottom: 12px;
  }

  .label {
    font-weight: 600;
    min-width: 80px;
  }

  .value {
    font-family: var(--f);
  }

  .value.pinned {
    color: var(--danger);
    font-weight: 600;
  }

  .value.gps {
    color: var(--primary);
    font-weight: 600;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
  }

  .btn-link {
    padding: 6px 12px;
    border-radius: var(--r-s);
    font-size: 13px;
    font-weight: 600;
    color: var(--primary);
    border: 1px solid var(--primary);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-link:hover {
    background: var(--primary-surface);
  }

  .btn-link:active {
    transform: scale(0.98);
  }

  [data-theme=dark] .location-picker {
    border-color: var(--border);
    background: var(--surface);
  }

  [data-theme=dark] .btn-link {
    color: var(--primary);
    border-color: var(--primary);
  }

  [data-theme=dark] .btn-link:hover {
    background: var(--primary-surface);
  }
</style>