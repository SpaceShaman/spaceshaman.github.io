<script setup lang="ts">
	import educations from '../data/educations.json'
</script>
<template>
	<Card title="Education">
		<CardItem
			v-for="(education, index) in educations"
			:key="index"
			:title="education.title"
			:subtitle="`${education.startDate} - ${education.endDate}`"
			:url="education.url"
			:description="education.institution"
		/>
	</Card>
</template>
