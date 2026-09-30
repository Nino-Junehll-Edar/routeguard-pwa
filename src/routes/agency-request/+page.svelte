<script lang="ts">
  import { onMount } from 'svelte';
  import { submitAgencyRequest } from '$lib/agencyUtils';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';

  let formData = {
    full_name: '',
    agency: '',
    role: '',
    id_number: '',
    purpose: ''
  };

  let isSubmitting = false;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let isLoading = true;
  let authRedirect = '';

  // Check authentication and redirect if needed
  async function checkAuth() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      // Not signed in, redirect to login
      authRedirect = '/agency-request';
      goto('/login');
      return;
    }

    // Wait for profile to load if needed
    if (!profileData) {
      // Profile will be loaded via authStore listener
      // For now, we'll assume the user doesn't have agency access until profile loads
      isLoading = false;
      return;
    }

    // Check if user is already agency personnel or admin
    if (profileData && (profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
      // Already has agency access, redirect appropriately
      goto(profileData.role === 'admin' ? '/admin/agency-requests' : '/agency');
      return;
    }

    // Prefill form with profile data
    if (profileData) {
      formData.full_name = profileData.full_name || '';
      // Email is not in the form, but we could add it if needed
    }

    isLoading = false;
  }

  onMount(() => {
    checkAuth();
  });

  // Function to check if user already has a pending request
  async function hasPendingRequest(): Promise<boolean> {
    const currentUser = user.get();
    if (!currentUser) return false;

    try {
      const { data, error } = await supabase
        .from('agency_requests')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        console.error('Error checking for pending request:', error);
        return false; // Assume no pending request on error to allow submission
      }

      return !!data; // true if a pending request exists
    } catch (error) {
      console.error('Error checking for pending request:', error);
      return false;
    }
  }

  async function handleSubmit() {
    // Basic validation
    if (!formData.full_name || !formData.agency || !formData.role || !formData.purpose) {
      errorMessage = 'Please fill in all required fields';
      return;
    }

    // Check for existing pending request
    const hasPending = await hasPendingRequest();
    if (hasPending) {
      errorMessage = 'You already have a pending agency request. Please wait for it to be reviewed.';
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    try {
      const result = await submitAgencyRequest(formData);

      if (result.success) {
        successMessage = 'Your agency request has been submitted successfully! An administrator will review it shortly.';
        // Reset form
        formData = {
          full_name: '',
          agency: '',
          role: '',
          id_number: '',
          purpose: ''
        };
      } else {
        errorMessage = result.error || 'Failed to submit request. Please try again.';
      }
    } catch (error) {
      console.error('Error submitting agency request:', error);
      errorMessage = 'An unexpected error occurred. Please try again later.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="agency-request-container">
  <h2>Request Agency Access</h2>
  <p class="description">
    Fill out the form below to request access as agency personnel.
    Your request will be reviewed by an administrator.
  </p>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="full_name">Full Name:</label>
      <input type="text" id="full_name" bind:value={formData.full_name} required class="input" />
    </div>

    <div class="form-group">
      <label for="agency">Agency/Organization:</label>
      <input type="text" id="agency" bind:value={formData.agency} required class="input" />
    </div>

    <div class="form-group">
      <label for="role">Role/Position:</label>
      <input type="text" id="role" bind:value={formData.role} required class="input" />
    </div>

    <div class="form-group">
      <label for="id_number">ID Number (optional):</label>
      <input type="text" id="id_number" bind:value={formData.id_number} class="input" />
    </div>

    <div class="form-group">
      <label for="purpose">Purpose/Reason for Request:</label>
      <textarea id="purpose" bind:value={formData.purpose} rows="4" required class="input"></textarea>
    </div>

    <button type="submit" disabled={isSubmitting} class="btn-primary">
      {#if isSubmitting}
        Submitting...
      {:else}
        Submit Request
      {/if}
    </button>
  </form>
</div>