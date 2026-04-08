<script>
	import { getStatusDotClass, getStatusTextClass, getStatusBgClass } from '$lib/client/status.js';
	import MonitorHistory from './MonitorHistory.svelte';

	let { monitor, config, layout = 'default', showMonitorType = true, showSSL = true } = $props();

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
	const bgClass = $derived(getStatusBgClass(effectiveStatus()));

	const targetUrl = $derived(() => {
		if (monitor.type === 'http') {
			return monitor.target;
		}
		if (monitor.type === 'ssl') {
			return `https://${monitor.target}`;
		}
		return null;
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

{#if layout === 'table'}
	<tr class="border-b border-base-300 last:border-0 hover:bg-base-300/30">
		<td class="px-4 py-2.5 font-medium text-base-content">
			<span
				class="tooltip tooltip-top decoration-base-content/40 decoration-dotted underline-offset-3 {monitor.description
					? 'cursor-help underline'
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
						class="ml-1.5 text-xs text-base-content/40 hover:text-primary"
					>
						{monitor.target}
					</a>
				{:else if monitor.target}
					<span class="ml-1.5 text-xs text-base-content/40">{monitor.target}</span>
				{/if}
			{/if}
		</td>
		<td class="px-4 py-2.5">
			<span class="inline-flex items-center gap-1.5 text-sm {textClass}">
				<span class="h-2 w-2 shrink-0 rounded-full {dotClass}"></span>
				{statusInfo.label}
			</span>
		</td>
		<td class="px-4 py-2.5 text-sm text-base-content/50">
			{monitor.responseTime ? `${monitor.responseTime}ms` : '—'}
		</td>
		{#if showMonitorType}
			<td class="px-4 py-2.5">
				<span class="rounded bg-base-300 px-1.5 py-0.5 font-mono text-xs text-base-content/70"
					>{monitor.type}</span
				>
			</td>
		{/if}
		{#if showSSL}
			<td class="px-4 py-2.5 text-xs">
				{#if monitor.type === 'ssl' && monitor.daysRemaining !== null && monitor.daysRemaining !== undefined}
					<span
						class={monitor.daysRemaining <= 7
							? 'text-error'
							: monitor.daysRemaining <= 14
								? 'text-warning'
								: 'text-base-content/50'}>{monitor.daysRemaining}d</span
					>
				{/if}
			</td>
		{/if}
	</tr>
{:else if layout === 'grid'}
	<div class="flex flex-col gap-2 rounded-lg bg-base-200 p-3">
		<div class="flex items-start justify-between gap-2">
			<span
				class="tooltip tooltip-top text-sm leading-tight font-medium text-base-content decoration-base-content/40 decoration-dotted underline-offset-3 {monitor.description
					? 'cursor-help underline'
					: ''}"
				data-tip={monitor.description}
			>
				{monitor.name}
			</span>
			<span
				class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {textClass}"
			>
				<span class="h-1.5 w-1.5 rounded-full {dotClass}"></span>
				{statusInfo.label}
			</span>
		</div>
		{#if monitor.showTarget && monitor.target}
			{#if targetUrl()}
				<a
					href={targetUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="truncate text-xs text-base-content/40 hover:text-primary"
				>
					{monitor.target}
				</a>
			{:else}
				<span class="truncate text-xs text-base-content/40">{monitor.target}</span>
			{/if}
		{/if}
		{#if shouldShowHistory && hasHistory}
			<MonitorHistory
				history={monitor.history}
				uptime={monitor.uptime}
				{config}
				incidentStatus={monitor.incidentStatus}
				incidentStartDate={incidentStartDate()}
			/>
		{/if}
		<div class="flex items-center justify-between text-xs text-base-content/50">
			{#if showMonitorType}
				<span class="rounded bg-base-300 px-1.5 py-0.5 font-mono">{monitor.type}</span>
			{/if}
			<div class="flex items-center gap-2">
				{#if showSSL && monitor.type === 'ssl' && monitor.daysRemaining !== null && monitor.daysRemaining !== undefined}
					<span
						class={monitor.daysRemaining <= 7
							? 'text-error'
							: monitor.daysRemaining <= 14
								? 'text-warning'
								: 'text-base-content/50'}>{monitor.daysRemaining}d</span
					>
				{/if}
				{#if monitor.responseTime}
					<span>{monitor.responseTime}ms</span>
				{/if}
			</div>
		</div>
	</div>
{:else}
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
				{#if monitor.type === 'ssl' && monitor.daysRemaining !== null && monitor.daysRemaining !== undefined}
					<span
						class="text-xs {monitor.daysRemaining <= 7
							? 'text-error'
							: monitor.daysRemaining <= 14
								? 'text-warning'
								: 'text-base-content/50'}">{monitor.daysRemaining}d</span
					>
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
{/if}

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
