<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user, profile } from '$lib/authStore';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

  let auditLogs: AuditLog[] = [];
  let isLoading = true;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let isAuthorized = false;
  let authLoading = true;
  let actionFilter = '';
  let actorFilter = '';
  let debounceTimeout: NodeJS.Timeout | null = null;
  let hasHitCap = false;

  // Types
  interface AuditLog {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    target_details: Json;
    created_at: string;
    actor: UserProfile; // Joined actor data
  }

  interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'common_user' | 'agency_personnel' | 'admin';
    is_suspended: boolean;
    suspension_reason: string | null;
    reputation_points: number;
    created_at: string;
    updated_at: string;
  }

  type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

  // Check authorization
  async function checkAuthorization() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      // Not signed in, redirect to login
      goto('/login');
      return false;
    }

    // Wait for profile to load if not already loaded
    if (!profileData) {
      // Profile will be loaded via authStore listener, we'll check again in a moment
      // For now, we'll assume not authorized until profile loads
      isAuthorized = false;
      authLoading = false;
      return false;
    }

    // Check if user is admin
    if (profileData.role === 'admin') {
      return true;
    }

    // Not authorized, redirect to appropriate page
    goto(profileData.role === 'agency_personnel' ? '/agency' : '/map');
    return false;
  }

  // Load audit logs with filters
  async function loadAuditLogs() {
    if (!isAuthorized) return;

    isLoading = true;
    errorMessage = null;
    successMessage = null;
    hasHitCap = false;

    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          actor:user_profiles!audit_logs_actor_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (actionFilter.trim()) {
        query = query.ilike('action', `%${actionFilter.trim()}%`);
      }
      if (actorFilter.trim()) {
        query = query.ilike('actor.full_name', `%${actorFilter.trim()}%`);
      }

      // Limit to 500 records as per spec
      query = query.limit(500);

      const { data, error, count } = await query;

      if (error) throw error;

      auditLogs = data as AuditLog[];
      hasHitCap = (count ?? 0) >= 500;
    } catch (err) {
      console.error('Error loading audit logs:', err);
      errorMessage = 'Failed to load audit logs. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Debounced filter update
  function updateActionFilter(value: string) {
    clearTimeout(debounceTimeout);
    actionFilter = value;
    debounceTimeout = setTimeout(() => {
      loadAuditLogs();
    }, 350);
  }

  function updateActorFilter(value: string) {
    clearTimeout(debounceTimeout);
    actorFilter = value;
    debounceTimeout = setTimeout(() => {
      loadAuditLogs();
    }, 350);
  }

  // Clear filters
  function clearFilters() {
    actionFilter = '';
    actorFilter = '';
    loadAuditLogs();
  }

  // Export to CSV
  async function exportToCSV() {
    if (!isAuthorized || auditLogs.length === 0) return;

    // Create CSV content
    const headers = ['Time', 'Actor', 'Action', 'Target', 'Details'];
    const rows = auditLogs.map(log => {
      const time = new Date(log.created_at).toLocaleString();
      const actor = log.actor?.full_name || log.actor?.email?.split('@')[0] || 'Unknown';
      const action = log.action;
      const target = `${log.target_type}: ${log.target_id}`;
      const details = typeof log.target_details === 'string'
        ? log.target_details
        : JSON.stringify(log.target_details);

      return [
        `"${time.replace(/"/g, '""')}"`,
        `"${actor.replace(/"/g, '""')}"`,
        `"${action.replace(/"/g, '""')}"`,
        `"${target.replace(/"/g, '""')}"`,
        `"${details.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `audit_${timestamp}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    successMessage = `Exported ${auditLogs.length} audit records to ${filename}`;
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

  // Get action badge class and label
  function getActionInfo(action: string): { className: string; label: string } {
    const actionLower = action.toLowerCase();

    if (actionLower.includes('approved') || actionLower.includes('approve')) {
      return { className: 'approved', label: 'Approved' };
    } else if (actionLower.includes('rejected') || actionLower.includes('reject')) {
      return { className: 'rejected', label: 'Rejected' };
    } else if (actionLower.includes('removed') || actionLower.includes('remove')) {
      return { className: 'removed', label: 'Removed' };
    } else if (actionLower.includes('expired') || actionLower.includes('expire')) {
      return { className: 'expired', label: 'Expired' };
    } else if (actionLower.includes('changed') || actionLower.includes('change') ||
               actionLower.includes('updated') || actionLower.includes('update')) {
      return { className: 'changed', label: 'Changed' };
    } else if (actionLower.includes('suspended') || actionLower.includes('suspend')) {
      return { className: 'suspended', label: 'Suspended' };
    } else if (actionLower.includes('reactivated') || actionLower.includes('reactivate')) {
      return { className: 'reactivated', label: 'Reactivated' };
    } else {
      return { className: 'normal', label: action };
    }
  }

  // Page load
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) {
      isLoading = false;
      return;
    }

    isAuthorized = true;
    await loadAuditLogs();
  });
</script>

{#if isLoading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <p>Loading audit logs...</p>
  </div>
{:else if errorMessage}
  <div class="error-banner">{errorMessage}</div>
{:else}
  <div class="admin-audit-container">
    <header class="audit-header">
      <h1>Audit Logs</h1>
      <p class="audit-subtitle">System activity and compliance records</p>
    </header>

    <section class="filters-section">
      <div class="filters-grid">
        <div class="filter-group">
          <label for="action-filter">Action contains…</label>
          <input
            type="text"
            id="action-filter"
            bind:value={actionFilter}
            on:input={(e) => updateActionFilter((e.target as HTMLInputElement).value)}
            placeholder="Filter by action (e.g., approved, rejected)..."
            class="filter-input"
          />
        </div>
        <div class="filter-group">
          <label for="actor-filter">Actor contains…</label>
          <input
            type="text"
            id="actor-filter"
            bind:value={actorFilter}
            on:input={(e) => updateActorFilter((e.target as HTMLInputElement).value)}
            placeholder="Filter by actor name or email..."
            class="filter-input"
          />
        </div>
        <div class="filter-actions">
          <button on:click={clearFilters} class="btn-action btn-clear">
            Clear Filters
          </button>
          <button on:click={exportToCSV} class="btn-action btn-export">
            Export CSV
          </button>
        </div>
      </div>

      {#if hasHitCap}
        <div class="cap-notice">
          <p>Showing first 500 records. Narrow the filters to see more specific results.</p>
        </div>
      {/if}
    </section>

    <div class="integrity-notice">
      <p><strong>Note:</strong> Audit rows are insert-only at the database level — they cannot be edited or deleted from any client.</p>
    </div>

    <section class="logs-section">
      {#if auditLogs.length === 0}
        <div class="empty-state">
          <p>{#if actionFilter || actorFilter}
            No audit logs match the current filters.
          {:else}
            No audit logs found.
          {/if}</p>
        </div>
      {:else}
        <div class="logs-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {#each auditLogs as log}
                <tr class="log-row">
                  <td class="time-cell">
                    <p>{formatTimeAgo(log.created_at)}</p>
                    <small class="timestamp">{new Date(log.created_at).toLocaleString()}</small>
                  </td>
                  <td class="actor-cell">
                    <div class="actor-info">
                      {#if log.actor?.full_name}
                        <div class="actor-name">{log.actor.full_name}</div>
                        <div class="actor-email">{log.actor.email}</div>
                      {:else}
                        <div class="actor-name">{log.actor?.email?.split('@')[0] || 'Unknown'}</div>
                        {#if log.actor?.email}
                          <div class="actor-email">{log.actor.email}</div>
                        {/if}
                      {/if}
                    </div>
                  </td>
                  <td class="action-cell">
                    <span class="action-badge action-{getActionInfo(log.action).className}">
                      {getActionInfo(log.action).label}
                    </span>
                  </td>
                  <td class="target-cell">
                    <div class="target-info">
                      <div class="target-type">{log.target_type}</div>
                      <div class="target-id">{log.target_id}</div>
                    </div>
                  </td>
                  <td class="details-cell">
                    <div class="details-content">
                      {#if typeof log.target_details === 'string'}
                        {log.target_details.length > 100
                          ? log.target_details.substring(0, 100) + '...'
                          : log.target_details}
                      {:else}
                        {JSON.stringify(log.target_details).length > 100
                          ? JSON.stringify(log.target_details).substring(0, 100) + '...'
                          : JSON.stringify(log.target_details)}
                      {/if}
                    </div>
                    {#if typeof log.target_details !== 'string' && JSON.stringify(log.target_details).length > 100}
                      <button on:click={() => {
                        // In a real app, this might open a modal with full details
                        alert(JSON.stringify(log.target_details, null, 2));
                      }} class="btn-details">
                        View Full
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  .admin-audit-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: var(--background);
    min-height: 100vh;
  }

  .audit-header {
    margin-bottom: 24px;
  }

  .audit-header h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: var(--primary-ink);
  }

  .audit-subtitle {
    margin: 0 0 16px 0;
    color: var(--ink2);
    font-size: 1rem;
  }

  .filters-section {
    margin-bottom: 24px;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
  }

  .filter-group label {
    margin-bottom: 8px;
    font-size: 0.875rem;
    color: var(--ink2);
    font-weight: 600;
  }

  .filter-input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }

  .filter-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    align-items: flex-end;
  }

  .btn-clear {
    background: var(--surface);
    color: var(--primary);
    border: 1px solid var(--primary);
    padding: 8px 16px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-clear:hover:not(:disabled) {
    background: var(--primary-surface);
  }

  .btn-export {
    background: var(--success);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-export:hover:not(:disabled) {
    background: var(--success-dark);
  }

  .cap-notice {
    background: var(--warning-surface);
    color: var(--warning);
    padding: 12px 16px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    margin-bottom: 16px;
    border-left: 4px solid var(--warning);
  }

  .integrity-notice {
    background: var(--info-surface);
    color: var(--info);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin-bottom: 24px;
    border-left: 4px solid var(--info);
    font-size: 0.875rem;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    background: var(--danger-surface);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin-bottom: 20px;
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--ink2);
  }

  .logs-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .logs-table th,
  .logs-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .logs-table th {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .time-cell {
    width: 150px;
  }

  .actor-cell {
    width: 200px;
  }

  .action-cell {
    width: 120px;
  }

  .target-cell {
    width: 150px;
  }

  .details-cell {
    width: 250px;
  }

  .actor-info {
    display: flex;
    flex-direction: column;
  }

  .actor-name {
    font-weight: 600;
    color: var(--primary-ink);
    font-size: 0.875rem;
  }

  .actor-email {
    font-size: 0.75rem;
    color: var(--ink2);
    font-family: var(--f);
  }

  .target-info {
    display: flex;
    flex-direction: column;
  }

  .target-type {
    font-weight: 600;
    color: var(--ink2);
    font-size: 0.875rem;
  }

  .target-id {
    font-family: var(--f);
    font-size: 0.875rem;
    color: var(--ink);
  }

  .details-content {
    font-size: 0.875rem;
    color: var(--ink2);
    line-height: 1.4;
    font-family: var(--f);
  }

  .btn-details {
    background: var(--primary-surface);
    color: var(--primary);
    border: 1px solid var(--primary);
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 8px;
  }

  .btn-details:hover:not(:disabled) {
    background: var(--primary);
    color: white;
  }

  /* Action badges */
  .action-badge {
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .action-badge.approved {
    background: var(--success-surface);
    color: var(--success);
  }

  .action-badge.rejected {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .action-badge.removed {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .action-badge.expired {
    background: var(--warning-surface);
    color: var(--warning);
  }

  .action-badge.changed {
    background: var(--info-surface);
    color: var(--info);
  }

  .action-badge.suspended {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .action-badge.reactivated {
    background: var(--success-surface);
    color: var(--success);
  }

  .action-badge.normal {
    background: var(--primary-surface);
    color: var(--primary);
  }

  /* Dark mode adjustments */
  [data-theme=dark] .filter-input {
    background: var(--surface);
    border-color: var(--border);
    color: var(--ink);
  }

  [data-theme=dark] .filter-input:focus {
    border-color: var(--primary);
  }

  [data-theme=dark] .btn-clear {
    border-color: var(--primary);
    color: var(--primary);
  }

  [data-theme=dark] .btn-clear:hover:not(:disabled) {
    background: var(--primary-surface);
  }

  [data-theme=dark] .btn-export {
    background: var(--success);
    color: white;
  }

  [data-theme=dark] .btn-export:hover:not(:disabled) {
    background: var(--success-dark);
  }

  [data-theme=dark] .cap-notice {
    background: var(--warning-surface);
    color: var(--warning);
  }

  [data-theme=dark] .integrity-notice {
    background: var(--info-surface);
    color: var(--info);
  }

  [data-theme=dark] .logs-table th,
  [data-theme=dark] .logs-table td {
    border-color: var(--border);
  }

  [data-theme=dark] .actor-name {
    color: var(--primary-ink);
  }

  [data-theme=dark] .actor-email {
    color: var(--ink2);
  }

  [data-theme=dark] .target-type {
    color: var(--ink2);
  }

  [data-theme=dark] .target-id {
    color: var(--ink);
  }

  [data-theme=dark] .details-content {
    color: var(--ink2);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .admin-audit-container {
      padding: 16px;
    }

    .filters-grid {
      grid-template-columns: 1fr;
    }

    .logs-table th,
    .logs-table td {
      padding: 12px 8px;
      font-size: 0.75rem;
    }

    .time-cell {
      width: 120px;
    }

    .actor-cell {
      width: 150px;
    }

    .action-cell {
      width: 100px;
    }

    .target-cell {
      width: 120px;
    }

    .details-cell {
      width: 150px;
    }
  }

  @media (max-width: 480px) {
    .logs-table {
      display: block;
      overflow-x: auto;
    }

    .logs-table thead {
      display: none;
    }

    .logs-table tbody {
      display: block;
    }

    .logs-table tr {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }

    .logs-table td {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: 8px 0;
      border-bottom: none;
    }

    .logs-table td::before {
      content: attr(data-label);
      flex: 1;
      font-weight: 600;
      color: var(--ink2);
    }

    .time-cell {
      order: 1;
    }

    .time-cell::before {
      content: "Time";
    }

    .actor-cell {
      order: 2;
    }

    .actor-cell::before {
      content: "Actor";
    }

    .action-cell {
      order: 3;
    }

    .action-cell::before {
      content: "Action";
    }

    .target-cell {
      order: 4;
    }

    .target-cell::before {
      content: "Target";
    }

    .details-cell {
      order: 5;
    }

    .details-cell::before {
      content: "Details";
    }

    .filters-grid {
      gap: 12px;
    }

    .filter-group {
      margin-bottom: 12px;
    }

    .filter-input {
      padding: 8px 10px;
      font-size: 0.75rem;
    }

    .filter-actions {
      flex-wrap: wrap;
    }

    .btn-clear,
    .btn-export {
      flex: 1;
      min-width: 80px;
      text-align: center;
      padding: 6px 12px;
      font-size: 0.75rem;
    }
  }
</style>