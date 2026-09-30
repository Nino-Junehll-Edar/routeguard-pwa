<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAgencyRequests, approveAgencyRequest, rejectAgencyRequest, type AgencyRequest } from '$lib/agencyUtils';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';

  let requests: AgencyRequest[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let filterStatus: string = 'all'; // all, pending, approved, rejected
  let isAuthorized = false;
  let authLoading = true;

  // Check if user is authorized (admin) to view this page
  async function checkAuthorization() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      // Not signed in, redirect to login
      goto('/login');
      return;
    }

    // Wait for profile to load if not already loaded
    if (!profileData) {
      // Profile will be loaded via authStore listener, we'll check again in a moment
      // For now, we'll assume not authorized until profile loads
      isAuthorized = false;
      authLoading = false;
      return;
    }

    // Check if user is admin
    isAuthorized = profileData.role === 'admin';
    authLoading = false;

    if (!isAuthorized) {
      // Not authorized, redirect to appropriate page
      goto(profileData.role === 'agency_personnel' ? '/agency' : '/map');
    }
  }

  onMount(async () => {
    await checkAuthorization();
    if (isAuthorized) {
      await loadRequests();
    }
  });

  async function loadRequests() {
    if (!isAuthorized) return;

    isLoading = true;
    errorMessage = null;

    try {
      const filters = filterStatus === 'all' ? {} : { status: filterStatus };
      requests = await loadAgencyRequests(filters);
    } catch (error) {
      console.error('Error loading agency requests:', error);
      // Distinguish between query errors and empty results
      if (error) {
        errorMessage = 'Failed to load requests due to a server error. Please try again.';
      } else if (requests.length === 0 && filterStatus !== 'all') {
        errorMessage = `No ${filterStatus} requests found.`;
      } else if (requests.length === 0) {
        errorMessage = 'No agency requests found.';
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleApprove(requestId: string) {
    if (!isAuthorized) return;

    try {
      const result = await approveAgencyRequest(requestId);
      if (result.success) {
        await loadRequests(); // Refresh list
      } else {
        errorMessage = result.error || 'Failed to approve request';
      }
    } catch (error) {
      console.error('Error approving request:', error);
      errorMessage = 'An error occurred while approving the request';
    }
  }

  async function handleReject(requestId: string) {
    if (!isAuthorized) return;

    try {
      const result = await rejectAgencyRequest(requestId);
      if (result.success) {
        await loadRequests(); // Refresh list
      } else {
        errorMessage = result.error || 'Failed to reject request';
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      errorMessage = 'An error occurred while rejecting the request';
    }
  }
</script>

<div class="admin-requests-container">
  {#if isLoading}
    <div class="loading">Loading agency requests...</div>
  {:else if requests.length === 0}
    <div class="empty-state">
      <p>No agency requests found.</p>
      {#if filterStatus !== 'all'}
        <p>Try changing the filter to see all requests.</p>
      {/if}
    </div>
  {:else}
    <div class="agency-requests-container">
      <h2>Agency Requests</h2>

      {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
      {/if}

      <div class="filters">
        <label for="filter">Filter by status:</label>
        <select id="filter" bind:value={filterStatus} on:change={loadRequests} class="select">
          <option value="all">All Requests</option>
          <option value="pending">Pending Only</option>
          <option value="approved">Approved Only</option>
          <option value="rejected">Rejected Only</option>
        </select>
      </div>

      <table class="requests-table">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Agency</th>
            <th>Role</th>
            <th>ID Number</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Actions</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {#each requests as request}
            <tr class="request-row">
              <td>{request.full_name}</td>
              <td>{request.agency}</td>
              <td>{request.role}</td>
              <td>{request.id_number || 'N/A'}</td>
              <td>{request.purpose}</td>
              <td>
                <span class="status-badge status-{request.status}">
                  {#if request.status === 'pending'}
                    Pending
                  {:else if request.status === 'approved'}
                    Approved
                  {:else}
                    Rejected
                  {/if}
                </span>
              </td>
              <td class="actions-cell">
                {#if request.status === 'pending'}
                  <button on:click={() => handleApprove(request.id)} class="btn-primary btn-sm">
                    Approve
                  </button>
                  <button on:click={() => handleReject(request.id)} class="btn-danger btn-sm">
                    Reject
                  </button>
                {:else}
                  <span class="action-completed">{request.status.charAt(0).toUpperCase() + request.status.slice(1)}d</span>
                {/if}
              </td>
              <td>{new Date(request.created_at).toLocaleString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>