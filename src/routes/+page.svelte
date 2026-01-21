<script>
	import config from '$lib/config';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import OverallStatus from '$lib/components/OverallStatus.svelte';
	import IncidentCard from '$lib/components/IncidentCard.svelte';
	import MonitorCard from '$lib/components/MonitorCard.svelte';
	import MonitorGroup from '$lib/components/MonitorGroup.svelte';
	import Announcement from '$lib/components/Announcement.svelte';

	const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes (matches action cron)

	let incidents = $state([]);
	let announcements = $state([]);
	let monitors = $state([]);
	let monitorGroups = $state([]);
	let overallStatus = $state('operational');
	let lastUpdated = $state(null);
	let isLoading = $state(true);
	let error = $state(null);
	let nextRefreshIn = $state(0);

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function calculateNextRefresh() {
		if (!lastUpdated) {
			return null;
		}
		const lastUpdate = new Date(lastUpdated).getTime();
		if (isNaN(lastUpdate)) {
			return null;
		}
		const nextUpdate = lastUpdate + REFRESH_INTERVAL;
		const now = Date.now();
		const remaining = Math.max(0, Math.ceil((nextUpdate - now) / 1000));
		return remaining;
	}

	function getIncidentState(incident) {
		if (incident.isResolved) {
			return 'ended';
		}

		if (incident.isMaintenance) {
			const now = new Date();
			const start = incident.scheduledStart ? new Date(incident.scheduledStart) : null;
			const end = incident.scheduledEnd ? new Date(incident.scheduledEnd) : null;
			if (end && now > end) {
				return 'ended';
			}
			if (start && now < start) {
				return 'upcoming';
			}
		}

		return 'active';
	}

	function recomputeMonitorStatuses(loadedMonitors, loadedIncidents) {
		const activeIncidents = loadedIncidents.filter((i) => getIncidentState(i) === 'active');

		return loadedMonitors.map((monitor) => {
			const activeAffecting = (monitor.affectingIncidents ?? []).filter(
				(inc) => getIncidentState(inc) !== 'ended'
			);

			if (monitor.status === 'maintenance' || monitor.incidentStatus === 'maintenance') {
				const stillAffected = activeIncidents.some(
					(incident) => incident.isMaintenance && isMonitorAffectedByIncident(monitor, incident)
				);

				if (!stillAffected) {
					return {
						...monitor,
						status: monitor.status === 'maintenance' ? 'operational' : monitor.status,
						incidentStatus: null,
						affectingIncidents: activeAffecting
					};
				}
			}

			if (activeAffecting.length !== (monitor.affectingIncidents?.length ?? 0)) {
				return {
					...monitor,
					affectingIncidents: activeAffecting,
					incidentStatus: activeAffecting.length > 0 ? monitor.incidentStatus : null
				};
			}

			return monitor;
		});
	}

	function isMonitorAffectedByIncident(monitor, incident) {
		const hasMonitors = incident.monitors && incident.monitors.length > 0;
		const hasGroups = incident.groups && incident.groups.length > 0;

		if (!hasMonitors && !hasGroups) {
			return true;
		}

		if (hasMonitors) {
			for (const pattern of incident.monitors) {
				if (matchesPattern(pattern, monitor.name)) {
					return true;
				}
			}
		}

		return false;
	}

	function matchesPattern(pattern, target) {
		if (!pattern || !target) return false;

		const lowerPattern = pattern.toLowerCase();
		const lowerTarget = target.toLowerCase();

		if (lowerPattern === lowerTarget) return true;

		if (lowerPattern.includes('*')) {
			const regexPattern = lowerPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
			const regex = new RegExp(`^${regexPattern}$`);
			return regex.test(lowerTarget);
		}

		return false;
	}

	async function loadStatusData() {
		try {
			const response = await fetch('/data/status.json');
			if (!response.ok) {
				throw new Error(`Failed to load status data: ${response.status}`);
			}
			const data = await response.json();

			incidents = data.incidents ?? [];
			announcements = data.announcements ?? [];

			monitors = recomputeMonitorStatuses(data.monitors ?? [], incidents);
			monitorGroups = (data.monitorGroups ?? []).map((group) => ({
				...group,
				monitors: recomputeMonitorStatuses(group.monitors ?? [], incidents)
			}));

			overallStatus = calculateOverallStatus(
				[...monitors, ...monitorGroups.flatMap((g) => g.monitors)],
				incidents
			);
			lastUpdated = data.lastUpdated ?? null;
			nextRefreshIn = calculateNextRefresh();

			isLoading = false;
		} catch (e) {
			console.error('Failed to load status data:', e);
			error = 'Failed to load status data. Please try again later.';
			isLoading = false;
		}
	}

	function calculateOverallStatus(allMonitors, incidents) {
		let worstStatus = 'operational';
		let worstPriority = 0;

		for (const monitor of allMonitors) {
			if (monitor.applyToOverall === false) continue;

			const monitorPriority = config.statusLevels[monitor.status]?.priority ?? 0;
			if (monitorPriority > worstPriority) {
				worstPriority = monitorPriority;
				worstStatus = monitor.status;
			}

			if (monitor.incidentStatus) {
				const incidentPriority = config.statusLevels[monitor.incidentStatus]?.priority ?? 0;
				if (incidentPriority > worstPriority) {
					worstPriority = incidentPriority;
					worstStatus = monitor.incidentStatus;
				}
			}
		}

		const activeIncidents = incidents.filter((i) => getIncidentState(i) === 'active');
		for (const incident of activeIncidents) {
			const priority = config.statusLevels[incident.status]?.priority ?? 0;
			if (priority > worstPriority) {
				worstPriority = priority;
				worstStatus = incident.status;
			}
		}

		return worstStatus;
	}

	const activeIncidents = $derived(incidents.filter((i) => getIncidentState(i) === 'active'));
	const upcomingMaintenance = $derived(incidents.filter((i) => getIncidentState(i) === 'upcoming'));
	const recentIncidents = $derived(
		incidents
			.filter((i) => getIncidentState(i) === 'ended')
			.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
			.slice(0, config.design?.recentIncidents?.number || 5)
	);

	onMount(() => {
		loadStatusData();

		const countdownInterval = setInterval(() => {
			nextRefreshIn = Math.max(0, nextRefreshIn - 1);
		}, 1000);

		return () => {
			clearInterval(countdownInterval);
		};
	});
