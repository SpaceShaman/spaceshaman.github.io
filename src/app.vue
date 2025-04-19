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
		<div class="mx-auto max-w-7xl p-4 print:p-2">
			<div class="flex space-x-4 print:space-x-2">
				<LeftSection class="print:basis-3/10 basis-1/3" />
				<RightSection class="print:basis-7/10 basis-2/3" />
			</div>
		</div>
	</div>
</template>
<style>
	body {
		@apply h-screen bg-base-200;
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
		@apply text-xl font-bold text-accent;
	}
	h3 {
		@apply text-sm font-bold text-gray-600 dark:text-gray-300;
	}
	@media print {
		h1 {
			@apply text-xl font-bold;
		}
		h2 {
			@apply text-lg font-bold;
		}
		h3 {
			@apply text-xs font-bold;
		}
	}
</style>
