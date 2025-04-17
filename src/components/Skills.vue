<script setup lang="ts">
	const skills = await getSkills()
</script>
<template>
	<div class="flex flex-wrap justify-center gap-2">
		<a
			v-for="skill in skills"
			:key="skill.name"
			:href="skill.url"
			class="hover:badge-accent-content badge badge-outline badge-accent badge-sm"
			target="_blank"
		>
			{{ skill.name }}
		</a>
	</div>
</template>
