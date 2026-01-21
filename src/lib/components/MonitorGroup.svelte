<script>
	import { getStatusDotClass, getStatusTextClass } from '$lib/client/status.js';
	import MonitorCard from './MonitorCard.svelte';
	import MonitorHistory from './MonitorHistory.svelte';

	let { group, config, defaultOpen = true, showGroupStatus = true } = $props();

	const showGroupHistory = $derived(group.showGroupHistory ?? false);
	const hasGroupHistory = $derived(group.history && group.history.length > 0);

	const dotAnimation = $derived.by(() => {
		const animation = config.design.statusDot.animation.group;
		if (animation === 'ping' || animation === true) return 'ping-dot';
		if (animation === 'pulse') return 'animate-pulse';
		return;
	});

	let isOpen = $derived(defaultOpen);

	function toggleOpen() {
		isOpen = !isOpen;
	}

	const groupIncidentStatus = $derived(() => {
		if (!group.monitors || group.monitors.length === 0) return null;

		let worstStatus = null;
		let worstPriority = -1;

		for (const monitor of group.monitors) {
			if (monitor.incidentStatus) {
				const incidentPriority = config.statusLevels[monitor.incidentStatus]?.priority ?? 0;
				if (incidentPriority > worstPriority) {
					worstPriority = incidentPriority;
					worstStatus = monitor.incidentStatus;
				}
			}
		}

		return worstStatus;
	});

	const groupIncidentStartDate = $derived(() => {
		if (!group.monitors || group.monitors.length === 0) return null;

		let earliest = null;
		for (const monitor of group.monitors) {
			if (monitor.affectingIncidents) {
				for (const incident of monitor.affectingIncidents) {
					const incidentDate = incident.createdAt?.split('T')[0];
					if (incidentDate && (!earliest || incidentDate < earliest)) {
						earliest = incidentDate;
					}
				}
			}
		}
		return earliest;
	});

	const groupStatus = $derived(() => {
		if (!group.monitors || group.monitors.length === 0) return 'operational';

		let worstStatus = 'operational';
		let worstPriority = 0;

		for (const monitor of group.monitors) {
			const effectiveStatus = monitor.incidentStatus || monitor.status;
			const effectivePriority = config.statusLevels[effectiveStatus]?.priority ?? 0;

			if (effectivePriority > worstPriority) {
				worstPriority = effectivePriority;
				worstStatus = effectiveStatus;
			}
		}

		return worstStatus;
	});

	const statusInfo = $derived(
		config.statusLevels[groupStatus()] ?? config.statusLevels.operational
	);
	const dotClass = $derived(getStatusDotClass(groupStatus()));
	const textClass = $derived(getStatusTextClass(groupStatus()));
</script>

<div class="rounded-lg border border-base-300">
	<button
		type="button"
		class="flex w-full cursor-pointer flex-col gap-2 bg-base-200 px-4 py-3 text-left transition-colors hover:bg-base-300 sm:flex-row sm:items-center sm:justify-between"
		onclick={toggleOpen}
	>
		<div class="flex min-w-0 items-center gap-1.5">
			<svg
				class="h-4 w-4 shrink-0 text-base-content/50 transition-transform {isOpen
					? 'rotate-90'
					: ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
			<span
				class="tooltip tooltip-top min-w-0 font-semibold text-base-content decoration-base-content/40 decoration-dotted underline-offset-3 {group.description
					? 'cursor-help underline hover:text-base-content/90'
					: ''}"
				data-tip={group.description}
			>
				<span class="block truncate">{group.name}</span>
			</span>
			<span class="shrink-0 text-xs text-base-content/50">({group.monitors?.length ?? 0})</span>
		</div>
		{#if showGroupStatus}
			<div class="flex shrink-0 items-center gap-2">
				<span class="text-sm {textClass}">{statusInfo.label}</span>
				{#if config.design.statusDot.enabled.group}
					<span class="h-2.5 w-2.5 rounded-full {dotClass} {dotAnimation}"></span>
				{/if}
			</div>
		{/if}
	</button>

	{#if showGroupHistory && hasGroupHistory}
		<div class="-mt-2 bg-base-200 px-4 pb-3">
			<MonitorHistory
				history={group.history}
				uptime={group.uptime}
				{config}
				incidentStatus={groupIncidentStatus()}
				incidentStartDate={groupIncidentStartDate()}
			/>
		</div>
	{/if}

	{#if isOpen}
		<div class="space-y-1 p-2">
			{#each group.monitors ?? [] as monitor (monitor.name)}
				<MonitorCard {monitor} {config} />
			{/each}
		</div>
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
