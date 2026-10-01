<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { user } from '$lib/authStore';
  import { addHazardComment, getHazardComments, type Comment } from '$lib/commentUtils';
  import { getHazardVoteSummary, voteOnHazard } from '$lib/voteUtils';
  import { normalizeHazardLocation } from '$lib/geoUtils';
  import type { Hazard } from '$lib/types/hazard';

  export let hazard: Hazard | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: { hazardId: string; verificationType: 'hazard_active' | 'hazard_cleared' };
  }>();

  let loadedHazardId: string | null = null;
  let comments: Comment[] = [];
  let commentText = '';
  let commentsLoading = false;
  let commentSubmitting = false;
  let votes = { upvotes: 0, downvotes: 0, userVote: null as 'upvote' | 'downvote' | null };
  let voting = false;
  let statusMessage = '';
  $: coordinates = normalizeHazardLocation(hazard?.location);

  $: if (hazard?.id !== loadedHazardId) {
    loadedHazardId = hazard?.id ?? null;
    comments = [];
    commentText = '';
    statusMessage = '';
    votes = { upvotes: 0, downvotes: 0, userVote: null };
    if (loadedHazardId) void loadDetails(loadedHazardId);
  }

  async function loadDetails(hazardId: string) {
    commentsLoading = true;
    const [loadedComments, voteSummary] = await Promise.all([
      getHazardComments(hazardId),
      getHazardVoteSummary(hazardId)
    ]);
    if (loadedHazardId === hazardId) {
      comments = loadedComments;
      votes = voteSummary;
      commentsLoading = false;
    }
  }

  function requireSignIn() {
    window.location.assign('/auth');
  }

  async function postComment() {
    if (!hazard || !commentText.trim() || commentSubmitting) return;
    if (!$user) return requireSignIn();

    commentSubmitting = true;
    const comment = await addHazardComment(hazard.id, commentText.trim());
    if (comment) {
      comments = [comment, ...comments];
      commentText = '';
      statusMessage = 'Comment posted.';
    } else {
      statusMessage = 'Could not post your comment.';
    }
    commentSubmitting = false;
  }

  async function castVote(voteType: 'upvote' | 'downvote') {
    if (!hazard || voting) return;
    if (!$user) return requireSignIn();

    voting = true;
    await voteOnHazard(hazard.id, voteType);
    votes = await getHazardVoteSummary(hazard.id);
    voting = false;
  }

  function hazardTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      flood: 'Flooding',
      pothole: 'Pothole',
      accident: 'Accident',
      obstruction: 'Obstruction',
      landslide: 'Landslide',
      tree: 'Fallen tree',
      collapse: 'Road collapse'
    };
    return labels[type] ?? type.replaceAll('_', ' ');
  }

  function severityLabel(severity: Hazard['severity']): string {
    if (severity === 'impassable') return 'Impassable';
    if (severity === 'one_lane') return 'One lane';
    return 'Passable';
  }

  function statusLabel(status: Hazard['status']): string {
    return status.replaceAll('_', ' ');
  }

  function formatTime(value: string): string {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

{#if hazard}
  <div class="sheet-layer">
    <button class="sheet-backdrop" type="button" aria-label="Close hazard details" onclick={() => dispatch('close')}></button>
    <section class="hazard-sheet" role="dialog" aria-modal="true" aria-labelledby="hazard-sheet-title">
      <header class="sheet-header">
        <span class="sheet-grab" aria-hidden="true"></span>
        <button class="sheet-close" type="button" aria-label="Close hazard details" onclick={() => dispatch('close')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>

      <div class="sheet-content">
        <div class="hazard-chips">
          <span class="chip type">{hazardTypeLabel(hazard.hazard_type)}</span>
          <span class="chip severity-{hazard.severity}">{severityLabel(hazard.severity)}</span>
          <span class="chip status-{hazard.status}">{statusLabel(hazard.status)}</span>
          {#if hazard.status === 'hazard_active'}<span class="chip verified">Verified active</span>{/if}
        </div>

        <h2 id="hazard-sheet-title">{hazardTypeLabel(hazard.hazard_type)}</h2>
        <p class="reported-time">Reported {formatTime(hazard.created_at)}</p>

        {#if hazard.photo_url}
          <img class="hazard-photo" src={hazard.photo_url} alt="Photo submitted with this hazard report" />
        {/if}
        {#if hazard.description}
          <p class="hazard-description">{hazard.description}</p>
        {/if}

        {#if coordinates}
          <div class="location-row">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span>{coordinates[1].toFixed(5)}° N, {coordinates[0].toFixed(5)}° E</span>
          </div>
        {/if}

        <div class="confirmation-row">
          <span>Community feedback</span>
          <div class="vote-actions">
            <button type="button" class:active={votes.userVote === 'upvote'} disabled={voting} onclick={() => castVote('upvote')} aria-label="Mark hazard as helpful or still active">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5-7 2 1-1 5h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7zM3 10h4v11H3z"/></svg>
              <span>{votes.upvotes}</span>
            </button>
            <button type="button" class:active={votes.userVote === 'downvote'} disabled={voting} onclick={() => castVote('downvote')} aria-label="Mark hazard as not helpful or cleared">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5 7 2-1-1-5h6a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H7zM3 3h4v11H3z"/></svg>
              <span>{votes.downvotes}</span>
            </button>
          </div>
        </div>

        <section class="comments-section" aria-label="Hazard comments">
          <h3>Comments <span>{comments.length}</span></h3>
          {#if $user}
            <form class="comment-form" onsubmit={(event) => { event.preventDefault(); postComment(); }}>
              <label class="sr-only" for="hazard-comment">Add a comment</label>
              <input id="hazard-comment" bind:value={commentText} maxlength="500" placeholder="Add useful context..." />
              <button type="submit" disabled={commentSubmitting || !commentText.trim()} aria-label="Post comment">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </form>
          {:else}
            <a class="sign-in-link" href="/auth" data-sveltekit-reload>Sign in to comment or vote</a>
          {/if}

          {#if commentsLoading}
            <p class="comments-empty">Loading comments...</p>
          {:else if comments.length === 0}
            <p class="comments-empty">No comments yet.</p>
          {:else}
            <ul class="comment-list">
              {#each comments as comment (comment.id)}
                <li><span class="comment-avatar">{comment.user_id.slice(0, 1).toUpperCase()}</span><div><b>{comment.user_id === $user?.id ? 'You' : 'Community member'}</b><p>{comment.comment}</p><time>{formatTime(comment.created_at)}</time></div></li>
              {/each}
            </ul>
          {/if}
          {#if statusMessage}<p class="status-message" role="status">{statusMessage}</p>{/if}
        </section>
      </div>

      <footer class="sheet-actions">
        {#if !$user}
          <a href="/auth" data-sveltekit-reload class="primary-action">Sign in to confirm this hazard</a>
        {:else if hazard.status === 'hazard_cleared'}
          <button class="primary-action" type="button" onclick={() => dispatch('confirm', { hazardId: hazard.id, verificationType: 'hazard_active' })}>Hazard active again</button>
        {:else}
          <div class="action-pair">
            <button class="primary-action" type="button" onclick={() => dispatch('confirm', { hazardId: hazard.id, verificationType: 'hazard_active' })}>Still active</button>
            <button class="secondary-action" type="button" onclick={() => dispatch('confirm', { hazardId: hazard.id, verificationType: 'hazard_cleared' })}>Cleared</button>
          </div>
        {/if}
      </footer>
    </section>
  </div>
{/if}

<style>
  .sheet-layer { position: fixed; inset: 0; z-index: 1040; display: flex; align-items: flex-end; justify-content: center; }
  .sheet-backdrop { position: absolute; inset: 0; border: 0; background: rgb(8 14 22 / 42%); }
  .hazard-sheet { position: relative; display: flex; width: min(520px, 100%); max-height: min(82dvh, 760px); flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 18px 18px 0 0; background: var(--surface); box-shadow: var(--e3); animation: sheet-in .22s ease-out; }
  .sheet-header { position: relative; display: flex; min-height: 34px; align-items: center; justify-content: center; flex: none; }
  .sheet-grab { width: 38px; height: 4px; border-radius: 99px; background: var(--border); }
  .sheet-close { position: absolute; top: 5px; right: 12px; display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 50%; background: var(--neutral-sf); color: var(--ink2); }
  .sheet-close svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 2; }
  .sheet-content { overflow-y: auto; padding: 4px 18px 18px; }
  .hazard-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .chip { padding: 4px 9px; border-radius: 999px; background: var(--neutral-sf); color: var(--ink2); font-size: 11px; font-weight: 700; text-transform: capitalize; }
  .chip.type { background: var(--primary-surface); color: var(--primary); }
  .chip.severity-impassable { background: var(--danger-sf); color: var(--danger); }
  .chip.severity-one_lane { background: var(--warning-sf); color: var(--warning); }
  .chip.severity-passable { background: var(--success-sf); color: var(--success); }
  .chip.status-hazard_active, .chip.verified { background: var(--danger-sf); color: var(--danger); }
  .chip.status-needs_verification { background: var(--warning-sf); color: var(--warning); }
  .chip.status-hazard_cleared { background: var(--success-sf); color: var(--success); }
  .sheet-content h2 { margin: 0; font-size: 19px; }
  .reported-time { margin: 3px 0 12px; color: var(--ink2); font-size: 12px; }
  .hazard-photo { display: block; width: 100%; max-height: 220px; margin-bottom: 12px; border-radius: var(--r-m); object-fit: cover; }
  .hazard-description { margin-bottom: 12px; font-size: 14px; white-space: pre-wrap; }
  .location-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid var(--border); color: var(--ink2); font-size: 12px; }
  .location-row svg { width: 16px; height: 16px; fill: none; stroke: var(--primary); stroke-width: 2; }
  .confirmation-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-block: 1px solid var(--border); font-size: 12px; font-weight: 700; }
  .vote-actions { display: flex; gap: 6px; }
  .vote-actions button { display: inline-flex; min-width: 52px; min-height: 34px; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--border); border-radius: var(--r-s); background: var(--surface); color: var(--ink2); }
  .vote-actions button.active { border-color: var(--primary); background: var(--primary-surface); color: var(--primary); }
  .vote-actions button:disabled { opacity: .6; }
  .vote-actions svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
  .comments-section { padding-top: 14px; }
  .comments-section h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; font-size: 14px; }
  .comments-section h3 span { color: var(--ink2); font-size: 11px; }
  .comment-form { display: flex; gap: 7px; }
  .comment-form input { width: 100%; min-width: 0; min-height: 40px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--r-s); background: var(--bg); color: var(--ink); }
  .comment-form button { display: grid; width: 40px; flex: none; place-items: center; border: 0; border-radius: var(--r-s); background: var(--primary); color: #fff; }
  .comment-form button:disabled { opacity: .55; }
  .comment-form svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
  .sign-in-link { color: var(--primary); font-size: 12px; font-weight: 700; }
  .comments-empty, .status-message { margin: 8px 0; color: var(--ink2); font-size: 12px; }
  .comment-list { display: grid; gap: 10px; margin: 10px 0 0; padding: 0; list-style: none; }
  .comment-list li { display: flex; gap: 9px; }
  .comment-avatar { display: grid; width: 28px; height: 28px; flex: none; place-items: center; border-radius: 50%; background: var(--primary-surface); color: var(--primary); font-size: 11px; font-weight: 800; }
  .comment-list b { font-size: 11px; }
  .comment-list p { margin: 2px 0; font-size: 12px; white-space: pre-wrap; }
  .comment-list time { color: var(--ink2); font-size: 10px; }
  .sheet-actions { flex: none; padding: 10px 16px max(12px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--surface); }
  .action-pair { display: flex; gap: 8px; }
  .primary-action, .secondary-action { display: inline-flex; min-height: 44px; flex: 1; align-items: center; justify-content: center; border: 1px solid var(--primary); border-radius: var(--r-s); background: var(--primary); color: #fff; font-size: 13px; font-weight: 700; text-decoration: none; }
  .secondary-action { border-color: var(--border); background: var(--surface); color: var(--ink2); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  @keyframes sheet-in { from { transform: translateY(24px); opacity: .7; } to { transform: translateY(0); opacity: 1; } }
  @media (min-width: 761px) { .hazard-sheet { margin-bottom: 16px; border-radius: var(--r-l); } }
  @media (prefers-reduced-motion: reduce) { .hazard-sheet { animation: none; } }
</style>