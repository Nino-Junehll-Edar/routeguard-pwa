<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { uploadHazardPhoto, deleteHazardPhoto } from '$lib/storageUtils';
  import type { HazardReportForm } from '$lib/types/hazardReport';
  import { writable, get } from 'svelte/store';
  import { initializeMap, addHazardMarker, loadHazards, clearHazardMarkers, subscribeToHazardChanges } from '$lib/mapUtils';
  import Stepper from '$lib/components/report/Stepper.svelte';
  import TagGrid from '$lib/components/report/TagGrid.svelte';
  import SeverityChips from '$lib/components/report/SeverityChips.svelte';
  import LocationPicker from '$lib/components/report/LocationPicker.svelte';
  import PhotoPreview from '$lib/components/report/PhotoPreview.svelte';

  // Geolocation state machine
  const GEOLOCATION_STATUS = {
    REQUESTING: 'requesting',
    LOCATED: 'located',
    DENIED: 'denied',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
  } as const;

  let geoStatus = writable<typeof GEOLOCATION_STATUS[keyof typeof GEOLOCATION_STATUS]>(GEOLOCATION_STATUS.REQUESTING);
  let latitude: number | null = null;
  let longitude: number | null = null;
  let geoError: string | null = null;
  let manualLocationEnabled = false;
  let manualLat = '';
  let manualLng = '';
  let manualLatError: string | null = null;
  let manualLngError: string | null = null;

  // Stepper state
  let currentStep = 1;
  let canProceed = false;

  // Form state
  let hazardType = '';
  let description = '';
  let severity: 'passable' | 'one_lane' | 'impassable' = 'one_lane'; // Default as per spec
  let photoFile: File | null = null;
  let photoPreview: string | null = null;
  let pinned = false; // Whether user has manually pinned location
  let isSubmitting = false;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // For location handling - we'll use the pin coordinates when pinned, otherwise GPS
  let useLatitude: number | null = null;
  let useLongitude: number | null = null;

  // Initialize geolocation on mount
  onMount(() => {
    // Initialize geolocation
    updateGeolocationStatus(GEOLOCATION_STATUS.REQUESTING);
    if (!navigator.geolocation) {
      updateGeolocationStatus(GEOLOCATION_STATUS.UNAVAILABLE);
      geoError = 'Geolocation is not supported by your browser';
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          updateGeolocationStatus(GEOLOCATION_STATUS.LOCATED);

          // Update form coordinates
          updateFormCoordinates();
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
    }
  });

  // Update form coordinates based on GPS/manual and pin state
  function updateFormCoordinates() {
    // Determine which coordinates to use for the form
    let useLat: number | null = latitude;
    let useLng: number | null = longitude;

    // If manual location is enabled, use manual coordinates
    if (manualLocationEnabled) {
      useLat = parseFloat(manualLat);
      useLng = parseFloat(manualLng);
    }

    // Update the form's use coordinates (what gets stored)
    useLatitude = useLat;
    useLongitude = useLng;

    // Update canProceed based on form validity
    updateCanProceed();
  }

  // Update canProceed based on form validity
  function updateCanProceed() {
    const hasLocation = useLatitude !== null && useLongitude !== null;
    const hasHazardType = hazardType.trim() !== '';
    canProceed = hasLocation && hasHazardType;
  }

  // Geolocation handlers
  function updateGeolocationStatus(status: typeof GEOLOCATION_STATUS[keyof typeof GEOLOCATION_STATUS]) {
    geoStatus.set(status);
  }

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
        updateFormCoordinates();
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

  // Manual location handlers
  function setManualCoordinates(lat: number, lng: number) {
    manualLat = lat.toString();
    manualLng = lng.toString();
    manualLocationEnabled = true;
    manualLatError = null;
    manualLngError = null;
    updateFormCoordinates();
  }

  function confirmManualLocation() {
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
    setManualCoordinates(lat, lng);
    manualLocationEnabled = false;
  }

  function cancelManualLocation() {
    manualLocationEnabled = false;
    manualLatError = null;
    manualLngError = null;
    updateFormCoordinates();
  }

  function previousStep() {
    if (currentStep > 1) {
      currentStep -= 1;
      updateCanProceed();
    }
  }

  // Photo handlers
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

      updateCanProceed(); // In case photo is required for proceed (it's not, but good practice)
    }
  }

  function removePhoto() {
    photoFile = null;
    photoPreview = null;
    updateCanProceed();
  }

  // Tag handler
  function onTagSelect(tag: string) {
    hazardType = tag;
    updateCanProceed();
  }

  // Severity handler
  function onSeveritySelect(sev: 'passable' | 'one_lane' | 'impassable') {
    severity = sev;
    updateCanProceed();
  }

  // Location picker handlers (bound to the component)
  function onLatitudeChange(lat: number | null) {
    latitude = lat;
    updateFormCoordinates();
  }

  function onLongitudeChange(lng: number | null) {
    longitude = lng;
    updateFormCoordinates();
  }

  function onPinnedChange(isPinned: boolean) {
    pinned = isPinned;
    updateFormCoordinates();
  }

  // Form validation
  function validateForm() {
    let valid = true;
    let errors: string[] = [];

    if (!hazardType || hazardType.trim() === '') {
      valid = false;
      errors.push('Please select a hazard type');
    }

    if (useLatitude === null || useLongitude === null) {
      valid = false;
      errors.push('Unable to get your location. Please try again.');
    }

    if (description.length > 140) {
      valid = false;
      errors.push('Description must be 140 characters or less');
    }

    return { valid, errors };
  }

  // Submit handler
  async function handleSubmit() {
    const { valid, errors } = validateForm();
    if (!valid) {
      errorMessage = errors[0]; // Show first error
      return;
    }

    errorMessage = null;
    isSubmitting = true;
    successMessage = null;

    // Track uploaded photo URL for cleanup on failure
    let photoUrl: string | null = null;
    let photoUploaded = false;

    try {
      // Get current user
      const currentUser = get(user);
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

      // Validate we have coordinates
      if (latitude === null || longitude === null) {
        throw new Error('Unable to determine location for hazard');
      }

      // Insert hazard report into database
      const { data, error } = await supabase
        .from('hazards')
        .insert({
          reporter_id: currentUser.id,
          location: `POINT(${longitude} ${latitude})`,
          hazard_type: hazardType,
          description: description || null,
          photo_url: photoUrl,
          severity: severity, // New field per spec
          status: 'unconfirmed',
          lifetime_minutes: 30
        });

      if (error) {
        throw error;
      }

      successMessage = 'Hazard reported. +5 points will be awarded after it is verified as active.';

      // Reset form
      hazardType = '';
      description = '';
      severity = 'one_lane'; // Reset to default
      photoFile = null;
      photoPreview = null;
      manualLat = '';
      manualLng = '';
      manualLocationEnabled = false;
      pinned = false;

      // Reset location to GPS
      updateFormCoordinates();

      // Auto-return to map after delay
      setTimeout(() => {
        window.location.assign('/map');
      }, 2000);

    } catch (error) {
      const reportError = error as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };
      console.error('Error reporting hazard:', reportError);
      errorMessage = error instanceof Error
        ? error.message
        : reportError.message || 'An unknown error occurred';

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

<style>
  /* Import CSS variables from the design overhaul */
  :root{
    --bg:#E7EDF4;--surface:#FFFFFF;--raised:#FFFFFF;--border:#DDE3EA;--ink:#12161A;--ink2:#4A545E;
    --primary:#1B5CA8;--primary-ink:#0F3460;--primary-surface:#E7F0FA;--danger:#C4271E;--danger-sf:#FBE9E7;
    --warning:#B45309;--warning-sf:#FCF0DD;--caution:#F0A400;--neutral:#64748B;--neutral-sf:#EEF1F5;
    --success:#2E8555;--success-sf:#E4F3EB;--advisory:#6D28D9;--advisory-sf:#F1EAFB;--route:#1D66C9;--gold:#B7791F;
    --map-land:#EDF1F6;--map-water:#C9E0F4;--map-road:#FFFFFF;--map-minor:#F2F5F9;--map-pk:#DDEAD9;--map-lbl:#5B6B7B;
    --r-s:8px;--r-m:12px;--r-l:16px;--e1:0 1px 2px rgba(10,20,30,.12);--e2:0 4px 14px rgba(10,20,30,.16);--e3:0 12px 32px rgba(10,20,30,.22);
    --ease:cubic-bezier(.32,.72,.24,1);--f:'Public Sans',system-ui,-apple-system,sans-serif;--navh:70px
  }
  [data-theme=dark]{
    --bg:#0E1116;--surface:#161B22;--raised:#1C2430;--border:#2A3340;--ink:#E6EAF0;--ink2:#9AA7B4;
    --primary:#5E93D6;--primary-ink:#C5D9F2;--primary-surface:#12283F;--danger:#FF6B4A;--danger-sf:#2E1512;
    --warning:#FFC24B;--warning-sf:#2A1F0E;--caution:#E0B341;--neutral:#94A3B8;--neutral-sf:#1D242E;
    --success:#4AC97E;--success-sf:#12271B;--advisory:#A78BFA;--advisory-sf:#1D1533;--route:#6EA8FF;--gold:#E9B44C;
    --map-land:#12171E;--map-water:#0E2438;--map-road:#39434F;--map-minor:#1D242E;--map-pk:#17251B;--map-lbl:#7C8A99
  }

  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--f);background:var(--app-background,linear-gradient(145deg,#E7EDF4 0%,#DCE8F5 52%,#D3E1F1 100%));color:var(--ink);font-size:14.5px;line-height:1.5;-webkit-font-smoothing:antialiased}

  .report-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  .step-content {
    padding: 24px 0;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--ink2);
    font-size: 14px;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    background: var(--surface);
    color: var(--ink);
    font-family: var(--f);
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-surface);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .char-count {
    font-size: 12px;
    color: var(--ink2);
    margin-top: 4px;
    text-align: right;
  }

  .review-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-l);
    padding: 20px;
  }

  .review-item {
    display: flex;
    margin-bottom: 16px;
  }

  .review-item:last-child {
    margin-bottom: 0;
  }

  .review-label {
    width: 120px;
    font-weight: 600;
    color: var(--ink2);
    flex-shrink: 0;
  }

  .review-value {
    flex: 1;
    color: var(--ink);
    line-height: 1.5;
  }

  .review-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    margin-left: 8px;
  }

  .review-photo {
    max-width: 150px;
    border-radius: var(--r-s);
    margin-top: 8px;
  }

  .review-hint {
    font-size: 13px;
    color: var(--ink2);
    margin-top: 16px;
    font-style: italic;
    line-height: 1.4;
  }

  .btn-outline {
    padding: 8px 16px;
    border-radius: var(--r-m);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-outline:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  .btn-outline:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-outline:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Hint text styling */
  .hint {
    font-size: 13px;
    color: var(--ink2);
    margin-top: 8px;
    line-height: 1.4;
  }

  /* Dark mode overrides */
  [data-theme=dark] .report-container {
    color: var(--ink);
  }

  [data-theme=dark] .form-group label {
    color: var(--ink2);
  }

  [data-theme=dark] .form-group input,
  [data-theme=dark] .form-group textarea,
  [data-theme=dark] .form-group select {
    background: var(--surface);
    color: var(--ink);
    border-color: var(--border);
  }

  [data-theme=dark] .form-group input:focus,
  [data-theme=dark] .form-group textarea:focus,
  [data-theme=dark] .form-group select:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-surface);
  }

  [data-theme=dark] .review-section {
    background: var(--surface);
    border-color: var(--border);
  }

  [data-theme=dark] .review-value {
    color: var(--ink);
  }

  [data-theme=dark] .review-hint {
    color: var(--ink2);
  }
