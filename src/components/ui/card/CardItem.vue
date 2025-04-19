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
		<h2>
			<a :href="url" target="_blank">
				{{ title }}
			</a>
		</h2>
		<h3 v-if="subtitle">
			{{ subtitle }}
		</h3>
		<p class="mt-1">{{ description }}</p>
		<slot />
	</div>
</template>
