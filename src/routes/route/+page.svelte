<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { findRoute, getAlternativeRoutes, generateTurnByTurnInstructions } from '$lib/routing/astar';
  import { loadHazards, initializeMap, subscribeToHazardChanges, updateUserPosition, displayRoute, clearRoute } from '$lib/mapUtils';
  import { user } from '$lib/authStore';
  import { supabase } from '$lib/supabaseClient';
  import type { RoutePoint, RouteResult } from '$lib/types/routing';

  let mapContainer: HTMLDivElement | null = null;
  let startPoint: RoutePoint | null = null;
  let endPoint: RoutePoint | null = null;
  let isCalculating = false;
  let route: RouteResult | null = null;
  let errorMessage: string | null = null;
  let showAlternatives = false;
  let alternativeRoutes: RouteResult[] = [];
  let turnByTurnInstructions: string[] = [];
  let isRecalculatingDueToHazards = false;
  let lastHazardCheckTime = 0;
  const HAZARD_RECHECK_INTERVAL_MS = 60 * 1000; // Minimum time between hazard-triggered recalculations
  const MIN_HAZARDS_NEAR_ROUTE_TO_RECALCULATE = 3; // Number of hazards near route to trigger recalculation

  // For demo, set some sample points (Tacloban City area)
  onMount(async () => {
    // Sample: from city center to a point north
    startPoint = { lat: 11.2447, lng: 125.0033 };
    endPoint = { lat: 11.2485, lng: 125.0079 };

    // Initialize map
    if (mapContainer) {
      await initializeMap(mapContainer.id);
      await loadHazards(null);

      // Subscribe to hazard changes with callback for potential route recalculation
      subscribeToHazardChanges(async () => {
        // Check if we should recalculate based on hazard changes
        await checkForHazardChangesAndRecalculateIfNeeded();
      });

      // Set up location tracking (optional)
      // In a full implementation, you'd set up location tracking here
    }

    calculateRoute();
  });

  async function calculateRoute() {
    if (!startPoint || !endPoint) return;

    isCalculating = true;
    errorMessage = null;
    route = null;
    alternativeRoutes = [];
    showAlternatives = false;
    turnByTurnInstructions = [];

    try {
      route = await findRoute(startPoint, endPoint);
      if (!route) {
        errorMessage = 'Unable to calculate route. Please try again.';
      } else {
        // Display the route on the map
        displayRoute(route);

        // Generate turn-by-turn instructions
        turnByTurnInstructions = generateTurnByTurnInstructions(route.points);

        // Get alternative routes
        alternativeRoutes = await getAlternativeRoutes(startPoint, endPoint, 3);
        showAlternatives = alternativeRoutes.length > 1; // Show if we have more than just the main route
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      errorMessage = 'An error occurred while calculating the route.';
    } finally {
      isCalculating = false;
    }
  }

  async function checkForHazardChangesAndRecalculateIfNeeded() {
    // Prevent recalculating too frequently
    const now = Date.now();
    if (now - lastHazardCheckTime < HAZARD_RECHECK_INTERVAL_MS) {
      return; // Still in cooldown period
    }

    lastHazardCheckTime = now;

    // Skip if we're already calculating a route
    if (isCalculating) {
      return;
    }

    try {
      // Check if there are significant hazards near the current route
      const hasSignificantHazardsNearRoute = await checkForSignificantHazardsNearRoute();

      if (hasSignificantHazardsNearRoute && route && startPoint && endPoint) {
        isRecalculatingDueToHazards = true;
        errorMessage = null; // Clear any previous error

        // Recalculate the route
        const newRoute = await findRoute(startPoint, endPoint);
        if (newRoute) {
          route = newRoute;
          displayRoute(route);
          turnByTurnInstructions = generateTurnByTurnInstructions(route.points);

          // Get alternative routes for the new route
          alternativeRoutes = await getAlternativeRoutes(startPoint, endPoint, 3);
          showAlternatives = alternativeRoutes.length > 1;
        } else {
          errorMessage = 'Unable to recalculate route due to hazards. Please try again.';
        }

        isRecalculatingDueToHazards = false;
      }
    } catch (error) {
      console.error('Error checking for hazard changes:', error);
      isRecalculatingDueToHazards = false;
    }
  }

  async function checkForSignificantHazardsNearRoute(): Promise<boolean> {
    if (!route || !route.points || route.points.length === 0) {
      return false;
    }

    try {
      // Sample points along the route to check for hazards
      const samplePoints: RoutePoint[] = [];
      const currentRoute = route;
    const pointCount = currentRoute.points.length;

      // Sample every 5th point or at least 2 points
      const step = Math.max(1, Math.floor(pointCount / 5));
      for (let i = 0; i < pointCount; i += step) {
        samplePoints.push(currentRoute.points[i]);
      }

      // Always include start and end points
      if (!samplePoints.some(p => p.lat === currentRoute.points[0].lat && p.lng === currentRoute.points[0].lng)) {
        samplePoints.unshift(currentRoute.points[0]);
      }
      if (!samplePoints.some(p => p.lat === currentRoute.points[pointCount - 1].lat && p.lng === currentRoute.points[pointCount - 1].lng)) {
        samplePoints.push(currentRoute.points[pointCount - 1]);
      }

      // Check for hazards near each sample point
      let hazardsNearRouteCount = 0;

      for (const point of samplePoints) {
        // Check for hazards within 100m of this point
        const { data, error } = await supabase
          .from('hazards')
          .select('id, hazard_type, status, updated_at')
          .not('status', 'eq', 'expired')
          .contains('location', {
            type: 'Point',
            coordinates: [point.lng, point.lat]
          });

        if (error) {
          console.error('Error checking for hazards near point:', error);
          continue;
        }

        // Count active hazards near this point
        if (data && data.length > 0) {
          hazardsNearRouteCount += data.length;

          // If we already have enough hazards near route, we can stop early
          if (hazardsNearRouteCount >= MIN_HAZARDS_NEAR_ROUTE_TO_RECALCULATE) {
            return true;
          }
        }
      }

      return hazardsNearRouteCount >= MIN_HAZARDS_NEAR_ROUTE_TO_RECALCULATE;
    } catch (error) {
      console.error('Error in checkForSignificantHazardsNearRoute:', error);
      return false;
    }
  }

  function swapPoints() {
    if (!startPoint || !endPoint) return;
    const temp = { ...startPoint };
    startPoint = { ...endPoint };
    endPoint = temp;
    calculateRoute();
  }

  function selectAlternativeRoute(index: number) {
    if (index >= 0 && index < alternativeRoutes.length) {
      route = alternativeRoutes[index];
      displayRoute(route);
      turnByTurnInstructions = generateTurnByTurnInstructions(route.points);
    }
  }

  function clearRouteDisplay() {
    clearRoute();
  }

  onDestroy(() => {
    clearRouteDisplay();
  });
</script>

<div class="route-container">
  <h2>Hazard-Aware Route Finder</h2>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  <div class="route-controls">
    <div class="input-group">
      <label for="start-point">Start Point:</label>
      {#if startPoint}
        <span class="coordinates" id="start-point">
          Lat: {startPoint.lat.toFixed(6)}, Lng: {startPoint.lng.toFixed(6)}
        </span>
      {:else}
        <span class="coordinates" id="start-point">Not set</span>
      {/if}
    </div>

    <div class="input-group">
      <label for="end-point">End Point:</label>
      {#if endPoint}
        <span class="coordinates" id="end-point">
          Lat: {endPoint.lat.toFixed(6)}, Lng: {endPoint.lng.toFixed(6)}
        </span>
      {:else}
        <span class="coordinates" id="end-point">Not set</span>
      {/if}
    </div>

    <div class="button-group">
      <button on:click={calculateRoute} disabled={isCalculating} class="btn-primary">
        {#if isCalculating}
          Calculating...
        {:else}
          Find Route
        {/if}
      </button>
      <button on:click={swapPoints} disabled={isCalculating || !startPoint || !endPoint} class="btn-secondary">
        Swap Points
      </button>
    </div>
  </div>

  <!-- Map Container -->
  <div class="route-map">
    {#if mapContainer}
      <div bind:this={mapContainer} class="map-container"></div>
    {:else}
      <div class="map-placeholder">Map will appear here</div>
    {/if}
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

      {#if showAlternatives}
        <div class="alternative-routes">
          <h4>Alternative Routes:</h4>
          <div class="alternative-list">
            {#each alternativeRoutes as altRoute, index}
              <button
                class={`alt-route-btn ${index === 0 ? 'active' : ''}`}
                on:click={() => selectAlternativeRoute(index)}
              >
                Route {index + 1} - {altRoute.totalDistance.toFixed(0)}m, {Math.ceil(altRoute.totalTime / 60)}min {Math.round(altRoute.totalTime % 60)}s, Hazard: {altRoute.hazardScore.toFixed(0)}
              </button>
            {/each}
          </div>
        </div>
      {/if}

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
                  <span class="hazard-indicator">!</span>
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
      </div>

      {#if turnByTurnInstructions.length > 0}
        <div class="turn-by-turn">
          <h4>Turn-by-Turn Directions:</h4>
          <ol class="instructions-list">
            {#each turnByTurnInstructions as instruction, index}
              <li class="instruction-item">
                {index + 1}. {instruction}
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    </div>
  {/if}
</div>