</style>

<div class="report-container">
  <h2>Report a Hazard</h2>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <Stepper
    {currentStep}
    {canProceed}
    {isSubmitting}
    onStepChange={(step) => currentStep = step}
    onSubmit={handleSubmit}
    onPrevious={previousStep}
  >
    <div slot="tag" class="step-content">
      <TagGrid
        selectedTag={hazardType}
        onTagSelect={onTagSelect}
      />

      <!-- Hint about tag selection -->
      <p class="hint">Select the type of hazard you're reporting</p>
    </div>

    <div slot="details" class="step-content">
      <div class="form-group">
        <SeverityChips
          selectedSeverity={severity}
          onSeveritySelect={onSeveritySelect}
        />

        <p class="hint">
          Passable: Normal traffic flow<br/>
          One lane: Lane reduced, traffic slowed<br/>
          Impassable: Road closed, no traffic
        </p>
      </div>

      <div class="form-group">
        <label for="description">Description (optional):</label>
        <textarea
          id="description"
          bind:value={description}
          maxlength="140"
          placeholder="Describe the hazard (max 140 characters)"
        />
        {#if description.length > 0}
          <div class="char-count">
            {description.length}/140 characters
          </div>
        {/if}
      </div>

      <div class="form-group">
        <PhotoPreview
          bind:photoFile
          bind:photoPreview
          onPhotoRemove={removePhoto}
        />
      </div>

      <div class="form-group">
        <LocationPicker
          bind:latitude
          bind:longitude
          bind:pinned
        />
      </div>
    </div>

    <div slot="review" class="step-content">
      <div class="review-section">
        <div class="review-item">
          <div class="review-label">Hazard Type:</div>
          <div class="review-value">
            {#if hazardType === 'flood'}
              Flooding
            {:else if hazardType === 'pothole'}
              Pothole
            {:else if hazardType === 'accident'}
              Accident
            {:else if hazardType === 'obstruction'}
              Obstruction
            {:else if hazardType === 'landslide'}
              Landslide
            {:else if hazardType === 'tree'}
              Fallen Tree
            {:else if hazardType === 'collapse'}
              Road Collapse
            {:else if hazardType === 'other'}
              Other
            {/if}
          </div>
        </div>

        <div class="review-item">
          <div class="review-label">Severity:</div>
          <div class="review-value">
            {#if severity === 'passable'}
              Passable
            {:else if severity === 'one_lane'}
              One lane
            {:else if severity === 'impassable'}
              Impassable
            {/if}
          </div>
          <div
            class="review-indicator"
            style:background-color={severity === 'passable' ? 'var(--caution)' : severity === 'one_lane' ? 'var(--warning)' : 'var(--danger)'}
          ></div>
        </div>

        {#if description}
          <div class="review-item">
            <div class="review-label">Description:</div>
            <div class="review-value">{description}</div>
          </div>
        {/if}

        {#if photoPreview}
          <div class="review-item">
            <div class="review-label">Photo:</div>
            <div class="review-value">
              <img src={photoPreview} alt="Photo preview" class="review-photo">
            </div>
          </div>
        {/if}

        <div class="review-item">
          <div class="review-label">Location:</div>
          <div class="review-value">
            {#if useLatitude !== null && useLongitude !== null}
              Lat: {useLatitude.toFixed(6)}, Lng: {useLongitude.toFixed(6)}
              <br />
              <span class="location-mode">
                {pinned ? 'Pinned on map' : 'Using GPS location'}
              </span>
            {:else}
              Getting location...
            {/if}
          </div>
        </div>

        <p class="hint review-hint">
          The location shown above is what will be stored with the hazard report.
          {#if pinned}
            You have manually positioned the pin on the map.
          {:else}
            The location is based on your current GPS position.
          {/if}
        </p>
      </div>
    </div>
  </Stepper>
</div>
