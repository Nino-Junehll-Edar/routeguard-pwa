<script lang="ts">
  import { onMount } from 'svelte';
  import { findRoute } from '$lib/routing/astar';
  import { user } from '$lib/authStore';
  import type { RoutePoint, RouteResult } from '$lib/types/routing';

  let startPoint: RoutePoint | null = null;
  let endPoint: RoutePoint | null = null;
  let isCalculating = false;
  let route: RouteResult | null = null;
  let errorMessage: string | null = null;

  // For demo, set some sample points (Tacloban City area)
  onMount(() => {
    // Sample: from city center to a point north
    startPoint = { lat: 14.1512, lng: 124.9734 };
    endPoint = { lat: 14.1550, lng: 124.9780 };

    calculateRoute();
  });

  async function calculateRoute() {
    if (!startPoint || !endPoint) return;

    isCalculating = true;
    errorMessage = null;
    route = null;

    try {
      route = await findRoute(startPoint, endPoint);
      if (!route) {
        errorMessage = 'Unable to calculate route. Please try again.';
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      errorMessage = 'An error occurred while calculating the route.';
    } finally {
      isCalculating = false;
    }
  }

  function swapPoints() {
    if (!startPoint || !endPoint) return;
    const temp = { ...startPoint };
    startPoint = { ...endPoint };
    endPoint = temp;
    calculateRoute();
  }
</script>

<div class="route-container">
  <h2>Hazard-Aware Route Finder</h2>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  <div class="route-controls">
    <div class="input-group">
      <label>Start Point:</label>
      {#if startPoint}
        <span class="coordinates">
          Lat: {startPoint.lat.toFixed(6)}, Lng: {startPoint.lng.toFixed(6)}
        </span>
      {:else}
        <span class="coordinates">Not set</span>
      {/if}
    </div>

    <div class="input-group">
      <label>End Point:</label>
      {#if endPoint}
        <span class="coordinates">
          Lat: {endPoint.lat.toFixed(6)}, Lng: {endPoint.lng.toFixed(6)}
        </span>
      {:else}
        <span class="coordinates">Not set</span>
      {/if}
    </div>

    <div class="button-group">
      <button on:click={calculateRoute} disabled={isCalculating}>
        {#if isCalculating}
          Calculating...
        {:else}
          Find Route
        {/if}
      </button>
      <button on:click={swapPoints} disabled={isCalculating || !startPoint || !endPoint}>
        Swap Points
      </button>
    </div>
  </div>

  {#if route}
    <div class="route-results">
      <h3>Route Details</h3>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">Distance:</span>
          <span class="stat-value">{route.totalDistance.toFixed(0)} m</span>
        </div>
        <div class="stat">
          <span class="stat-label">Estimated Time:</span>
          <span class="stat-value">{Math.ceil(route.totalTime / 60)} min {Math.round(route.totalTime % 60)} sec</span>
        </div>
        <div class="stat">
          <span class="stat-label">Hazard Score:</span>
          <span class="stat-value hazard-score">{route.hazardScore.toFixed(0)}/100</span>
        </div>
      </div>

      <div class="route-segments">
        <h4>Route Segments:</h4>
        {#if route.segments.length > 0}
          <ol>
            {#each route.segments as segment, i}
              <li class="segment-item">
                Segment {i + 1}:
                <span class="segment-distance">{segment.distance.toFixed(0)}m</span>
                (Base: {segment.baseCost.toFixed(0)},
                Hazard: {segment.hazardCost.toFixed(0)})
                {#if segment.hazardCost > 0}
                  <span class="hazard-indicator">⚠</span>
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .route-container {
    max-width: 600px;
    margin: 2rem auto;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .route-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .input-group {
    flex: 1;
    min-width: 200px;
  }

  .input-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: bold;
  }

  .coordinates {
    font-family: monospace;
    background-color: #f8f9fa;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
  }

  button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }

  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .route-results {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat {
    display: flex;
    justify-content: space-between;
  }

  .stat-label {
    font-weight: bold;
    color: #555;
  }

  .stat-value {
    font-weight: 500;
    color: #333;
  }

  .hazard-score {
    color: #d35400;
    font-weight: bold;
  }

  .route-segments h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  .segment-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .segment-item:last-child {
    border-bottom: none;
  }

  .hazard-indicator {
    color: #e74c3c;
    font-weight: bold;
    margin-left: 0.5rem;
  }
</style>