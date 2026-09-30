<script>
  import { onMount } from 'svelte';
  import { getHazardComments, addHazardComment, updateComment, deleteComment } from '$lib/commentUtils';
  import { writable } from 'svelte/store';
  import { user } from '$lib/authStore';

  export let hazardId = '';

  // State
  const comments = writable([]);
  const isLoading = writable(false);
  const newComment = writable('');
  const editingCommentId = writable(null);
  const editText = writable('');

  // Load comments when hazardId changes
  async function loadComments() {
    if (!hazardId) return;

    isLoading.set(true);
    try {
      const loadedComments = await getHazardComments(hazardId);
      comments.set(loadedComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      isLoading.set(false);
    }
  }

  // Handle adding a new comment
  async function handleAddComment() {
    const text = get(newComment).trim();
    if (!text || !hazardId) return;

    try {
      const newCommentData = await addHazardComment(hazardId, text);
      if (newCommentData) {
        // Add to the top of the list
        comments.update(current => [newCommentData, ...current]);
        newComment.set(''); // Clear input
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }

  // Handle editing a comment
  function handleEditComment(comment) {
    editingCommentId.set(comment.id);
    editText.set(comment.comment);
  }

  async function handleSaveEdit(comment) {
    const text = get(editText).trim();
    if (!text) return;

    try {
      const success = await updateComment(comment.id, text);
      if (success) {
        // Update the comment in the list
        comments.update(current =>
          current.map(c =>
            c.id === comment.id ? { ...c, comment: text, updated_at: new Date().toISOString() } : c
          )
        );
        editingCommentId.set(null);
        editText.set('');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  }

  async function handleDeleteComment(comment) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const success = await deleteComment(comment.id);
      if (success) {
        // Remove from the list
        comments.update(current => current.filter(c => c.id !== comment.id));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  }

  // Initial load
  onMount(() => {
    loadComments();
  });
</script>

<div class="hazard-comments">
  {#if hazardId}
    <div class="comments-header">
      <h3>Comments</h3>
      {#if $user}
        <div class="comment-input">
          <textarea
            bind:value={$newComment}
            placeholder="Add a comment..."
            rows="2"
          ></textarea>
          <button
            on:click={handleAddComment}
            class="btn btn-sm btn-primary"
            disabled={!$newComment.get().trim() || !$user}
          >
            Post
          </button>
        </div>
      {/if}
    </div>

    {#if $isLoading}
      <div class="comments-loading">Loading comments...</div>
    {:else if !$user}
      <div class="comments-empty">Please log in to view and add comments</div>
    {:else}
      {#if $comments.length === 0}
        <div class="comments-empty">No comments yet. Be the first to comment!</div>
      {:else}
        <div class="comments-list">
          {#each $comments as comment}
            <div class="comment-item" data-id={comment.id}>
              <div class="comment-header">
                <span class="comment-author">
                  {#if $user && $user.id === comment.user_id}
                    You
                  {:else}
                    User
                  {/if}
                </span>
                <span class="comment-time">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
                {#if $user && $user.id === comment.user_id}
                  <div class="comment-actions">
                    <button
                      on:click={() => handleEditComment(comment)}
                      class="btn btn-g btn-xs"
                    >
                      Edit
                    </button>
                    <button
                      on:click={() => handleDeleteComment(comment)}
                      class="btn btn-g btn-xs"
                    >
                      Delete
                    </button>
                  </div>
                {/if}
              </div>
              <div class="comment-body">
                {#if editingCommentId.get() === comment.id}
                  <div class="comment-edit">
                    <textarea
                      bind:value={$editText}
                      rows="2"
                    ></textarea>
                    <div class="comment-edit-actions">
                      <button
                        on:click={() => handleSaveEdit(comment)}
                        class="btn btn-sm btn-primary"
                      >
                        Save
                      </button>
                      <button
                        on:click={() => {
                          editingCommentId.set(null);
                          editText.set('');
                        }}
                        class="btn btn-g btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                {:else}
                  <p>{comment.comment}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {:else}
    <div class="comments-empty">Select a hazard to view comments</div>
  {/if}
</div>