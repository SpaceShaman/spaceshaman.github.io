<script lang="ts" setup>
	const { icon, url } = defineProps<{
		icon: string
		url: string
	}>()
</script>
<template>
	<a :href="url" target="_blank">
		<Icon :name="icon" size="2rem" />
	</a>
</template>
