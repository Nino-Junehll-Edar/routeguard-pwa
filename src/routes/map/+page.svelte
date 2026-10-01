<script lang="ts">
  import { onMount } from 'svelte';
  import { loadHazards, loadAdvisories, initializeMap, subscribeToHazardChanges, subscribeToAdvisoryChanges, updateUserPosition, displayRoute, clearRoute, clearAdvisoryMarkers, clearHazardMarkers } from '$lib/mapUtils';
  import { user } from '$lib/authStore';
  import { supabase } from '$lib/supabaseClient';
  import { setupFCMListener } from '$lib/firebase';
  import { writable } from 'svelte/store';
  import { initNotifications, checkProximityAlerts, sendVerificationPrompt, showNotification } from '$lib/notificationUtils';
  import { findNearestNode, findRoute, generateTurnByTurnInstructions, getAlternativeRoutes } from '$lib/routing/astar';
  import { getNode } from '$lib/routing/osmLoader';
  import HazardComments from '$lib/components/HazardComments.svelte';
  import VoteButton from '$lib/components/VoteButton.svelte';
  import HazardDetailSheet from '$lib/components/HazardDetailSheet.svelte';
  import { get } from 'svelte/store';
  import { normalizeHazardLocation } from '$lib/geoUtils';
      import notificationsStore from '$lib/stores/notifications.js';
  import type { RoutePoint, RouteResult } from '$lib/types/routing';
  import type { Hazard } from '$lib/types/hazard';

  // Interface for verification card data
  interface VerificationData {
    id: string;
    hazard_type: string;
    status: Hazard['status'];
    created_at: string;
    photo_url: string | null;
    latitude: number;
    longitude: number;
  }

  let mapContainer: HTMLDivElement | null = null;
  let userMarker: any = null;
  let detailHazard: Hazard | null = null;

  // UI state
  const showErrorBanner = writable(false);
  const errorMessage = writable('');
  const showVerificationCard = writable(false);
      const verificationData = writable<VerificationData | null>(null);
  const activeTab = writable('verification'); // 'verification', 'comments', or 'voting'
  const showCoachTip = writable(true);
  const showLegend = writable(false);
  const showLayerPopup = writable(false);
  const showSheet = writable(false);
  const sheetContent = writable('report-hazard'); // default to hazard reporting
  const showDestinationInput = writable(false);
  const destinationInput = writable('');
  const showRecentDestinations = writable(false);
  const alertChips = writable([
    { id: 'all', label: 'All', active: true },
    { id: 'nearby', label: 'Nearby', active: false },
    { id: 'verify', label: 'Verifications', active: false },
    { id: 'adv', label: 'Advisories', active: false }
  ]);
    const selectedHazardId = writable<string | null>(null);
  const showSrPill = writable(true);
  const srPillStatus = writable('Operational');
  const srPillNotifications = writable(0);

  // Online/offline status
  const isOnline = writable(navigator.onLine);

  // Notification state
  const notificationCount = writable(0);
  const notificationLoading = writable(false);

    // Route state
  const activeRoute = writable<RouteResult | null>(null);
  const routeStartPoint = writable<RoutePoint | null>(null);
  const routeEndPoint = writable<RoutePoint | null>(null);
  const routeInstructions = writable<string[]>([]);
  const isCalculatingRoute = writable(false);

  // System time update
  let systemTimeInterval: ReturnType<typeof setInterval> | null = null;

  // Initialize map when component mounts
  onMount(() => {
    let cleanup = () => {};

    void (async () => {
    if (!mapContainer) return;

    // Set up online/offline detection
    const updateOnlineStatus = () => {
      isOnline.set(navigator.onLine);
      // Update SR pill based on online status
      if (navigator.onLine) {
        // If we were showing issues due to being offline, now show operational
        // unless there are other issues (like notifications)
        if ($notificationCount === 0) {
          updateSrPill('Operational');
        } else {
          updateSrPill('Notifications', $notificationCount);
        }
      } else {
        updateSrPill('Offline');
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();

    // Set up system time update
    systemTimeInterval = setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Update system time elements if they exist
      const systemTimeEl = document.getElementById('system-time');
      const clockEl = document.getElementById('clock');
      if (systemTimeEl) systemTimeEl.textContent = timeString;
      if (clockEl) clockEl.textContent = timeString;
    }, 1000);

    try {
      // Initialize map
      await initializeMap(mapContainer.id);

      // Load initial data based on filters
      await loadDataBasedOnFilters();

      // Subscribe to real-time updates
      subscribeToHazardChanges(
        () => {
          // Recalculate route when hazards change
          recalculateRouteIfNeeded();
        },
        async (hazard) => {
          // Automatically show verification card when hazard needs verification
          // Extract coordinates from PostGIS point (format: [lng, lat])
          const coordinates = normalizeHazardLocation(hazard.location);
          if (!coordinates) return;
          const [lng, lat] = coordinates;

          // Format the data for the verification card
          const verificationData = {
            id: hazard.id,
            hazard_type: hazard.hazard_type,
            status: hazard.status,
            created_at: hazard.created_at,
            photo_url: hazard.photo_url,
            latitude: lat,
            longitude: lng
          };

          openVerificationCard(verificationData);

          // Also send verification prompt notification
          await sendVerificationPrompt(hazard.id, hazard.hazard_type);
        },
        openHazardDetails
      );

      // Load initial advisories
      await loadAdvisories();

      // Subscribe to real-time advisory updates
      subscribeToAdvisoryChanges(() => {
        // Recalculate route when advisories change (if they affect routing)
        recalculateRouteIfNeeded();
      });

      // Initialize notification service
      await initNotifications();

      // Set up FCM listener for background notifications
      setupFCMListener(({ notification }) => {
        // Handle incoming FCM notification
        // For now, we'll just show a browser notification if we're in the foreground
        // In a more sophisticated implementation, you might want to handle data-only messages
        // or show a notification even when the app is in the background
        if (notification) {
          const { title, body } = notification;
          showNotification(title, { body });
        }
      });

      // Set up location tracking
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          updateUserPosition(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy
          );

          // Check for proximity alerts when location updates significantly
          // (we could add a threshold here to avoid too frequent checks)
          checkProximityAlerts(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setErrorBanner(true, 'Unable to access location services');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );

      // Also check for proximity alerts and recalculate route periodically (every 5 minutes)
      const proximityCheckInterval = setInterval(() => {
        if (userMarker) {
          const position = userMarker.getLatLng();
          checkProximityAlerts(position.lat, position.lng);
          // Recalculate route periodically to account for changing hazards
          recalculateRouteIfNeeded();
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Update hazards when selected hazard changes
      const selectedHazardSubscription = selectedHazardId.subscribe(() => {
        loadDataBasedOnFilters();
      });

      // Update data when alert chip changes
      const alertChipsSubscription = alertChips.subscribe(() => {
        loadDataBasedOnFilters();
      });

      // Subscribe to notification store updates
      const notificationSubscription = notificationsStore.subscribe(({ unreadCount, loading }) => {
        notificationCount.set(unreadCount);
        notificationLoading.set(loading);
        // Update SR pill based on notification count and online status
        if ($isOnline) {
          if (unreadCount === 0) {
            updateSrPill('Operational');
          } else {
            updateSrPill('Notifications', unreadCount);
          }
        } else {
          // If we're offline, show offline status regardless of notifications
          updateSrPill('Offline');
        }
      });

      // Update notification count periodically (every 2 minutes)
      const notificationUpdateInterval = setInterval(() => {
        // This will trigger the store's update function which we imported and called on mount
        // The store's update function is already set up to run when the user changes
        // We could call it directly here too, but let's rely on the store's internal mechanism
        // For now, we'll just update every 2 minutes to be safe
      }, 2 * 60 * 1000); // 2 minutes

      cleanup = () => {
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
        clearInterval(proximityCheckInterval);
        if (systemTimeInterval) clearInterval(systemTimeInterval);
        clearInterval(notificationUpdateInterval);
        selectedHazardSubscription();
        notificationSubscription();
      };
    } catch (error) {
      console.error('Map initialization error:', error);
      setErrorBanner(true, 'Failed to initialize map');
    }
    })();

    return () => cleanup();
  });

  // Helper functions
  function closeErrorBanner() {
    showErrorBanner.set(false);
  }

  function setErrorBanner(show: boolean, message = '') {
    showErrorBanner.set(show);
    if (message) {
      errorMessage.set(message);
    }
  }

    function openVerificationCard(data: VerificationData | null) {
    verificationData.set(data);
    showVerificationCard.set(true);
  }

  function closeVerificationCard() {
    showVerificationCard.set(false);
    verificationData.set(null);
  }

  function toggleLegend() {
    showLegend.set(!$showLegend);
  }

  function toggleLayerPopup() {
    showLayerPopup.set(!$showLayerPopup);
  }

  function openSheet(contentType: string) {
    sheetContent.set(contentType);
    showSheet.set(true);
  }

  function closeSheet() {
    showSheet.set(false);
  }

  function toggleDestinationInput() {
    showDestinationInput.set(!$showDestinationInput);
    if ($showDestinationInput) {
      // Focus input when opened
      setTimeout(() => {
        const input = document.getElementById('destination-input');
        if (input) input.focus();
      }, 100);
    }
  }

  function toggleRecentDestinations() {
    showRecentDestinations.set(!$showRecentDestinations);
  }

  function selectAlertChip(chipId: string) {
    alertChips.update(chips =>
      chips.map(chip => ({
        ...chip,
        active: chip.id === chipId
      }))
    );
  }

  async function selectHazard(hazardId: string) {
    selectedHazardId.set(hazardId);

    // Fetch the full hazard data to show in verification card
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('*')
        .eq('id', hazardId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        // Extract coordinates from PostGIS point (format: [lng, lat])
        const coordinates = normalizeHazardLocation(data.location);
        if (!coordinates) return;
        const [lng, lat] = coordinates;

        // Format the data for the verification card
        const verificationData = {
          id: data.id,
          hazard_type: data.hazard_type,
          status: data.status,
          created_at: data.created_at,
          photo_url: data.photo_url,
          latitude: lat,
          longitude: lng
        };

        openVerificationCard(verificationData);
      }
    } catch (error) {
      console.error('Error fetching hazard data:', error);
      setErrorBanner(true, 'Failed to load hazard details');
    }
  }

  function clearHazardSelection() {
    selectedHazardId.set(null);
  }

    function updateSrPill(status: string, notifications = 0) {
    srPillStatus.set(status);
    srPillNotifications.set(notifications);
  }

  /**
   * Load data based on selected alert chip and filters
   */
  async function loadDataBasedOnFilters() {
    const activeChip = $alertChips.find(chip => chip.active);
    if (!activeChip) return;

    // Clear both layers first to avoid mixing data from different views
    clearHazardMarkers();
    clearAdvisoryMarkers();

    switch (activeChip.id) {
      case 'all':
        // Show all hazards (non-expired) and advisories
        await loadHazards($selectedHazardId, {}, openHazardDetails);
        await loadAdvisories();
        break;
      case 'nearby':
        // TODO: Implement nearby filtering (would need user location)
        // For now, show all hazards and advisories
        await loadHazards($selectedHazardId, {}, openHazardDetails);
        await loadAdvisories();
        break;
      case 'verify':
        // Show only hazards that need verification
        await loadHazards($selectedHazardId, { status: 'needs_verification' }, openHazardDetails);
        await loadAdvisories();
        break;
      case 'adv':
        // Show only advisories
        await loadAdvisories();
        break;
      default:
        await loadHazards($selectedHazardId, {}, openHazardDetails);
        await loadAdvisories();
    }
  }

  function openHazardDetails(hazard: Hazard) {
    detailHazard = hazard;
  }

  async function verifyHazard(verificationType: string, targetHazardId: string | null = $selectedHazardId) {
    const hazardId = targetHazardId;
    if (!hazardId) return;

    try {
      // Call the Supabase function to verify the hazard
      const { error } = await supabase
        .rpc('verify_hazard', {
          p_hazard_id: hazardId,
          p_verification_type: verificationType
        });

      if (error) {
        throw error;
      }

      // Close the verification card after successful verification
      closeVerificationCard();
      detailHazard = null;

      // Optionally, you could show a toast notification here
      // For now, we'll just close the card and let the UI update via real-time updates
    } catch (error) {
      console.error('Error verifying hazard:', error);
      setErrorBanner(true, 'Failed to verify hazard. Please try again.');
    }
  }

  // Helper function to calculate distance text for verification card
  function calculateDistanceText(latitude: number, longitude: number): string {
    // Get user's current position
    if (!userMarker) return 'unknown distance';

    const userPos = userMarker.getLatLng();

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const lat1 = userPos.lat * Math.PI/180;
    const lat2 = latitude * Math.PI/180;
    const deltaLat = (latitude - userPos.lat) * Math.PI/180;
    const deltaLng = (longitude - userPos.lng) * Math.PI/180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // in meters

    // Return formatted distance
    if (distance < 1000) {
      return Math.round(distance) + ' m';
    } else {
      return (distance/1000).toFixed(1) + ' km';
    }
  }

  // Calculate and display route between two points
    async function calculateAndDisplayRoute(startLat: number, startLng: number, endLat: number, endLng: number) {
    if (!mapContainer) return;

    // Set calculating state
    isCalculatingRoute.set(true);
    updateSrPill('Calculating route...');

    try {
      // Find nearest OSM nodes for better accuracy
      const startNodeId = await findNearestNode(startLat, startLng);
      const endNodeId = await findNearestNode(endLat, endLng);

      if (!startNodeId || !endNodeId) {
        setErrorBanner(true, 'Could not find route. Please try different locations.');
        return;
      }

      // Get the actual coordinates of the nearest nodes
      const startNode = getNode(startNodeId);
      const endNode = getNode(endNodeId);

      if (!startNode || !endNode) {
        setErrorBanner(true, 'Could not find route. Please try different locations.');
        return;
      }

      // Calculate the route
      const route = await findRoute(
        { lat: startNode.lat, lng: startNode.lng },
        { lat: endNode.lat, lng: endNode.lng }
      );

      if (route) {
        // Store the route points for recalculation
        routeStartPoint.set({ lat: startLat, lng: startLng });
        routeEndPoint.set({ lat: endLat, lng: endLng });

        // Display the route on the map
        displayRoute(route);

        // Generate turn-by-turn instructions
        const instructions = generateTurnByTurnInstructions(route.points);
        routeInstructions.set(instructions);

        updateSrPill('Route calculated');
      } else {
        setErrorBanner(true, 'No route found between the specified points.');
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      setErrorBanner(true, 'Error calculating route. Please try again.');
    } finally {
      isCalculatingRoute.set(false);
      if (!$isCalculatingRoute && $notificationCount === 0) {
        updateSrPill('Operational');
      }
    }
  }

  // Clear the current route from the map
  function clearCurrentRoute() {
    clearRoute();
    routeStartPoint.set(null);
    routeEndPoint.set(null);
    activeRoute.set(null);
    if (!$isCalculatingRoute && $notificationCount === 0) {
      updateSrPill('Operational');
    }
  }

  // Recalculate route when hazards change (called from hazard subscription)
  function recalculateRouteIfNeeded() {
    // If we have an active route, recalculate it when hazards change
    if ($routeStartPoint && $routeEndPoint && !$isCalculatingRoute) {
      calculateAndDisplayRoute(
        $routeStartPoint.lat, $routeStartPoint.lng,
        $routeEndPoint.lat, $routeEndPoint.lng
      );
    }
  }
</script>

<!-- Error banner -->
<div id="errbox" class:show={$showErrorBanner}>
  {$errorMessage}
  <button on:click={closeErrorBanner} class="btn btn-sm btn-g">Close</button>
</div>

<!-- Phone view -->
<div id="view-phone">
  <!-- Main container (replaces phone view) -->
  <div id="main-container">
    <!-- Offline banner -->
    <div class="obanner" class:show={!$isOnline} id="offline-banner">
      Offline
    </div>

    <!-- Status bar -->
    <div class="srpill">
      <svg class="ic"><use href="#i-search"/></svg>Search a place or address<button class="bell" id="bellBtn" aria-label="Alerts"><svg class="ic"><use href="#i-bell"/></svg><i id="bellDot"></i></button>
    </div>

    <!-- Screens container -->
    <div class="pscreens">
      <div class="scr on">
        <div class="page">
          <!-- Map wrapper -->
          <div class="mapwrap">
            <div id="map-container" bind:this={mapContainer}></div>
          </div>
        </div>
      </div>

      <!-- Map box buttons -->
      <div class="mbtns">
        <button on:click={toggleLayerPopup} title="Map Layers" class="mbt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3h18v2H3V3zm0 8h18v2H3v-2zm0 8h18v2H3v-2zm0 8h18v2H3v-2z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        <button on:click={toggleLegend} title="Legend" class="mbt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-6h8v6zm0-10H8V4h8v4z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>

      <!-- Legend container -->
      <div class="legend" class:open={$showLegend}>
        <button class="legbtn" on:click={() => showLegend.set(!$showLegend)} title="Legend">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-6h8v6zm0-10H8V4h8v4z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        <div class="legcard">
          <div class="lrow"><span class="lpin"></span>Impassable</div>
          <div class="lrow"><span class="lpin"></span>One lane only</div>
          <div class="lrow"><span class="lpin"></span>Passable with care</div>
          <div class="lrow"><span class="lpin dash"></span>Unconfirmed (single report)</div>
          <div class="lrow"><span class="lsh"><svg viewBox="0 0 24 24"><use href="#i-shieldc"/></svg></span>LGU-verified</div>
          <div class="lrow"><span class="lln"></span>Official advisory</div>
          <div class="lrow"><span class="lln rt2"></span>Your route</div>
        </div>
      </div>

      <!-- Navigation strip (bottom) -->
      <div class="navstrip">
        <div class="navstrip-content">
          <div class="turn">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div>
            <b id="turn-text">Turn</b>
            <small id="turn-distance">100m</small>
          </div>
          <div id="end" class="end">
            End
          </div>
        </div>
      </div>

      <!-- Destination pill -->
      <div class="destpill" class:show={$showDestinationInput}>
        <input
          type="text"
          id="destination-input"
          placeholder="Enter destination"
          bind:value={$destinationInput}
          on:keydown={event => event.key === 'Enter' && toggleDestinationInput()}
         
        />
        <button on:click={toggleDestinationInput}>Go</button>
      </div>

      <!-- Recent destinations -->
      <div class="recents" class:show={$showRecentDestinations}>
        <div class="recents-header">
          <span>Recent</span>
          <button on:click={toggleRecentDestinations} class="btn btn-g btn-sm" aria-label="Close recent destinations">x</button>
        </div>
        <div class="recents-item">
          <span>City Hall</span>
          <button class="recents-delete" on:click={() => alert('Removed')} aria-label="Remove City Hall">x</button>
        </div>
        <div class="recents-item">
          <span>Main Market</span>
          <button class="recents-delete" on:click={() => alert('Removed')} aria-label="Remove Main Market">x</button>
        </div>
      </div>

      <!-- Alert chips -->
      <div class="achips">
        {#each $alertChips as chip}
          <button
            class="chip {chip.active ? 'p' : ''}"
            on:click={() => selectAlertChip(chip.id)}
            aria-label={`Show ${chip.label} hazards`}
           
          >
            {chip.label}
          </button>
        {/each}
      </div>

      <!-- Verification card -->
      <div id="vc" class:show={$showVerificationCard}>
        {#if $verificationData}
          <button class="x" on:click={closeVerificationCard} aria-label="Close verification card">
            <svg class="ic"><use href="#i-x"/></svg>
          </button>
          <div class="t">
            <svg class="ic"><use href="#i-warn"/></svg>
            <span>{$verificationData.hazard_type} reported {calculateDistanceText($verificationData.latitude, $verificationData.longitude)} ahead</span>
          </div>
          <div class="s" id="vcS">
            {$verificationData.hazard_type.charAt(0).toUpperCase() + $verificationData.hazard_type.slice(1)} - you're within 500 m - can you confirm?
          </div>
          <div class="acts">
            <button on:click={() => verifyHazard('hazard_active')} class="btn d">Hazard Active</button>
            <button on:click={() => verifyHazard('hazard_cleared')} class="btn b2">
              Hazard Cleared
            </button>
          </div>
        {/if}
      </div>

      <!-- Coach tip -->
      <div id="coach" class:show={$showCoachTip}>
        <div class="coach-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" stroke="currentColor" stroke-width="2"/>
          </svg>
          <h3>RouteGuard Tips</h3>
        </div>
        <div class="coach-body">
          Tap the FAB to report a hazard. Enable location services for real-time alerts.
        </div>
        <div class="coach-footer">
          <button on:click={() => showCoachTip.set(false)} class="btn btn-g btn-sm">Got it</button>
        </div>
      </div>

      <!-- Layer popup -->
      {#if $showLayerPopup}
        <div class="layer-popup">
          <h3>Map Layers</h3>
          <div class="divider"></div>
          <div>
            <label>
              <input type="checkbox" checked on:change={() => { /* Toggle hazard layer */ }}>
              <span>Hazard Points</span>
            </label>
            <label>
              <input type="checkbox" checked on:change={() => { /* Toggle official advisories */ }}>
              <span>Official Advisories</span>
            </label>
            <label>
              <input type="checkbox" on:change={() => { /* Toggle satellite imagery */ }}>
              <span>Satellite View</span>
            </label>
          </div>
          <div class="divider"></div>
          <div class="note">
            Base layer: OpenStreetMap
          </div>
        </div>
      {/if}

      <!-- FAB menu -->
      <div id="fabmenu" class="fab-menu">
        <button class="fab-toggle" on:click={() => showSheet.update(s => !s)} aria-label="Open menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 13H5v-2h14v2z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        <div class="fab-menu-items">
          <button class="fab-menu-item" title="Report Hazard" on:click={() => openSheet('report-hazard')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="fab-menu-item" title="View Routes" on:click={() => openSheet('route-planner')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 12l10-8 10 8" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="fab-menu-item" title="Settings" on:click={() => openSheet('settings')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98L15.7 7.03c-.18-.18-.41-.29-.65-.29s-.47.11-.65.29l-1.83 1.83c-.37.37-.59.88-.59 1.48v1.9h-2.06v-1.9c0-.6-.22-1.11-.59-1.48l-1.83-1.83c-.18-.18-.41-.28-.65-.29s-.47.1-.65.29l-1.95 1.95c-.04.32-.07.65-.07.98s.03.66.07.98l3.91 3.91c.18.18.41.29.65.29s.47-.11.65-.29l1.83-1.83c.36-.36.86-.58 1.48-.59h1.9c.6 0 1.11.22 1.48.59l1.83 1.83c.18.18.29.41.29.65s-.11.47-.29.65l-1.95 1.95z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Backdrop for modals/sheets -->
      {#if $showSheet}
        <button class="backdrop" on:click={closeSheet} aria-label="Close modal"></button>

        <div class="sheet">
          <div class="sheet-content">
            {#if $sheetContent === 'report-hazard'}
              <!-- Hazard reporting form would go here -->
              <div>
                <h3>Report Hazard</h3>
                <p>Form implementation pending</p>
                <button on:click={closeSheet} class="btn btn-sm btn-secondary">Cancel</button>
              </div>
            {:else if $sheetContent === 'route-planner'}
              <!-- Route planner would go here -->
              <div>
                <h3>Route Planner</h3>
                <p>Form implementation pending</p>
                <button on:click={closeSheet} class="btn btn-sm btn-secondary">Cancel</button>
              </div>
            {:else if $sheetContent === 'settings'}
              <!-- Settings would go here -->
              <div>
                <h3>Settings</h3>
                <p>Settings implementation pending</p>
                <button on:click={closeSheet} class="btn btn-sm btn-secondary">Cancel</button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<HazardDetailSheet
  hazard={detailHazard}
  on:close={() => detailHazard = null}
  on:confirm={(event) => verifyHazard(event.detail.verificationType, event.detail.hazardId)}
/>

<!-- SR pill (top-right, outside phone view) -->
<div class="srpill" class:show={$showSrPill}>
  <div class="dot"></div>
  <span>{$srPillStatus}</span>
  {#if $srPillNotifications > 0}
    <span>
      {$srPillNotifications}
    </span>
  {/if}
</div>







