<script setup lang="ts">
	const { title } = defineProps<{
		title?: string
	}>()
</script>

<template>
	<div class="card bg-base-100 shadow-sm print:card-sm">
		<div class="card-body">
			<h1 v-if="title">{{ title }}</h1>
			<slot />
		</div>
	</div>
</template>
