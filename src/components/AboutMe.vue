<script setup lang="ts">
	const aboutMe = await getAboutMe()
</script>
<template>
	<Card title="About Me">
		<MDC :value="aboutMe" />
	</Card>
</template>
