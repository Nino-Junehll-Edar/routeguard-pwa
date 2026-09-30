<script>
  import { voteOnHazard, getHazardVoteSummary } from '$lib/voteUtils';
  import { writable } from 'svelte/store';

  export let hazardId = '';

  // State
  const voteSummary = writable({ upvotes: 0, downvotes: 0, userVote: null });
  const isLoading = writable(false);
  const isVoting = writable(false);

  // Load vote summary when hazardId changes
  async function loadVoteSummary() {
    if (!hazardId) return;

    isLoading.set(true);
    try {
      const summary = await getHazardVoteSummary(hazardId);
      voteSummary.set(summary);
    } catch (error) {
      console.error('Failed to load vote summary:', error);
    } finally {
      isLoading.set(false);
    }
  }

  // Handle voting
  async function handleVote(voteType) {
    if (!hazardId) return;

    isVoting.set(true);
    try {
      const result = await voteOnHazard(hazardId, voteType);
      // Reload vote summary to get updated counts
      await loadVoteSummary();
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      isVoting.set(false);
    }
  }

  // Initial load
  async function loadInitialData() {
    await loadVoteSummary();
  }

  // In a real component, we'd use onMount, but for simplicity we'll call it directly
  loadInitialData();
</script>

{#if hazardId}
  <div class="hazard-votes">
    <div class="vote-buttons">
      <button
        on:click={() => handleVote('upvote')}
        class={`vote-btn ${$voteSummary.userVote === 'upvote' ? 'active' : ''} ${$isVoting ? 'loading' : ''}`}
        disabled={$isLoading || $isVoting}
        aria-label="Upvote: Mark hazard as still active"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="vote-count">{$voteSummary.upvotes}</span>
      </button>

      <button
        on:click={() => handleVote('downvote')}
        class={`vote-btn ${$voteSummary.userVote === 'downvote' ? 'active' : ''} ${$isVoting ? 'loading' : ''}`}
        disabled={$isLoading || $isVoting}
        aria-label="Downvote: Mark hazard as cleared"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="vote-count">{$voteSummary.downvotes}</span>
      </button>
    </div>

    {#if $voteSummary.userVote}
      <div class="vote-feedback">
        You voted: {$voteSummary.userVote === 'upvote' ? 'Hazard Active' : 'Hazard Cleared'}
      </div>
    {/if}
  </div>
{:else}
  <div class="hazard-votes">
    <div class="vote-buttons">
      <button disabled class="vote-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="vote-count">0</span>
      </button>
      <button disabled class="vote-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="vote-count">0</span>
      </button>
    </div>
  </div>
{/if}