<script setup lang="ts">
	const { icon } = defineProps<{
		icon: string
	}>()
</script>
<template>
	<button class="btn btn-soft btn-circle">
		<Icon :name="icon" size="1.5rem" />
	</button>
</template>
