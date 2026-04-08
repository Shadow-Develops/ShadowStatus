<script>
	import config from '$lib/config';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import OverallStatus from '$lib/components/OverallStatus.svelte';
	import IncidentCard from '$lib/components/IncidentCard.svelte';
	import MonitorCard from '$lib/components/MonitorCard.svelte';
	import MonitorGroup from '$lib/components/MonitorGroup.svelte';
	import Announcement from '$lib/components/Announcement.svelte';

	const REFRESH_INTERVAL = 16 * 60 * 1000; // 16 minutes (matches action cron of 15min + 1 minute buffer)

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
			const response = await fetch(`/data/status.json?t=${Date.now()}`);
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

	let searchQuery = $state('');
	let statusFilter = $state('all');
	let groupFilter = $state('all');
	let allGroupsOpen = $state(null); // null = uncontrolled, true = force open, false = force closed

	const allGroupNames = $derived(monitorGroups.map((g) => g.name));

	function monitorMatchesFilters(monitor, groupName = null) {
		const effectiveStatus = monitor.incidentStatus || monitor.status;

		if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
		if (groupFilter !== 'all' && groupFilter !== (groupName ?? '__ungrouped__')) return false;

		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			if (!monitor.name.toLowerCase().includes(q)) return false;
		}

		return true;
	}

	const filteredGroups = $derived(
		monitorGroups
			.map((group) => ({
				...group,
				monitors: group.monitors.filter((m) => monitorMatchesFilters(m, group.name))
			}))
			.filter((group) => {
				if (groupFilter !== 'all' && groupFilter !== group.name) return false;
				return group.monitors.length > 0;
			})
	);

	const filteredMonitors = $derived(
		monitors.filter((m) => monitorMatchesFilters(m, '__ungrouped__'))
	);

	const hasActiveFilters = $derived(
		searchQuery.trim() !== '' || statusFilter !== 'all' || groupFilter !== 'all'
	);

	const statusFilterOptions = $derived(() => {
		const statuses = new Set();
		for (const group of monitorGroups) {
			for (const m of group.monitors) statuses.add(m.incidentStatus || m.status);
		}
		for (const m of monitors) statuses.add(m.incidentStatus || m.status);
		return [...statuses].filter(Boolean);
	});

	const monitorsCfg = $derived(config.design?.monitors ?? {});
	const layoutMode = $derived(monitorsCfg.layout ?? 'default');
	const gridColumns = $derived(monitorsCfg.gridColumns ?? 2);
	const showFilterBar = $derived(monitorsCfg.showFilterBar ?? true);
	const showSearch = $derived(monitorsCfg.showSearch ?? true);
	const showStatusFilter = $derived(monitorsCfg.showStatusFilter ?? true);
	const showGroupFilter = $derived(monitorsCfg.showGroupFilter ?? true);
	const showCollapseButtons = $derived(monitorsCfg.showCollapseButtons ?? true);

	const pageOrder = $derived(
		config.design?.pageOrder ?? [
			'overall-status',
			'announcements',
			'active-incidents',
			'monitors',
			'upcoming-maintenance',
			'recent-incidents'
		]
	);

	const showMonitorType = $derived(monitorsCfg.showMonitorType ?? true);
	const showSSL = $derived(monitorsCfg.showSSL ?? true);

	const pageMaxWidth = $derived(() => {
		const widthSetting = config.design?.pageWidth ?? 'auto';
		const widthMap = {
			'3xl': 'max-w-3xl',
			'4xl': 'max-w-4xl',
			'5xl': 'max-w-5xl',
			'6xl': 'max-w-6xl',
			'7xl': 'max-w-7xl'
		};
		if (widthSetting !== 'auto' && widthMap[widthSetting]) {
			return widthMap[widthSetting];
		}
		if (layoutMode !== 'grid') return 'max-w-3xl';
		if (gridColumns <= 2) return 'max-w-3xl';
		if (gridColumns === 3) return 'max-w-5xl';
		if (gridColumns === 4) return 'max-w-6xl';
		return 'max-w-7xl';
	});

	let retryDelay = $state(0);

	async function loadStatusDataWithRetry() {
		await loadStatusData();
		if (error) {
			retryDelay = retryDelay === 0 ? 30 : Math.min(retryDelay * 2, 300);
		} else {
			retryDelay = 0;
		}
	}

	onMount(() => {
		loadStatusDataWithRetry();

		const countdownInterval = setInterval(() => {
			if (document.hidden) return;

			const remaining = calculateNextRefresh();

			if (remaining === null) return;

			if (retryDelay > 0) {
				retryDelay = Math.max(0, retryDelay - 1);
				nextRefreshIn = retryDelay;
				if (retryDelay === 0 && !isLoading) {
					loadStatusDataWithRetry();
				}
				return;
			}

			nextRefreshIn = remaining;

			if (remaining === 0 && !isLoading) {
				loadStatusDataWithRetry();
			}
		}, 1000);

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				const remaining = calculateNextRefresh();
				if (remaining !== null) {
					nextRefreshIn = remaining;
				}
				if ((remaining === 0 || remaining === null) && !isLoading) {
					loadStatusDataWithRetry();
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			clearInterval(countdownInterval);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:head>
	<title>{config.siteSettings.siteName}</title>
</svelte:head>

<div class="mx-auto px-4 py-8 {pageMaxWidth()}">
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

	{#snippet overallStatusSection()}
		{#if config.design.showOverallStatus}
			<section class="mb-8">
				<OverallStatus status={overallStatus} {config} />
			</section>
		{/if}
	{/snippet}

	{#snippet announcementsSection()}
		{#if announcements.length > 0}
			<section class="mb-8">
				{#each announcements as announcement (announcement.id)}
					<Announcement {announcement} {config} />
				{/each}
			</section>
		{/if}
	{/snippet}

	{#snippet activeIncidentsSection()}
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
	{/snippet}

	{#snippet monitorsSection()}
		{#if monitorGroups.length > 0 || monitors.length > 0}
			<section class="mb-8">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-base-content">Monitors</h2>
					{#if monitorGroups.length > 0 && layoutMode === 'default' && showCollapseButtons}
						<div class="flex gap-1 text-xs">
							<button
								class="cursor-pointer rounded px-2 py-1 text-base-content/50 hover:bg-base-300 hover:text-base-content"
								onclick={() => {
									allGroupsOpen = true;
								}}>Expand all</button
							>
							<button
								class="cursor-pointer rounded px-2 py-1 text-base-content/50 hover:bg-base-300 hover:text-base-content"
								onclick={() => {
									allGroupsOpen = false;
								}}>Collapse all</button
							>
						</div>
					{/if}
				</div>

				{#if showFilterBar}
					<div class="mb-3 flex flex-wrap gap-2">
						{#if showSearch}
							<div class="relative flex-1" style="min-width: 160px;">
								<svg
									class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
								<input
									type="text"
									placeholder="Search monitors..."
									bind:value={searchQuery}
									class="w-full rounded-lg border border-base-300 bg-base-200 py-1.5 pr-3 pl-8 text-sm text-base-content placeholder-base-content/40 focus:border-primary focus:outline-none"
								/>
							</div>
						{/if}

						{#if showStatusFilter}
							<select
								bind:value={statusFilter}
								class="cursor-pointer rounded-lg border border-base-300 bg-base-200 px-2.5 py-1.5 text-sm text-base-content focus:border-primary focus:outline-none"
							>
								<option value="all">All statuses</option>
								{#each statusFilterOptions() as s}
									<option value={s}>{config.statusLevels[s]?.label ?? s}</option>
								{/each}
							</select>
						{/if}

						{#if showGroupFilter && allGroupNames.length > 0}
							<select
								bind:value={groupFilter}
								class="cursor-pointer rounded-lg border border-base-300 bg-base-200 px-2.5 py-1.5 text-sm text-base-content focus:border-primary focus:outline-none"
							>
								<option value="all">All groups</option>
								{#each allGroupNames as name}
									<option value={name}>{name}</option>
								{/each}
								{#if monitors.length > 0}
									<option value="__ungrouped__">Ungrouped</option>
								{/if}
							</select>
						{/if}

						{#if hasActiveFilters}
							<button
								class="rounded-lg border border-base-300 bg-base-200 px-2.5 py-1.5 text-sm text-base-content/50 hover:text-base-content"
								onclick={() => {
									searchQuery = '';
									statusFilter = 'all';
									groupFilter = 'all';
								}}>Clear</button
							>
						{/if}
					</div>
				{/if}

				{#if layoutMode === 'table'}
					<div class="overflow-hidden rounded-lg border border-base-300">
						<table class="w-full text-sm">
							<thead class="bg-base-300">
								<tr>
									<th class="px-4 py-2 text-left font-medium text-base-content/70">Name</th>
									<th class="px-4 py-2 text-left font-medium text-base-content/70">Status</th>
									<th class="px-4 py-2 text-left font-medium text-base-content/70">Response Time</th
									>
									{#if showMonitorType}
										<th class="px-4 py-2 text-left font-medium text-base-content/70">Type</th>
									{/if}
									{#if showSSL}
										<th class="px-4 py-2 text-left font-medium text-base-content/70">SSL</th>
									{/if}
								</tr>
							</thead>
							<tbody class="bg-base-200">
								{#each filteredGroups as group (group.name)}
									{#if group.monitors.length > 0}
										<tr class="bg-base-300/40">
											<td
												colspan={3 + (showMonitorType ? 1 : 0) + (showSSL ? 1 : 0)}
												class="px-4 py-1.5 text-xs font-semibold text-base-content/60"
												>{group.name}</td
											>
										</tr>
										{#each group.monitors as monitor (monitor.name)}
											<MonitorCard {monitor} {config} layout="table" {showMonitorType} {showSSL} />
										{/each}
									{/if}
								{/each}
								{#each filteredMonitors as monitor (monitor.name)}
									<MonitorCard {monitor} {config} layout="table" {showMonitorType} {showSSL} />
								{/each}
							</tbody>
						</table>
						{#if filteredGroups.length === 0 && filteredMonitors.length === 0 && hasActiveFilters}
							<p class="py-6 text-center text-sm text-base-content/50">
								No monitors match your filters.
							</p>
						{/if}
					</div>
				{:else if layoutMode === 'grid'}
					<div
						class="grid gap-3"
						style="grid-template-columns: repeat({gridColumns}, minmax(0, 1fr))"
					>
						{#each filteredGroups as group (group.name)}
							{#if group.monitors.length > 0}
								<div class="col-span-full pt-1 text-xs font-semibold text-base-content/60">
									{group.name}
								</div>
								{#each group.monitors as monitor (monitor.name)}
									<MonitorCard {monitor} {config} layout="grid" {showMonitorType} {showSSL} />
								{/each}
							{/if}
						{/each}
						{#each filteredMonitors as monitor (monitor.name)}
							<MonitorCard {monitor} {config} layout="grid" {showMonitorType} {showSSL} />
						{/each}
						{#if filteredGroups.length === 0 && filteredMonitors.length === 0 && hasActiveFilters}
							<p class="col-span-full py-6 text-center text-sm text-base-content/50">
								No monitors match your filters.
							</p>
						{/if}
					</div>
				{:else}
					<div class="space-y-3">
						{#each filteredGroups as group (group.name)}
							<MonitorGroup
								{group}
								{config}
								defaultOpen={group.defaultOpen}
								showGroupStatus={group.showGroupStatus}
								forceOpen={allGroupsOpen}
							/>
						{/each}
						{#each filteredMonitors as monitor (monitor.name)}
							<MonitorCard {monitor} {config} />
						{/each}
						{#if filteredGroups.length === 0 && filteredMonitors.length === 0 && hasActiveFilters}
							<p class="py-6 text-center text-sm text-base-content/50">
								No monitors match your filters.
							</p>
						{/if}
					</div>
				{/if}
			</section>
		{/if}
	{/snippet}

	{#snippet upcomingMaintenanceSection()}
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
	{/snippet}

	{#snippet recentIncidentsSection()}
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
	{/snippet}

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

		{#each pageOrder as sectionId (sectionId)}
			{@const sectionSnippets = {
				'overall-status': overallStatusSection,
				announcements: announcementsSection,
				'active-incidents': activeIncidentsSection,
				monitors: monitorsSection,
				'upcoming-maintenance': upcomingMaintenanceSection,
				'recent-incidents': recentIncidentsSection
			}}
			{#if sectionSnippets[sectionId]}
				{@render sectionSnippets[sectionId]()}
			{/if}
		{/each}

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
