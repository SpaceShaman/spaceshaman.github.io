<script setup lang="ts">
	import experiances from '~/data/experiances.json'
</script>
<template>
	<Card title="Work Experience">
		<CardItem
			v-for="(experiance, index) in experiances"
			:key="index"
			:title="experiance.title"
			:subtitle="`${experiance.startDate} - ${experiance.endDate}`"
			:url="experiance.url"
			:description="experiance.description"
		/>
	</Card>
</template>
