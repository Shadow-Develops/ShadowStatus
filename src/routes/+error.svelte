<script>
	import { page } from '$app/stores';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>{$page.status} Error</title>
</svelte:head>

<section class="mx-auto flex h-[82vh] max-w-7xl items-center justify-center">
	<div class="mockup-browser border-base-300 w-1/2 border backdrop-blur-md">
		<div class="mockup-browser-toolbar">
			<div class="input bg-red-600/60!">{$page.url.href}</div>
		</div>
		<div class="border-base-300 grid h-80 place-content-center border-t">
			<div class="card text-neutral-content">
				<div class="card-body items-center text-center">
					<h2 class="card-title">{$page.status}</h2>
					<p>{@html $page.error.message}</p>
					<div class="card-actions mt-3 justify-end">
						<button on:click={() => history.back()} class="btn btn-primary">Back</button>
						<a href="{base}/" data-sveltekit-reload class="btn btn-ghost">Home</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
