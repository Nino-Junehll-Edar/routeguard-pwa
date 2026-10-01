<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAgencyRequests, approveAgencyRequest, rejectAgencyRequest, type AgencyRequest } from '$lib/agencyUtils';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

  let requests: AgencyRequest[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let activeTab: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'; // all, pending, approved, rejected
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
    successMessage = null;

    try {
      const filters = activeTab === 'all' ? {} : { status: activeTab };
      requests = await loadAgencyRequests(filters);
    } catch (error) {
      console.error('Error loading agency requests:', error);
      // Distinguish between query errors and empty results
      if (error) {
        errorMessage = 'Failed to load requests due to a server error. Please try again.';
      } else if (requests.length === 0 && activeTab !== 'all') {
        errorMessage = `No ${activeTab} requests found.`;
      } else if (requests.length === 0) {
        errorMessage = 'No agency requests found.';
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleApprove(requestId: string) {
    if (!isAuthorized) return;

    // Confirmation dialog per spec
    if (!window.confirm('Approving this request will grant the user agency_personnel access and notify them to sign in. Continue?')) {
      return;
    }

    try {
      const result = await approveAgencyRequest(requestId);
      if (result.success) {
        successMessage = `'Approved — notified to sign in'`; // Simplified per spec
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

    // Reject requires a reason per spec
    const reason = window.prompt('Please provide a reason for rejecting this request:');
    if (reason === null) {
      // User canceled
      return;
    }

    if (reason.trim() === '') {
      errorMessage = 'Please provide a reason for rejection';
      return;
    }

    try {
      const result = await rejectAgencyRequest(requestId, reason);
      if (result.success) {
        successMessage = 'Request rejected';
        await loadRequests(); // Refresh list
      } else {
        errorMessage = result.error || 'Failed to reject request';
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      errorMessage = 'An error occurred while rejecting the request';
    }
  }

  // Get initials from name
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Format time ago
  function formatTimeAgo(dateString: string): string {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    let interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
      return interval + ' years ago';
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
      return interval + ' months ago';
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
      return interval + ' days ago';
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
      return interval + ' hours ago';
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
      return interval + ' minutes ago';
    }
    return Math.floor(seconds) + ' seconds ago';
  }
</script>

{#if authLoading}
  <div class="loading">Loading...</div>
{:else if !isAuthorized}
  <div class="unauthorized">Unauthorized access</div>
{:else}
  <div class="admin-requests-container">
    <div class="tabs">
      <button
        class:active={activeTab === 'pending'}
        on:click={() => { activeTab = 'pending'; loadRequests(); }}
      >
        Pending
      </button>
      <button
        class:active={activeTab === 'approved'}
        on:click={() => { activeTab = 'approved'; loadRequests(); }}
      >
        Approved
      </button>
      <button
        class:active={activeTab === 'rejected'}
        on:click={() => { activeTab = 'rejected'; loadRequests(); }}
      >
        Rejected
      </button>
      <button
        class:active={activeTab === 'all'}
        on:click={() => { activeTab = 'all'; loadRequests(); }}
      >
        All
      </button>
    </div>

    {#if isLoading}
      <div class="loading">Loading agency requests...</div>
    {:else if requests.length === 0}
      <div class="empty-state">
        <p>{#if errorMessage}
          {errorMessage}
        {:else}
          {#if activeTab === 'all'}
            No agency requests found.
          {:else}
            No ${activeTab} requests found.
          {/if}
        {/if}</p>
        {#if activeTab !== 'all'}
          <p>Try changing the tab to see all requests.</p>
        {/if}
      </div>
    {:else}
      <div class="requests-table">
        <table>
          <thead>
            <tr>
              <th></th> <!-- For initials avatar -->
              <th>Full Name</th>
              <th>Agency</th>
              <th>Role</th>
              <th>ID Number</th>
              <th>Purpose</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each requests as request}
              <tr class="request-row">
                <td class="initials-cell">
                  <div class="initials-avatar">
                    {getInitials(request.full_name)}
                  </div>
                </td>
                <td>{request.full_name}</td>
                <td>{request.agency}</td>
                <td>{request.role}</td>
                <td>{request.id_number || 'N/A'}</td>
                <td class="purpose-cell">
                  <p>{request.purpose}</p>
                </td>
                <td class="time-cell">
                  <p>{formatTimeAgo(request.created_at)}</p>
                </td>
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
                    <div class="action-buttons">
                      <button
                        on:click={() => handleApprove(request.id)}
                        class="btn-action btn-approve"
                      >
                        Approve
                      </button>
                      <button
                        on:click={() => handleReject(request.id)}
                        class="btn-action btn-reject"
                      >
                        Reject
                      </button>
                    </div>
                  {:else}
                    <span class="action-completed">
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}d
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if successMessage}
      <div class="success-message">{successMessage}</div>
    {/if}
    {#if errorMessage}
      <div class="error-message">{errorMessage}</div>
    {/if}
  </div>
{/if}

<style>
  .admin-requests-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .tabs button {
    padding: 8px 16px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    border-radius: var(--r-s);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .tabs button.active {
    background: var(--primary);
    color: var(--primary-ink);
    border-color: var(--primary);
  }

  .tabs button:hover:not(.active) {
    background: var(--primary-surface);
    color: var(--primary);
    border-color: var(--primary);
  }

  .requests-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .requests-table th,
  .requests-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .requests-table th {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .initials-cell {
    width: 48px;
    padding-left: 24px !important;
  }

  .initials-avatar {
    width: 32px;
    height: 32px;
    background: var(--primary-surface);
    color: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .purse-cell p,
  .time-cell p {
    margin: 0;
    color: var(--ink2);
    font-size: 0.875rem;
  }

  .purse-cell p {
    line-height: 1.4;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-badge.pending {
    background: var(--warning-surface);
    color: var(--warning);
  }

  .status-badge.approved {
    background: var(--success-surface);
    color: var(--success);
  }

  .status-badge.rejected {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .actions-cell {
    padding-left: 24px !important;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .btn-action {
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-approve {
    background: var(--success);
    color: white;
  }

  .btn-approve:hover:not(:disabled) {
    background: var(--success-dark);
  }

  .btn-reject {
    background: var(--danger);
    color: white;
  }

  .btn-reject:hover:not(:disabled) {
    background: var(--danger-dark);
  }

  .btn-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-completed {
    color: var(--ink2);
    font-style: italic;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--ink2);
  }

  .loading {
    text-align: center;
    padding: 40px 20px;
    color: var(--ink2);
  }

  .success-message {
    background: var(--success-surface);
    color: var(--success);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin: 16px 0;
    font-size: 0.875rem;
  }

  .error-message {
    background: var(--danger-surface);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin: 16px 0;
    font-size: 0.875rem;
  }

  /* Dark mode adjustments */
  [data-theme=dark] .tabs button {
    border-color: var(--border);
    background: var(--surface);
    color: var(--ink);
  }

  [data-theme=dark] .tabs button.active {
    background: var(--primary);
    color: var(--primary-ink);
  }

  [data-theme=dark] .tabs button:hover:not(.active) {
    background: var(--primary-surface);
    color: var(--primary);
  }

  [data-theme=dark] .requests-table th,
  [data-theme=dark] .requests-table td {
    border-color: var(--border);
  }

  [data-theme=dark] .initials-avatar {
    background: var(--primary-surface);
    color: var(--primary);
  }

  [data-theme=dark] .status-badge.pending {
    background: var(--warning-surface);
    color: var(--warning);
  }

  [data-theme=dark] .status-badge.approved {
    background: var(--success-surface);
    color: var(--success);
  }

  [data-theme=dark] .status-badge.rejected {
    background: var(--danger-surface);
    color: var(--danger);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .admin-requests-container {
      padding: 16px;
    }

    .requests-table th,
    .requests-table td {
      padding: 12px 8px;
      font-size: 0.75rem;
    }

    .initials-cell {
      width: 40px;
      padding-left: 16px !important;
    }

    .initials-avatar {
      width: 28px;
      height: 28px;
      font-size: 0.75rem;
    }

    .actions-cell {
      padding-left: 16px !important;
    }

    .purse-cell p,
    .time-cell p {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .requests-table {
      display: block;
      overflow-x: auto;
    }

    .tabs {
      flex-wrap: wrap;
    }

    .tabs button {
      flex: 1;
      min-width: 60px;
      text-align: center;
    }

    .requests-table thead {
      display: none;
    }

    .requests-table tbody {
      display: block;
    }

    .requests-table tr {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }

    .requests-table td {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: 8px 0;
      border-bottom: none;
    }

    .requests-table td::before {
      content: attr(data-label);
      flex: 1;
      font-weight: 600;
      color: var(--ink2);
    }

    .initials-cell {
      order: 1;
    }

    .initials-cell::before {
      content: "Initials";
    }

    .requests-table td:nth-child(2) {
      order: 2;
    }

    .requests-table td:nth-child(2)::before {
      content: "Full Name";
    }

    .requests-table td:nth-child(3) {
      order: 3;
    }

    .requests-table td:nth-child(3)::before {
      content: "Agency";
    }

    .requests-table td:nth-child(4) {
      order: 4;
    }

    .requests-table td:nth-child(4)::before {
      content: "Role";
    }

    .requests-table td:nth-child(5) {
      order: 5;
    }

    .requests-table td:nth-child(5)::before {
      content: "ID Number";
    }

    .requests-table td:nth-child(6) {
      order: 6;
    }

    .requests-table td:nth-child(6)::before {
      content: "Purpose";
    }

    .requests-table td:nth-child(7) {
      order: 7;
    }

    .requests-table td:nth-child(7)::before {
      content: "Submitted";
    }

    .requests-table td:nth-child(8) {
      order: 8;
    }

    .requests-table td:nth-child(8)::before {
      content: "Status";
    }

    .requests-table td:nth-child(9) {
      order: 9;
    }

    .requests-table td:nth-child(9)::before {
      content: "Actions";
    }
  }
</style>