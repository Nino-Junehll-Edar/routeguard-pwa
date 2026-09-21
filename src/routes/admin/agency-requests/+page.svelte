<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAgencyRequests, approveAgencyRequest, rejectAgencyRequest } from '$lib/agencyUtils';
  import { user } from '$lib/authStore';

  let requests: AgencyRequest[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let filterStatus: string = 'all'; // all, pending, approved, rejected

  onMount(async () => {
    await loadRequests();
  });

  async function loadRequests() {
    isLoading = true;
    errorMessage = null;

    try {
      const filters = filterStatus === 'all' ? {} : { status: filterStatus };
      requests = await loadAgencyRequests(filters);
    } catch (error) {
      console.error('Error loading agency requests:', error);
      errorMessage = 'Failed to load requests. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleApprove(requestId: string) {
    const currentUser = user.get();
    if (!currentUser) return;

    try {
      const result = await approveAgencyRequest(requestId, currentUser.id);
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
    const currentUser = user.get();
    if (!currentUser) return;

    try {
      const result = await rejectAgencyRequest(requestId, currentUser.id);
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
      <select id="filter" bind:value={filterStatus} on:change={loadRequests}>
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
                <button on:click={() => handleApprove(request.id)} class="approve-btn">
                  Approve
                </button>
                <button on:click={() => handleReject(request.id)} class="reject-btn">
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

<style>
  .agency-requests-container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .filters {
    margin-bottom: 1.5rem;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .filters label {
    font-weight: bold;
  }

  .filters select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .requests-table {
    width: 100%;
    border-collapse: collapse;
  }

  .requests-table th,
  .requests-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .requests-table th {
    background-color: #f8f9fa;
    font-weight: bold;
  }

  .requests-table tbody tr:hover {
    background-color: #f5f5f5;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.875rem;
    font-weight: bold;
    text-transform: uppercase;
  }

  .status-badge.status-pending {
    background-color: #fff3cd;
    color: #856404;
  }

  .status-badge.status-approved {
    background-color: #d4edda;
    color: #155724;
  }

  .status-badge.status-rejected {
    background-color: #f8d7da;
    color: #721c24;
  }

  .actions-cell {
    gap: 0.5rem;
    display: flex;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 3px;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
  }

  .approve-btn {
    background-color: #28a745;
    color: white;
  }

  .approve-btn:hover {
    background-color: #218838;
  }

  .reject-btn {
    background-color: #dc3545;
    color: white;
  }

  .reject-btn:hover {
    background-color: #c82333;
  }

  .action-completed {
    color: #6c757d;
    font-style: italic;
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error-message {
    background-color: #ffe6e6;
    color: #d33;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }
</style>