<script setup lang="ts">
	const aboutMe = await getAboutMe()
</script>
<template>
	<MDC :value="aboutMe" />
</template>
