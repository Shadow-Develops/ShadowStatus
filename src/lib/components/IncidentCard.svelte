<script>
	import parseMarkdown from '$lib/client/md';
	import {
		getStatusDotClass,
		getStatusTextClass,
		timeAgo,
		formatDate
	} from '$lib/client/status.js';

	let { incident, config, expanded = false } = $props();

	const statusInfo = $derived(
		config.statusLevels[incident.status] ?? config.statusLevels.operational
	);
	const dotClass = $derived(getStatusDotClass(incident.status));
	const textClass = $derived(getStatusTextClass(incident.status));

	const displayBody = $derived(
		incident.body
			?.replace(/<!--\s*monitors:\s*[^>]*-->/gi, '')
			.replace(/<!--\s*groups:\s*[^>]*-->/gi, '')
			.replace(/<!--\s*start:\s*[^>]*-->/gi, '')
			.replace(/<!--\s*end:\s*[^>]*-->/gi, '')
			.trim() || null
	);
	const hasStart = $derived(/<!--\s*start:\s*[^>]*-->/gi.test(incident.body ?? ''));
	const hasEnd = $derived(/<!--\s*end:\s*[^>]*-->/gi.test(incident.body ?? ''));

	const updates = $derived.by(() => {
		if (incident.updates && incident.updates.length > 0) {
			return [...incident.updates].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		}
		return incident.updates;
	});

	function formatMaintenanceDate(date) {
		return new Date(date).toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-200">
	<button
		class="flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-base-300/50"
		onclick={() => (expanded = !expanded)}
	>
		<div class="min-w-0 flex-1">
			<div class="mb-1 flex flex-wrap items-center gap-2">
				<span class="h-2 w-2 shrink-0 rounded-full {dotClass}"></span>
				<h3 class="font-medium text-base-content">{incident.title}</h3>
				{#if incident.isResolved}
					<span class="badge badge-ghost badge-sm">Resolved</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/60">
				<span class={textClass}>{statusInfo.label}</span>
				<span class="hidden sm:inline">·</span>
				<span>Updated: {timeAgo(incident.updatedAt)}</span>
				{#if hasStart}
					<span class="hidden sm:inline">·</span>
					<span>
						Start: {formatMaintenanceDate(
							new Date(incident.body.match(/<!--\s*start:\s*([^]*?)\s*-->/i)?.[1])
						)}
					</span>
				{/if}
				{#if hasEnd}
					<span class="hidden sm:inline">·</span>
					<span>
						End: {formatMaintenanceDate(
							new Date(incident.body.match(/<!--\s*end:\s*([^]*?)\s*-->/i)?.[1])
						)}
					</span>
				{/if}
			</div>
		</div>
		<svg
			class="mt-1 h-5 w-5 shrink-0 text-base-content/40 transition-transform"
			class:rotate-180={expanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if expanded}
		<div class="border-t border-base-300 px-4 pb-4">
			{#if incident.updates && incident.updates.length > 0}
				<div class="mb-4 space-y-3 border-b border-base-300 pt-3 pb-4">
					{#each updates as update (update.id)}
						<div class="relative border-l-2 border-base-300 pl-4">
							<p class="text-sm whitespace-pre-wrap text-base-content/80">
								{@html parseMarkdown(update.body)}
							</p>
							<div class="mt-1 flex items-center gap-2 text-xs text-base-content/50">
								{#if config.design.incident.showCommentAuthor}
									{#if update.authorAvatar}
										<img
											src={update.authorAvatar}
											alt={update.author}
											class="h-4 w-4 rounded-full"
										/>
									{/if}
									<span class="font-medium text-base-content/70">{update.author}</span>
									<span>·</span>
								{/if}
								<span>{timeAgo(update.createdAt)}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="prose-sm prose-invert mt-3 prose max-w-none">
				{#if displayBody}
					<p class="whitespace-pre-wrap text-base-content/80">{@html parseMarkdown(displayBody)}</p>
				{:else}
					<p class="text-base-content/50 italic">No description provided.</p>
				{/if}
			</div>

			<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
				<span>Created: {formatDate(incident.createdAt)}</span>
				{#if incident.closedAt}
					<span>&bullet;</span>
					<span>Resolved: {formatDate(incident.closedAt)}</span>
				{/if}
				{#if config.design.incident.showGithubLink}
					<span>&bullet;</span>
					<a
						href={incident.url}
						target="_blank"
						rel="noopener noreferrer"
						class="link link-hover hover:text-primary/80"
					>
						View on GitHub
					</a>
				{/if}
			</div>
		</div>
	{/if}
</div>
