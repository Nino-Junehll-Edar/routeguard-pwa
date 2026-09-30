<script lang="ts">
	const { label = '', error = undefined, children, ...restProps } = $props();
</script>

<div class="field">
	{#if label}
		<label for={restProps.id || ''} class="field-label">
			{label}
			{#if error}
				<span class="field-error">{error}</span>
			{/if}
		</label>
	{/if}
	<div class="field-input">
		{@render children()}
	</div>
	{#if !label && error}
		<p class="field-error">{error}</p>
	{/if}
</div>



