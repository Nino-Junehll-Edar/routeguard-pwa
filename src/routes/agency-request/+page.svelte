<script lang="ts">
  import { onMount } from 'svelte';
  import { submitAgencyRequest } from '$lib/agencyUtils';
  import { user } from '$lib/authStore';

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

  // Pre-fill with user data if available
  onMount(() => {
    const currentUser = user.get();
    if (currentUser) {
      // In a real app, you might fetch profile data to pre-fill
      formData.full_name = currentUser.user_metadata?.full_name || '';
    }
  });

  async function handleSubmit() {
    // Basic validation
    if (!formData.full_name || !formData.agency || !formData.role || !formData.purpose) {
      errorMessage = 'Please fill in all required fields';
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
      <input type="text" id="full_name" bind:value={formData.full_name} required />
    </div>

    <div class="form-group">
      <label for="agency">Agency/Organization:</label>
      <input type="text" id="agency" bind:value={formData.agency} required />
    </div>

    <div class="form-group">
      <label for="role">Role/Position:</label>
      <input type="text" id="role" bind:value={formData.role} required />
    </div>

    <div class="form-group">
      <label for="id_number">ID Number (optional):</label>
      <input type="text" id="id_number" bind:value={formData.id_number} />
    </div>

    <div class="form-group">
      <label for="purpose">Purpose/Reason for Request:</label>
      <textarea id="purpose" bind:value={formData.purpose} rows="4" required></textarea>
    </div>

    <button type="submit" disabled={isSubmitting}>
      {#if isSubmitting}
        Submitting...
      {:else}
        Submit Request
      {/if}
    </button>
  </form>
</div>

<style>
  .agency-request-container {
    max-width: 600px;
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
    background-color: #28a745;
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
    background-color: #218838;
  }

  .description {
    color: #666;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }
</style>