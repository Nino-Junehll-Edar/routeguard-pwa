<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { uploadHazardPhoto, deleteHazardPhoto } from '$lib/storageUtils';
  import type { HazardReportForm } from '$lib/types/hazardReport';
  import { writable } from 'svelte/store';

  // Geolocation state machine
  const GEOLOCATION_STATUS = {
    REQUESTING: 'requesting',
    LOCATED: 'located',
    DENIED: 'denied',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
  } as const;

  let geoStatus = writable<keyof typeof GEOLOCATION_STATUS>(GEOLOCATION_STATUS.REQUESTING);
  let latitude: number | null = null;
  let longitude: number | null = null;
  let geoError: string | null = null;
  let manualLocationEnabled = false;
  let manualLat = '';
  let manualLng = '';
  let manualLatError: string | null = null;
  let manualLngError: string | null = null;

  let hazardType = '';
  let description = '';
  let photoFile: File | null = null;
  let photoPreview: string | null = null;
  let isSubmitting = false;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // Initialize geolocation on mount
  onMount(() => {
    updateGeolocationStatus(GEOLOCATION_STATUS.REQUESTING);
    if (!navigator.geolocation) {
      updateGeolocationStatus(GEOLOCATION_STATUS.UNAVAILABLE);
      geoError = 'Geolocation is not supported by your browser';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        updateGeolocationStatus(GEOLOCATION_STATUS.LOCATED);
      },
      (error) => {
        // Handle different error types
        switch (error.code) {
          case error.PERMISSION_DENIED:
            updateGeolocationStatus(GEOLOCATION_STATUS.DENIED);
            geoError = 'Location permission denied. Please enable location services to report hazards.';
            break;
          case error.POSITION_UNAVAILABLE:
            updateGeolocationStatus(GEOLOCATION_STATUS.UNAVAILABLE);
            geoError = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            updateGeolocationStatus(GEOLOCATION_STATUS.ERROR);
            geoError = 'Location request timed out.';
            break;
          default:
            updateGeolocationStatus(GEOLOCATION_STATUS.ERROR);
            geoError = `Unknown error: ${error.message}`;
            break;
        }
      }
    );
  });

  function updateGeolocationStatus(status: keyof typeof GEOLOCATION_STATUS) {
    geoStatus.set(status);
  }

  // Retry geolocation request
  function retryGeolocation() {
    updateGeolocationStatus(GEOLOCATION_STATUS.REQUESTING);
    geoError = null;
    if (!navigator.geolocation) {
      updateGeolocationStatus(GEOLOCATION_STATUS.UNAVAILABLE);
      geoError = 'Geolocation is not supported by your browser';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        updateGeolocationStatus(GEOLOCATION_STATUS.LOCATED);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            updateGeolocationStatus(GEOLOCATION_STATUS.DENIED);
            geoError = 'Location permission denied. Please enable location services to report hazards.';
            break;
          case error.POSITION_UNAVAILABLE:
            updateGeolocationStatus(GEOLOCATION_STATUS.UNAVAILABLE);
            geoError = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            updateGeolocationStatus(GEOLOCATION_STATUS.ERROR);
            geoError = 'Location request timed out.';
            break;
          default:
            updateGeolocationStatus(GEOLOCATION_STATUS.ERROR);
            geoError = `Unknown error: ${error.message}`;
            break;
        }
      }
    );
  }

  async function handlePhotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      photoFile = input.files[0];

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        photoPreview = reader.result as string;
      };
      reader.readAsDataURL(photoFile);
    }
  }

  async function handleSubmit() {
    // Determine which coordinates to use
    let useLatitude: number | null = latitude;
    let useLongitude: number | null = longitude;

    // If manual location is enabled, use manual coordinates
    if (manualLocationEnabled) {
      useLatitude = parseFloat(manualLat);
      useLongitude = parseFloat(manualLng);

      // Validate manual coordinates
      if (isNaN(useLatitude) || useLatitude < -90 || useLatitude > 90) {
        errorMessage = 'Please enter a valid latitude between -90 and 90';
        return;
      }
      if (isNaN(useLongitude) || useLongitude < -180 || useLongitude > 180) {
        errorMessage = 'Please enter a valid longitude between -180 and 180';
        return;
      }
    } else {
      // Validate that we have a location from geolocation (check for null, not falsy, to allow 0,0)
      if (useLatitude === null || useLongitude === null) {
        errorMessage = 'Unable to get your location. Please try again.';
        return;
      }
    }

    if (!hazardType) {
      errorMessage = 'Please select a hazard type';
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    // Track uploaded photo URL for cleanup on failure
    let photoUrl: string | null = null;
    let photoUploaded = false;

    try {
      // Get current user
      const currentUser = user.get();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Upload photo if provided
      if (photoFile) {
        photoUrl = await uploadHazardPhoto(photoFile, currentUser.id);
        if (!photoUrl) {
          throw new Error('Failed to upload photo');
        }
        photoUploaded = true;
      }

      // Insert hazard report into database
      const { data, error } = await supabase
        .from('hazards')
        .insert({
          reporter_id: currentUser.id,
          location: `POINT(${useLongitude} ${useLatitude})`,
          hazard_type: hazardType,
          description: description || null,
          photo_url: photoUrl,
          status: 'unconfirmed',
          lifetime_minutes: 30
        });

      if (error) {
        throw error;
      }

      successMessage = 'Hazard reported successfully!';

      // Reset form
      hazardType = '';
      description = '';
      photoFile = null;
      photoPreview = null;
      manualLat = '';
      manualLng = '';
      manualLocationEnabled = false;

    } catch (error) {
      console.error('Error reporting hazard:', error);
      errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      // Clean up uploaded photo if hazard insert failed
      if (photoUploaded && photoUrl) {
        try {
          await deleteHazardPhoto(photoUrl);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded photo:', cleanupError);
          // We don't want to overwrite the original error with cleanup error
        }
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="report-container">
  <h2>Report a Hazard</h2>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="hazard-type">Hazard Type:</label>
      <select id="hazard-type" bind:value={hazardType} required>
        <option value="">Select hazard type</option>
        <option value="flooding">Flooding</option>
        <option value="debris">Debris/Road Blockage</option>
        <option value="roadblock">Complete Roadblock</option>
        <option value="landslide">Landslide</option>
        <option value="collapsed_structure">Collapsed Structure</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div class="form-group">
      <label for="description">Description (optional):</label>
      <textarea id="description" bind:value={description} rows="3"></textarea>
    </div>

    <div class="form-group">
      <label for="photo">Photo Evidence (recommended):</label>
      <input type="file" id="photo" accept="image/*" on:change={handlePhotoChange} />
      {#if photoPreview}
        <div class="photo-preview">
          <img src={photoPreview} alt="Preview" />
        </div>
      {/if}
    </div>

    <div class="form-group">
      <p>{#if $geoStatus === 'requesting'}
        Getting your location...
      {:else if $geoStatus === 'located'}
        Your location: Lat: {$latitude?.toFixed(6) || '0.000000'}, Lng: {$longitude?.toFixed(6) || '0.000000'}
      {:else if $geoStatus === 'denied'}
        Location permission denied.
        <button on:click={retryGeolocation} class="btn-link">Try again</button> or
        <button on:click={() => manualLocationEnabled = true} class="btn-link">Enter manually</button>
      {:else if $geoStatus === 'unavailable'}
        Geolocation is not supported by your browser.
        <button on:click={() => manualLocationEnabled = true} class="btn-link">Enter location manually</button>
      {:else if $geoStatus === 'error'}
        {$geoError}
        <button on:click={retryGeolocation} class="btn-link">Try again</button>
      {/if}</p>
    </div>

    {#if manualLocationEnabled}
    <div class="form-group">
      <h3>Enter Location Manually</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="manual-lat">Latitude:</label>
          <input type="number" id="manual-lat" bind:value={manualLat} step="any" />
          {#if manualLatError}
            <p class="error">{manualLatError}</p>
          {/if}
        </div>
        <div class="form-group">
          <label for="manual-lng">Longitude:</label>
          <input type="number" id="manual-lng" bind:value={manualLng} step="any" />
          {#if manualLngError}
            <p class="error">{manualLngError}</p>
          {/if}
        </div>
      </div>
      <button on:click={() => {
        manualLatError = null;
        manualLngError = null;
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          manualLatError = 'Please enter a valid latitude between -90 and 90';
          return;
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          manualLngError = 'Please enter a valid longitude between -180 and 180';
          return;
        }
        latitude = lat;
        longitude = lng;
        manualLocationEnabled = false;
      }} class="btn-primary">
        Use Manual Location
      </button>
      <button on:click={() => manualLocationEnabled = false} class="btn-link">
        Cancel
      </button>
    </div>
    {/if}

    <button type="submit" disabled={isSubmitting} class="btn-primary">
      {#if isSubmitting}
        Reporting...
      {:else}
        Report Hazard
      {/if}
    </button>
  </form>
</div>