</script>

<svelte:head>
	<title>{config.siteSettings.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-8 text-center">
		{#if config.design.useLogo && config.design.useLogo !== '' && config.design.useLogo !== null}
			<img
				src={config.design.useLogo}
				alt="Site Logo/Banner"
				class="mx-auto h-auto max-w-full"
				width={config.design.logoDimensions.width}
				height={config.design.logoDimensions.height}
				style="max-height: {config.design.logoDimensions.height}px"
				class:mb-3={config.design.showSiteName || config.design.showDescription}
			/>
		{/if}
		{#if config.design.showSiteName}
			<h1 class="text-3xl font-bold text-base-content">{config.siteSettings.siteName}</h1>
		{/if}
		{#if config.design.showDescription}
			<p class="mt-2 text-base-content/60">{config.siteSettings.siteDescription}</p>
		{/if}
	</header>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<svg
				class="h-8 w-8 animate-spin text-base-content/50"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			<span class="ml-3 text-base-content/60">Loading status...</span>
		</div>
	{:else}
		{#if error}
			<div transition:fade={{ duration: 250 }} class="mb-6 alert alert-warning">
				<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		{#if config.design.showOverallStatus}
			<section class="mb-8">
				<OverallStatus status={overallStatus} {config} />
			</section>
		{/if}

		{#if announcements.length > 0}
			<section class="mb-8">
				{#each announcements as announcement (announcement.id)}
					<Announcement {announcement} {config} />
				{/each}
			</section>
		{/if}

		{#if activeIncidents.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-lg font-semibold text-base-content">Active Incidents</h2>
				<div class="space-y-3">
					{#each activeIncidents as incident (incident.id)}
						<IncidentCard {incident} {config} expanded={activeIncidents.length == 1} />
					{/each}
				</div>
			</section>
		{/if}

		{#if monitorGroups.length > 0 || monitors.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-lg font-semibold text-base-content">Monitors</h2>
				<div class="space-y-3">
					{#each monitorGroups as group (group.name)}
						<MonitorGroup
							{group}
							{config}
							defaultOpen={group.defaultOpen}
							showGroupStatus={group.showGroupStatus}
						/>
					{/each}
					{#each monitors as monitor (monitor.name)}
						<MonitorCard {monitor} {config} />
					{/each}
				</div>
			</section>
		{/if}

		{#if upcomingMaintenance.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-lg font-semibold text-base-content">Upcoming Maintenance</h2>
				<div class="space-y-3">
					{#each upcomingMaintenance as incident (incident.id)}
						<IncidentCard {incident} {config} />
					{/each}
				</div>
			</section>
		{/if}

		{#if config.design.recentIncidents.active && recentIncidents.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-lg font-semibold text-base-content">Recent Incidents</h2>
				<div class="space-y-3">
					{#each recentIncidents as incident (incident.id)}
						<IncidentCard {incident} {config} />
					{/each}
				</div>
			</section>
		{/if}

		{#if incidents.length === 0 && monitors.length === 0 && monitorGroups.length === 0}
			<section class="rounded-lg border border-base-300 bg-base-200 p-8 text-center">
				<svg
					class="mx-auto h-12 w-12 text-base-content/30"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="mt-4 text-base-content/60">No monitors or incidents configured.</p>
			</section>
		{/if}

		<footer class="mt-8 text-center text-sm text-base-content/50">
			<p>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}</p>
			<p>Next refresh in: {nextRefreshIn !== null ? formatTime(nextRefreshIn) : 'Unknown'}</p>
		</footer>
	{/if}
</div>
