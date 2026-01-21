<script>
	import { getStatusBgClass, getStatusTextClass } from '$lib/client/status.js';

	let { status = 'operational', config } = $props();

	const statusInfo = $derived(config.statusLevels[status] ?? config.statusLevels.operational);
	const bgClass = $derived(getStatusBgClass(status));
	const textClass = $derived(getStatusTextClass(status));
</script>

<div class="rounded-xl border {bgClass} p-6 text-center">
	<div class="flex items-center justify-center gap-3">
		{#if status === 'operational'}
			<svg class="h-8 w-8 {textClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
		{:else if status === 'maintenance'}
			<svg class="h-8 w-8 {textClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		{:else if status === 'major'}
			<svg class="h-8 w-8 {textClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		{:else}
			<svg class="h-8 w-8 {textClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
		{/if}
		<h2 class="text-2xl font-semibold {textClass}">{statusInfo.label}</h2>
	</div>
	<p class="mt-2 text-sm text-base-content/60">
		{#if status === 'operational'}
			{config.overallStatusText.operational}
		{:else if status === 'maintenance'}
			{config.overallStatusText.maintenance}
		{:else if status === 'major'}
			{config.overallStatusText.major}
		{:else}
			{config.overallStatusText.degraded}
		{/if}
	</p>
</div>
