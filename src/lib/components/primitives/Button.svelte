<script lang="ts">
	const { block = false, loading = false, disabled = false, children, ...restProps } = $props();
</script>

<button
	class:btn-primary={true}
	class:btn-secondary={restProps.variant === 'secondary'}
	class:btn-danger={restProps.variant === 'danger'}
	class:btn-sm={restProps.size === 'sm'}
	class:btn-g={restProps.variant === 'ghost'}
	class:btn-d={restProps.variant === 'destructive'}
	class:btn-b2={restProps.variant === 'outline'}
	class:disabled={disabled || loading}
	class:block={block}
	type={restProps.type || 'button'}
	{...restProps}
	onclick={restProps.onClick}
	disabled={disabled || loading}
>
	{#if loading}
		<span class="loading-spinner" aria-hidden="true"></span>
		<span class="sr-only">Loading...</span>
	{:else}
		{@render children()}
	{/if}
</button>
