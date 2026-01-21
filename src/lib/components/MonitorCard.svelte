<script>
	import { getStatusDotClass, getStatusTextClass } from '$lib/client/status.js';
	import MonitorHistory from './MonitorHistory.svelte';

	let { monitor, config } = $props();

	const shouldShowHistory = $derived(monitor.showHistory ?? true);

	const dotAnimation = $derived.by(() => {
		const animation = config.design.statusDot.animation.monitor;
		if (animation === 'ping' || animation === true) return 'ping-dot';
		if (animation === 'pulse') return 'animate-pulse';
		return;
	});

	const effectiveStatus = $derived(() => {
		if (monitor.incidentStatus) {
			return monitor.incidentStatus;
		}
		return monitor.status;
	});

	const statusInfo = $derived(
		config.statusLevels[effectiveStatus()] ?? config.statusLevels.operational
	);
	const dotClass = $derived(getStatusDotClass(effectiveStatus()));
	const textClass = $derived(getStatusTextClass(effectiveStatus()));

	const targetUrl = $derived(() => {
		if (monitor.type === 'http') {
			return monitor.target;
		}
		return null; // For ping, not clickable
	});

	const hasHistory = $derived(monitor.history && monitor.history.length > 0);

	const incidentStartDate = $derived(() => {
		if (!monitor.affectingIncidents || monitor.affectingIncidents.length === 0) {
			return null;
		}
		let earliest = null;
		for (const incident of monitor.affectingIncidents) {
			const incidentDate = incident.createdAt?.split('T')[0];
			if (incidentDate && (!earliest || incidentDate < earliest)) {
				earliest = incidentDate;
			}
		}
		return earliest;
	});
</script>

<div class="rounded-lg bg-base-200 px-4 py-3">
	<div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			<span
				class="tooltip tooltip-top font-medium text-base-content decoration-base-content/40 decoration-dotted underline-offset-3 {monitor.description
					? 'cursor-help underline hover:text-base-content/90'
					: ''}"
				data-tip={monitor.description}
			>
				{monitor.name}
			</span>
			{#if monitor.showTarget}
				{#if targetUrl()}
					<a
						href={targetUrl()}
						target="_blank"
						rel="noopener noreferrer"
						class="max-w-50 truncate text-xs text-base-content/50 hover:text-primary hover:underline sm:max-w-75"
						onclick={(e) => e.stopPropagation()}
					>
						{monitor.target}
					</a>
				{:else}
					<span class="max-w-50 truncate text-xs text-base-content/50 sm:max-w-75"
						>{monitor.target}</span
					>
				{/if}
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-3">
			{#if monitor.responseTime}
				<span class="text-xs text-base-content/50">{monitor.responseTime}ms</span>
			{/if}
			<span class="text-sm {textClass}">{statusInfo.label}</span>
			{#if config.design.statusDot.enabled.monitor}
				<span class="h-2.5 w-2.5 rounded-full {dotClass} {dotAnimation}"></span>
			{/if}
		</div>
	</div>
	{#if shouldShowHistory && hasHistory}
		<MonitorHistory
			history={monitor.history}
			uptime={monitor.uptime}
			{config}
			incidentStatus={monitor.incidentStatus}
			incidentStartDate={incidentStartDate()}
		/>
	{/if}
</div>

<style>
	.ping-dot {
		position: relative;
	}

	.ping-dot::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		background-color: inherit;
		animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	@keyframes ping {
		75%,
		100% {
			transform: translate(-50%, -50%) scale(2);
			opacity: 0;
		}
	}
</style>
