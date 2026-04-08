<script>
	import { untrack } from 'svelte';

	let {
		history = [],
		uptime = null,
		config,
		incidentStatus = null,
		incidentStartDate = null
	} = $props();

	const showStatusTab = $derived(config.design?.historyGraph?.showStatusTab ?? true);
	const showResponseTimeTab = $derived(config.design?.historyGraph?.showResponseTimeTab ?? true);

	let activeTab = $state(untrack(() => config.design?.historyGraph?.defaultTab ?? 'status'));

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

	const rtPoints = $derived(() =>
		days().map((day, i) => ({
			index: i,
			day: day.day,
			value: day.avgResponseTime ?? null
		}))
	);

	const hasResponseTimeData = $derived(() => rtPoints().some((p) => p.value !== null));

	const rtRange = $derived.by(() => {
		const values = rtPoints()
			.map((p) => p.value)
			.filter((v) => v !== null);
		if (values.length === 0) return { min: 0, max: 1 };
		const min = Math.min(...values);
		const max = Math.max(...values);
		const padding = (max - min) * 0.1 || 10;
		return { min: Math.max(0, min - padding), max: max + padding };
	});

	const SVG_W = 600;
	const SVG_H = 60;
	const PAD_T = 4;
	const PAD_B = 4;

	function toX(index, total) {
		if (total <= 1) return SVG_W / 2;
		return (index / (total - 1)) * SVG_W;
	}

	function toY(value, min, max) {
		const range = max - min || 1;
		return PAD_T + ((value - min) / range) * (SVG_H - PAD_T - PAD_B);
	}

	const rtSegments = $derived.by(() => {
		const points = rtPoints();
		const { min, max } = rtRange;
		const total = points.length;
		const segments = [];
		let current = [];
		for (const pt of points) {
			if (pt.value !== null) {
				current.push({
					x: toX(pt.index, total),
					y: toY(pt.value, min, max),
					day: pt.day,
					value: pt.value
				});
			} else {
				if (current.length > 0) {
					segments.push(current);
					current = [];
				}
			}
		}
		if (current.length > 0) segments.push(current);
		return segments;
	});

	function buildLinePath(seg) {
		return seg
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
			.join(' ');
	}

	function buildAreaPath(seg) {
		if (seg.length === 0) return '';
		const line = seg
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
			.join(' ');
		const bottom = SVG_H - PAD_B;
		return `${line} L ${seg.at(-1).x.toFixed(2)},${bottom} L ${seg[0].x.toFixed(2)},${bottom} Z`;
	}

	let rtTooltip = $state(null);

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
	{#if hasResponseTimeData() && showStatusTab && showResponseTimeTab}
		<div class="mb-1.5 flex gap-1 text-xs">
			<button
				class="cursor-pointer rounded px-2 py-0.5 {activeTab === 'status'
					? 'bg-base-300 text-base-content'
					: 'text-base-content/50 hover:text-base-content'}"
				onclick={() => (activeTab = 'status')}>Status</button
			>
			<button
				class="cursor-pointer rounded px-2 py-0.5 {activeTab === 'response'
					? 'bg-base-300 text-base-content'
					: 'text-base-content/50 hover:text-base-content'}"
				onclick={() => (activeTab = 'response')}>Response Time</button
			>
		</div>
	{/if}

	{#if activeTab === 'status' && showStatusTab}
		<div class="flex min-w-0 gap-px overflow-hidden">
			{#each days() as day (day.day)}
				{@const segments = getStatusSegments(day)}
				<div class="group relative min-w-0 flex-1">
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
							<div class={day.status ? '' : 'text-base-content/50'}>
								{getStatusLabel(day.status)}
							</div>
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
	{/if}

	{#if activeTab === 'response' && showResponseTimeTab}
		<div class="relative h-8">
			<svg
				viewBox="0 0 {SVG_W} {SVG_H}"
				preserveAspectRatio="none"
				class="h-full w-full overflow-visible"
			>
				<defs>
					<linearGradient id="rt-area-gradient" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="currentColor" stop-opacity="0.2" />
						<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
					</linearGradient>
				</defs>
				{#each rtSegments as seg}
					<path d={buildAreaPath(seg)} fill="url(#rt-area-gradient)" class="text-primary" />
					<path
						d={buildLinePath(seg)}
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						class="text-primary"
					/>
					{#each seg as pt}
						<circle
							cx={pt.x}
							cy={pt.y}
							r="3"
							fill="currentColor"
							role="presentation"
							class="cursor-pointer text-primary opacity-0 hover:opacity-100"
							onmouseenter={() => (rtTooltip = pt)}
							onmouseleave={() => (rtTooltip = null)}
						/>
					{/each}
				{/each}
			</svg>
			{#if rtTooltip}
				<div
					class="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded bg-base-300 px-2 py-1 text-xs whitespace-nowrap shadow-lg"
					style="left: {(rtTooltip.x / SVG_W) * 100}%"
				>
					<div class="font-medium">{formatDate(rtTooltip.day)}</div>
					<div>{Math.round(rtTooltip.value)}ms</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="mt-1 flex items-center justify-between text-xs text-base-content/50">
		<span>90 days ago</span>
		{#if activeTab === 'status' && uptime !== null}
			<span class="font-medium">{uptime}% uptime</span>
		{:else if activeTab === 'response'}
			<span>avg response time</span>
		{/if}
		<span>Today</span>
	</div>
</div>

<style>
	.ping-dot {
		position: relative;
	}
</style>
