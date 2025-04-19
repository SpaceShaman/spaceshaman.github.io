<script setup lang="ts">
	const printCV = () => {
		window.print()
	}
</script>
<template>
	<ActionButton icon="mdi:printer-outline" @click="printCV" />
</template>
