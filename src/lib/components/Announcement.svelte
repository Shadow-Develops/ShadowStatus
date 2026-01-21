<script>
	import parseMarkdown from '$lib/client/md';
	import { timeAgo } from '$lib/client/status.js';

	let { announcement, config } = $props();

	const displayBody = $derived(
		announcement.body?.replace(/<!--\s*type:\s*[^>]*-->/gi, '').trim() || null
	);

	// Extract first line of body for inline display when no title
	const firstBodyLine = $derived.by(() => {
		if (!displayBody) return null;
		const firstLine = displayBody.split('\n')[0].trim();
		return firstLine || null;
	});

	const remainingBody = $derived.by(() => {
		if (!displayBody) return null;
		const lines = displayBody.split('\n');
		if (lines.length <= 1) return null;
		return lines.slice(1).join('\n').trim() || null;
	});

	const typeClasses = {
		success: {
			container: 'border-success/30 bg-gradient-to-r from-success/20 via-success/15 to-success/10',
			bar: 'bg-success',
			icon: 'text-success',
			divider: 'border-success/20',
			update: 'border-success/30'
		},
		info: {
			container: 'border-info/30 bg-gradient-to-r from-info/20 via-info/15 to-info/10',
			bar: 'bg-info',
			icon: 'text-info',
			divider: 'border-info/20',
			update: 'border-info/30'
		},
		error: {
			container: 'border-error/30 bg-gradient-to-r from-error/20 via-error/15 to-error/10',
			bar: 'bg-error',
			icon: 'text-error',
			divider: 'border-error/20',
			update: 'border-error/30'
		},
		warning: {
			container: 'border-warning/30 bg-gradient-to-r from-warning/20 via-warning/15 to-warning/10',
			bar: 'bg-warning',
			icon: 'text-warning',
			divider: 'border-warning/20',
			update: 'border-warning/30'
		},
		neutral: {
			container: 'border-neutral/30 bg-gradient-to-r from-neutral/20 via-neutral/15 to-neutral/10',
			bar: 'bg-neutral',
			icon: 'text-neutral',
			divider: 'border-neutral/20',
			update: 'border-neutral/30'
		},
		accent: {
			container: 'border-accent/30 bg-gradient-to-r from-accent/20 via-accent/15 to-accent/10',
			bar: 'bg-accent',
			icon: 'text-accent',
			divider: 'border-accent/20',
			update: 'border-accent/30'
		},
		secondary: {
			container:
				'border-secondary/30 bg-gradient-to-r from-secondary/20 via-secondary/15 to-secondary/10',
			bar: 'bg-secondary',
			icon: 'text-secondary',
			divider: 'border-secondary/20',
			update: 'border-secondary/30'
		}
	};
	const type = $derived.by(() => {
		const match = announcement.body?.match(/<!--\s*type:\s*([^>]*?)-->/i);
		const typeMatch = match ? match[1].trim() : 'info';
		return typeClasses[typeMatch] ? typeMatch : 'info';
	});
	const classes = $derived(typeClasses[type]);

	const updates = $derived.by(() => {
		if (announcement.updates && announcement.updates.length > 0) {
			return [...announcement.updates].sort(
				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
			);
		}
		return announcement.updates;
	});
</script>

