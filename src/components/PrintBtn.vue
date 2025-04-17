<script setup lang="ts">
	const printCV = () => {
		window.print()
	}
</script>
<template>
	<button class="btn btn-soft btn-circle" @click="printCV">
		<Icon name="mdi:printer-outline" size="1.5rem" />
	</button>
</template>
