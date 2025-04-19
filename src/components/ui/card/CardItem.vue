<script setup lang="ts">
	const { title, url, description } = defineProps<{
		title?: string
		url?: string
		description?: string
	}>()
</script>
<template>
	<h2>
		<a :href="url" target="_blank">
			{{ title }}
		</a>
	</h2>
	<p>{{ description }}</p>
	<slot />
</template>
