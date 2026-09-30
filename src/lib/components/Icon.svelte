<script lang="ts">
	export let name: string;
	export let size: number = 24;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name}">
	{#if name === 'back'}
		<path d="M19 12H5m14 0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
	{/if}
	{#if name === 'eye'}
		<path d="M1 12s4-8 11-8 11 8-11 8-11-8-11-8zm8 0c-4 0-7 4-7 8s3 8 7 8 7-4 7-8-3-8-7-8zm0 10c-4 0-7-2-7-6s2-6 7-6 7 2 7 6-2 6-7 6z" />
	{/if}
	{#if name === 'eye-off'}
		<path d="M2.29 2.29c.49-.49 1.07-.89 1.8-1.2 1.07-.44 2.29-.27 3.32.22 1.01.48 1.82 1.24 2.36 2.17.31.52.43 1.12.43 1.75 0 .63-.12 1.24-.43 1.75-.54.93-1.35 1.69-2.36 2.17-1.03.49-2.25.29-3.32-.22-.73-.31-1.31-.71-1.8-1.2" />
		<line x1="2" y1="2" x2="22" y2="22" />
	{/if}
	{#if name === 'shield-check'}
		<path d="M12 2l4 9v4c0 6-4 10-5 10s-5-4-5-10v-4l4-9Z" />
		<path d="M9 12l2 2 4-4" />
	{/if}
	{#if name === 'check'}
		<polyline points="9 11 12 14 22 4" />
	{/if}
</svg>