<div class="relative overflow-hidden rounded-xl border {classes.container}">
	<div class="absolute top-0 bottom-0 left-0 w-1 {classes.bar}"></div>

	<div class="p-4 pl-5">
		{#if config.design.announcement.showIcon}
			<div class="mb-3 flex items-center gap-3">
				{#if type == 'error'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-6 w-6 shrink-0 {classes.icon}"
						viewBox="0 0 24 24"
					>
						<path
							fill="none"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-miterlimit="10"
							stroke-width="1.5"
							d="M12 16h.008M12 8v5M3.23 7.913L7.91 3.23c.15-.15.35-.23.57-.23h7.05c.21 0 .42.08.57.23l4.67 4.673c.15.15.23.35.23.57v7.054c0 .21-.08.42-.23.57L16.1 20.77c-.15.15-.35.23-.57.23H8.47a.8.8 0 0 1-.57-.23l-4.67-4.673a.8.8 0 0 1-.23-.57V8.473c0-.21.08-.42.23-.57z"
						/>
					</svg>
				{:else if type == 'success'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-6 w-6 shrink-0 {classes.icon}"
						viewBox="0 0 48 48"
					>
						<g
							fill="none"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="4"
						>
							<path
								d="m24 4l5.253 3.832l6.503-.012l1.997 6.188l5.268 3.812L41 24l2.021 6.18l-5.268 3.812l-1.997 6.188l-6.503-.012L24 44l-5.253-3.832l-6.503.012l-1.997-6.188l-5.268-3.812L7 24l-2.021-6.18l5.268-3.812l1.997-6.188l6.503.012z"
							/>
							<path d="m17 24l5 5l10-10" />
						</g>
					</svg>
				{:else if type == 'warning'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-6 w-6 shrink-0 {classes.icon}"
						viewBox="0 0 24 24"
					>
						<path
							fill="currentColor"
							fill-rule="evenodd"
							d="M12.218 5.377a.25.25 0 0 0-.436 0l-7.29 12.96a.25.25 0 0 0 .218.373h14.58a.25.25 0 0 0 .218-.372l-7.29-12.96Zm-1.743-.735c.669-1.19 2.381-1.19 3.05 0l7.29 12.96a1.75 1.75 0 0 1-1.525 2.608H4.71a1.75 1.75 0 0 1-1.525-2.608zM12.75 17.46h-1.5v-1.5h1.5zm-1.5-3h1.5v-5h-1.5z"
						/>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mt-0.5 h-5 w-5 shrink-0 {classes.icon}"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
				{#if config.design.announcement.showTitle}
					<h3 class="font-semibold text-base-content">{announcement.title}</h3>
				{:else if firstBodyLine}
					<div id="firstLine" class="text-sm text-base-content/70">
						{@html parseMarkdown(firstBodyLine)}
					</div>
				{/if}
			</div>
		{:else if config.design.announcement.showTitle}
			<h3 class="mb-3 font-semibold text-base-content">{announcement.title}</h3>
		{/if}

		<div class="min-w-0">
			{#if config.design.announcement.showIcon && !config.design.announcement.showTitle && remainingBody}
				<div id="body" class="max-w-none text-sm text-base-content/70">
					{@html parseMarkdown(remainingBody)}
				</div>
			{:else if displayBody && (config.design.announcement.showTitle || !config.design.announcement.showIcon)}
				<div id="body" class="max-w-none text-sm text-base-content/70">
					{@html parseMarkdown(displayBody)}
				</div>
			{/if}

			<div class="mt-2 flex items-center gap-2 text-xs text-base-content/50">
				<span>{timeAgo(announcement.createdAt)}</span>
				{#if config.design.announcement.showGithubLink}
					<span>&bullet;</span>
					<a
						href={announcement.url}
						target="_blank"
						rel="noopener noreferrer"
						class="link link-hover hover:text-primary/80"
					>
						View on GitHub
					</a>
				{/if}
			</div>

			{#if updates && updates.length > 0}
				<div class="mt-3 space-y-2 border-t {classes.divider} pt-3">
					{#each updates as update (update.id)}
						<div class="border-l-2 {classes.update} pl-3">
							<p class="text-sm whitespace-pre-wrap text-base-content/80">
								{@html parseMarkdown(update.body)}
							</p>
							<div class="mt-1 flex items-center gap-2 text-xs text-base-content/50">
								{#if config.design.announcement.showCommentAuthor}
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
		</div>
	</div>
</div>

<style>
	#body :global(:first-child) {
		margin-top: 0 !important;
	}
	#firstLine :global(:first-child) {
		margin-top: 0 !important;
		margin-bottom: 0 !important;
	}
</style>
