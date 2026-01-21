<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { base } from '$app/paths';
	import config from '$lib/config';
	let { children } = $props();

	let activeUrl = $derived($page.url.pathname);

	let isLoading = $state(true);
	onMount(() => {
		setTimeout(() => {
			isLoading = false;
		}, 100);

		//? Console Alert Messages
		console.log(
			"%cShadow Status %cis designed by %cShadow Development%c.\nGet Free: %chttps://shadowdevs.com/store/shadowstatus\n\n%c⚠️ WARNING: Do not paste any code here unless you know what you're doing!\n%cIf you encounter any errors, please contact support (https://shadowdevs.com/contactus).",
			'font-size: 18px; color: #3b82f6; font-weight: bold;',
			'font-size: 18px; color: #fff; font-weight: bold;',
			'font-size: 18px; color: #3b82f6; font-weight: bold;',
			'font-size: 13px; color: #fff;',
			'font-size: 13px; color: #60a5fa;',
			'color: #fbbf24; font-weight: bold;',
			'color: #9ca3af;'
		);
	});

	function getPageTitle(str) {
		return str
			.replace('/', '')
			.replace(/\//g, ' - ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

<svelte:head>
	{#if $page.url.pathname === '/'}
		<meta property="og:title" content={config.siteSettings.siteName} />
		<meta name="description" content={config.siteSettings.siteDescription} />
		<meta property="og:description" content={config.siteSettings.siteDescription} />
		<meta name="twitter:description" content={config.siteSettings.siteDescription} />
	{:else}
		<meta property="og:title" content={getPageTitle($page.url.pathname)} />
		<meta name="description" content={config.siteSettings.siteDescription} />
		<meta property="og:description" content={config.siteSettings.siteDescription} />
		<meta name="twitter:description" content={config.siteSettings.siteDescription} />
		<meta property="og:site_name" content={config.siteSettings.siteName} />
	{/if}
	<meta name="theme-color" content={config.siteSettings.metaColor} />
	<meta property="og:url" content={config.domain} />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content={config.domain} />
	<meta name="language" content="English" />
	<meta name="revisit-after" content="10 days" />
	<meta name="robots" content="index, follow" />

	{#if isLoading}
		<title>Loading...</title>
	{/if}
</svelte:head>

{#if isLoading}
	<div
		out:fade|global={{ duration: 500 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-base-100"
	>
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
	{#key activeUrl}
		<main class="min-h-[91vh]" in:fade|global={{ duration: 300 }}>
			{@render children()}
		</main>
	{/key}

	{#if config.design.footer.enabled}
		<footer class="border-t border-base-300 py-6">
			<div class="mx-auto max-w-3xl px-4 text-center">
				<p class="text-sm text-base-content/50">
					© {new Date().getFullYear()}
					<a href="{base}/" class="transition-colors hover:text-base-content">
						{config.siteSettings.siteName}
					</a>
				</p>
				{#if config.design.footer.credits}
					<p class="mt-1 text-xs text-base-content/30">
						Designed by
						<a
							href="https://shadowdevs.com"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-base-content/50"
						>
							Shadow Development
						</a>
					</p>
				{/if}
			</div>
		</footer>
	{/if}
{/if}
