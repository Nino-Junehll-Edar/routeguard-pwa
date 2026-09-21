<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { uploadHazardPhoto } from '$lib/storageUtils';
  import type { HazardReportForm } from '$lib/types/hazardReport';

  let hazardType = '';
  let description = '';
  let photoFile: File | null = null;
  let photoPreview: string | null = null;
  let isSubmitting = false;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // Get user location on mount
  onMount(() => {
    if (!navigator.geolocation) {
      errorMessage = 'Geolocation is not supported by your browser';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      },
      (error) => {
        errorMessage = `Unable to get location: ${error.message}`;
      }
    );
  });

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
    if (!latitude || !longitude) {
      errorMessage = 'Unable to get your location. Please try again.';
      return;
    }

    if (!hazardType) {
      errorMessage = 'Please select a hazard type';
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    try {
      // Upload photo if provided
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadHazardPhoto(photoFile);
        if (!photoUrl) {
          throw new Error('Failed to upload photo');
        }
      }

      // Insert hazard report into database
      const { data, error } = await supabase
        .from('hazards')
        .insert({
          reporter_id: user.get()?.id ?? null,
          location: `POINT(${longitude} ${latitude})`,
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

    } catch (error) {
      console.error('Error reporting hazard:', error);
      errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
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
      <p>Your location will be automatically included with this report.</p>
      {#if latitude && longitude}
        <p class="location-info">Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}</p>
      {/if}
    </div>

    <button type="submit" disabled={isSubmitting}>
      {#if isSubmitting}
        Reporting...
      {:else}
        Report Hazard
      {/if}
    </button>
  </form>
</div>

<style>
  .report-container {
    max-width: 500px;
    margin: 2rem auto;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .form-group textarea {
    resize: vertical;
  }

  .photo-preview {
    margin-top: 1rem;
    text-align: center;
  }

  .photo-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .error-message {
    background-color: #ffe6e6;
    color: #d33;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }

  .success-message {
    background-color: #e6ffe6;
    color: #2d5a2d;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
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
</style>