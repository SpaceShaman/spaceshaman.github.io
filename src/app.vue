<script setup lang="ts">
	useHead({
		bodyAttrs: {
			style: 'user-select: none;',
		},
		link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
	})
	useSeoMeta({
		title: 'Krzysztof Stanisławski - Fullstack Developer',
		description:
			"Krzysztof Stanisławski - Fullstack Developer. I'm a fullstack developer with a passion for creating advanced web applications.",
	})
</script>
<template>
	<ActionButtons />
	<div>
		<div class="mx-auto max-w-7xl p-4 print:p-1">
			<div class="flex space-x-4 print:space-x-2">
				<LeftSection class="basis-1/3 print:basis-2/5" />
				<RightSection class="basis-2/3 print:basis-3/5" />
			</div>
		</div>
	</div>
</template>
<style>
	body {
		@apply h-screen bg-base-200;
	}
	@media print {
		@page {
			size: A4;
		}
		body {
			height: 29.7cm;
		}
	}
	a {
		@apply text-accent;
	}
	a:hover {
		@apply text-accent-content;
	}
	h1 {
		@apply text-2xl font-bold;
	}
	h2 {
		@apply text-lg font-bold text-accent;
	}
</style>
