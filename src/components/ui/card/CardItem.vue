<script setup lang="ts">
	const { title, url, description } = defineProps<{
		title?: string
		subtitle?: string
		url?: string
		description?: string
	}>()
</script>
<template>
	<div>
		<a :href="url" target="_blank" class="text-lg font-bold text-accent">
			{{ title }}
		</a>
		<p v-if="subtitle" class="text-sm text-gray-600 dark:text-gray-300">
			{{ subtitle }}
		</p>
		<p class="mt-1">{{ description }}</p>
		<slot />
	</div>
</template>
