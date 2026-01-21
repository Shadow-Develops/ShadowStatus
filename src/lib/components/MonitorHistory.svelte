<script>
	let {
		history = [],
		uptime = null,
		config,
		incidentStatus = null,
		incidentStartDate = null
	} = $props();

	const days = $derived(() => {
		const sliced = history.slice(-90);
		const today = new Date().toISOString().split('T')[0];

		if (!incidentStatus) return sliced;

		const effectiveStartDate = incidentStartDate || today;

		if (sliced.length === 0) {
			return [{ day: today, status: incidentStatus, hasIncident: true, checks: 0 }];
		}

		let result = sliced.map((day) => {
			if (day.day >= effectiveStartDate && day.day <= today) {
				const updatedDay = { ...day, hasIncident: true, incidentStatus };

				if (day.statusCounts && day.checks > 0) {
					const newStatusCounts = { ...day.statusCounts };
					newStatusCounts[incidentStatus] = (newStatusCounts[incidentStatus] || 0) + 1;
					updatedDay.statusCounts = newStatusCounts;
					updatedDay.checks = day.checks + 1;
				} else {
					updatedDay.status = incidentStatus;
				}

				return updatedDay;
			}
			return day;
		});

		const lastDay = result[result.length - 1];
		if (lastDay.day !== today) {
			result = [...result, { day: today, status: incidentStatus, hasIncident: true, checks: 0 }];
		}

		return result;
	});

	const statusOrder = ['operational', 'maintenance', 'degraded', 'partial', 'major'];

	function getStatusColor(status) {
		if (!status) return 'bg-base-300'; // No data
		switch (status) {
			case 'operational':
				return 'bg-success';
			case 'degraded':
				return 'bg-warning';
			case 'partial':
				return 'bg-warning';
			case 'major':
				return 'bg-error';
			case 'maintenance':
				return 'bg-info';
			default:
				return 'bg-base-300';
		}
	}

	function getStatusLabel(status) {
		if (!status) return 'No data';
		return config.statusLevels[status]?.label ?? status;
	}

	function formatDate(dateStr) {
		// Parse as local date to avoid timezone shift issues
		// dateStr is in YYYY-MM-DD format
		const [year, month, day] = dateStr.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getStatusSegments(day) {
		if (!day.statusCounts || day.checks === 0) {
			return [{ status: day.status, percent: 100 }];
		}

		const segments = [];
		for (const status of statusOrder) {
			if (day.statusCounts[status]) {
				const percent = (day.statusCounts[status] / day.checks) * 100;
				segments.push({ status, percent, count: day.statusCounts[status] });
			}
		}
		return segments.length > 0 ? segments : [{ status: day.status, percent: 100 }];
	}
</script>

<div class="mt-2">
	<div class="flex gap-px">
		{#each days() as day (day.day)}
			{@const segments = getStatusSegments(day)}
			<div class="group relative flex-1">
				<div
					class="flex h-8 min-w-0.75 flex-col-reverse overflow-hidden rounded-sm transition-all hover:scale-y-110"
				>
					{#each segments as segment}
						<div
							class="{getStatusColor(segment.status)} min-h-0"
							style="height: {segment.percent}%"
						></div>
					{/each}
				</div>
				<div
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 overflow-clip rounded bg-base-300 px-2 py-1 text-xs whitespace-nowrap shadow-lg group-hover:block"
				>
					<div class="font-medium">{formatDate(day.day)}</div>
					{#if day.checks > 0 && day.statusCounts}
						{#each segments as segment}
							<div class="flex items-center gap-1.5">
								<span class="inline-block h-2 w-2 rounded-sm {getStatusColor(segment.status)}"
								></span>
								<span>{getStatusLabel(segment.status)}: {segment.count}</span>
							</div>
						{/each}
					{:else}
						<div class={day.status ? '' : 'text-base-content/50'}>{getStatusLabel(day.status)}</div>
					{/if}
					{#if day.checks > 0}
						<div class="mt-1 text-base-content/50">{day.checks} checks</div>
					{/if}
					{#if day.avgResponseTime}
						<div class="text-base-content/50">Avg: {Math.round(day.avgResponseTime)}ms</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
	<div class="mt-1 flex items-center justify-between text-xs text-base-content/50">
		<span>90 days ago</span>
		{#if uptime !== null}
			<span class="font-medium">{uptime}% uptime</span>
		{/if}
		<span>Today</span>
	</div>
</div>
